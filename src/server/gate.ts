/* Бот-фильтр заявок (второй бот).
   Заявка с сайта сначала приходит владельцу этого бота с кнопками «Переслать» / «Не пересылать».
   По кнопке «Переслать» заявка уходит администраторам основного бота ровно так же, как раньше —
   от основного бота и в прежнем виде, без следов пересылки. */
import { randomUUID } from "node:crypto";
import { DbError, dbSecret, rpc } from "./db";
import { esc, gateTg, gateToken } from "./telegram";
import { notifyLead, type Lead } from "./bot";
import { hashIp, safeEqual } from "./secure";
import type { Update } from "./bot";

type Chat = { id: number; type?: string; first_name?: string; username?: string };
type Message = {
  message_id: number; chat: Chat; from?: Chat; text?: string;
  contact?: { phone_number: string };
};
type CallbackQuery = { id: string; from: Chat; message?: Message; data?: string };

type StoredLead = Lead & { gate_status: "forwarded" | "rejected" | null };

const send = (chat: number, text: string, markup?: unknown) =>
  gateTg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });

const isOwner = (user: number) => rpc<boolean>("gate_is_owner", { p_chat: user });

/** Не перехватываем заявки, если кнопки бота не смогут пройти проверку вебхука. */
export const gateEnabled = () => Boolean(gateToken() && process.env.TELEGRAM_GATE_WEBHOOK_SECRET);

/** Значение из кнопки: «fwd:123» / «rej:123». Данные кнопок можно подделать — принимаем только такой вид. */
export function parseGateAction(data: string): { action: "fwd" | "rej"; id: number } | null {
  const match = /^(fwd|rej):([1-9]\d{0,15})$/.exec(data);
  if (!match) return null;
  const id = Number(match[2]);
  return Number.isSafeInteger(id) ? { action: match[1] as "fwd" | "rej", id } : null;
}

export function leadText(lead: Lead) {
  return [
    `🚗 <b>Новая заявка #${lead.id}</b>`, "",
    `👤 ${esc(lead.name)}`,
    `📞 ${esc(lead.phone)}`,
    lead.comment ? `💬 ${esc(lead.comment)}` : "",
    lead.page ? `🔗 ${esc(lead.page)}` : ""
  ].filter(Boolean).join("\n");
}

const STATUS = {
  wait: "⏳ <i>Ждёт решения: переслать в основной бот?</i>",
  forwarded: "✅ <b>Переслано в основной бот</b>",
  check: "⚠️ <b>Отправка уже запускалась. Проверьте основной бот.</b>\nПовторная отправка заблокирована, чтобы не создать дубль. Если заявки нет, обратитесь к администратору сайта.",
  rejected: "🚫 <b>Не переслано</b>"
};

const askButtons = (id: number) => ({ inline_keyboard: [[
  { text: "📨 Переслать", callback_data: `fwd:${id}` },
  { text: "🚫 Не пересылать", callback_data: `rej:${id}` }
]] });
const undoButton = (id: number) => ({ inline_keyboard: [[{ text: "↩️ Всё-таки переслать", callback_data: `fwd:${id}` }]] });

/**
 * Новая заявка → владельцам бота-фильтра. Возвращает, скольким владельцам доставлено.
 * 0 — владельцев нет или Telegram недоступен: тогда сайт отправит заявку сразу в основной бот, чтобы она не потерялась.
 */
export async function notifyGate(lead: Lead) {
  const owners = await rpc<number[]>("gate_owner_ids");
  if (!owners?.length) return 0;
  const text = `${leadText(lead)}\n\n${STATUS.wait}`;
  const results = await Promise.allSettled(owners.map((chat) => send(Number(chat), text, askButtons(lead.id))));
  return results.filter((r) => r.status === "fulfilled").length;
}

async function finish(q: CallbackQuery, lead: Lead, status: keyof typeof STATUS, note?: string) {
  if (!q.message) return;
  const text = `${leadText(lead)}\n\n${STATUS[status]}${note ? `\n${note}` : ""}`;
  await gateTg("editMessageText", {
    chat_id: q.message.chat.id, message_id: q.message.message_id, text, parse_mode: "HTML", disable_web_page_preview: true,
    reply_markup: status === "rejected" ? undoButton(lead.id) : status === "wait" ? askButtons(lead.id) : { inline_keyboard: [] }
  }).catch(() => {});
}

async function handleCallback(q: CallbackQuery) {
  if (q.message?.chat.type !== "private") return;
  const answer = (text?: string) => gateTg("answerCallbackQuery", { callback_query_id: q.id, ...(text ? { text } : {}) }).catch(() => {});
  if (!(await isOwner(q.from.id))) return handleClientCallback(q, answer);
  const parsed = parseGateAction(q.data ?? "");
  if (!parsed) return answer();
  const lead = await rpc<StoredLead | null>("gate_get_lead", { p_id: parsed.id });
  if (!lead) { await answer("Заявка не найдена"); return; }

  if (parsed.action === "rej") {
    const ok = await rpc<boolean>("gate_decide", { p_id: lead.id, p_status: "rejected" });
    await answer(ok ? "Не пересылаем" : "Решение по заявке уже принято");
    return finish(q, lead, ok ? "rejected" : lead.gate_status === "forwarded" ? "check" : (lead.gate_status ?? "wait"));
  }

  // Сначала атомарно помечаем заявку пересланной — второе нажатие (с любого устройства) уже ничего не отправит
  const ok = await rpc<boolean>("gate_decide", { p_id: lead.id, p_status: "forwarded" });
  // The DB flag is also a concurrent-send lock, not proof of Telegram delivery.
  // A stopped process can leave it set before sending. Never claim success or resend automatically.
  if (!ok) { await answer("Отправка уже запускалась — проверьте основной бот"); return finish(q, lead, "check"); }
  const delivered = await notifyLead(lead).catch(() => 0);
  if (delivered > 0) { await answer("Переслано"); return finish(q, lead, "forwarded"); }
  await rpc("gate_undo", { p_id: lead.id });
  await answer("Не удалось переслать — попробуйте ещё раз");
  return finish(q, lead, "wait", "⚠️ Основной бот не ответил, заявка не переслана. Нажмите «Переслать» ещё раз.");
}

const HELP = [
  "<b>Фильтр заявок OnCarClick</b>", "",
  "Сюда приходят все заявки с сайта. Под каждой — кнопки:",
  "📨 <b>Переслать</b> — заявка уйдёт в основной бот, как обычно.",
  "🚫 <b>Не пересылать</b> — заявка останется только здесь (передумали — «↩️ Всё-таки переслать»)."
].join("\n");

const CLIENT_START = "Оставить заявку";
const CLIENT_CATALOG = "Открыть каталог";
const CLIENT_CANCEL = "Отменить заявку";
const CATALOG_URL = "https://www.oncarclick.com/catalog.html";
const CATALOG_BUTTON = { inline_keyboard: [[{ text: CLIENT_CATALOG, url: CATALOG_URL }]] };
const CLIENT_MENU = {
  keyboard: [[{ text: CLIENT_START }, { text: CLIENT_CATALOG }], [{ text: CLIENT_CANCEL }]],
  resize_keyboard: true, is_persistent: true
};
const PHONE_MENU = {
  ...CLIENT_MENU,
  keyboard: [[{ text: "Отправить мой номер", request_contact: true }], ...CLIENT_MENU.keyboard]
};
const CLIENT_WELCOME = [
  "<b>OnCarClick</b>",
  "Поможем подобрать и привезти автомобиль. Нажмите «Оставить заявку», чтобы рассказать, какой автомобиль вы ищете.",
  `<a href="${CATALOG_URL}">${CLIENT_CATALOG}</a>`
].join("\n\n");

const CLIENT_FIELDS = {
  name: { next: "car", min: 2, max: 80, prompt: "Как вас зовут? Напишите ваше имя (2–80 символов)." },
  car: { next: "budget", min: 2, max: 300, prompt: "Какой автомобиль вы ищете? Укажите марку, модель и пожелания (2–300 символов)." },
  budget: { next: "phone", min: 1, max: 80, prompt: "Какой у вас бюджет? Укажите сумму и валюту (1–80 символов)." },
  phone: { next: "confirm", min: 10, max: 30, prompt: "Отправьте ваш телефон контактом Telegram или напишите его (не менее 10 цифр, до 30 символов)." }
} as const;

type ClientField = keyof typeof CLIENT_FIELDS;
type ClientDraft = Record<ClientField, string>;
type ClientState = { step: ClientField | "confirm"; token: string; draft: ClientDraft };
type EmptyClientState = { step?: never };

// Оба бота используют одну таблицу состояний. Личные чаты основного бота имеют положительные ID.
const getClientState = (chat: number) => rpc<ClientState | EmptyClientState | null>("bot_get_state", { p_chat: -chat });
const setClientState = (chat: number, state: ClientState | EmptyClientState) =>
  rpc<void>("bot_set_state", { p_chat: -chat, p_state: state });

const promptClient = (chat: number, field: ClientField) =>
  send(chat, CLIENT_FIELDS[field].prompt, field === "phone" ? PHONE_MENU : CLIENT_MENU);

async function startClientForm(chat: number) {
  await setClientState(chat, { step: "name", token: randomUUID(), draft: { name: "", car: "", budget: "", phone: "" } });
  return promptClient(chat, "name");
}

async function cancelClientForm(chat: number) {
  await setClientState(chat, {});
  return send(chat, "Заявка отменена.", CLIENT_MENU);
}

function previewClientForm(chat: number, state: ClientState) {
  const { draft, token } = state;
  const preview = [
    "<b>Проверьте заявку</b>", "",
    `Имя: ${esc(draft.name)}`,
    `Автомобиль: ${esc(draft.car)}`,
    `Бюджет: ${esc(draft.budget)}`,
    `Телефон: ${esc(draft.phone)}`
  ].join("\n");
  return send(chat, preview, { inline_keyboard: [
    [{ text: "Подтвердить", callback_data: `client:confirm:${token}` }],
    [{ text: "Изменить данные", callback_data: `client:edit:${token}` }, { text: "Отменить", callback_data: `client:cancel:${token}` }]
  ] });
}

async function handleClientMessage(chat: number, text: string, contact?: Message["contact"]) {
  const command = text.split(/\s/, 1)[0].toLowerCase().replace(/@oncarclickk_bot$/, "");
  if (command === "/start") return send(chat, CLIENT_WELCOME, CLIENT_MENU);
  if (command === "/request" || text === CLIENT_START) return startClientForm(chat);
  if (text === CLIENT_CATALOG) return send(chat, "Полный каталог OnCarClick", CATALOG_BUTTON);
  if (command === "/cancel" || text === CLIENT_CANCEL) return cancelClientForm(chat);

  const state = await getClientState(chat);
  if (!state?.step) return send(chat, CLIENT_WELCOME, CLIENT_MENU);
  if (state.step === "confirm") return previewClientForm(chat, state);

  const field = state.step;
  const { min, max, next } = CLIENT_FIELDS[field];
  const value = (field === "phone" ? contact?.phone_number ?? text : text).trim();
  const length = [...value].length;
  if (length < min || length > max || (field === "phone" && value.replace(/\D/g, "").length < 10)) {
    return promptClient(chat, field);
  }
  const updated = { ...state, step: next, draft: { ...state.draft, [field]: value } };
  await setClientState(chat, updated);
  if (next !== "confirm") return promptClient(chat, next);

  // Клавиатура для отправки контакта заменяется отдельно от кнопок под предпросмотром.
  await send(chat, "Телефон записан.", CLIENT_MENU);
  return previewClientForm(chat, updated);
}

async function submitClientForm(chat: number, state: ClientState) {
  const { name, car, budget, phone } = state.draft;
  const lead = { name, phone, comment: `Автомобиль: ${car}\nБюджет: ${budget}`, page: "@OnCarClickk_bot" };
  let id: number;
  try {
    const ip_hash = hashIp(`telegram:${chat}`, dbSecret());
    id = await rpc<number>("site_add_lead", { p_lead: { ...lead, ip_hash } });
  } catch (error) {
    const message = error instanceof DbError && error.code === "P0429"
      ? "Слишком много заявок. Попробуйте подтвердить заявку позже."
      : "Не удалось сохранить заявку. Повторите подтверждение.";
    return send(chat, message);
  }

  if (id > 0) {
    const saved = { ...lead, id };
    const delivered = await notifyGate(saved).catch(() => 0);
    if (!delivered) await notifyLead(saved).catch(() => 0);
  }
  const current = await getClientState(chat);
  if (current?.step && current.token === state.token) await setClientState(chat, {});
  return send(chat, "Ваша заявка принята. Мы свяжемся с вами по указанному телефону.", CATALOG_BUTTON);
}

async function handleClientCallback(q: CallbackQuery, answer: (text?: string) => Promise<unknown>) {
  const chat = q.message?.chat.id;
  const action = /^client:(confirm|edit|cancel):([0-9a-f-]{36})$/.exec(q.data ?? "");
  if (chat !== q.from.id || !action) return answer();

  const state = await getClientState(chat);
  if (state?.step !== "confirm" || state.token !== action[2]) return answer("Эта кнопка устарела");
  await answer();
  if (action[1] === "cancel") return cancelClientForm(chat);
  if (action[1] === "edit") return startClientForm(chat);
  return submitClientForm(chat, state);
}

async function handleMessage(m: Message, claimCode = process.env.GATE_CLAIM_CODE) {
  if (m.chat.type !== "private" || m.from?.id !== m.chat.id) return;
  const chat = m.chat.id;
  const text = (m.text ?? "").trim();
  if (await isOwner(m.from.id)) return send(chat, HELP);

  // Подключение владельца: «/start КОД» (или просто КОД), либо первым — администратор основного бота
  const code = text.replace(/^\/start\s*/i, "").trim();
  const byCode = Boolean(code) && safeEqual(code, claimCode);
  if (text.startsWith("/start") || byCode) {
    const name = m.from.first_name ?? m.from.username ?? null;
    const claimed = await rpc<boolean>("gate_claim", { p_chat: m.from.id, p_name: name, p_by_code: byCode });
    if (claimed) return send(chat, `✅ Готово, теперь заявки с сайта будут приходить сюда.\n\n${HELP}`);
  }
  return handleClientMessage(chat, text, m.contact);
}

export async function handleGateUpdate(update: Update) {
  const u = update as unknown as { message?: Message; callback_query?: CallbackQuery };
  if (u.callback_query) return handleCallback(u.callback_query);
  if (u.message) return handleMessage(u.message);
}
