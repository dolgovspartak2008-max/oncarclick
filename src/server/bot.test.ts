import { beforeEach, describe, expect, test, vi } from "vitest";

const { rpc, tg } = vi.hoisted(() => ({ rpc: vi.fn(), tg: vi.fn() }));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("./db", () => ({ rpc, select: vi.fn().mockResolvedValue([]) }));
vi.mock("./telegram", () => ({ tg, esc: (v: unknown) => String(v ?? "") }));
vi.mock("./rate", () => ({ getOurKrwRate: vi.fn(), getSourceKrwRate: vi.fn(), SETTINGS_TAG: "settings" }));

import { handleUpdate, parseCountry, parseId, parseRating } from "./bot";

const ADMIN = 111;
const STRANGER = 222;
let state: Record<string, unknown> = {};

beforeEach(() => {
  state = {};
  tg.mockReset().mockResolvedValue(true);
  rpc.mockReset().mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "bot_is_admin") return args.p_chat === ADMIN;
    if (fn === "bot_get_state") return state;
    if (fn === "bot_set_state") { state = args.p_state as Record<string, unknown>; return null; }
    if (fn === "bot_delete_review") return true;
    return null;
  });
});

const calls = (fn: string) => rpc.mock.calls.filter(([name]) => name === fn);
const sent = () => tg.mock.calls.filter(([method]) => method === "sendMessage");

const message = (from: number, chat: { id: number; type?: string }, text = "/menu") =>
  ({ update_id: 1, message: { message_id: 1, chat, from: { id: from }, text } });
const callback = (from: number, chat: { id: number; type?: string }, data: string) =>
  ({ update_id: 1, callback_query: { id: "q", from: { id: from }, data, message: { message_id: 1, chat } } });

describe("значения кнопок", () => {
  test("страна — только из списка", () => {
    expect(parseCountry("Корея")).toBe("Корея");
    expect(parseCountry("Япония")).toBe("Япония");
    expect(parseCountry("Китай")).toBe("Китай");
    expect(parseCountry("<b>США</b>")).toBeNull();
  });

  test("оценка — целое 1–5", () => {
    expect(parseRating("1")).toBe(1);
    expect(parseRating("5")).toBe(5);
    for (const bad of ["0", "6", "4.5", "-1", "", "5 ", "1e0", "500"]) expect(parseRating(bad)).toBeNull();
  });

  test("id — положительное целое", () => {
    expect(parseId("42")).toBe(42);
    for (const bad of ["0", "-3", "1.5", "abc", "", "01", "99999999999999999"]) expect(parseId(bad)).toBeNull();
  });
});

describe("доступ к боту", () => {
  test("сообщения из групп молча игнорируются, даже от администратора", async () => {
    await handleUpdate(message(ADMIN, { id: -100, type: "group" }));
    await handleUpdate(message(ADMIN, { id: -100, type: "supergroup" }));
    await handleUpdate(message(ADMIN, { id: -100 }));
    expect(sent()).toHaveLength(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("права проверяются по пользователю, а не по чату", async () => {
    await handleUpdate(message(STRANGER, { id: ADMIN, type: "private" }));
    expect(calls("bot_is_admin")[0][1]).toEqual({ p_chat: STRANGER });
    expect(sent()[0][1].text).toContain("Доступ есть только у администраторов");
  });

  test("администратор в личном чате получает меню", async () => {
    await handleUpdate(message(ADMIN, { id: ADMIN, type: "private" }));
    expect(sent()[0][1].text).toContain("Главное меню");
  });

  test("кнопки из группы игнорируются", async () => {
    await handleUpdate(callback(ADMIN, { id: -100, type: "group" }, "del:5"));
    expect(calls("bot_delete_review")).toHaveLength(0);
    expect(tg).not.toHaveBeenCalled();
  });

  test("кнопку удаления в личном чате не-администратора не выполняем", async () => {
    await handleUpdate(callback(STRANGER, { id: STRANGER, type: "private" }, "del:5"));
    expect(calls("bot_delete_review")).toHaveLength(0);
  });
});

describe("callback-данные", () => {
  const privateChat = { id: ADMIN, type: "private" };

  test("del: удаляет только по корректному id", async () => {
    await handleUpdate(callback(ADMIN, privateChat, "del:abc"));
    await handleUpdate(callback(ADMIN, privateChat, "del:-1"));
    expect(calls("bot_delete_review")).toHaveLength(0);
    await handleUpdate(callback(ADMIN, privateChat, "del:7"));
    expect(calls("bot_delete_review")[0][1]).toEqual({ p_id: 7 });
  });

  test("c: принимает только Корею, Японию, Китай", async () => {
    state = { step: "country", draft: { name: "А" } };
    await handleUpdate(callback(ADMIN, privateChat, "c:<script>"));
    expect(state).toEqual({ step: "country", draft: { name: "А" } });
    await handleUpdate(callback(ADMIN, privateChat, "c:Япония"));
    expect(state).toMatchObject({ step: "rating", draft: { country: "Япония" } });
  });

  test("r: принимает только 1–5", async () => {
    state = { step: "rating", draft: { name: "А" } };
    await handleUpdate(callback(ADMIN, privateChat, "r:100"));
    expect(state).toEqual({ step: "rating", draft: { name: "А" } });
    await handleUpdate(callback(ADMIN, privateChat, "r:4"));
    expect(state).toMatchObject({ step: "body", draft: { rating: 4 } });
  });
});
