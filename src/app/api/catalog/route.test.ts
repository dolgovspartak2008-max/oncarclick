import { describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { createCatalogHandler } from "./route";

describe("GET /api/catalog", () => {
  test("returns a paginated catalog", async () => {
    const getCatalog = vi.fn().mockResolvedValue({ items: [{ id: "1" }], total: 25, makes: ["KIA"], models: [] });
    const GET = createCatalogHandler(getCatalog);
    const response = await GET(new NextRequest("http://localhost/api/catalog?page=2&limit=24"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ page: 2, total: 25, hasMore: false, makes: ["KIA"] });
    expect(response.headers.get("cache-control")).toContain("stale-while-revalidate");
  });

  test("returns a friendly upstream error", async () => {
    const GET = createCatalogHandler(vi.fn().mockRejectedValue(new Error("upstream")));
    const response = await GET(new NextRequest("http://localhost/api/catalog"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ message: "Источник временно не ответил. Показываем последнюю сохранённую версию, если она доступна." });
  });
});
