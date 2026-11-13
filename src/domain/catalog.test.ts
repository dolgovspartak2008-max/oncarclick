import { describe, expect, test } from "vitest";
import { inBudget, parseCatalogParams, sourcePriceWindow } from "./catalog";

describe("parseCatalogParams", () => {
  test("uses safe defaults", () => {
    expect(parseCatalogParams({})).toMatchObject({ page: 1, limit: 24, sort: "newest" });
  });

  test("bounds page and limit and rejects unknown sort", () => {
    expect(parseCatalogParams({ page: "999999", limit: "500", sort: "drop table" })).toMatchObject({
      page: 5_000,
      limit: 24,
      sort: "newest"
    });
  });

  test("normalizes supported filters", () => {
    expect(parseCatalogParams({ make: " Kia ", model: "K5", engine: "1998", sort: "price-asc", page: "2" })).toMatchObject({
      make: "Kia",
      model: "K5",
      engineCc: 1_998,
      sort: "price-asc",
      page: 2
    });
  });

  test("бюджет: числа, перепутанные «от» и «до» меняются местами, мусор отбрасывается", () => {
    expect(parseCatalogParams({ priceFrom: "3000000", priceTo: "1500000" })).toMatchObject({ priceFrom: 1_500_000, priceTo: 3_000_000 });
    expect(parseCatalogParams({ priceFrom: "abc", priceTo: "" })).toMatchObject({ priceFrom: undefined, priceTo: undefined });
  });
});

describe("бюджет", () => {
  test("отбор по итоговой цене, границы включительно; без цены — не подходит", () => {
    expect(inBudget(3_000_000, { priceFrom: 3_000_000, priceTo: 5_000_000 })).toBe(true);
    expect(inBudget(5_000_000, { priceTo: 5_000_000 })).toBe(true);
    expect(inBudget(5_000_001, { priceTo: 5_000_000 })).toBe(false);
    expect(inBudget(null, { priceFrom: 1 })).toBe(false);
    expect(inBudget(null, {})).toBe(true);
  });

  test("у источника просим диапазон с запасом: его цена выше нашей", () => {
    expect(sourcePriceWindow({ priceFrom: 3_000_000, priceTo: 5_000_000 })).toEqual({ from: 3_000_000, to: Math.ceil(5_300_000 / 0.75) });
    expect(sourcePriceWindow({})).toEqual({ from: undefined, to: undefined });
  });
});
