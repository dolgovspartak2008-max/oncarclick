import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const { tg } = vi.hoisted(() => ({ tg: vi.fn() }));
vi.mock("@/server/telegram", () => ({ tg }));

import { siteOrigin } from "@/server/site";
import { POST } from "./route";

const call = (headers: Record<string, string> = {}, query = "") =>
  POST(new NextRequest(`https://evil.example/api/telegram/setup${query}`, { method: "POST", headers }));

beforeEach(() => {
  tg.mockReset().mockImplementation(async (method: string) => (method === "getMe" ? { username: "oncarclick_bot" } : true));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("TELEGRAM_SETUP_SECRET", "setup-key");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "hook-secret");
  vi.stubEnv("SITE_URL", "https://oncarclick.example");
});

afterEach(() => vi.unstubAllEnvs());

describe("siteOrigin", () => {
  test("SITE_URL важнее домена Vercel, схема дописывается", () => {
    expect(siteOrigin({ SITE_URL: "https://a.example/", VERCEL_PROJECT_PRODUCTION_URL: "b.vercel.app" })).toBe("https://a.example");
    expect(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "b.vercel.app" })).toBe("https://b.vercel.app");
  });

  test("без адреса или не https — null", () => {
    expect(siteOrigin({})).toBeNull();
    expect(siteOrigin({ SITE_URL: "http://a.example" })).toBeNull();
  });
});

describe("POST /api/telegram/setup", () => {
  test("TELEGRAM_SETUP_SECRET не задан — 401", async () => {
    vi.stubEnv("TELEGRAM_SETUP_SECRET", "");
    expect((await call({ "x-setup-key": "" })).status).toBe(401);
    expect(tg).not.toHaveBeenCalled();
  });

  test("неверный ключ или ключ в query string — 401", async () => {
    expect((await call({ "x-setup-key": "wrong" })).status).toBe(401);
    expect((await call({}, "?key=setup-key")).status).toBe(401);
    expect(tg).not.toHaveBeenCalled();
  });

  test("верный ключ — вебхук на SITE_URL, а не на Host запроса", async () => {
    const response = await call({ "x-setup-key": "setup-key" });
    expect(response.status).toBe(200);
    expect(tg).toHaveBeenCalledWith("setWebhook", expect.objectContaining({
      url: "https://oncarclick.example/api/telegram", secret_token: "hook-secret"
    }));
  });

  test("ошибка Telegram наружу не попадает", async () => {
    tg.mockRejectedValue(new Error("Telegram: Unauthorized token 123:ABC"));
    const response = await call({ "x-setup-key": "setup-key" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false });
  });
});
