import { describe, expect, test } from "vitest";
import { calculateCustomsDuty, classifyAge, productionMoment, type CustomsCarInput, type OfficialRates } from "./customs-duty";

/** Курсы ЦБ на 12.11.2026 — те же, что в расчёте Drom из ТЗ. */
const CBR: OfficialRates = { eurRub: 92.6968, krwRubPer1000: 61.5363, rateDate: "2026-11-12", source: "test" };
/** Удобные курсы: 1 € = 100 ₽, 1 000 ₩ = 1 ₽ → 1 € = 100 000 ₩. */
const SIMPLE: OfficialRates = { eurRub: 100, krwRubPer1000: 1, rateDate: "2026-11-12", source: "test" };
const eurToKrw = (eur: number) => eur * 100_000;
const NOW = new Date("2026-11-12T09:00:00Z");

const car = (overrides: Partial<CustomsCarInput>): CustomsCarInput => ({
  priceKrw: 118_000_000, engineCc: 2_993, engineKind: "ice",
  productionYear: 2025, productionMonth: 3, productionBasis: "production-month", ...overrides
});

describe("пошлина: пример Drom из ТЗ", () => {
  test("118 000 000 ₩, младше 3 лет, 2993 см³ → 48 %, клиенту 60 %", () => {
    const duty = calculateCustomsDuty(car({}), CBR, NOW);
    expect(duty.ageCategory).toBe("under-3");
    expect(duty.youngDiscount).toBe(true);
    expect(duty.calculationStatus).toBe("exact");
    expect(duty.priceEur).toBeCloseTo(78_334, 0);
    expect(duty.officialDutyEur).toBeCloseTo(37_600, 0);
    expect(Math.abs(duty.officialDutyRub! - 3_485_000)).toBeLessThan(1_000);
    expect(Math.abs(duty.customerDutyRub! - 2_091_000)).toBeLessThan(1_000);
    expect(Math.abs(duty.commercialAdjustmentRub! - 1_394_000)).toBeLessThan(1_000);
    // корректировка ровно 40 % от официальной пошлины, без потери копеек
    expect(duty.customerDutyRub! + duty.commercialAdjustmentRub!).toBeCloseTo(duty.officialDutyRub!, 2);
    expect(duty.commercialAdjustmentRub!).toBeCloseTo(duty.officialDutyRub! * 0.4, 1);
  });
});

describe("пошлина: контрольные примеры ТЗ по трём возрастам", () => {
  test("3–5 лет, 2993 см³ → 2993 × 3 = 8979 €, без снижения", () => {
    const duty = calculateCustomsDuty(car({ productionYear: 2022, productionMonth: 6 }), SIMPLE, NOW);
    expect(duty.ageCategory).toBe("3-5");
    expect(duty.officialDutyEur).toBe(8_979);
    expect(duty.customerDutyRub).toBe(897_900);
    expect(duty.commercialAdjustmentRub).toBe(0);
  });

  test("старше 5 лет, 2993 см³ → 2993 × 5 = 14965 €, без снижения", () => {
    const duty = calculateCustomsDuty(car({ productionYear: 2018, productionMonth: 1 }), SIMPLE, NOW);
    expect(duty.ageCategory).toBe("over-5");
    expect(duty.officialDutyEur).toBe(14_965);
    expect(duty.customerDutyRub).toBe(1_496_500);
    expect(duty.commercialAdjustmentRub).toBe(0);
  });

  test("младше 3 лет, 30 000 €, 2000 см³ → 14 400 €, корректировка 5760 €, клиенту 8640 €", () => {
    const duty = calculateCustomsDuty(car({ priceKrw: eurToKrw(30_000), engineCc: 2_000 }), SIMPLE, NOW);
    expect(duty.officialDutyEur).toBe(14_400);
    expect(duty.officialDutyRub).toBe(1_440_000);
    expect(duty.commercialAdjustmentRub).toBe(576_000);
    expect(duty.customerDutyRub).toBe(864_000);
  });
});

describe("пошлина: возраст", () => {
  test("момент выпуска: 15-е число месяца или 1 июля года", () => {
    expect(new Date(productionMoment(2023, 9)).toISOString().slice(0, 10)).toBe("2023-09-15");
    expect(new Date(productionMoment(2023, null)).toISOString().slice(0, 10)).toBe("2023-07-01");
  });

  test("ровно 3 года — ставки «до 3 лет», но без коммерческого снижения", () => {
    const exactly = new Date("2026-11-15T09:00:00Z");
    const duty = calculateCustomsDuty(car({ productionYear: 2023, productionMonth: 11 }), SIMPLE, exactly);
    expect(duty.ageCategory).toBe("under-3");
    expect(duty.youngDiscount).toBe(false);
    expect(duty.commercialAdjustmentRub).toBe(0);
    expect(duty.customerDutyRub).toBe(duty.officialDutyRub);
    expect(duty.calculationStatus).toBe("approximate"); // граница — помечаем
  });

  test("на день раньше трёх лет — снижение есть", () => {
    const dayBefore = new Date("2026-11-14T09:00:00Z");
    expect(calculateCustomsDuty(car({ productionYear: 2023, productionMonth: 11 }), SIMPLE, dayBefore).youngDiscount).toBe(true);
  });

  test("на день старше трёх лет — уже 3–5 лет", () => {
    const dayAfter = new Date("2026-11-16T09:00:00Z");
    expect(calculateCustomsDuty(car({ productionYear: 2023, productionMonth: 11 }), SIMPLE, dayAfter).ageCategory).toBe("3-5");
  });

  test("ровно 5 лет — ставки 3–5 лет, без снижения; на день старше — старше 5", () => {
    const exactly = calculateCustomsDuty(car({ productionYear: 2021, productionMonth: 11 }), SIMPLE, new Date("2026-11-15T09:00:00Z"));
    expect(exactly.ageCategory).toBe("3-5");
    expect(exactly.officialDutyEur).toBe(2_993 * 3);
    expect(exactly.commercialAdjustmentRub).toBe(0);
    const after = calculateCustomsDuty(car({ productionYear: 2021, productionMonth: 11 }), SIMPLE, new Date("2026-11-16T09:00:00Z"));
    expect(after.ageCategory).toBe("over-5");
    expect(after.officialDutyEur).toBe(2_993 * 5);
  });

  test("не опирается на разницу календарных лет", () => {
    // 2023 и 2026 — разница «3 года», но 12.2023 → 11.2026 это 2 года 11 месяцев
    expect(classifyAge(productionMoment(2023, 12), Date.UTC(2026, 10, 12)).category).toBe("under-3");
  });

  test("известен только год — расчёт приблизительный", () => {
    const duty = calculateCustomsDuty(car({ productionYear: 2019, productionMonth: null, productionBasis: "year-only" }), SIMPLE, NOW);
    expect(duty.productionDate).toBe("2019-07-01");
    expect(duty.calculationStatus).toBe("approximate");
  });
});

describe("пошлина: пограничные объёмы", () => {
  const cases: Array<[number, number, number]> = [
    // объём, € за см³ 3–5 лет, € за см³ старше 5 лет
    [1_000, 1.5, 3.0], [1_001, 1.7, 3.2], [1_500, 1.7, 3.2], [1_501, 2.5, 3.5], [1_800, 2.5, 3.5],
    [1_801, 2.7, 4.8], [2_300, 2.7, 4.8], [2_301, 3.0, 5.0], [3_000, 3.0, 5.0], [3_001, 3.6, 5.7]
  ];
  test.each(cases)("%i см³", (cc, from3to5, over5) => {
    expect(calculateCustomsDuty(car({ engineCc: cc, productionYear: 2022, productionMonth: 6 }), SIMPLE, NOW).officialDutyEur)
      .toBeCloseTo(cc * from3to5, 6);
    expect(calculateCustomsDuty(car({ engineCc: cc, productionYear: 2015, productionMonth: 6 }), SIMPLE, NOW).officialDutyEur)
      .toBeCloseTo(cc * over5, 6);
  });
});

describe("пошлина: пограничные стоимости (до 3 лет)", () => {
  // объём 1 см³, чтобы минимум не мешал проверять процент
  const cases: Array<[number, number]> = [
    [8_500, 0.54], [8_500.01, 0.48], [16_700, 0.48], [42_300, 0.48], [84_500, 0.48], [169_000, 0.48], [169_000.01, 0.48]
  ];
  test.each(cases)("%f €", (eur, percent) => {
    const duty = calculateCustomsDuty(car({ priceKrw: eurToKrw(eur), engineCc: 1 }), SIMPLE, NOW);
    expect(duty.officialDutyEur).toBeCloseTo(eur * percent, 2);
  });

  test("минимум за см³ меняется на границах диапазонов", () => {
    // цена такая, что процент меньше минимума — видно, какой минимум выбран
    const minimum = (eur: number) => calculateCustomsDuty(car({ priceKrw: eurToKrw(eur), engineCc: 6_000 }), SIMPLE, NOW).officialDutyEur;
    expect(minimum(8_500)).toBe(6_000 * 2.5);
    expect(minimum(8_501)).toBe(6_000 * 3.5);
    expect(minimum(16_701)).toBe(6_000 * 5.5);
    expect(minimum(42_301)).toBe(6_000 * 7.5);
    expect(minimum(84_501)).toBe(6_000 * 15);
    expect(minimum(169_001)).toBe(6_000 * 20);
  });

  test("минимум за см³ больше процента — берётся минимум", () => {
    const duty = calculateCustomsDuty(car({ priceKrw: eurToKrw(5_000), engineCc: 3_000 }), SIMPLE, NOW);
    expect(duty.officialDutyEur).toBe(7_500); // 54 % = 2700 €, а 3000 × 2,5 = 7500 €
    expect(duty.rateLabel).toContain("применён минимум");
    expect(duty.customerDutyRub).toBe(450_000); // 60 % от 750 000 ₽
  });
});

describe("пошлина: неполные данные — без выдуманных сумм", () => {
  test.each([
    ["нет объёма", car({ engineCc: null })],
    ["нулевой объём", car({ engineCc: 0 })],
    ["нет года", car({ productionYear: null, productionMonth: null, productionBasis: null })],
    ["нет цены у машины до 3 лет", car({ priceKrw: 0 })],
    ["отрицательная цена", car({ priceKrw: -5 })],
    ["электромобиль", car({ engineKind: "electric" })],
    ["неизвестный двигатель", car({ engineKind: "unknown" })]
  ])("%s → требует уточнения", (_name, input) => {
    const duty = calculateCustomsDuty(input, CBR, NOW);
    expect(duty.calculationStatus).toBe("needs_review");
    expect(duty.officialDutyRub).toBeNull();
    expect(duty.customerDutyRub).toBeNull();
    expect(duty.notes.length).toBeGreaterThan(0);
  });

  test("нет курсов → требует уточнения", () => {
    expect(calculateCustomsDuty(car({}), null, NOW).calculationStatus).toBe("needs_review");
  });

  test("для машины старше 3 лет цена не нужна", () => {
    expect(calculateCustomsDuty(car({ priceKrw: 0, productionYear: 2015 }), SIMPLE, NOW).officialDutyEur).toBe(2_993 * 5);
  });

  test("гибрид считается по ставкам ДВС и помечается приблизительным", () => {
    const duty = calculateCustomsDuty(car({ engineKind: "hybrid" }), CBR, NOW);
    expect(duty.officialDutyRub).not.toBeNull();
    expect(duty.calculationStatus).toBe("approximate");
  });
});

describe("пошлина: курсы", () => {
  test("обновление курса KRW и EUR меняет пошлину; курс воны нормализуется из «за 1 000 ₩»", () => {
    const before = calculateCustomsDuty(car({}), CBR, NOW);
    const after = calculateCustomsDuty(car({}), { ...CBR, krwRubPer1000: 70 }, NOW);
    expect(after.officialDutyRub!).toBeGreaterThan(before.officialDutyRub!);
    expect(after.priceEur).toBeCloseTo(118_000_000 * 0.07 / 92.6968, 1);
    // для машин старше 3 лет от курса воны ничего не зависит, от курса евро — зависит
    const old = car({ productionYear: 2018 });
    expect(calculateCustomsDuty(old, { ...CBR, krwRubPer1000: 70 }, NOW).officialDutyRub).toBe(calculateCustomsDuty(old, CBR, NOW).officialDutyRub);
    expect(calculateCustomsDuty(old, { ...CBR, eurRub: 100 }, NOW).officialDutyRub).toBe(1_496_500);
    expect(before.rateDate).toBe("2026-11-12");
  });
});
