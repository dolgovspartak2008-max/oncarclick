import { unstable_cache } from "next/cache";
import type { CatalogCar } from "@/domain/trust-encar";
import { select } from "./db";
import { getCatalog } from "./trust-encar";
import { getOfficialRates } from "./customs-rates";
import { priceWithCustoms } from "@/domain/car-price";

export const SETTINGS_TAG = "site-settings";

/** Наш курс воны из бота: рублей за 1 000 ₩. null — не задан, цены как у источника. */
export async function getOurKrwRate(): Promise<number | null> {
  try {
    const rows = await select<Array<{ value: { perThousand?: number } }>>("settings?key=eq.krw_rate&select=value", [SETTINGS_TAG], 300);
    const perThousand = Number(rows[0]?.value?.perThousand);
    return perThousand > 0 ? perThousand : null;
  } catch {
    return null;
  }
}

/** Курс, по которому Trust Encar пересчитывает цену машины в Корее: «Стоимость авто в Корее: 30 300 000 ₩ (1 965 864 ₽)». */
export function parseTrustEncarRate(html: string): number | null {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
  const match = text.match(/Стоимость авто(?:мобиля)? в Корее:?\s*([\d\s]+)\s*₩\s*\(?\s*~?\s*([\d\s]+)\s*₽/i);
  if (!match) return null;
  const krw = Number(match[1].replace(/\s/g, ""));
  const rub = Number(match[2].replace(/\s/g, ""));
  return krw > 0 && rub > 0 ? (rub / krw) * 1_000 : null;
}

async function fetchTrustEncarRate(sampleId: string): Promise<number | null> {
  const response = await fetch(`https://trust-encar.ru/auto/${sampleId}/`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  return response.ok ? parseTrustEncarRate(await response.text()) : null;
}

/** Курс источника берём с карточки свежей машины из каталога; он одинаков для всех машин. */
const cachedSourceRate = unstable_cache(async () => {
  const catalog = await getCatalog({ page: 1, limit: 24, sort: "newest" });
  for (const car of catalog.items.slice(0, 3)) {
    const rate = await fetchTrustEncarRate(car.id).catch(() => null);
    if (rate) return rate;
  }
  return null;
}, ["trust-encar-krw-rate-v2"], { revalidate: 6 * 3_600 });

export async function getSourceKrwRate(): Promise<number | null> {
  try { return await cachedSourceRate(); } catch { return null; }
}

/**
 * Разница курсов переносится на стоимость машины в Корее (priceBaseRub). Утильсбор и пошлина не меняются:
 * пошлина считается по официальному курсу ЦБ, а не по курсу из бота.
 */
export function applyKrwRate<T extends CatalogCar>(car: T, ourPerThousand: number | null, sourcePerThousand: number | null): T {
  if (!ourPerThousand || !sourcePerThousand || !car.priceKrw || !car.priceBaseRub) return car;
  const delta = Math.round(car.priceKrw * (ourPerThousand - sourcePerThousand) / 1_000);
  return { ...car, priceBaseRub: car.priceBaseRub + delta };
}

/**
 * Окончательная цена для всех мест сайта (каталог, страница машины, избранное, сортировка):
 * наш курс воны → цена в Корее, затем пошлина по курсам ЦБ → итог (src/domain/car-price.ts).
 */
export async function priceCars<T extends CatalogCar>(cars: T[], now = new Date()): Promise<T[]> {
  if (!cars.length) return cars;
  const [ours, official] = await Promise.all([getOurKrwRate(), getOfficialRates(now)]);
  const source = ours ? await getSourceKrwRate() : null;
  return cars.map((car) => priceWithCustoms(applyKrwRate(car, ours, source), official, now));
}

/** Прежнее имя — оставлено для совместимости. */
export const withOurRate = priceCars;
