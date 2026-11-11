import { sourcePriceWindow, type CatalogFilters, type CatalogSort } from "./catalog";
import { calculateRecyclingFee, parseMonth } from "./recycling-fee";
import { provisionalPrice, withExpenses, type PricingFields } from "./car-price";
import type { EngineKind, ProductionBasis } from "./customs-duty";

export type TrustEncarBootstrap = {
  ajaxUrl: string;
  nonce: string;
  total: number;
  makes: Array<{ id: string; name: string }>;
};

export type CatalogCar = PricingFields & {
  id: string;
  slug: string;
  make: string;
  model: string;
  trim: string | null;
  generation: string | null;
  year: number;
  month: number | null;
  mileageKm: number;
  engineCc: number | null;
  powerHp: number | null;
  fuel: string | null;
  transmission: string | null;
  drive: string | null;
  bodyType: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  vin: string | null;
  priceKrw: number;
  /** Цена Trust Encar «до Владивостока» как есть: уже включает его пошлину и его утильсбор. */
  sourcePriceRub: number | null;
  /** Утильсбор, заложенный источником в sourcePriceRub. */
  sourceRecyclingFeeRub: number | null;
  /** Машина в Корее + расходы ON Car Click (src/domain/expenses.ts), без пошлины и утильсбора. */
  priceBaseRub: number | null;
  /** Утильсбор по таблице ON Car Click; если не хватает мощности — утильсбор источника (recyclingFeeSource = "source"). */
  recyclingFeeRub: number | null;
  recyclingFeeSource: "table" | "source" | null;
  /** Итоговая цена: priceBaseRub + утильсбор + пошлина клиента (см. src/domain/car-price.ts). */
  priceRub: number | null;
  photos: string[];
  details: Record<string, unknown>;
};

const numberFrom = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const textFrom = (value: unknown) => String(value ?? "").trim();
const slugPart = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function parseTrustEncarBootstrap(html: string): TrustEncarBootstrap {
  const configMatch = html.match(/(?:var\s+|window\.)TE_CATALOG\s*=\s*(\{.*?\});/s);
  const ssrMatch = html.match(/window\.TE_CATALOG_SSR\s*=\s*(\{.*?\});/s);
  if (!configMatch || !ssrMatch) throw new Error("Trust Encar не вернул конфигурацию каталога");

  const config = JSON.parse(configMatch[1]) as { ajaxUrl?: unknown; nonce?: unknown };
  const ssr = JSON.parse(ssrMatch[1]) as {
    total?: unknown;
    facets?: { facets?: { marks?: Array<{ value?: unknown; name?: unknown }> } };
  };
  const ajaxUrl = textFrom(config.ajaxUrl);
  const nonce = textFrom(config.nonce);
  const url = new URL(ajaxUrl);
  if (url.protocol !== "https:" || (url.hostname !== "trust-encar.ru" && !url.hostname.endsWith(".trust-encar.ru"))) {
    throw new Error("Trust Encar вернул недопустимый адрес каталога");
  }
  if (!nonce) throw new Error("Trust Encar не вернул ключ публичного каталога");

  const makes = (ssr.facets?.facets?.marks ?? []).flatMap((mark) => {
    const id = textFrom(mark.value);
    const name = textFrom(mark.name);
    return id && name ? [{ id, name }] : [];
  });
  return { ajaxUrl, nonce, total: numberFrom(ssr.total), makes };
}

function parseImages(value: unknown) {
  let values: unknown[] = [];
  if (Array.isArray(value)) values = value;
  else if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) values = parsed;
    } catch {}
  }
  return values.flatMap((item) => {
    try {
      const url = new URL(textFrom(item));
      if (url.protocol !== "https:") return [];
      if (url.hostname === "trust-encar.ru") return [`${url.origin}${url.pathname}`];
      if (url.hostname === "ci.encar.com") return [`https://trust-encar.ru/images/${url.pathname.replace(/^\//, "")}`];
    } catch {}
    return [];
  });
}

/** Число из поля источника; null — поля нет совсем (не путать с честным нулём). */
function optionalNumber(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = numberFrom(value);
  return parsed >= 0 ? parsed : null;
}

/** «09.2023», «~ 09.2023», «2023.09», «2023-09», «202309» → год и месяц. */
export function parseYearMonth(value: unknown): { year: number; month: number } | null {
  const text = String(value ?? "").replace(/[~≈\s]/g, "");
  const match = text.match(/^(\d{1,2})[./-](\d{4})$/) ?? text.match(/^(\d{4})[./-]?(\d{1,2})$/);
  if (!match) return null;
  const [a, b] = [Number(match[1]), Number(match[2])];
  const [year, month] = a > 12 ? [a, b] : [b, a];
  return year >= 1950 && month >= 1 && month <= 12 ? { year, month } : null;
}

/**
 * Дата выпуска для таможни: сначала дата производства (PRODUCTION_LABEL), затем месяц регистрации, затем только год.
 * Год берём из той же даты: машина, выпущенная в 09.2023 и зарегистрированная в 01.2024, для таможни — 2023 года.
 */
export function productionOf(raw: Record<string, unknown>, year: number): {
  productionYear: number | null; productionMonth: number | null; productionBasis: ProductionBasis | null;
} {
  const produced = parseYearMonth(raw.PRODUCTION_LABEL);
  if (produced) return { productionYear: produced.year, productionMonth: produced.month, productionBasis: "production-month" };
  const registered = parseYearMonth(raw.MONTH) ?? parseYearMonth(raw.REGISTRATION_LABEL);
  if (registered) return { productionYear: registered.year, productionMonth: registered.month, productionBasis: "registration-month" };
  return year >= 1950 ? { productionYear: year, productionMonth: null, productionBasis: "year-only" } : { productionYear: null, productionMonth: null, productionBasis: null };
}

/** Тип силовой установки по коду топлива источника. */
export function engineKindOf(fuelCode: string, raw: Record<string, unknown> = {}): EngineKind {
  const code = fuelCode.toUpperCase();
  if (code === "E") return "electric";
  if (/\+E$|^E\+/.test(code)) return "hybrid";
  if (["G", "D", "LPG", "LPGP", "L", "G+L", "CNG"].includes(code)) return "ice";
  const electric = String(raw.HAS_ELECTRIC_POWER ?? "") === "1";
  const combustion = String(raw.HAS_COMBUSTION_POWER ?? "") === "1";
  if (combustion && !electric) return "ice";
  if (electric && !combustion) return "electric";
  return "unknown";
}

export function normalizeTrustEncarRecords(records: unknown[], now = new Date()): CatalogCar[] {
  return records.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const raw = record as Record<string, unknown>;
    const id = textFrom(raw.ID || raw.LOT);
    const make = textFrom(raw.MARKA_NAME);
    const model = textFrom(raw.MODEL_NAME);
    if (!id || !make || !model) return [];
    const fuelCode = textFrom(raw.TIME);
    const year = numberFrom(raw.YEAR);
    const month = parseMonth(raw.MONTH) ?? parseMonth(raw.REGISTRATION_LABEL);
    const engineCc = numberFrom(raw.ENG_V) || null;
    const powerHp = numberFrom(textFrom(raw.POWER_TEXT).match(/\d+/)?.[0]) || null;
    const sourcePriceRub = numberFrom(raw.FINISH_RUB) || null;
    const sourceDutyRub = optionalNumber(raw.TAMOG_P);
    const sourceRecyclingFeeRub = optionalNumber(raw.UTIL);
    // Цена источника уже содержит его пошлину и утильсбор — вычитаем, чтобы не начислить их второй раз.
    const sourceBaseRub = sourcePriceRub ? sourcePriceRub - (sourceDutyRub ?? 0) - (sourceRecyclingFeeRub ?? 0) : null;
    const carPriceKoreaRub = numberFrom(raw.PRICE_KOREA_RUB) || null;
    const fee = calculateRecyclingFee({ engineCc, powerHp, year, month }, now);
    const recyclingFeeRub = fee?.feeRub ?? sourceRecyclingFeeRub;
    const recyclingFeeSource = fee ? "table" : sourceRecyclingFeeRub != null ? "source" : null;
    const fuel = (({ G: "Бензин", D: "Дизель", E: "Электро", "G+E": "Гибрид", LPGP: "Газ" } as Record<string, string>)[fuelCode] ?? fuelCode) || null;
    const production = productionOf(raw, year);

    return [provisionalPrice(withExpenses({
      id,
      slug: `${slugPart(make)}-${slugPart(model)}-${slugPart(id)}`,
      make,
      model,
      trim: textFrom(raw.GRADE) || null,
      generation: textFrom(raw.GENERATION_SHOW || raw.GENERATION_EN) || null,
      year,
      month,
      mileageKm: numberFrom(raw.MILEAGE),
      engineCc,
      powerHp,
      fuel,
      transmission: textFrom(raw.KPP) || null,
      drive: textFrom(raw.PRIV) || null,
      bodyType: textFrom(raw.KUZOV) || null,
      exteriorColor: textFrom(raw.COLOR) || null,
      interiorColor: textFrom(raw.SEAT_COLOR) || null,
      vin: textFrom(raw.VEHICLENO) || null,
      priceKrw: numberFrom(raw.FINISH),
      sourcePriceRub,
      sourceDutyRub,
      sourceRecyclingFeeRub,
      carPriceKoreaRub,
      expenses: null,
      sourceBaseRub,
      priceBaseRub: sourceBaseRub,
      recyclingFeeRub,
      recyclingFeeSource,
      ...production,
      engineKind: engineKindOf(fuelCode, raw),
      dutyRub: null,
      dutySource: null,
      customs: null,
      priceRub: null,
      photos: parseImages(raw.IMAGES),
      details: {
        sourceStatus: raw.STATUS_LABEL_RU ?? raw.STATUS ?? null,
        registration: raw.REGISTRATION_LABEL ?? raw.MONTH ?? null,
        accidentCount: numberFrom(raw.ACCIDENT_COUNT_SUM),
        accidentPayoutRub: numberFrom(raw.ACCIDENT_COST_RUB_SUM)
      }
    }, now))];
  });
}

const sortFields: Record<CatalogSort, [string, "ASC" | "DESC"]> = {
  newest: ["CREATED_DATE", "DESC"],
  mileage: ["MILEAGE", "ASC"],
  "price-asc": ["FINISH_RUB", "ASC"],
  "price-desc": ["FINISH_RUB", "DESC"]
};

export function buildTrustEncarSearchBody(
  action: "search_db" | "ajax_catalog_count_db",
  filters: CatalogFilters,
  bootstrap: Pick<TrustEncarBootstrap, "nonce" | "makes">,
  modelId?: string,
  upstreamPage = filters.page - 1
) {
  const body = new URLSearchParams({
    action,
    nonce: bootstrap.nonce,
    page: String(upstreamPage)
  });
  const make = bootstrap.makes.find((item) => item.name.toLowerCase() === filters.make?.toLowerCase());
  if (make) body.set("marka_id", make.id);
  if (modelId) body.set("model_id", modelId);
  if (filters.engineCc) {
    body.set("engine_from", String(Math.max(0, filters.engineCc - 50)));
    body.set("engine_to", String(filters.engineCc + 50));
  }
  if (filters.yearFrom) body.set("year_from", String(filters.yearFrom));
  if (filters.yearTo) body.set("year_to", String(filters.yearTo));
  if (filters.mileageTo) body.set("mileage_to", String(filters.mileageTo));
  const price = sourcePriceWindow(filters);
  if (price.from) body.set("priceRubFrom", String(price.from));
  if (price.to) body.set("priceRubTo", String(price.to));
  const [field, order] = sortFields[filters.sort];
  body.set("field_sort", field);
  body.set("order_by", order);
  return body;
}

export type TrustEncarGeneration = { name: string; minYear: number; maxYear: number };

const facetsOf = (value: unknown) =>
  value && typeof value === "object" ? ((value as { facets?: Record<string, unknown> }).facets ?? {}) : {};

/** Поколения модели с годами выпуска из ответа ajax_facets_state_db. */
export function parseTrustEncarGenerations(value: unknown): TrustEncarGeneration[] {
  const list = facetsOf(value).generations;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as { value?: unknown; name?: unknown; min_year?: unknown; max_year?: unknown };
    const name = textFrom(raw.name || raw.value);
    const minYear = numberFrom(raw.min_year);
    const maxYear = numberFrom(raw.max_year) || new Date().getFullYear();
    if (!name || minYear < 1900 || maxYear < minYear || seen.has(name)) return [];
    seen.add(name);
    return [{ name, minYear, maxYear }];
  }).sort((a, b) => b.minYear - a.minYear);
}

/** Комплектации, если источник отдаёт их в фасетах. */
export function parseTrustEncarTrimsFacet(value: unknown): string[] {
  const facets = facetsOf(value);
  const list = [facets.grades, facets.grade, facets.trims, facets.complectations].find(Array.isArray) as unknown[] | undefined;
  if (!list) return [];
  return uniqueSorted(list.map((item) => item && typeof item === "object"
    ? textFrom((item as { name?: unknown; value?: unknown }).name || (item as { value?: unknown }).value)
    : textFrom(item)));
}

export function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => textFrom(v)).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
}

/** Пересечение выбранного года и годов поколения. null — пересечения нет. */
export function resolveYearRange(
  filters: Pick<CatalogFilters, "yearFrom" | "yearTo">,
  generation?: TrustEncarGeneration
): { yearFrom?: number; yearTo?: number } | null {
  let yearFrom = filters.yearFrom;
  let yearTo = filters.yearTo;
  if (generation) {
    yearFrom = Math.max(yearFrom ?? generation.minYear, generation.minYear);
    yearTo = Math.min(yearTo ?? generation.maxYear, generation.maxYear);
  }
  if (yearFrom && yearTo && yearFrom > yearTo) return null;
  return { yearFrom, yearTo };
}

export const sameText = (a: unknown, b: unknown) => textFrom(a).toLowerCase() === textFrom(b).toLowerCase();
