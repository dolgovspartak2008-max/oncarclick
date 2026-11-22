import { beforeEach, describe, expect, test, vi } from "vitest";

const { rpc, gateTg, notifyLead } = vi.hoisted(() => ({ rpc: vi.fn(), gateTg: vi.fn(), notifyLead: vi.fn() }));
vi.mock("./db", () => ({ rpc }));
vi.mock("./telegram", () => ({
  gateTg, gateToken: () => "t",
  esc: (v: unknown) => String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)
}));
vi.mock("./bot", () => ({ notifyLead }));

import { handleGateUpdate, leadText, notifyGate, parseGateAction } from "./gate";

const LEAD = { id: 7, name: "Иван <script>", phone: "+79001234567", comment: "Kia", page: "/car/1", gate_status: null };
const press = (data: string, from = 100) => handleGateUpdate({
  update_id: 1,
  callback_query: { id: "q", from: { id: from }, data, message: { message_id: 5, chat: { id: from, type: "private" } } }
} as never);

/** Ответы rpc по имени функции. */
function db(map: Record<string, unknown>) {
  rpc.mockImplementation(async (fn: string) => (typeof map[fn] === "function" ? (map[fn] as () => unknown)() : map[fn]));
}

beforeEach(() => {
  rpc.mockReset(); gateTg.mockReset().mockResolvedValue({}); notifyLead.mockReset().mockResolvedValue(1);
});

describe("parseGateAction", () => {
  test("принимает только fwd/rej с числом", () => {
    expect(parseGateAction("fwd:12")).toEqual({ action: "fwd", id: 12 });
    expect(parseGateAction("rej:3")).toEqual({ action: "rej", id: 3 });
    expect(parseGateAction("fwd:0")).toBeNull();
    expect(parseGateAction("del:1")).toBeNull();
    expect(parseGateAction("fwd:1;x")).toBeNull();
  });
});

describe("бот-фильтр", () => {
  test("заявка уходит владельцам с кнопками и экранированием", async () => {
    db({ gate_owner_ids: [100, 200] });
    expect(await notifyGate(LEAD)).toBe(2);
    const [, body] = gateTg.mock.calls[0];
    expect(body.text).toContain("&lt;script&gt;");
    expect(body.reply_markup.inline_keyboard[0].map((b: { callback_data: string }) => b.callback_data)).toEqual(["fwd:7", "rej:7"]);
  });

  test("нет владельцев — 0, чтобы сайт отправил в основной бот", async () => {
    db({ gate_owner_ids: [] });
    expect(await notifyGate(LEAD)).toBe(0);
    expect(gateTg).not.toHaveBeenCalled();
  });

  test("«Переслать» отправляет заявку через основной бот в обычном виде", async () => {
    db({ gate_is_owner: true, gate_get_lead: LEAD, gate_decide: true });
    await press("fwd:7");
    expect(notifyLead).toHaveBeenCalledWith(LEAD);
    expect(rpc).toHaveBeenCalledWith("gate_decide", { p_id: 7, p_status: "forwarded" });
  });

  test("повторное нажатие «Переслать» ничего не отправляет", async () => {
    db({ gate_is_owner: true, gate_get_lead: { ...LEAD, gate_status: "forwarded" }, gate_decide: false });
    await press("fwd:7");
    expect(notifyLead).not.toHaveBeenCalled();
  });

  test("если основной бот не доставил — решение откатывается", async () => {
    db({ gate_is_owner: true, gate_get_lead: LEAD, gate_decide: true, gate_undo: null });
    notifyLead.mockResolvedValue(0);
    await press("fwd:7");
    expect(rpc).toHaveBeenCalledWith("gate_undo", { p_id: 7 });
  });

  test("«Не пересылать» не трогает основной бот", async () => {
    db({ gate_is_owner: true, gate_get_lead: LEAD, gate_decide: true });
    await press("rej:7");
    expect(notifyLead).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("gate_decide", { p_id: 7, p_status: "rejected" });
  });

  test("кнопки чужого пользователя игнорируются", async () => {
    db({ gate_is_owner: false });
    await press("fwd:7", 999);
    expect(notifyLead).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("gate_decide", expect.anything());
  });

  test("текст заявки совпадает с форматом основного бота", () => {
    expect(leadText(LEAD).split("\n")[0]).toBe("🚗 <b>Новая заявка #7</b>");
  });
});
