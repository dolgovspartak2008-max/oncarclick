import { describe, expect, test, vi } from "vitest";
import type { CatalogFilters } from "@/domain/catalog";
import type { CatalogCar } from "@/domain/trust-encar";
import { CATALOG_REVALIDATE_SECONDS, fetchLiveCatalog, fetchLiveCount, fetchLiveOptions } from "./trust-encar";

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

  test("does not cache the expiring upstream nonce for a day", async () => {
    const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (!init?.body) return new Response(bootstrap);
      return (init.body as URLSearchParams).get("action") === "search_db"
        ? Response.json([]) : Response.json({ status: "success", total: 0 });
    });
    await fetchLiveCatalog(filters, fetcher);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  test("renews an expired nonce once for concurrent search and count without losing filters", async () => {
    const bodies: URLSearchParams[] = [];
    let pages = 0;
    const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (!init?.body) return new Response(bootstrap.replace('"key"', `"key${++pages}"`));
      const body = new URLSearchParams(init.body as URLSearchParams);
      bodies.push(body);
      if (body.get("nonce") === "key1") return new Response("-1", { status: 403 });
      if (body.get("action") === "search_db") return Response.json([]);
      return Response.json({ status: "success", total: 0 });
    });
    const result = await fetchLiveCatalog({ ...filters, yearFrom: 2026, mileageTo: 10000 }, fetcher);
    expect(result.total).toBe(0);
    expect(pages).toBe(2);
    const searches = bodies.filter((body) => body.get("action") === "search_db");
    expect(searches).toHaveLength(2);
    const before = new URLSearchParams(searches[0]);
    before.set("nonce", "key2");
    expect(searches[1].toString()).toBe(before.toString());
  });

  test("stops retrying if a fresh nonce is also rejected", async () => {
    let pages = 0;
    const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (!init?.body) { pages++; return new Response(bootstrap); }
      return new Response("-1", { status: 403 });
    });
    await expect(fetchLiveCount(filters, fetcher)).rejects.toThrow();
    expect(pages).toBe(2);
  });

  test("does not substitute the entire inventory count for an upstream error", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(bootstrap))
      .mockResolvedValueOnce(Response.json({ status: "error" }));
    await expect(fetchLiveCount({ ...filters, yearFrom: 2026 }, fetcher)).rejects.toThrow();
  });

  test("does not silently drop a make that could not be resolved", async () => {
    const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (!init?.body) return new Response(bootstrap);
      return (init.body as URLSearchParams).get("action") === "search_db"
        ? Response.json([]) : Response.json({ status: "success", total: 149585 });
    });
    await expect(fetchLiveCatalog({ ...filters, make: "BMW" }, fetcher)).rejects.toThrow();
  });

  test("renews the nonce when loading the models list", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(bootstrap))
      .mockResolvedValueOnce(new Response("-1", { status: 403 }))
      .mockResolvedValueOnce(new Response(bootstrap.replace('"key"', '"fresh"')))
      .mockResolvedValueOnce(Response.json({ facets: { models: [{ name: "Casper" }] } }));
    const result = await fetchLiveOptions({ ...filters, make: "Hyundai" }, fetcher);
    expect(result.models).toEqual(["Casper"]);
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
    expect(body.get("priceRubFrom")).toBe("1500000");
    expect(Number(body.get("priceRubTo"))).toBeGreaterThan(3_200_000);
    expect(body.get("field_sort")).toBe("CREATED_DATE"); // по цене сортируем сами
  });
});
