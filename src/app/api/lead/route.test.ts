import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const { rpc, notifyLead } = vi.hoisted(() => ({ rpc: vi.fn(), notifyLead: vi.fn() }));

vi.mock("@/server/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/db")>();
  return { ...original, rpc, dbSecret: () => "test-secret" };
});
vi.mock("@/server/bot", () => ({ notifyLead }));

import { DbError } from "@/server/db";
import { POST } from "./route";

const lead = (headers: Record<string, string> = {}, body: Record<string, unknown> = {}) =>
  new NextRequest("https://example.com/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ name: "Алексей", phone: "+7 900 123-45-67", ...body })
  });

beforeEach(() => {
  rpc.mockReset();
  notifyLead.mockReset().mockResolvedValue(1);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/lead", () => {
  test("передаёт в базу хеш IP, а не сам IP, и отправляет заявку в Telegram", async () => {
    rpc.mockResolvedValue(12);
    const response = await POST(lead({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }));
    expect(response.status).toBe(200);
    const sent = rpc.mock.calls[0][1].p_lead;
    expect(sent.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(sent)).not.toContain("1.2.3.4");
    expect(notifyLead).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({ ok: true, id: 12, delivered: true });
  });

  test("повтор с того же телефона (отрицательный id) сохраняется, но не уходит в Telegram", async () => {
    rpc.mockResolvedValue(-13);
    const response = await POST(lead());
    expect(response.status).toBe(200);
    expect(notifyLead).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ ok: true, id: 13, delivered: false });
  });

  test("лимит базы P0429 → 429 с понятным текстом", async () => {
    rpc.mockRejectedValue(new DbError(400, "P0429", "too_many_leads"));
    const response = await POST(lead({ "x-real-ip": "5.6.7.8" }));
    expect(response.status).toBe(429);
    expect((await response.json()).message).toBe("Слишком много заявок, попробуйте позже или позвоните нам");
  });

  test("другие ошибки базы → 502 без подробностей", async () => {
    rpc.mockRejectedValue(new DbError(500, "XX000", "internal details"));
    const response = await POST(lead());
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("internal details");
  });

  test("ловушка website по-прежнему молча отвечает ok", async () => {
    const response = await POST(lead({}, { website: "spam.example" }));
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });
});
