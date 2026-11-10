import { describe, expect, test } from "vitest";
import { parseCatalogParams } from "./catalog";

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
});
