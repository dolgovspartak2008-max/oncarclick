/* Telegram-бот OnCarClick для администраторов сайта:
   — получает заявки с сайта;
   — добавляет и удаляет отзывы, которые сразу появляются на главной;
   — меняет курс воны, по которому считаются цены в каталоге. */
import { revalidateTag } from "next/cache";
import { rpc, select } from "./db";
import { esc, tg } from "./telegram";
import { getOurKrwRate, getSourceKrwRate, SETTINGS_TAG } from "./rate";

export const REVIEWS_TAG = "site-reviews";

type Chat = { id: number; first_name?: string; username?: string };
type Message = { message_id: number; chat: Chat; from?: Chat; text?: string; photo?: Array<{ file_id: string; width: number }> };
type CallbackQuery = { id: string; from: Chat; message?: Message; data?: string };
export type Update = { update_id: number; message?: Message; callback_query?: CallbackQuery };

type Draft = { name?: string; city?: string; car?: string; country?: string; rating?: number; body?: string; photo?: string };
type State = { step?: string; draft?: Draft };

const BTN = { review: "📝 Добавить отзыв", reviews: "🗂 Отзывы", rate: "💱 Курс воны", help: "ℹ️ Помощь", cancel: "✖️ Отмена" };
const MENU = { keyboard: [[{ text: BTN.review }, { text: BTN.reviews }], [{ text: BTN.rate }, { text: BTN.help }]], resize_keyboard: true, is_persistent: true };
const CANCEL = { keyboard: [[{ text: BTN.cancel }]], resize_keyboard: true };
const inline = (rows: Array<Array<{ text: string; data: string }>>) => ({
  inline_keyboard: rows.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data })))
});

const send = (chat: number, text: string, markup?: unknown) =>
  tg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });

const getState = (chat: number) => rpc<State>("bot_get_state", { p_chat: chat });
const setState = (chat: number, state: State) => rpc<void>("bot_set_state", { p_chat: chat, p_state: state });
const isAdmin = (chat: number) => rpc<boolean>("bot_is_admin", { p_chat: chat });
const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const STEPS: Array<{ step: keyof Draft; ask: string; skip?: boolean }> = [
  { step: "name", ask: "Как зовут клиента? (например: <b>Алексей</b>)" },
  { step: "city", ask: "Город клиента?", skip: true },
  { step: "car", ask: "Какой автомобиль? (например: <b>Kia Sorento · 2022</b>)", skip: true },
  { step: "country", ask: "Откуда автомобиль?" },
  { step: "rating", ask: "Оценка клиента?" },
  { step: "body", ask: "Пришлите текст отзыва." },
  { step: "photo", ask: "Пришлите фото автомобиля или клиента (одно фото).", skip: true }
];

async function askStep(chat: number, index: number) {
  const step = STEPS[index];
  if (step.step === "country") {
    return send(chat, step.ask, inline([[{ text: "🇰🇷 Корея", data: "c:Корея" }, { text: "🇯🇵 Япония", data: "c:Япония" }, { text: "🇨🇳 Китай", data: "c:Китай" }]]));
  }
  if (step.step === "rating") {
    return send(chat, step.ask, inline([[5, 4, 3, 2, 1].map((n) => ({ text: `${n} ⭐`, data: `r:${n}` }))]));
  }
  return send(chat, `${step.ask}${step.skip ? "\n<i>Можно пропустить кнопкой ниже.</i>" : ""}`,
    step.skip ? inline([[{ text: "Пропустить →", data: "skip" }]]) : CANCEL);
}

async function nextStep(chat: number, state: State) {
  const index = STEPS.findIndex((s) => s.step === state.step);
  if (index < STEPS.length - 1) {
    const step = STEPS[index + 1].step;
    await setState(chat, { ...state, step });
    return askStep(chat, index + 1);
  }
  await setState(chat, { ...state, step: "confirm" });
  return preview(chat, state.draft ?? {});
}

async function preview(chat: number, d: Draft) {
  const text = [
    "<b>Проверьте отзыв:</b>", "",
    `👤 ${esc(d.name)}${d.city ? `, ${esc(d.city)}` : ""}`,
    `${"⭐".repeat(d.rating ?? 5)}`,
    d.car ? `🚗 ${esc(d.car)}${d.country ? ` · ${esc(d.country)}` : ""}` : d.country ? `🌏 ${esc(d.country)}` : "",
    "", esc(d.body), "", d.photo ? "🖼 Фото прикреплено" : "Без фото"
  ].filter((line, i, all) => line !== "" || all[i - 1] !== "").join("\n");
  return send(chat, text, inline([[{ text: "✅ Опубликовать", data: "pub" }, { text: "✖️ Отмена", data: "cancel" }]]));
}

async function showReviews(chat: number) {
  const reviews = await select<Array<{ id: number; name: string; car: string | null; rating: number; body: string }>>(
    "reviews?select=id,name,car,rating,body&published=eq.true&order=created_at.desc&limit=15", [REVIEWS_TAG], 0);
  if (!reviews.length) return send(chat, "Отзывов пока нет. Нажмите «📝 Добавить отзыв».", MENU);
  const lines = reviews.map((r) => `<b>#${r.id}</b> ${esc(r.name)}${r.car ? ` — ${esc(r.car)}` : ""} ${"⭐".repeat(r.rating)}\n<i>${esc(r.body.slice(0, 90))}${r.body.length > 90 ? "…" : ""}</i>`);
  const buttons = reviews.map((r) => [{ text: `🗑 Удалить #${r.id} (${r.name})`, data: `del:${r.id}` }]);
  return send(chat, `<b>Отзывы на сайте (${reviews.length}):</b>\n\n${lines.join("\n\n")}`, inline(buttons));
}

async function showRate(chat: number) {
  const [ours, source] = await Promise.all([getOurKrwRate(), getSourceKrwRate()]);
  const text = [
    "<b>Курс воны для цен в каталоге</b>", "",
    `Курс источника: ${source ? `<b>${fmt(source)} ₽</b> за 1 000 ₩` : "не удалось узнать"}`,
    `Ваш курс: ${ours ? `<b>${fmt(ours)} ₽</b> за 1 000 ₩` : "не задан — цены считаются по курсу источника"}`, "",
    "Отправьте новый курс числом в рублях за 1 000 ₩, например <code>64,5</code>.",
    "Цена машины в Корее пересчитается по вашему курсу, утильсбор не меняется."
  ].join("\n");
  await setState(chat, { step: "rate" });
  return send(chat, text, ours ? inline([[{ text: "↩️ Вернуть курс источника", data: "rate:reset" }]]) : CANCEL);
}

const HELP = [
  "<b>Что умеет бот</b>", "",
  "📨 Присылает сюда все заявки с сайта.",
  `${BTN.review} — пошагово добавить отзыв, он сразу появится на главной.`,
  `${BTN.reviews} — посмотреть и удалить отзывы.`,
  `${BTN.rate} — задать курс воны для цен в каталоге.`, "",
  "Отменить любое действие — /cancel"
].join("\n");

async function handleCallback(q: CallbackQuery) {
  const chat = q.message?.chat.id ?? q.from.id;
  await tg("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {});
  if (!(await isAdmin(chat))) return;
  const data = q.data ?? "";
  const state = await getState(chat);

  if (data === "cancel") { await setState(chat, {}); return send(chat, "Отменено.", MENU); }
  if (data.startsWith("del:")) {
    const id = Number(data.slice(4));
    const ok = await rpc<boolean>("bot_delete_review", { p_id: id });
    revalidateTag(REVIEWS_TAG, "max");
    return send(chat, ok ? `Отзыв #${id} удалён с сайта.` : `Отзыв #${id} уже удалён.`, MENU);
  }
  if (data === "rate:reset") {
    await rpc("bot_set_setting", { p_key: "krw_rate", p_value: null });
    revalidateTag(SETTINGS_TAG, "max");
    await setState(chat, {});
    return send(chat, "Готово: цены снова считаются по курсу источника.", MENU);
  }
  if (data === "pub" && state.step === "confirm" && state.draft?.name && state.draft.body) {
    const id = await rpc<number>("bot_add_review", { p_review: state.draft });
    revalidateTag(REVIEWS_TAG, "max");
    await setState(chat, {});
    return send(chat, `✅ Отзыв #${id} опубликован на сайте.`, MENU);
  }
  const draft = state.draft ?? {};
  if (data.startsWith("c:") && state.step === "country") return nextStep(chat, { ...state, draft: { ...draft, country: data.slice(2) } });
  if (data.startsWith("r:") && state.step === "rating") return nextStep(chat, { ...state, draft: { ...draft, rating: Number(data.slice(2)) } });
  if (data === "skip" && STEPS.some((s) => s.step === state.step && s.skip)) return nextStep(chat, state);
}

async function handleMessage(m: Message) {
  const chat = m.chat.id;
  const text = (m.text ?? "").trim();
  const admin = await isAdmin(chat);

  // Доступ только у администраторов из базы — список задаётся вручную, самостоятельно войти нельзя
  if (!admin) return send(chat, "Это служебный бот сайта OnCarClick. Доступ есть только у администраторов.");

  if (text === "/start" || text === "/menu") { await setState(chat, {}); await send(chat, "Главное меню. Сюда приходят заявки с сайта.", MENU); return text === "/start" ? send(chat, HELP, MENU) : undefined; }
  if (text === "/help" || text === BTN.help) return send(chat, HELP, MENU);
  if (text === "/cancel" || text === BTN.cancel) { await setState(chat, {}); return send(chat, "Отменено.", MENU); }
  if (text === BTN.review || text === "/review") {
    await setState(chat, { step: STEPS[0].step, draft: {} });
    return askStep(chat, 0);
  }
  if (text === BTN.reviews || text === "/reviews") { await setState(chat, {}); return showReviews(chat); }
  if (text === BTN.rate || text === "/rate") return showRate(chat);

  const state = await getState(chat);
  if (state.step === "rate") {
    const value = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
    if (!(value > 1 && value < 1_000)) return send(chat, "Не понял число. Пример: <code>64,5</code> — это 64,5 ₽ за 1 000 ₩.");
    await rpc("bot_set_setting", { p_key: "krw_rate", p_value: { perThousand: value } });
    revalidateTag(SETTINGS_TAG, "max");
    await setState(chat, {});
    return send(chat, `✅ Курс обновлён: <b>${fmt(value)} ₽</b> за 1 000 ₩. Цены в каталоге пересчитаются в течение 5 минут.`, MENU);
  }
  if (state.step === "photo") {
    const photo = m.photo?.length ? m.photo.reduce((a, b) => (b.width > a.width ? b : a)) : null;
    if (!photo) return send(chat, "Пришлите именно фотографию (не файлом) или нажмите «Пропустить».");
    return nextStep(chat, { ...state, draft: { ...state.draft, photo: photo.file_id } });
  }
  if (state.step && ["name", "city", "car", "body"].includes(state.step)) {
    if (!text) return send(chat, "Пришлите ответ текстом.");
    const limit = state.step === "body" ? 1_500 : 80;
    return nextStep(chat, { ...state, draft: { ...state.draft, [state.step]: text.slice(0, limit) } });
  }
  if (state.step === "country" || state.step === "rating" || state.step === "confirm") return send(chat, "Выберите вариант кнопкой выше или /cancel.");
  return send(chat, "Выберите действие в меню ниже.", MENU);
}

export async function handleUpdate(update: Update) {
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message) return handleMessage(update.message);
}

/** Заявка с сайта → всем администраторам бота. */
export async function notifyLead(lead: { id: number; name: string; phone: string; comment?: string; page?: string }) {
  const admins = await rpc<number[]>("bot_admin_ids");
  const text = [
    `🚗 <b>Новая заявка #${lead.id}</b>`, "",
    `👤 ${esc(lead.name)}`,
    `📞 ${esc(lead.phone)}`,
    lead.comment ? `💬 ${esc(lead.comment)}` : "",
    lead.page ? `🔗 ${esc(lead.page)}` : ""
  ].filter(Boolean).join("\n");
  const results = await Promise.allSettled((admins ?? []).map((chat) => send(Number(chat), text)));
  return results.filter((r) => r.status === "fulfilled").length;
}
