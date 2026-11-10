import { describe, expect, test } from "vitest";
import { ageInMonths, calculateRecyclingFee, parseMonth, RECYCLING_FEE_TABLE } from "./recycling-fee";

const now = new Date(2026, 10, 10); // 10 ноября 2026

describe("утильсбор по таблице", () => {
  test("в таблице 4 группы объёма по 12 строк мощности и 12 колонок", () => {
    for (const rows of Object.values(RECYCLING_FEE_TABLE)) {
      expect(rows).toHaveLength(12);
      rows.forEach((row) => expect(row).toHaveLength(12));
    }
  });

  test("Porsche 911 (992): 3.0 л, 385 л.с., 2023 год — колонка 2026, до 3 лет", () => {
    expect(calculateRecyclingFee({ engineCc: 2_981, powerHp: 385, year: 2023, month: 12 }, now))
      .toEqual({ feeRub: 2_949_600, ageGroup: "0-3", tableYear: 2026 });
  });

  test("машина старше трёх лет берёт колонку «3–5 лет»", () => {
    expect(calculateRecyclingFee({ engineCc: 1_998, powerHp: 245, year: 2021, month: 5 }, now)?.feeRub).toBe(1_677_600);
  });

  test("границы объёма: 3.5 л и свыше 3.5 л", () => {
    expect(calculateRecyclingFee({ engineCc: 3_470, powerHp: 300, year: 2025, month: 1 }, now)?.feeRub).toBe(2_880_000);
    expect(calculateRecyclingFee({ engineCc: 3_996, powerHp: 650, year: 2025, month: 1 }, now)?.feeRub).toBe(4_581_600);
  });

  test("до 157,7 л.с. — льготный сбор, без мощности — не считаем", () => {
    expect(calculateRecyclingFee({ engineCc: 1_598, powerHp: 150, year: 2024, month: 1 }, now)?.feeRub).toBe(3_400);
    expect(calculateRecyclingFee({ engineCc: 1_598, powerHp: 150, year: 2020, month: 1 }, now)?.feeRub).toBe(5_200);
    expect(calculateRecyclingFee({ engineCc: 1_598, powerHp: null, year: 2024 }, now)).toBeNull();
  });

  test("возраст и месяц выпуска", () => {
    expect(ageInMonths(2023, 11, now)).toBe(36);
    expect(ageInMonths(2023, 12, now)).toBe(35);
    expect(parseMonth("202303")).toBe(3);
    expect(parseMonth("2023-07")).toBe(7);
    expect(parseMonth("11")).toBe(11);
    expect(parseMonth("abc")).toBeNull();
  });
});
