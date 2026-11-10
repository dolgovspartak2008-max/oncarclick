import type { CatalogFilters, CatalogSort } from "./catalog";

export type TrustEncarBootstrap = {
  ajaxUrl: string;
  nonce: string;
  total: number;
  makes: Array<{ id: string; name: string }>;
};

export type CatalogCar = {
  id: string;
  slug: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
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

export function normalizeTrustEncarRecords(records: unknown[]): CatalogCar[] {
  return records.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const raw = record as Record<string, unknown>;
    const id = textFrom(raw.ID || raw.LOT);
    const make = textFrom(raw.MARKA_NAME);
    const model = textFrom(raw.MODEL_NAME);
    if (!id || !make || !model) return [];
    const fuelCode = textFrom(raw.TIME);
    const fuel = (({ G: "Бензин", D: "Дизель", E: "Электро", "G+E": "Гибрид", LPGP: "Газ" } as Record<string, string>)[fuelCode] ?? fuelCode) || null;

    return [{
      id,
      slug: `${slugPart(make)}-${slugPart(model)}-${slugPart(id)}`,
      make,
      model,
      trim: textFrom(raw.GRADE) || null,
      year: numberFrom(raw.YEAR),
      mileageKm: numberFrom(raw.MILEAGE),
      engineCc: numberFrom(raw.ENG_V) || null,
      powerHp: numberFrom(textFrom(raw.POWER_TEXT).match(/\d+/)?.[0]) || null,
      fuel,
      transmission: textFrom(raw.KPP) || null,
      drive: textFrom(raw.PRIV) || null,
      bodyType: textFrom(raw.KUZOV) || null,
      exteriorColor: textFrom(raw.COLOR) || null,
      interiorColor: textFrom(raw.SEAT_COLOR) || null,
      vin: textFrom(raw.VEHICLENO) || null,
      priceKrw: numberFrom(raw.FINISH),
      priceRub: numberFrom(raw.FINISH_RUB) || null,
      photos: parseImages(raw.IMAGES),
      details: {
        sourceStatus: raw.STATUS_LABEL_RU ?? raw.STATUS ?? null,
        registration: raw.REGISTRATION_LABEL ?? raw.MONTH ?? null,
        accidentCount: numberFrom(raw.ACCIDENT_COUNT_SUM),
        accidentPayoutRub: numberFrom(raw.ACCIDENT_COST_RUB_SUM)
      }
    }];
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
  modelId?: string
) {
  const body = new URLSearchParams({
    action,
    nonce: bootstrap.nonce,
    page: String(filters.page - 1)
  });
  const make = bootstrap.makes.find((item) => item.name.toLowerCase() === filters.make?.toLowerCase());
  if (make) body.set("marka_id", make.id);
  if (modelId) body.set("model_id", modelId);
  if (filters.engineCc) {
    body.set("engine_from", String(Math.max(0, filters.engineCc - 50)));
    body.set("engine_to", String(filters.engineCc + 50));
  }
  const [field, order] = sortFields[filters.sort];
  body.set("field_sort", field);
  body.set("order_by", order);
  return body;
}
