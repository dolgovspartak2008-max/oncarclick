import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { tg, gateTg, rpc } = vi.hoisted(() => ({ tg: vi.fn(), gateTg: vi.fn(), rpc: vi.fn() }));
vi.mock("./telegram", () => ({ tg, gateTg }));
vi.mock("./db", () => ({ rpc }));

import { ensureGateWebhook, ensureWebhook, needsReset } from "./webhook";

const URL = "https://oncarclick.example/api/telegram";
const GATE_URL = `${URL}/gate`;
const NOW = 1_800_000_000;

beforeEach(() => {
  tg.mockReset();
  gateTg.mockReset();
  rpc.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("SITE_URL", "https://oncarclick.example");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "hook-secret");
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "token");
});
afterEach(() => vi.unstubAllEnvs());

describe("ensureGateWebhook", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_GATE_WEBHOOK_SECRET", "gate-hook-secret");
    vi.stubEnv("TELEGRAM_GATE_BOT_TOKEN", "gate-token");
  });

  test("добавляет владельца при рабочем вебхуке и безопасно повторяет вызов", async () => {
    gateTg.mockResolvedValue({ url: GATE_URL });
    rpc.mockResolvedValue(true);

    expect(await ensureGateWebhook()).toBe("ok");
    expect(await ensureGateWebhook()).toBe("ok");

    const claim = { p_chat: 944732927, p_name: null, p_by_code: true };
    expect(rpc.mock.calls).toEqual([["gate_claim", claim], ["gate_claim", claim]]);
    expect(gateTg.mock.calls).toEqual([["getWebhookInfo"], ["getWebhookInfo"]]);
  });

  test("восстанавливает вебхук, если добавление владельца завершилось ошибкой", async () => {
    gateTg.mockResolvedValueOnce({ url: "" }).mockResolvedValue(true);
    rpc.mockRejectedValue(new Error("network"));

    expect(await ensureGateWebhook()).toBe("reset");

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("gate"), "network");
    expect(gateTg).toHaveBeenCalledWith("setWebhook", expect.objectContaining({
      url: GATE_URL,
      secret_token: "gate-hook-secret",
      drop_pending_updates: false,
    }));
  });
});

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
