import { describe, expect, test, vi } from "vitest";
import type { CatalogFilters } from "@/domain/catalog";
import { CATALOG_REVALIDATE_SECONDS, fetchLiveCatalog } from "./trust-encar";

const filters: CatalogFilters = { page: 1, limit: 24, sort: "newest" };
const bootstrap = `
  <script>var TE_CATALOG = {"ajaxUrl":"https://trust-encar.ru/ajax","nonce":"key"};</script>
  <script>window.TE_CATALOG_SSR = {"total":149585,"facets":{"facets":{"marks":[{"value":"1","name":"Hyundai"}]}}};</script>
`;

describe("Trust Encar server client", () => {
  test("refreshes cached catalog once per day", () => {
    expect(CATALOG_REVALIDATE_SECONDS).toBe(86_400);
  });

  test("maps public catalog responses", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(bootstrap))
      .mockResolvedValueOnce(Response.json([{
        ID: "43131720", MARKA_NAME: "Hyundai", MODEL_NAME: "Casper", YEAR: 2023,
        MILEAGE: 58471, ENG_V: 998, FINISH: 14500000, FINISH_RUB: 1455950, IMAGES: "[]"
      }]))
      .mockResolvedValueOnce(Response.json({ status: "success", total: 149_585 }));

    const result = await fetchLiveCatalog(filters, fetcher);

    expect(result.total).toBe(149_585);
    expect(result.items[0]).toMatchObject({ id: "43131720", make: "Hyundai", priceRub: 1_455_950 });
    expect(result.makes).toEqual(["Hyundai"]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  test("rejects a failed upstream response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("no", { status: 503 }));
    await expect(fetchLiveCatalog(filters, fetcher)).rejects.toThrow("503");
  });
});
