import { describe, expect, test, vi } from "vitest";
import type { CatalogFilters } from "@/domain/catalog";
import type { CatalogCar } from "@/domain/trust-encar";
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

  test("honors the requested API page size when Trust Encar returns its default batch", async () => {
    const records = ["1", "2"].map((id) => ({
      ID: id, MARKA_NAME: "KIA", MODEL_NAME: "K5", YEAR: 2023,
      MILEAGE: 1000, ENG_V: 1998, FINISH: 20000000, FINISH_RUB: 2500000, IMAGES: "[]"
    }));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(bootstrap))
      .mockResolvedValueOnce(Response.json(records))
      .mockResolvedValueOnce(Response.json({ status: "success", total: 2 }));

    const result = await fetchLiveCatalog({ ...filters, limit: 1 }, fetcher);
    expect(result.items).toHaveLength(1);
  });

  test("бюджет: просит у источника цену с запасом и отбирает по нашей итоговой цене", async () => {
    const records = [["1", 2_000_000], ["2", 3_500_000], ["3", 6_000_000]].map(([id, rub]) => ({
      ID: id, MARKA_NAME: "KIA", MODEL_NAME: "K5", YEAR: 2018, MILEAGE: 1000, ENG_V: 1998, FINISH: 20000000, FINISH_RUB: rub, IMAGES: "[]"
    }));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(bootstrap))
      .mockResolvedValueOnce(Response.json(records))
      .mockResolvedValueOnce(Response.json({ status: "success", total: 3 }));
    // «наша» цена — на 10 % ниже цены источника
    const price = async (cars: CatalogCar[]) => cars.map((car) => ({ ...car, priceRub: Math.round(car.sourcePriceRub! * 0.9) }));

    const result = await fetchLiveCatalog({ ...filters, priceFrom: 1_500_000, priceTo: 3_200_000, sort: "price-desc" }, fetcher, new Date(), price);

    expect(result.items.map((car) => car.id)).toEqual(["2", "1"]); // 3 150 000 и 1 800 000; 5 400 000 — мимо
    expect(result.total).toBe(2);
    const body = fetcher.mock.calls[1][1].body as URLSearchParams;
    expect(body.get("priceRubFrom")).toBe("1350000");
    expect(Number(body.get("priceRubTo"))).toBeGreaterThan(3_200_000);
  });
});
