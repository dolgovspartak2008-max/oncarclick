import { describe, expect, test } from "vitest";
import { buildTrustEncarSearchBody, isReservedStatus, normalizeTrustEncarRecords, parseTrustEncarBootstrap, parseTrustEncarGenerations, resolveYearRange } from "./trust-encar";

const html = `
  <script>var TE_CATALOG = {"ajaxUrl":"https://trust-encar.ru/wp-admin/admin-ajax.php","nonce":"public-key"};</script>
  <script>window.TE_CATALOG_SSR = {"total":149585,"facets":{"facets":{"marks":[{"value":"12","name":"KIA"}]}}};</script>
`;

describe("Trust Encar parsing", () => {
  test("reads the public catalog configuration", () => {
    expect(parseTrustEncarBootstrap(html)).toEqual({
      ajaxUrl: "https://trust-encar.ru/wp-admin/admin-ajax.php",
      nonce: "public-key",
      total: 149_585,
      makes: [{ id: "12", name: "KIA" }]
    });
  });

  test("rejects an upstream-controlled host", () => {
    expect(() => parseTrustEncarBootstrap(html.replace("https://trust-encar.ru", "https://evil.example"))).toThrow("недопустимый адрес");
  });

  test("rejects missing catalog configuration", () => {
    expect(() => parseTrustEncarBootstrap("<html></html>")).toThrow("конфигурацию каталога");
  });

  test("normalizes records and keeps only safe images", () => {
    const cars = normalizeTrustEncarRecords([{
      ID: "43131720",
      MARKA_NAME: "Hyundai",
      MODEL_NAME: "Casper",
      GRADE: "Turbo The Essential",
      YEAR: "2023",
      MILEAGE: "58471",
      ENG_V: "998",
      TIME: "G",
      PRIV: "2WD",
      FINISH: "14500000",
      FINISH_RUB: "1455950",
      IMAGES: JSON.stringify([
        "https://ci.encar.com/carpicture/01/car.jpg",
        "https://evil.example/car.jpg"
      ])
    }]);

    expect(cars).toHaveLength(1);
    expect(cars[0]).toMatchObject({
      id: "43131720",
      make: "Hyundai",
      model: "Casper",
      year: 2023,
      mileageKm: 58_471,
      engineCc: 998,
      fuel: "Бензин",
      priceRub: 1_455_950,
      photos: ["https://trust-encar.ru/images/carpicture/01/car.jpg"]
    });
  });

  test("builds a bounded catalog search request", () => {
    const body = buildTrustEncarSearchBody("search_db", {
      page: 2,
      limit: 24,
      sort: "price-desc",
      make: "KIA",
      engineCc: 1_998
    }, parseTrustEncarBootstrap(html));

    expect(body.get("action")).toBe("search_db");
    expect(body.get("nonce")).toBe("public-key");
    expect(body.get("page")).toBe("1");
    expect(body.get("marka_id")).toBe("12");
    expect(body.get("engine_from")).toBe("1948");
    expect(body.get("engine_to")).toBe("2048");
    expect(body.get("field_sort")).toBe("FINISH_RUB");
    expect(body.get("order_by")).toBe("DESC");
  });

  test("adds the recycling fee to the Trust Encar price", () => {
    const [car] = normalizeTrustEncarRecords([{
      ID: "1", MARKA_NAME: "Porsche", MODEL_NAME: "911", YEAR: "2023", MONTH: "12", MILEAGE: "8000",
      ENG_V: "2981", POWER_TEXT: "385 л.с.", FINISH_RUB: "20000000", IMAGES: "[]"
    }], new Date(2026, 10, 10));
    expect(car).toMatchObject({ priceBaseRub: 20_000_000, recyclingFeeRub: 2_949_600, priceRub: 22_949_600, month: 12 });
  });

  test("sends year and mileage filters", () => {
    const body = buildTrustEncarSearchBody("ajax_catalog_count_db", {
      page: 1, limit: 24, sort: "newest", yearFrom: 2019, yearTo: 2024, mileageTo: 10_000
    }, parseTrustEncarBootstrap(html));
    expect(body.get("year_from")).toBe("2019");
    expect(body.get("year_to")).toBe("2024");
    expect(body.get("mileage_to")).toBe("10000");
  });

  test("turns a generation into a year range", () => {
    const [gen] = parseTrustEncarGenerations({ facets: { generations: [{ name: "911 (992)", min_year: 2019, max_year: 2026 }] } });
    expect(resolveYearRange({ yearFrom: 2015 }, gen)).toEqual({ yearFrom: 2019, yearTo: 2026 });
    expect(resolveYearRange({ yearTo: 2010 }, gen)).toBeNull();
  });
});

describe("бронь (задаток) из статуса источника", () => {
  test.each(["Забронирован", "В резерве", "Под задатком", "Контракт", "계약중", "CONTRACT"])("«%s» — забронирован", (status) => {
    expect(isReservedStatus(status)).toBe(true);
  });
  test.each(["В продаже", "Лизинг", "", null])("«%s» — свободен", (status) => {
    expect(isReservedStatus(status)).toBe(false);
  });
});
