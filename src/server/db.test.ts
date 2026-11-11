import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DbError, rpc } from "./db";

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://db.example.com");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-key");
  vi.stubEnv("BOT_DB_SECRET", "db-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("rpc", () => {
  test("при ошибке передаёт статус, код и текст ответа базы", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "P0429", message: "too_many_leads" }), { status: 400 })));
    const error = await rpc("site_add_lead").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DbError);
    expect(error).toMatchObject({ status: 400, code: "P0429", details: "too_many_leads" });
  });

  test("ответ не в JSON — код null, текст сохраняется", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })));
    const error = await rpc("site_add_lead").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: null, details: "Bad gateway" });
  });

  test("успешный ответ разбирается как раньше", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("42", { status: 200 })));
    expect(await rpc<number>("site_add_lead")).toBe(42);
  });
});
