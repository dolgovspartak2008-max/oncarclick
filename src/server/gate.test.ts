import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { rpc, gateTg, notifyLead } = vi.hoisted(() => ({ rpc: vi.fn(), gateTg: vi.fn(), notifyLead: vi.fn() }));
vi.mock("./db", async (importOriginal) => ({ ...await importOriginal<typeof import("./db")>(), rpc }));
vi.mock("./telegram", () => ({
  gateTg, gateToken: () => "t",
  esc: (v: unknown) => String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)
}));
vi.mock("./bot", () => ({ notifyLead }));

import { DbError } from "./db";
import { hashIp } from "./secure";
import { gateEnabled, handleGateUpdate, leadText, notifyGate, parseGateAction } from "./gate";

const LEAD = { id: 7, name: "Иван <script>", phone: "+79001234567", comment: "Kia", page: "/car/1", gate_status: null };
const press = (data: string, from = 100, chat = from, type = "private") => handleGateUpdate({
  update_id: 1,
  callback_query: { id: "q", from: { id: from }, data, message: { message_id: 5, chat: { id: chat, type } } }
} as never);

/** Ответы rpc по имени функции. */
function db(map: Record<string, unknown>) {
  rpc.mockImplementation(async (fn: string) => (typeof map[fn] === "function" ? (map[fn] as () => unknown)() : map[fn]));
}

beforeEach(() => {
  rpc.mockReset(); gateTg.mockReset().mockResolvedValue({}); notifyLead.mockReset().mockResolvedValue(1);
});
afterEach(() => vi.unstubAllEnvs());

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
  test("не перехватывает заявки, пока не настроен секрет вебхука", () => {
    vi.stubEnv("TELEGRAM_GATE_WEBHOOK_SECRET", "");
    expect(gateEnabled()).toBe(false);
    vi.stubEnv("TELEGRAM_GATE_WEBHOOK_SECRET", "gate-secret");
    expect(gateEnabled()).toBe(true);
  });
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
    const edited = gateTg.mock.calls.find(([method]) => method === "editMessageText")?.[1];
    expect(edited.text).not.toContain("✅ <b>Переслано");
    expect(edited.text).toContain("Проверьте основной бот");
  });

  test("если основной бот не доставил — решение откатывается", async () => {
    db({ gate_is_owner: true, gate_get_lead: LEAD, gate_decide: true, gate_undo: null });
    notifyLead.mockResolvedValue(0);
    await press("fwd:7");
    expect(rpc).toHaveBeenCalledWith("gate_undo", { p_id: 7 });
  });

  test("не скрывает ошибку отката после неудачной отправки", async () => {
    db({ gate_is_owner: true, gate_get_lead: LEAD, gate_decide: true, gate_undo: () => { throw new Error("database unavailable"); } });
    notifyLead.mockResolvedValue(0);
    await expect(press("fwd:7")).rejects.toThrow("database unavailable");
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

const CLIENT_CHAT = 300;
const CATALOG_URL = "https://www.oncarclick.com/catalog.html";
const CLIENT_FIELDS = ["Иван <b>", "Kia & Hyundai", "до <3 млн", "+7 900 123-45-67"];

const message = (text?: string, options: { chat?: number; from?: number; type?: string; contact?: { phone_number: string; user_id?: number } } = {}) =>
  handleGateUpdate({
    update_id: 1,
    message: {
      message_id: 5, chat: { id: options.chat ?? CLIENT_CHAT, type: options.type ?? "private" },
      from: { id: options.from ?? CLIENT_CHAT, first_name: "Иван" }, text, contact: options.contact
    }
  } as never);

function clientDb(id: number | (() => number) = 42, owners = [100, 200]) {
  const states = new Map<number, unknown>();
  vi.stubEnv("BOT_DB_SECRET", "test-db-secret");
  rpc.mockImplementation(async (fn: string, args?: { p_chat: number; p_state?: unknown }) => {
    switch (fn) {
      case "gate_is_owner": return false;
      case "gate_claim": return false;
      case "gate_owner_ids": return owners;
      case "bot_get_state": return states.get(args!.p_chat);
      case "bot_set_state": states.set(args!.p_chat, args!.p_state); return null;
      case "site_add_lead": return typeof id === "function" ? id() : id;
      default: throw new Error("Unexpected RPC " + fn);
    }
  });
}

function lastClientMessage() {
  return gateTg.mock.calls.findLast(([method, body]) => method === "sendMessage" && body.chat_id === CLIENT_CHAT)?.[1];
}

function clientAction(text: string) {
  const buttons = lastClientMessage()?.reply_markup?.inline_keyboard as { text: string; callback_data: string }[][] | undefined;
  return buttons?.flat().find((button) => button.text.includes(text))?.callback_data ?? "missing-client-action";
}

async function fillForm(fields = CLIENT_FIELDS) {
  await message("/request");
  for (const field of fields) await message(field);
}

async function pressWhileAnswerPending(data: string, interrupt: () => Promise<unknown>) {
  const started = Promise.withResolvers<void>();
  const answer = Promise.withResolvers<void>();
  gateTg.mockImplementation(async (method) => {
    if (method === "answerCallbackQuery") {
      started.resolve();
      await answer.promise;
    }
  });
  const handling = press(data, CLIENT_CHAT);
  await started.promise;
  try {
    await interrupt();
  } finally {
    answer.resolve();
    await handling;
  }
}

describe("публичная форма второго бота", () => {
  test("владелец по-прежнему получает служебную справку", async () => {
    db({ gate_is_owner: true });
    await message("/request");
    expect(lastClientMessage()?.text).toContain("Фильтр заявок OnCarClick");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  test("подключение владельца по коду по-прежнему возможно", async () => {
    vi.stubEnv("GATE_CLAIM_CODE", "owner-claim");
    db({ gate_is_owner: false, gate_claim: true });
    await message("/start owner-claim");
    expect(rpc).toHaveBeenCalledWith("gate_claim", { p_chat: CLIENT_CHAT, p_name: "Иван", p_by_code: true });
    expect(lastClientMessage()?.text).toContain("Фильтр заявок OnCarClick");
  });

  test("показывает клиенту приветствие, постоянное меню и ссылку на каталог", async () => {
    clientDb();
    await message("/start");
    expect(lastClientMessage()).toMatchObject({
      text: expect.stringContaining(CATALOG_URL),
      reply_markup: {
        is_persistent: true,
        keyboard: expect.arrayContaining([expect.arrayContaining([{ text: "Оставить заявку" }])])
      }
    });
    await message("Оставить заявку");
    expect(lastClientMessage()?.text).toMatch(/ваше имя/i);
    expect(rpc).toHaveBeenCalledWith("bot_set_state", { p_chat: -CLIENT_CHAT, p_state: expect.any(Object) });
  });

  test("спрашивает данные по очереди, принимает текстовый телефон и экранирует предпросмотр", async () => {
    clientDb();
    await message("/request");
    expect(lastClientMessage()?.text).toMatch(/ваше имя/i);
    await message(CLIENT_FIELDS[0]);
    expect(lastClientMessage()?.text).toMatch(/автомобиль/i);
    await message(CLIENT_FIELDS[1]);
    expect(lastClientMessage()?.text).toMatch(/бюджет/i);
    await message(CLIENT_FIELDS[2]);
    expect(lastClientMessage()?.text).toMatch(/телефон/i);
    expect(lastClientMessage()?.reply_markup.keyboard.flat()).toContainEqual(expect.objectContaining({ request_contact: true }));
    await message("+7 <900> 123&45-67");
    expect(lastClientMessage()?.text).toContain("Иван &lt;b&gt;");
    expect(lastClientMessage()?.text).toContain("Kia &amp; Hyundai");
    expect(lastClientMessage()?.text).toContain("до &lt;3 млн");
    expect(lastClientMessage()?.text).toContain("+7 &lt;900&gt; 123&amp;45-67");
    expect(rpc).not.toHaveBeenCalledWith("site_add_lead", expect.anything());
  });

  test.each([
    { field: "имя", previous: [], invalid: ["Я", "Я".repeat(81)] },
    { field: "автомобиль", previous: CLIENT_FIELDS.slice(0, 1), invalid: ["X", "X".repeat(301)] },
    { field: "бюджет", previous: CLIENT_FIELDS.slice(0, 2), invalid: [" ", "9".repeat(81)] },
    { field: "телефон", previous: CLIENT_FIELDS.slice(0, 3), invalid: ["123456789", "+12345 6789", "1".repeat(31)] }
  ])("повторно спрашивает поле «$field» после неверного ввода", async ({ field, previous, invalid }) => {
    clientDb();
    await fillForm(previous);
    const writes = rpc.mock.calls.filter(([fn]) => fn === "bot_set_state").length;
    for (const value of invalid) {
      await message(value);
      expect(lastClientMessage()?.text.toLowerCase()).toContain(field);
    }
    expect(rpc.mock.calls.filter(([fn]) => fn === "bot_set_state")).toHaveLength(writes);
  });

  test("принимает номер из контакта Telegram", async () => {
    clientDb();
    await fillForm(CLIENT_FIELDS.slice(0, 3));
    await message(undefined, { contact: { phone_number: "79001234567", user_id: CLIENT_CHAT } });
    expect(lastClientMessage()?.text).toContain("79001234567");
  });

  test("отменяет черновик из предпросмотра", async () => {
    clientDb();
    await fillForm();
    const confirm = clientAction("Подтвердить");
    await press(clientAction("Отменить"), CLIENT_CHAT);
    expect(rpc).toHaveBeenLastCalledWith("bot_set_state", { p_chat: -CLIENT_CHAT, p_state: {} });
    expect(lastClientMessage()?.text).toMatch(/отменена/i);
    await press(confirm, CLIENT_CHAT);
    expect(rpc).not.toHaveBeenCalledWith("site_add_lead", expect.anything());
  });

  test("кнопка редактирования начинает форму заново и прежние кнопки устаревают", async () => {
    clientDb();
    await fillForm();
    const confirm = clientAction("Подтвердить");
    await press(clientAction("Изменить"), CLIENT_CHAT);
    expect(lastClientMessage()?.text).toMatch(/ваше имя/i);
    for (const field of CLIENT_FIELDS) await message(field);
    expect(clientAction("Подтвердить")).not.toBe(confirm);
    await press(confirm, CLIENT_CHAT);
    expect(rpc).not.toHaveBeenCalledWith("site_add_lead", expect.anything());
  });

  test("подтверждение сохраняет заявку, оповещает владельцев и показывает каталог", async () => {
    clientDb();
    await fillForm();
    await press(clientAction("Подтвердить"), CLIENT_CHAT);
    const lead = {
      name: CLIENT_FIELDS[0], phone: CLIENT_FIELDS[3], comment: "Автомобиль: Kia & Hyundai\nБюджет: до <3 млн",
      page: "@OnCarClickk_bot"
    };
    expect(rpc).toHaveBeenCalledWith("site_add_lead", { p_lead: { ...lead, ip_hash: hashIp("telegram:300", "test-db-secret") } });
    const notifications = gateTg.mock.calls.filter(([method, body]) => method === "sendMessage" && body.chat_id !== CLIENT_CHAT);
    expect(notifications.map(([, body]) => body.chat_id)).toEqual([100, 200]);
    expect(notifications[0][1].text).toContain("Kia &amp; Hyundai");
    expect(notifyLead).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith("bot_set_state", { p_chat: -CLIENT_CHAT, p_state: {} });
    expect(lastClientMessage()).toMatchObject({
      text: expect.stringMatching(/заявка принята/i),
      reply_markup: { inline_keyboard: [[expect.objectContaining({ url: CATALOG_URL })]] }
    });
  });

  test("завершение старой заявки не стирает новый черновик", async () => {
    clientDb();
    const started = Promise.withResolvers<void>();
    const delivery = Promise.withResolvers<void>();
    gateTg.mockImplementation(async (method, body) => {
      if (method === "sendMessage" && body.chat_id === 100) {
        started.resolve();
        await delivery.promise;
      }
    });
    await fillForm();
    const saving = press(clientAction("Подтвердить"), CLIENT_CHAT);
    await started.promise;
    try {
      await message("/request");
    } finally {
      delivery.resolve();
      await saving;
    }
    await message("Мария");
    expect(lastClientMessage()?.text).toMatch(/^Какой автомобиль/i);
  });

  test("ожидающее подтверждение не сохраняет отменённый черновик", async () => {
    clientDb();
    await fillForm();
    await pressWhileAnswerPending(clientAction("Подтвердить"), () => message("/cancel"));
    expect(rpc).not.toHaveBeenCalledWith("site_add_lead", expect.anything());
  });

  test("ожидающая отмена не стирает новый черновик", async () => {
    clientDb();
    await fillForm();
    await pressWhileAnswerPending(clientAction("Отменить"), () => message("/request"));
    await message("Мария");
    expect(lastClientMessage()?.text).toMatch(/^Какой автомобиль/i);
  });

  test("чужая или групповая кнопка не может изменить черновик клиента", async () => {
    clientDb();
    await fillForm();
    const confirm = clientAction("Подтвердить");
    rpc.mockClear();
    await press(confirm, 301, CLIENT_CHAT);
    await press(confirm, CLIENT_CHAT, CLIENT_CHAT, "group");
    await press(confirm, 301, 301);
    expect(rpc).not.toHaveBeenCalledWith("bot_set_state", expect.anything());
    expect(rpc).not.toHaveBeenCalledWith("site_add_lead", expect.anything());
  });

  test("не запускает форму в группе или в чужом личном чате", async () => {
    clientDb();
    await message("/request", { type: "group" });
    await message("/request", { from: 301 });
    expect(rpc).not.toHaveBeenCalled();
    expect(gateTg).not.toHaveBeenCalled();
  });

  test.each([
    { owners: [] as number[], label: "нет владельцев" },
    { owners: [100, 200], label: "ни один владелец не получил сообщение" }
  ])("использует основной бот, если $label", async ({ owners }) => {
    clientDb(42, owners);
    gateTg.mockImplementation(async (method, body) => {
      if (method === "sendMessage" && owners.includes(body.chat_id)) throw new Error("Telegram unavailable");
    });
    await fillForm();
    await press(clientAction("Подтвердить"), CLIENT_CHAT);
    expect(notifyLead).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 42, page: "@OnCarClickk_bot" }));
  });

  test("сохраняет дубликат без повторных уведомлений", async () => {
    clientDb(-42);
    await fillForm();
    await press(clientAction("Подтвердить"), CLIENT_CHAT);
    expect(rpc).toHaveBeenCalledWith("site_add_lead", expect.anything());
    expect(rpc).not.toHaveBeenCalledWith("gate_owner_ids");
    expect(notifyLead).not.toHaveBeenCalled();
    expect(lastClientMessage()?.text).toMatch(/заявка принята/i);
  });

  test.each([
    { error: new DbError(400, "P0429", "rate-limit internal detail"), text: /слишком много заявок.*позже/i },
    { error: new Error("database unavailable"), text: /не удалось сохранить заявку.*повторите/i }
  ])("сохраняет черновик, если запись не удалась ($error.message)", async ({ error, text }) => {
    let attempt = 0;
    clientDb(() => {
      if (++attempt === 1) throw error;
      return 42;
    });
    await fillForm();
    const confirm = clientAction("Подтвердить");
    rpc.mockClear();
    await press(confirm, CLIENT_CHAT);
    expect(lastClientMessage()?.text).toMatch(text);
    expect(rpc).not.toHaveBeenCalledWith("bot_set_state", expect.anything());
    await press(confirm, CLIENT_CHAT);
    expect(lastClientMessage()?.text).toMatch(/заявка принята/i);
  });
});
