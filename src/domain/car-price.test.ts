import { describe, expect, test } from "vitest";
import { priceWithCustoms, sortByFinalPrice } from "./car-price";
import { normalizeTrustEncarRecords, parseYearMonth } from "./trust-encar";
import type { OfficialRates } from "./customs-duty";

const NOW = new Date("2026-11-11T09:00:00Z");
/** Курсы ЦБ на 11.11.2026 — по ним Trust Encar посчитал записи ниже. */
const CBR: OfficialRates = { eurRub: 92.39, krwRubPer1000: 60.94, rateDate: "2026-11-11", source: "test" };

/** Реальные записи Trust Encar от 11.11.2026 (сокращены до нужных полей). */
const GRANDEUR = {
  ID: "43139186", MARKA_NAME: "Hyundai", MODEL_NAME: "Grandeur", YEAR: "2018", MONTH: "2018.02",
  PRODUCTION_LABEL: "01.2018", REGISTRATION_LABEL: "02.2018", ENG_V: "2999", POWER_TEXT: "266 л.с.", TIME: "G",
  FINISH: "7300000", FINISH_RUB: "5900536", TAMOG_P: "1385000", UTIL: "3660000", IMAGES: "[]"
};
const BMW_X5 = {
  ID: "43139200", MARKA_NAME: "BMW", MODEL_NAME: "X5", YEAR: "2024", MONTH: "2024.01",
  PRODUCTION_LABEL: "09.2023", REGISTRATION_LABEL: "01.2024", ENG_V: "2998", POWER_TEXT: "381 л.с.", TIME: "G",
  FINISH: "82000000", FINISH_RUB: "10473658", TAMOG_P: "831000", UTIL: "4094400", IMAGES: "[]"
};
const BMW_X3_YOUNG = {
  ID: "43139119", MARKA_NAME: "BMW", MODEL_NAME: "X3", YEAR: "2025", MONTH: "2025.12",
  PRODUCTION_LABEL: "08.2025", REGISTRATION_LABEL: "12.2025", ENG_V: "1984", POWER_TEXT: "272 л.с.", TIME: "G",
  FINISH: "86500000", FINISH_RUB: "9504878", TAMOG_P: "2530000", UTIL: "1142400", IMAGES: "[]"
};
const EV = {
  ID: "43139168", MARKA_NAME: "Kia", MODEL_NAME: "Ray EV", YEAR: "2024", MONTH: "2024.10",
  PRODUCTION_LABEL: "09.2024", ENG_V: "111", POWER_TEXT: "125 кВт", TIME: "E", HAS_ELECTRIC_POWER: "1", HAS_COMBUSTION_POWER: "1",
  FINISH: "21800000", FINISH_RUB: "2276623", TAMOG_P: "199000", UTIL: "3400", IMAGES: "[]"
};

const priced = (raw: Record<string, string>) => priceWithCustoms(normalizeTrustEncarRecords([raw], NOW)[0], CBR, NOW);

describe("итоговая цена: без двойного начисления", () => {
  test("пошлина и утильсбор источника вычитаются, наши — прибавляются один раз", () => {
    const car = priced(GRANDEUR);
    expect(car.sourcePriceRub).toBe(5_900_536);
    expect(car.priceBaseRub).toBe(5_900_536 - 1_385_000 - 3_660_000);
    expect(car.recyclingFeeRub).toBe(3_660_000); // таблица ON Car Click совпала с источником
    expect(car.customs?.ageCategory).toBe("over-5");
    expect(car.customs?.officialDutyEur).toBe(2_999 * 5);
    expect(car.dutyRub).toBeCloseTo(14_995 * 92.39, 2);
    // итог совпадает с ценой источника с точностью до его округления пошлины до тысяч
    expect(Math.abs(car.priceRub! - 5_900_536)).toBeLessThan(1_000);
    expect(car.priceRub).toBe(Math.round(car.priceBaseRub! + car.recyclingFeeRub! + car.dutyRub!));
  });

  test("машина 3–5 лет: возраст по дате производства (09.2023), а не по регистрации (01.2024)", () => {
    const car = priced(BMW_X5);
    expect(car.productionYear).toBe(2023);
    expect(car.productionMonth).toBe(9);
    expect(car.customs?.ageCategory).toBe("3-5");
    expect(car.customs?.officialDutyEur).toBe(2_998 * 3);
    expect(Math.abs(car.dutyRub! - 831_000)).toBeLessThan(1_000);
    expect(car.customs?.commercialAdjustmentRub).toBe(0);
  });

  test("машина младше 3 лет: официальная пошлина как у источника, клиенту — 60 %", () => {
    const car = priced(BMW_X3_YOUNG);
    expect(car.customs?.ageCategory).toBe("under-3");
    expect(car.customs?.youngDiscount).toBe(true);
    expect(Math.abs(car.customs!.officialDutyRub! - 2_530_000)).toBeLessThan(1_000);
    expect(car.dutyRub).toBeCloseTo(car.customs!.officialDutyRub! * 0.6, 1);
    // скидка только на пошлину: всё остальное как было
    const withoutDiscount = car.priceBaseRub! + car.recyclingFeeRub! + car.customs!.officialDutyRub!;
    expect(withoutDiscount - car.priceRub!).toBeCloseTo(car.customs!.commercialAdjustmentRub!, -1);
  });

  test("электромобиль: пошлину не выдумываем — остаётся расчёт источника и пометка «требует уточнения»", () => {
    const car = priced(EV);
    expect(car.engineKind).toBe("electric");
    expect(car.customs?.calculationStatus).toBe("needs_review");
    expect(car.dutySource).toBe("source");
    expect(car.dutyRub).toBe(199_000);
    expect(car.priceRub).toBe(car.priceBaseRub! + car.recyclingFeeRub! + 199_000);
  });

  test("повторный расчёт не накапливает пошлину", () => {
    const once = priced(GRANDEUR);
    const twice = priceWithCustoms(priceWithCustoms(once, CBR, NOW), CBR, NOW);
    expect(twice.priceRub).toBe(once.priceRub);
  });

  test("без курсов цена не занижается: берётся пошлина источника", () => {
    const car = priceWithCustoms(normalizeTrustEncarRecords([GRANDEUR], NOW)[0], null, NOW);
    expect(car.customs?.calculationStatus).toBe("needs_review");
    expect(car.priceRub).toBe(5_900_536);
  });
});

describe("разбор дат источника", () => {
  test.each([["09.2023", 2023, 9], ["~ 09.2023", 2023, 9], ["2018.02", 2018, 2], ["202303", 2023, 3], ["2023-03", 2023, 3]])(
    "%s", (value, year, month) => expect(parseYearMonth(value)).toEqual({ year, month }));
  test("мусор не разбирается", () => expect(parseYearMonth("13.2023")).toBeNull());
});

describe("сортировка по итоговой цене", () => {
  test("цена по возрастанию, машины без цены — в конце", () => {
    const items = [{ priceRub: 3 }, { priceRub: null }, { priceRub: 1 }];
    expect(sortByFinalPrice(items, "price-asc").map((item) => item.priceRub)).toEqual([1, 3, null]);
    expect(sortByFinalPrice(items, "price-desc").map((item) => item.priceRub)).toEqual([3, 1, null]);
    expect(sortByFinalPrice(items, "newest")).toBe(items);
  });
});
