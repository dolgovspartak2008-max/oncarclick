import { load } from "cheerio";

/** Подробности автомобиля со страницы trust-encar.ru/auto/{id}/ */
export type VehiclePage = {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  mileageKm: number;
  engineCc: number | null;
  powerHp: number | null;
  fuel: string | null;
  transmission: string | null;
  color: string | null;
  /** «Стоимость до Владивостока» — уже с пошлиной и утильсбором источника. */
  priceRub: number | null;
  /** Цена машины в Корее, ₩. */
  priceKrw: number | null;
  /** Строки «Подробного расчёта» источника: таможенная пошлина и утильсбор, ₽. */
  sourceDutyRub: number | null;
  sourceRecyclingFeeRub: number | null;
  photos: string[];
  /** Все характеристики «как на источнике»: подпись → значение. */
  specs: Array<{ label: string; value: string }>;
  optionGroups: Array<{ title: string; items: string[] }>;
  insurance: string | null;
};

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const numberFrom = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Подписи, которые не показываем посетителю: внутренняя кухня источника и цены в чужой разбивке. */
const HIDDEN_SPECS = /стоимост|цена|комисси|брокер|лот|trust|encar|ссылк|статус|номер/i;

export function safeTrustEncarImage(value: string) {
  try {
    const url = new URL(value, "https://trust-encar.ru");
    if (url.protocol !== "https:") return "";
    if (url.hostname === "trust-encar.ru") return `${url.origin}${url.pathname}`;
    if (url.hostname === "ci.encar.com") return `https://trust-encar.ru/images/${url.pathname.replace(/^\//, "")}`;
  } catch {}
  return "";
}

export function parseTrustEncarVehiclePage(html: string): VehiclePage | null {
  const $ = load(html);
  let vehicle: Record<string, unknown> | null = null;
  $("script[type='application/ld+json']").each((_, element) => {
    if (vehicle) return;
    try {
      const value = JSON.parse($(element).text()) as Record<string, unknown>;
      const candidates = [value, ...(Array.isArray(value["@graph"]) ? value["@graph"] as unknown[] : [])];
      const found = candidates.find((candidate) => {
        if (!candidate || typeof candidate !== "object") return false;
        const raw = candidate as Record<string, unknown>;
        const types = Array.isArray(raw["@type"]) ? raw["@type"].map(String) : [String(raw["@type"] || "")];
        return types.some((type) => type === "Vehicle" || type === "Car") && Boolean(raw.sku);
      });
      if (found) vehicle = found as Record<string, unknown>;
    } catch {}
  });
  if (!vehicle) return null;
  const data = vehicle as Record<string, unknown>;
  const obj = (value: unknown) => (value && typeof value === "object" ? value as Record<string, unknown> : {});
  const engine = obj(data.vehicleEngine);

  $(".auto-item").remove(); // блоки «похожие автомобили»
  const specs: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();
  $(".product-option").each((_, element) => {
    const item = $(element);
    const label = clean(item.find(".product-option-label").first().text()).replace(/:\s*$/, "");
    const copy = item.clone();
    copy.find(".product-option-label, .te-car-color-swatch").remove();
    const value = clean(copy.text());
    if (!label || !value || seen.has(label) || HIDDEN_SPECS.test(label)) return;
    seen.add(label);
    specs.push({ label, value });
  });
  const spec = (label: string) => specs.find((item) => item.label === label)?.value ?? "";

  const optionGroups = $(".product-descr").toArray().flatMap((element) => {
    const group = $(element);
    const title = clean(group.find("h3").first().text()).replace(/\s*\(\d+\s+опци(?:я|и|й)\)\s*$/i, "");
    const items = group.find("ul.product-option li.is-active").toArray().map((item) => clean($(item).text())).filter(Boolean);
    return title && items.length ? [{ title, items }] : [];
  });

  const pageText = clean($("body").text());
  const insurance = pageText.match(/Страховая история:\s*повреждения этого автомобиля\s*(.*?)\s*Страховая история:\s*повреждения другого автомобиля/i)?.[1]?.trim() || null;
  const images = (Array.isArray(data.image) ? data.image : [data.image]).map((image) => safeTrustEncarImage(clean(image))).filter(Boolean);
  const offers = obj(data.offers);
  const visiblePrice = numberFrom(pageText.match(/Стоимость до (?:города )?Владивостока:\s*~?\s*([\d\s]+)\s*₽/i)?.[1]);

  const rubLine = (label: string) => {
    const match = pageText.match(new RegExp(`${label}:\\s*([\\d\\s]+?)\\s*₽`, "i"));
    return match ? numberFrom(match[1]) : null;
  };
  const koreaKrw = numberFrom(pageText.match(/Стоимость автомобиля в Корее:\s*([\d\s]+?)\s*₩/i)?.[1]) || null;

  const id = clean(data.sku);
  const make = clean(obj(data.brand).name);
  const model = clean(data.model);
  if (!id || !make || !model) return null;
  return {
    id,
    make,
    model,
    trim: clean(data.vehicleConfiguration) || null,
    year: numberFrom(data.productionDate) || numberFrom(data.modelDate),
    mileageKm: numberFrom(obj(data.mileageFromOdometer).value),
    engineCc: numberFrom(obj(engine.engineDisplacement).value) || null,
    powerHp: numberFrom(spec("Мощность").match(/[\d\s]+/)?.[0]) || null,
    fuel: clean(data.fuelType) || null,
    transmission: clean(data.vehicleTransmission) || spec("Коробка") || null,
    color: spec("Цвет кузова") || clean(data.color) || null,
    priceRub: numberFrom(offers.price) || visiblePrice || null,
    priceKrw: koreaKrw,
    sourceDutyRub: rubLine("Таможенная пошлина"),
    sourceRecyclingFeeRub: rubLine("Утилизационный сбор"),
    photos: Array.from(new Set(images)),
    specs,
    optionGroups,
    insurance
  };
}
