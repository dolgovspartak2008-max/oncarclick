/**
 * Таможенная пошлина для легковых автомобилей, ввозимых физическим лицом для личного пользования
 * (единые ставки ЕАЭС, Решение Совета ЕЭК № 107). Единственное место в проекте, где считается пошлина:
 * каталог, карточка, страница машины, сортировка и избранное берут результат отсюда.
 *
 * Порядок:
 * 1. официальная пошлина по ставкам — officialDuty;
 * 2. для машин строго младше 3 лет — коммерческая корректировка ON Car Click: клиент платит 60 % пошлины.
 *    Это скидка компании, а не изменение государственного платежа; оба значения хранятся отдельно.
 *
 * Ставки вынесены в таблицу ниже — при изменении законодательства правится только она.
 */
import { add, dec, div, gt, lte, max, mul, sub, toNumber, type Dec } from "./decimal";

/** Цена в евро «до X включительно» → процент и минимум за 1 см³ (машины не старше 3 лет). */
export const UNDER_3_BY_VALUE: ReadonlyArray<{ upToEur: number; percent: string; minEurPerCc: string }> = [
  { upToEur: 8_500, percent: "0.54", minEurPerCc: "2.5" },
  { upToEur: 16_700, percent: "0.48", minEurPerCc: "3.5" },
  { upToEur: 42_300, percent: "0.48", minEurPerCc: "5.5" },
  { upToEur: 84_500, percent: "0.48", minEurPerCc: "7.5" },
  { upToEur: 169_000, percent: "0.48", minEurPerCc: "15" },
  { upToEur: Infinity, percent: "0.48", minEurPerCc: "20" }
];
/** Объём «до X см³ включительно» → € за 1 см³ (старше 3, но не старше 5 лет). */
export const FROM_3_TO_5_BY_VOLUME: ReadonlyArray<{ upToCc: number; eurPerCc: string }> = [
  { upToCc: 1_000, eurPerCc: "1.5" },
  { upToCc: 1_500, eurPerCc: "1.7" },
  { upToCc: 1_800, eurPerCc: "2.5" },
  { upToCc: 2_300, eurPerCc: "2.7" },
  { upToCc: 3_000, eurPerCc: "3.0" },
  { upToCc: Infinity, eurPerCc: "3.6" }
];
/** Объём «до X см³ включительно» → € за 1 см³ (старше 5 лет). */
export const OVER_5_BY_VOLUME: ReadonlyArray<{ upToCc: number; eurPerCc: string }> = [
  { upToCc: 1_000, eurPerCc: "3.0" },
  { upToCc: 1_500, eurPerCc: "3.2" },
  { upToCc: 1_800, eurPerCc: "3.5" },
  { upToCc: 2_300, eurPerCc: "4.8" },
  { upToCc: 3_000, eurPerCc: "5.0" },
  { upToCc: Infinity, eurPerCc: "5.7" }
];
/** Доля пошлины, которую платит клиент за машину строго младше 3 лет (−40 %). */
export const YOUNG_CAR_CUSTOMER_SHARE = "0.60";
/** Если 3-я или 5-я годовщина ближе этого числа дней — расчёт помечается приблизительным. */
export const AGE_BOUNDARY_WINDOW_DAYS = 90;

export type EngineKind = "ice" | "hybrid" | "electric" | "unknown";
export type ProductionBasis = "production-month" | "registration-month" | "year-only";
export type AgeCategory = "under-3" | "3-5" | "over-5";
export type CalculationStatus = "exact" | "approximate" | "needs_review";

export type CustomsCarInput = {
  priceKrw: number | null;
  engineCc: number | null;
  engineKind: EngineKind;
  productionYear: number | null;
  productionMonth: number | null;
  productionBasis: ProductionBasis | null;
};

/** Официальные курсы ЦБ РФ на дату расчёта. */
export type OfficialRates = {
  eurRub: number;
  /** Рублей за 1 000 вон (так их публикует ЦБ). */
  krwRubPer1000: number;
  /** Дата, на которую установлены курсы, YYYY-MM-DD. */
  rateDate: string;
  source: string;
};

export type CustomsDuty = {
  calculationStatus: CalculationStatus;
  /** Почему расчёт приблизительный или требует уточнения. */
  notes: string[];
  ageCategory: AgeCategory | null;
  /** Строго младше 3 лет — применена коммерческая корректировка. */
  youngDiscount: boolean;
  /** Расчётная дата выпуска (15-е число месяца или 1 июля года), YYYY-MM-DD. */
  productionDate: string | null;
  productionBasis: ProductionBasis | null;
  /** Предполагаемая дата таможенного оформления (= дата расчёта), YYYY-MM-DD. */
  clearanceDate: string;
  priceEur: number | null;
  rateLabel: string | null;
  officialDutyEur: number | null;
  officialDutyRub: number | null;
  customerDutyRub: number | null;
  commercialAdjustmentRub: number | null;
  eurRub: number | null;
  krwRubPer1000: number | null;
  rateDate: string | null;
  calculatedAt: string;
};

const DAY_MS = 86_400_000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Дата оформления — сегодняшний день по Москве (курсы ЦБ и таможня живут по московскому времени). */
export function clearanceDay(now: Date) {
  const moscow = new Date(now.getTime() + 3 * 3_600_000);
  return Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth(), moscow.getUTCDate());
}

/**
 * Момент выпуска по правилам ЕЭК (Решение Коллегии № 74, приложение, п. 5):
 * известны год и месяц — 15-е число месяца; известен только год — 1 июля.
 */
export function productionMoment(year: number, month: number | null) {
  return month && month >= 1 && month <= 12 ? Date.UTC(year, month - 1, 15) : Date.UTC(year, 6, 1);
}

const anniversary = (moment: number, years: number) => {
  const date = new Date(moment);
  return Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate());
};

export function classifyAge(productionTime: number, clearanceTime: number) {
  const three = anniversary(productionTime, 3);
  const five = anniversary(productionTime, 5);
  const category: AgeCategory = clearanceTime <= three ? "under-3" : clearanceTime <= five ? "3-5" : "over-5";
  const nearBoundary = [three, five].some((boundary) => Math.abs(boundary - clearanceTime) <= AGE_BOUNDARY_WINDOW_DAYS * DAY_MS);
  return { category, youngDiscount: clearanceTime < three, nearBoundary };
}

const fmtEur = (value: string) => value.replace(".", ",");

function officialDutyEur(category: AgeCategory, priceEur: Dec, engineCc: Dec) {
  if (category === "under-3") {
    const band = UNDER_3_BY_VALUE.find((item) => lte(priceEur, dec(item.upToEur === Infinity ? "1e15" : item.upToEur)))!;
    const byValue = mul(priceEur, dec(band.percent));
    const byVolume = mul(engineCc, dec(band.minEurPerCc));
    return {
      duty: max(byValue, byVolume),
      label: `${Math.round(Number(band.percent) * 100)}% от стоимости, не менее ${fmtEur(band.minEurPerCc)} €/см³${gt(byVolume, byValue) ? " (применён минимум)" : ""}`
    };
  }
  const table = category === "3-5" ? FROM_3_TO_5_BY_VOLUME : OVER_5_BY_VOLUME;
  const band = table.find((item) => lte(engineCc, dec(item.upToCc === Infinity ? "1e15" : item.upToCc)))!;
  return { duty: mul(engineCc, dec(band.eurPerCc)), label: `${fmtEur(band.eurPerCc)} €/см³` };
}

/**
 * Считает пошлину по характеристикам машины. Ничего не подставляет вместо отсутствующих данных:
 * если считать нельзя — calculationStatus = "needs_review", суммы = null.
 */
export function calculateCustomsDuty(car: CustomsCarInput, rates: OfficialRates | null, now = new Date()): CustomsDuty {
  const clearanceTime = clearanceDay(now);
  const notes: string[] = [];
  const result: CustomsDuty = {
    calculationStatus: "needs_review", notes, ageCategory: null, youngDiscount: false,
    productionDate: null, productionBasis: car.productionBasis, clearanceDate: iso(clearanceTime),
    priceEur: null, rateLabel: null, officialDutyEur: null, officialDutyRub: null, customerDutyRub: null,
    commercialAdjustmentRub: null, eurRub: rates?.eurRub ?? null, krwRubPer1000: rates?.krwRubPer1000 ?? null,
    rateDate: rates?.rateDate ?? null, calculatedAt: now.toISOString()
  };

  if (car.engineKind === "electric") {
    notes.push("Электромобиль: ставки для ДВС не применяются, нужен отдельный расчёт пошлины.");
    return result;
  }
  if (car.engineKind === "unknown") {
    notes.push("Тип двигателя не определён — нужен отдельный расчёт пошлины.");
    return result;
  }
  const year = car.productionYear ?? 0;
  if (year < 1950 || year > new Date(clearanceTime).getUTCFullYear() + 1) {
    notes.push("Не указан год выпуска.");
    return result;
  }
  const productionTime = productionMoment(year, car.productionMonth);
  result.productionDate = iso(productionTime);
  if (productionTime > clearanceTime) {
    notes.push("Дата выпуска позже даты расчёта — проверьте данные.");
    return result;
  }
  const { category, youngDiscount, nearBoundary } = classifyAge(productionTime, clearanceTime);
  result.ageCategory = category;
  result.youngDiscount = youngDiscount;

  if (!car.engineCc || !Number.isFinite(car.engineCc) || car.engineCc <= 0) {
    notes.push("Не указан рабочий объём двигателя.");
    return result;
  }
  if (category === "under-3" && (!car.priceKrw || !Number.isFinite(car.priceKrw) || car.priceKrw <= 0)) {
    notes.push("Нет корректной цены автомобиля в вонах.");
    return result;
  }
  if (!rates || !(rates.eurRub > 0) || !(rates.krwRubPer1000 > 0)) {
    notes.push("Нет официальных курсов валют ЦБ.");
    return result;
  }

  const eurRub = dec(rates.eurRub);
  const krwRub = div(dec(rates.krwRubPer1000), dec(1_000)); // нормализация: ЦБ публикует за 1 000 ₩
  const priceEur = car.priceKrw && car.priceKrw > 0 ? div(mul(dec(car.priceKrw), krwRub), eurRub) : null;
  const { duty, label } = officialDutyEur(category, priceEur ?? dec(0), dec(Math.round(car.engineCc)));
  const officialRub = mul(duty, eurRub);
  const customerRub = youngDiscount ? mul(officialRub, dec(YOUNG_CAR_CUSTOMER_SHARE)) : officialRub;

  result.priceEur = priceEur === null ? null : toNumber(priceEur, 2);
  result.rateLabel = label;
  result.officialDutyEur = toNumber(duty, 2);
  result.officialDutyRub = toNumber(officialRub, 2);
  result.customerDutyRub = toNumber(customerRub, 2);
  result.commercialAdjustmentRub = toNumber(sub(officialRub, customerRub), 2);

  result.calculationStatus = "exact";
  if (car.productionBasis !== "production-month") {
    result.calculationStatus = "approximate";
    notes.push(car.productionBasis === "year-only"
      ? "Известен только год выпуска — возраст считаем от 1 июля."
      : "Месяц производства неизвестен — возраст считаем по месяцу регистрации.");
  }
  if (nearBoundary) {
    result.calculationStatus = "approximate";
    notes.push("Возраст близок к границе 3 или 5 лет: при уточнении даты выпуска или даты оформления пошлина может измениться.");
  }
  if (car.engineKind === "hybrid") {
    result.calculationStatus = "approximate";
    notes.push("Гибрид: посчитан по ставкам ДВС; для последовательного гибрида нужен отдельный расчёт.");
  }
  return result;
}

/** Сумма в цене: базовая часть без пошлины и утильсбора + утильсбор + пошлина клиента. Округление — только здесь. */
export function sumRub(parts: Array<number | null | undefined>) {
  return toNumber(parts.reduce<Dec>((total, part) => add(total, dec(part ?? 0)), dec(0)), 0);
}
