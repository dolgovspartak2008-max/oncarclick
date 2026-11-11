import { describe, expect, test } from "vitest";
import CatalogModel from "../public/js/catalog-model.js";

describe("catalog browser model", () => {
  test("builds the API URL from existing controls", () => {
    expect(CatalogModel.buildCatalogUrl({
      brand: "KIA",
      model: "K5",
      engine: "1998",
      sort: "cheap"
    }, 2)).toBe("/api/catalog?page=2&limit=24&make=KIA&model=K5&engine=1998&sort=price-asc");
  });

  test("normalizes real vehicle data for a card", () => {
    expect(CatalogModel.normalizeCar({
      id: "43131720",
      make: "Hyundai",
      model: "Casper",
      trim: "Turbo",
      year: 2023,
      mileageKm: 58471,
      engineCc: 998,
      priceRub: 1455950,
      photos: ["https://trust-encar.ru/images/car.jpg"]
    })).toMatchObject({
      id: "43131720",
      name: "Hyundai Casper",
      year: 2023,
      km: 58471,
      engine: 998,
      price: 1455950,
      photo: "https://trust-encar.ru/images/car.jpg"
    });
  });

  test("formats engines and escapes untrusted text", () => {
    expect(CatalogModel.engineLabel(998)).toBe("1.0 л");
    expect(CatalogModel.engineLabel(null)).toBe("Объём не указан");
    expect(CatalogModel.escapeHtml('<img src=x onerror="bad">')).toBe("&lt;img src=x onerror=&quot;bad&quot;&gt;");
  });

  test("formats the Russian vehicle count without demo helpers", () => {
    expect(CatalogModel.plural(1, "автомобиль", "автомобиля", "автомобилей")).toBe("автомобиль");
    expect(CatalogModel.plural(24, "автомобиль", "автомобиля", "автомобилей")).toBe("автомобиля");
    expect(CatalogModel.plural(149_597, "автомобиль", "автомобиля", "автомобилей")).toBe("автомобилей");
  });

  test("groups near-identical engine sizes into one filter option", () => {
    expect(CatalogModel.engineBuckets([998, 1995, 1998, 1999, null])).toEqual([1000, 2000]);
  });

  test("подпись под ценой говорит, что входит в цену", () => {
    const base = { price: 5_000_000, fee: 3_660_000, duty: 1_385_000, dutyStatus: "exact" };
    expect(CatalogModel.priceNote(base)).toBe("вкл. пошлину и утильсбор");
    expect(CatalogModel.priceNote({ ...base, fee: null })).toBe("вкл. пошлину; утильсбор уточним при расчёте");
    expect(CatalogModel.priceNote({ ...base, dutyStatus: "needs_review" })).toBe("вкл. утильсбор; пошлину уточним при расчёте");
    expect(CatalogModel.priceNote({ ...base, price: null })).toBe("");
  });

  test("переносит в карточку пошлину и корректировку", () => {
    expect(CatalogModel.normalizeCar({ id: "1", priceRub: 100, dutyRub: 60, customs: { officialDutyRub: 100, commercialAdjustmentRub: 40, calculationStatus: "exact" } }))
      .toMatchObject({ duty: 60, dutyOfficial: 100, dutyAdjustment: 40, dutyStatus: "exact" });
  });

  test("переносит в карточку расходы и доставку до Москвы", () => {
    expect(CatalogModel.normalizeCar({ id: "1", carPriceKoreaRub: 5_000_000,
      expenses: { items: [{ label: "Транзитные расходы", rub: 140_000 }], optionalItems: [{ label: "Минск", rub: 60_000 }], moscowDeliveryRub: 230_000 } }))
      .toMatchObject({ koreaPrice: 5_000_000, expenses: [{ label: "Транзитные расходы", rub: 140_000 }], optional: [{ label: "Минск", rub: 60_000 }], moscow: 230_000 });
  });
});
