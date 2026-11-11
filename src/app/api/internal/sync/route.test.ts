import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const { getCatalog } = vi.hoisted(() => ({ getCatalog: vi.fn() }));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/server/trust-encar", () => ({ CATALOG_CACHE_TAG: "catalog", getCatalog }));

import { GET, isSyncAuthorized } from "./route";

const call = (authorization?: string) =>
  GET(new NextRequest("https://example.com/api/internal/sync", { headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  getCatalog.mockReset().mockResolvedValue({ items: [{}, {}], total: 2 });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.unstubAllEnvs());

describe("catalog sync authorization", () => {
  test("без настроенного секрета доступа нет", () => {
    expect(isSyncAuthorized(new Headers(), undefined)).toBe(false);
    expect(isSyncAuthorized(new Headers(), "")).toBe(false);
    expect(isSyncAuthorized(new Headers({ authorization: "Bearer " }), "")).toBe(false);
  });

  test("требует точный bearer-секрет", () => {
    expect(isSyncAuthorized(new Headers(), "secret")).toBe(false);
    expect(isSyncAuthorized(new Headers({ authorization: "Bearer wrong" }), "secret")).toBe(false);
    expect(isSyncAuthorized(new Headers({ authorization: "Bearer secret" }), "secret")).toBe(true);
  });
});

describe("GET /api/internal/sync", () => {
  test("CRON_SECRET не задан — 401", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await call("Bearer anything");
    expect(response.status).toBe(401);
    expect(getCatalog).not.toHaveBeenCalled();
  });

  test("неверный секрет — 401", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call()).status).toBe(401);
  });

  test("верный секрет (как присылает Vercel Cron) — 200", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    const response = await call("Bearer secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, received: 2, total: 2 });
  });

  test("ошибка синхронизации не раскрывает подробности", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    getCatalog.mockRejectedValue(new Error("internal source url"));
    const response = await call("Bearer secret");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false });
  });
});
