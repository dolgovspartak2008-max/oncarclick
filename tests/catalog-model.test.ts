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
});
