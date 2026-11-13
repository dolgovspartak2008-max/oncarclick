import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { tg } = vi.hoisted(() => ({ tg: vi.fn() }));
vi.mock("./telegram", () => ({ tg }));

import { ensureWebhook, needsReset } from "./webhook";

const URL = "https://oncarclick.example/api/telegram";
const NOW = 1_800_000_000;

beforeEach(() => {
  tg.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("SITE_URL", "https://oncarclick.example");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "hook-secret");
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "token");
});
afterEach(() => vi.unstubAllEnvs());

describe("needsReset", () => {
  test("рабочий вебхук не трогаем", () => {
    expect(needsReset({ url: URL, pending_update_count: 0 }, URL, NOW)).toBe(false);
    expect(needsReset({ url: URL, last_error_message: "Wrong response from the webhook: 401 Unauthorized", last_error_date: NOW - 7_200, pending_update_count: 0 }, URL, NOW)).toBe(false);
  });

  test("другой адрес или 401 при ожидающих сообщениях — переустановить", () => {
    expect(needsReset({ url: "" }, URL, NOW)).toBe(true);
    expect(needsReset({ url: URL, last_error_message: "Wrong response from the webhook: 401 Unauthorized", last_error_date: NOW - 60, pending_update_count: 3 }, URL, NOW)).toBe(true);
  });
});

describe("ensureWebhook", () => {
  test("при 401 ставит вебхук с текущим секретом, не выбрасывая накопленное", async () => {
    tg.mockImplementation(async (method: string) => method === "getWebhookInfo"
      ? { url: URL, last_error_message: "Wrong response from the webhook: 401 Unauthorized", last_error_date: Math.floor(Date.now() / 1000), pending_update_count: 5 }
      : true);
    expect(await ensureWebhook()).toBe("reset");
    expect(tg).toHaveBeenCalledWith("setWebhook", expect.objectContaining({ url: URL, secret_token: "hook-secret", drop_pending_updates: false }));
  });

  test("без токена ничего не делает, ошибки Telegram не роняют сервер", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    expect(await ensureWebhook()).toBe("skipped");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "token");
    tg.mockRejectedValue(new Error("network"));
    expect(await ensureWebhook()).toBe("skipped");
  });
});
