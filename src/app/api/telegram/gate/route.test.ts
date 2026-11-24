import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const { handleGateUpdate } = vi.hoisted(() => ({ handleGateUpdate: vi.fn() }));
vi.mock("@/server/gate", () => ({ handleGateUpdate }));
import { POST } from "./route";

const call = (secret = "gate-secret", body = '{"update_id":1}') => POST(new NextRequest("https://example.com/api/telegram/gate", {
  method: "POST", headers: { "x-telegram-bot-api-secret-token": secret }, body
}));
beforeEach(() => {
  vi.stubEnv("TELEGRAM_GATE_WEBHOOK_SECRET", "gate-secret");
  handleGateUpdate.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

test("rejects an invalid webhook secret", async () => {
  expect((await call("wrong")).status).toBe(401);
  expect(handleGateUpdate).not.toHaveBeenCalled();
});
test("acknowledges a processed update", async () => {
  expect((await call()).status).toBe(200);
  expect(handleGateUpdate).toHaveBeenCalledWith({ update_id: 1 });
});
test("does not acknowledge a failed update so Telegram can redeliver it", async () => {
  handleGateUpdate.mockRejectedValue(new Error("database temporarily unavailable"));
  expect((await call()).status).toBe(503);
});
test("rejects malformed JSON before calling the bot", async () => {
  expect((await call("gate-secret", "{")).status).toBe(400);
  expect(handleGateUpdate).not.toHaveBeenCalled();
});
