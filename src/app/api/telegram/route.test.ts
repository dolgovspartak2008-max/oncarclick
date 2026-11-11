import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const { handleUpdate } = vi.hoisted(() => ({ handleUpdate: vi.fn() }));
vi.mock("@/server/bot", () => ({ handleUpdate }));

import { POST } from "./route";

const call = (token?: string) => POST(new NextRequest("https://example.com/api/telegram", {
  method: "POST",
  headers: token === undefined ? {} : { "x-telegram-bot-api-secret-token": token },
  body: JSON.stringify({ update_id: 1 })
}));

beforeEach(() => handleUpdate.mockReset().mockResolvedValue(undefined));
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/telegram", () => {
  test("без настроенного секрета — 401", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
    expect((await call("")).status).toBe(401);
  });

  test("неверный или отсутствующий секрет — 401", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "hook");
    expect((await call("wrong")).status).toBe(401);
    expect((await call()).status).toBe(401);
    expect(handleUpdate).not.toHaveBeenCalled();
  });

  test("верный секрет — обновление передаётся боту", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "hook");
    expect((await call("hook")).status).toBe(200);
    expect(handleUpdate).toHaveBeenCalledWith({ update_id: 1 });
  });
});
