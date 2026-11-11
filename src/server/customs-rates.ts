import { unstable_cache } from "next/cache";
import type { OfficialRates } from "@/domain/customs-duty";
import { getCatalog } from "./trust-encar";

/**
 * Официальные курсы ЦБ РФ (EUR и KRW) для расчёта пошлины. Не путать с коммерческим курсом воны из бота
 * (src/server/rate.ts) — тот меняет только цену машины в Корее, а пошлина всегда считается по ЦБ.
 * Источники по очереди: cbr.ru → зеркало cbr-xml-daily.ru → курсы ЦБ со страницы машины Trust Encar.
 */

const toNumber = (value: string) => Number(value.replace(/\s/g, "").replace(",", "."));
const isoFromRu = (value: string) => {
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};
const valid = (rates: OfficialRates) =>
  rates.eurRub > 10 && rates.eurRub < 1_000 && rates.krwRubPer1000 > 1 && rates.krwRubPer1000 < 1_000 ? rates : null;

/** Ответ https://www.cbr.ru/scripts/XML_daily.asp. Курс воны ЦБ публикует за 1 000 ₩ — нормализуем по <Nominal>. */
export function parseCbrXml(xml: string): OfficialRates | null {
  const rateDate = isoFromRu(xml.match(/<ValCurs[^>]*Date="([^"]+)"/)?.[1] ?? "");
  const perUnit = (code: string) => {
    const block = xml.split("<Valute").find((part) => part.includes(`<CharCode>${code}</CharCode>`));
    if (!block) return null;
    const nominal = toNumber(block.match(/<Nominal>([^<]+)<\/Nominal>/)?.[1] ?? "");
    const value = toNumber(block.match(/<Value>([^<]+)<\/Value>/)?.[1] ?? "");
    return nominal > 0 && value > 0 ? value / nominal : null;
  };
  const eur = perUnit("EUR");
  const krw = perUnit("KRW");
  if (!rateDate || !eur || !krw) return null;
  return valid({ eurRub: eur, krwRubPer1000: Number((krw * 1_000).toFixed(6)), rateDate, source: "cbr.ru" });
}

/** Ответ https://www.cbr-xml-daily.ru/daily_json.js (зеркало курсов ЦБ). */
export function parseCbrJson(json: unknown): OfficialRates | null {
  const data = json as { Date?: string; Valute?: Record<string, { Nominal?: number; Value?: number }> };
  const eur = data?.Valute?.EUR;
  const krw = data?.Valute?.KRW;
  if (!data?.Date || !eur?.Value || !eur.Nominal || !krw?.Value || !krw.Nominal) return null;
  return valid({
    eurRub: eur.Value / eur.Nominal,
    krwRubPer1000: Number((krw.Value / krw.Nominal * 1_000).toFixed(6)),
    rateDate: data.Date.slice(0, 10),
    source: "cbr-xml-daily.ru"
  });
}

/** «Расчетные курсы на 11.11.2026 … Курс воны по ЦБ 1 000 ₩ = 60,94 ₽ Курс евро по ЦБ 1 € = 92,39 ₽». */
export function parseTrustEncarOfficialRates(html: string): OfficialRates | null {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
  const krw = text.match(/Курс воны по ЦБ\s*([\d\s]+)\s*₩\s*=\s*([\d\s,.]+)\s*₽/i);
  const eur = text.match(/Курс евро по ЦБ\s*1\s*€\s*=\s*([\d\s,.]+)\s*₽/i);
  const rateDate = isoFromRu(text.match(/Расч[её]тные курсы на\s*(\d{2}\.\d{2}\.\d{4})/i)?.[1] ?? "");
  if (!krw || !eur || !rateDate) return null;
  const units = toNumber(krw[1]);
  return valid({ eurRub: toNumber(eur[1]), krwRubPer1000: toNumber(krw[2]) / units * 1_000, rateDate, source: "trust-encar.ru (курсы ЦБ)" });
}

/** Сегодняшняя дата по Москве в форматах ЦБ. */
export function moscowDate(now = new Date()) {
  const moscow = new Date(now.getTime() + 3 * 3_600_000);
  const dd = String(moscow.getUTCDate()).padStart(2, "0");
  const mm = String(moscow.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = moscow.getUTCFullYear();
  return { iso: `${yyyy}-${mm}-${dd}`, cbr: `${dd}/${mm}/${yyyy}`, path: `${yyyy}/${mm}/${dd}` };
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const OPTIONS = { signal: undefined as AbortSignal | undefined, cache: "no-store" as const, headers: { "User-Agent": "Mozilla/5.0 (compatible; OnCarClick/1.0)" } };

export async function fetchOfficialRates(now = new Date(), fetcher: Fetcher = fetch): Promise<OfficialRates | null> {
  const day = moscowDate(now);
  const attempts: Array<() => Promise<OfficialRates | null>> = [
    async () => {
      const response = await fetcher(`https://www.cbr.ru/scripts/XML_daily.asp?date_req=${day.cbr}`, { ...OPTIONS, signal: AbortSignal.timeout(8_000) });
      return response.ok ? parseCbrXml(new TextDecoder("latin1").decode(await response.arrayBuffer())) : null;
    },
    async () => {
      const response = await fetcher("https://www.cbr-xml-daily.ru/daily_json.js", { ...OPTIONS, signal: AbortSignal.timeout(8_000) });
      return response.ok ? parseCbrJson(await response.json()) : null;
    },
    async () => {
      const catalog = await getCatalog({ page: 1, limit: 24, sort: "newest" });
      for (const car of catalog.items.slice(0, 3)) {
        const response = await fetcher(`https://trust-encar.ru/auto/${car.id}/`, { ...OPTIONS, signal: AbortSignal.timeout(10_000) });
        const rates = response.ok ? parseTrustEncarOfficialRates(await response.text()) : null;
        if (rates) return rates;
      }
      return null;
    }
  ];
  for (const attempt of attempts) {
    const rates = await attempt().catch(() => null);
    if (rates) return rates;
  }
  return null;
}

/** Курсы кешируются на 3 часа и отдельно на каждый день — после полуночи по Москве берутся курсы нового дня. */
const cachedRates = unstable_cache(
  async (_day: string) => {
    const rates = await fetchOfficialRates();
    if (!rates) throw new Error("Нет курсов ЦБ"); // не кешируем неудачу
    return rates;
  },
  ["cbr-official-rates-v1"],
  { revalidate: 3 * 3_600, tags: ["official-rates"] }
);

export async function getOfficialRates(now = new Date()): Promise<OfficialRates | null> {
  try { return await cachedRates(moscowDate(now).iso); } catch { return null; }
}
