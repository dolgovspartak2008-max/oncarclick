/* Бот-фильтр заявок (второй бот).
   Заявка с сайта сначала приходит владельцу этого бота с кнопками «Переслать» / «Не пересылать».
   По кнопке «Переслать» заявка уходит администраторам основного бота ровно так же, как раньше —
   от основного бота и в прежнем виде, без следов пересылки. */
import { rpc } from "./db";
import { esc, gateTg, gateToken } from "./telegram";
import { notifyLead, type Lead } from "./bot";
import { safeEqual } from "./secure";
import type { Update } from "./bot";

type Chat = { id: number; type?: string; first_name?: string; username?: string };
type Message = { message_id: number; chat: Chat; from?: Chat; text?: string };
type CallbackQuery = { id: string; from: Chat; message?: Message; data?: string };

type StoredLead = Lead & { gate_status: "forwarded" | "rejected" | null };

const send = (chat: number, text: string, markup?: unknown) =>
  gateTg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });

const isOwner = (user: number) => rpc<boolean>("gate_is_owner", { p_chat: user });

/** Включён ли фильтр: задан токен второго бота. */
export const gateEnabled = () => Boolean(gateToken());

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
  if (!(await isOwner(q.from.id))) return answer();
  const parsed = parseGateAction(q.data ?? "");
  if (!parsed) return answer();
  const lead = await rpc<StoredLead | null>("gate_get_lead", { p_id: parsed.id });
  if (!lead) { await answer("Заявка не найдена"); return; }

  if (parsed.action === "rej") {
    const ok = await rpc<boolean>("gate_decide", { p_id: lead.id, p_status: "rejected" });
    await answer(ok ? "Не пересылаем" : "Решение по заявке уже принято");
    return finish(q, lead, ok ? "rejected" : (lead.gate_status ?? "wait"));
  }

  // Сначала атомарно помечаем заявку пересланной — второе нажатие (с любого устройства) уже ничего не отправит
  const ok = await rpc<boolean>("gate_decide", { p_id: lead.id, p_status: "forwarded" });
  if (!ok) { await answer("Заявка уже переслана"); return finish(q, lead, "forwarded"); }
  const delivered = await notifyLead(lead).catch(() => 0);
  if (delivered > 0) { await answer("Переслано"); return finish(q, lead, "forwarded"); }
  await rpc("gate_undo", { p_id: lead.id }).catch(() => {});
  await answer("Не удалось переслать — попробуйте ещё раз");
  return finish(q, lead, "wait", "⚠️ Основной бот не ответил, заявка не переслана. Нажмите «Переслать» ещё раз.");
}

const HELP = [
  "<b>Фильтр заявок OnCarClick</b>", "",
  "Сюда приходят все заявки с сайта. Под каждой — кнопки:",
  "📨 <b>Переслать</b> — заявка уйдёт в основной бот, как обычно.",
  "🚫 <b>Не пересылать</b> — заявка останется только здесь (передумали — «↩️ Всё-таки переслать»)."
].join("\n");

async function handleMessage(m: Message, claimCode = process.env.GATE_CLAIM_CODE) {
  if (m.chat.type !== "private" || !m.from) return;
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
  return send(chat, "Это служебный бот. Доступа нет.");
}

export async function handleGateUpdate(update: Update) {
  const u = update as unknown as { message?: Message; callback_query?: CallbackQuery };
  if (u.callback_query) return handleCallback(u.callback_query);
  if (u.message) return handleMessage(u.message);
}
