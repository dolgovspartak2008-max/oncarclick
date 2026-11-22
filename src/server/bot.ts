/* Telegram-бот OnCarClick для администраторов сайта:
   — получает заявки с сайта;
   — добавляет и удаляет отзывы, которые сразу появляются на главной;
   — меняет курс воны, по которому считаются цены в каталоге. */
import { revalidateTag } from "next/cache";
import { rpc, select } from "./db";
import { esc, tg } from "./telegram";
import { getOurKrwRate, getSourceKrwRate, SETTINGS_TAG } from "./rate";

export const REVIEWS_TAG = "site-reviews";

type Chat = { id: number; type?: string; first_name?: string; username?: string };
type TgFile = { file_id: string; file_size?: number; mime_type?: string; thumbnail?: { file_id: string }; thumb?: { file_id: string } };
type Message = {
  message_id: number; chat: Chat; from?: Chat; text?: string;
  photo?: Array<{ file_id: string; width: number }>;
  video?: TgFile; document?: TgFile; animation?: TgFile;
};
type CallbackQuery = { id: string; from: Chat; message?: Message; data?: string };
export type Update = { update_id: number; message?: Message; callback_query?: CallbackQuery };

type Draft = { name?: string; city?: string; car?: string; country?: string; rating?: number; date?: string; body?: string; photo?: string; video?: string; videoThumb?: string };
type State = { step?: string; draft?: Draft; adminId?: number; reviewId?: number };

const BTN = { review: "📝 Добавить отзыв", reviews: "🗂 Отзывы", rate: "💱 Курс воны", help: "ℹ️ Помощь", admins: "👥 Админы", cancel: "✖️ Отмена" };
const MENU = { keyboard: [[{ text: BTN.review }, { text: BTN.reviews }], [{ text: BTN.rate }, { text: BTN.admins }], [{ text: BTN.help }]], resize_keyboard: true, is_persistent: true };
const CANCEL = { keyboard: [[{ text: BTN.cancel }]], resize_keyboard: true };
const inline = (rows: Array<Array<{ text: string; data: string }>>) => ({
  inline_keyboard: rows.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data })))
});

const send = (chat: number, text: string, markup?: unknown) =>
  tg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });

const getState = (chat: number) => rpc<State>("bot_get_state", { p_chat: chat });
const setState = (chat: number, state: State) => rpc<void>("bot_set_state", { p_chat: chat, p_state: state });
// Права проверяем по Telegram ID пользователя, а не чата: в группе chat.id общий для всех участников
const isAdmin = (user: number) => rpc<boolean>("bot_is_admin", { p_chat: user });
const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

/* Значения из кнопок приходят от клиента Telegram и могут быть подделаны — принимаем только ожидаемые. */
export const COUNTRIES = ["Корея", "Япония", "Китай"] as const;
export const parseCountry = (value: string) => (COUNTRIES as readonly string[]).includes(value) ? value : null;
export const parseRating = (value: string) => (/^[1-5]$/.test(value) ? Number(value) : null);
export const parseId = (value: string) => {
  const id = /^[1-9]\d{0,15}$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(id) ? id : null;
};

const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
const MONTH_NAMES = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Дата отзыва из сообщения администратора → «ГГГГ-ММ-ДД». Понимает «15.10.2026», «15.10.26», «2026-10-15»,
 * «10.2026», «октябрь 2026». Без числа — первое число месяца (на сайте показываются месяц и год).
 * Будущие даты и даты раньше 2015 года не принимаются.
 */
export function parseReviewDate(text: string, now = new Date()): string | null {
  const value = text.trim().toLowerCase().replace(/ё/g, "е").replace(/\s*г(?:ода|\.)?$/, "");
  let y: number, m: number, d = 1;
  let match: RegExpMatchArray | null;
  if ((match = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/))) {
    d = Number(match[1]); m = Number(match[2]); y = Number(match[3]); if (y < 100) y += 2000;
  } else if ((match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
  } else if ((match = value.match(/^(\d{1,2})[./-](\d{4})$/))) {
    m = Number(match[1]); y = Number(match[2]);
  } else if ((match = value.match(/^(?:(\d{1,2})\s+)?([а-я]+)\s+(\d{4})$/))) {
    const word = match[2];
    const index = word === "мая" || word === "май" ? 4 : MONTHS.findIndex((stem, i) => i !== 4 && word.startsWith(stem));
    if (index < 0) return null;
    m = index + 1; y = Number(match[3]); d = match[1] ? Number(match[1]) : 1;
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2015 || date.getTime() > now.getTime() + 86_400_000) return null;
  return iso(y, m, d);
}
export const formatReviewDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return d === 1 ? `${MONTH_NAMES[m - 1]} ${y}` : `${d}.${String(m).padStart(2, "0")}.${y}`;
};

/** Видео из сообщения: обычное видео или видеофайл документом. Бот может скачать из Telegram не больше 20 МБ. */
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export function videoOf(m: Pick<Message, "video" | "document" | "animation">): { file: TgFile } | { error: string } | null {
  const file = m.video ?? m.animation ?? (m.document && /^video\//.test(m.document.mime_type ?? "") ? m.document : undefined);
  if (!file) return null;
  if ((file.file_size ?? 0) > VIDEO_MAX_BYTES) return { error: "Видео больше 20 МБ — Telegram не даёт боту скачать такой файл. Отправьте его обычным видео (Telegram сам сожмёт) или обрежьте и пришлите снова." };
  return { file };
}

/**
 * Курс из сообщения администратора → рублей за 1 000 ₩. Понимает:
 * «1000 вон = 64 рубля», «1 000 ₩ — 64,5 ₽», «1000=64», «64 руб за 1000 вон», «64,5».
 * Если чисел два — большее считается суммой в вонах, меньшее — в рублях (вона всегда «дешевле» рубля).
 */
export const RATE_MIN = 20;
export const RATE_MAX = 150;
export function parseRateInput(text: string): number | null {
  const numbers = (text.match(/\d{1,3}(?:[ \u00a0]\d{3}(?!\d))+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g) ?? [])
    .map((n) => Number(n.replace(/[ \u00a0]/g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
  let perThousand: number;
  if (numbers.length === 1) perThousand = numbers[0];
  else if (numbers.length === 2) {
    const krw = Math.max(...numbers), rub = Math.min(...numbers);
    perThousand = (rub / krw) * 1_000;
  } else return null;
  perThousand = Math.round(perThousand * 100) / 100;
  return perThousand >= RATE_MIN && perThousand <= RATE_MAX ? perThousand : null;
}
/** Похоже ли сообщение на курс («… вон … руб …»), чтобы принимать его прямо из меню, без кнопки. */
export const looksLikeRate = (text: string) => /(вон|₩|krw|won)/i.test(text) && /(руб|₽|rub|=)/i.test(text);

const DATE_ASK = "Когда клиент оставил отзыв? Пришлите дату: <code>15.10.2026</code>, <code>10.2026</code> или <code>октябрь 2026</code>.\nНа сайте показываются месяц и год.";

const STEPS: Array<{ step: keyof Draft; ask: string; skip?: boolean }> = [
  { step: "name", ask: "Как зовут клиента? (например: <b>Алексей</b>)" },
  { step: "city", ask: "Город клиента?", skip: true },
  { step: "car", ask: "Какой автомобиль? (например: <b>Kia Sorento · 2022</b>)", skip: true },
  { step: "country", ask: "Откуда автомобиль?" },
  { step: "rating", ask: "Оценка клиента?" },
  { step: "date", ask: DATE_ASK },
  { step: "body", ask: "Пришлите текст отзыва." },
  { step: "photo", ask: "Пришлите фото автомобиля или клиента (одно фото).", skip: true },
  { step: "video", ask: "Пришлите видео отзыва (одно видео, до 20 МБ).", skip: true }
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
    d.date ? `📅 ${formatReviewDate(d.date)}` : "",
    "", esc(d.body), "", d.photo ? "🖼 Фото прикреплено" : "Без фото", d.video ? "🎬 Видео прикреплено" : "Без видео"
  ].filter((line, i, all) => line !== "" || all[i - 1] !== "").join("\n");
  return send(chat, text, inline([[{ text: "✅ Опубликовать", data: "pub" }, { text: "✖️ Отмена", data: "cancel" }]]));
}

async function showReviews(chat: number) {
  const reviews = await select<Array<{ id: number; name: string; car: string | null; rating: number; body: string }>>(
    "reviews?select=id,name,car,rating,body&published=eq.true&order=created_at.desc&limit=15", [REVIEWS_TAG], 0);
  if (!reviews.length) return send(chat, "Отзывов пока нет. Нажмите «📝 Добавить отзыв».", MENU);
  const lines = reviews.map((r) => `<b>#${r.id}</b> ${esc(r.name)}${r.car ? ` — ${esc(r.car)}` : ""} ${"⭐".repeat(r.rating)}\n<i>${esc(r.body.slice(0, 90))}${r.body.length > 90 ? "…" : ""}</i>`);
  const buttons = reviews.map((r) => [
    { text: `📅 #${r.id}`, data: `date:${r.id}` },
    { text: `🎬 #${r.id}`, data: `vid:${r.id}` },
    { text: `🗑 #${r.id} ${r.name}`.slice(0, 40), data: `del:${r.id}` }
  ]);
  return send(chat, `<b>Отзывы на сайте (${reviews.length}):</b>\n\n${lines.join("\n\n")}\n\n📅 — изменить дату, 🎬 — добавить или заменить видео, 🗑 — удалить.`, inline(buttons));
}

async function showRate(chat: number) {
  const [ours, source] = await Promise.all([getOurKrwRate(), getSourceKrwRate()]);
  const text = [
    "<b>Курс воны для цен в каталоге</b>", "",
    `Курс источника: ${source ? `<b>${fmt(source)} ₽</b> за 1 000 ₩` : "не удалось узнать"}`,
    `Ваш курс: ${ours ? `<b>${fmt(ours)} ₽</b> за 1 000 ₩` : "не задан — цены считаются по курсу источника"}`, "",
    "Пришлите новый курс в таком виде:",
    "<code>1000 вон = 64 рубля</code>",
    "(можно короче: <code>1000=64</code> или просто <code>64</code>)", "",
    "Цена машины в Корее пересчитается по вашему курсу, пошлина и утильсбор не меняются."
  ].join("\n");
  await setState(chat, { step: "rate" });
  return send(chat, text, ours ? inline([[{ text: "↩️ Вернуть курс источника", data: "rate:reset" }]]) : CANCEL);
}

/** Telegram ID из сообщения: «123456789», «ID: 123456789», «/admin 123456789». */
export const parseTelegramId = (text: string) => {
  const match = text.match(/(?:^|\D)(\d{5,15})(?!\d)/);
  return match ? parseId(match[1]) : null;
};

type AdminRow = { chat_id: number; name: string | null };
async function showAdmins(chat: number) {
  const admins = await rpc<AdminRow[]>("bot_list_admins");
  const lines = admins.map((a, i) => `${i + 1}. <code>${a.chat_id}</code>${a.name ? ` — ${esc(a.name)}` : ""}${Number(a.chat_id) === chat ? " (вы)" : ""}`);
  const rows = admins
    .filter((a) => Number(a.chat_id) !== chat)
    .map((a) => [{ text: `🗑 Убрать ${a.name ?? a.chat_id}`, data: `adm:del:${a.chat_id}` }]);
  rows.unshift([{ text: "➕ Добавить администратора", data: "adm:add" }]);
  await setState(chat, {});
  return send(chat, [`<b>Администраторы бота (${admins.length}):</b>`, "", ...lines, "",
    "Администраторы получают заявки с сайта и могут менять отзывы и курс."].join("\n"), inline(rows));
}

const HELP = [
  "<b>Что умеет бот</b>", "",
  "📨 Присылает сюда все заявки с сайта.",
  `${BTN.review} — пошагово добавить отзыв, он сразу появится на главной.`,
  `${BTN.reviews} — посмотреть отзывы, изменить дату, добавить видео или удалить.`,
  `${BTN.rate} — задать курс воны для цен в каталоге.`,
  `${BTN.admins} — добавить или убрать администратора по Telegram ID.`,
  "Курс можно прислать и без кнопки: <code>1000 вон = 64 рубля</code>", "",
  "Отменить любое действие — /cancel"
].join("\n");

async function confirmAdmin(chat: number, id: number, name?: string) {
  await setState(chat, { step: "admin_confirm", adminId: id, draft: name ? { name } : {} });
  return send(chat, `Добавить администратора <code>${id}</code>${name ? ` (${esc(name)})` : ""}?\nОн будет получать заявки и сможет менять отзывы, курс и список администраторов.`,
    inline([[{ text: "✅ Добавить", data: "adm:ok" }, { text: "✖️ Отмена", data: "cancel" }]]));
}

async function handleCallback(q: CallbackQuery) {
  // Только кнопки из личного чата с ботом; в личном чате chat.id совпадает с ID пользователя
  if (q.message?.chat.type !== "private") return;
  const chat = q.message.chat.id;
  await tg("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {});
  if (!(await isAdmin(q.from.id))) return;
  const data = q.data ?? "";
  const state = await getState(chat);

  if (data === "cancel") { await setState(chat, {}); return send(chat, "Отменено.", MENU); }
  if (data.startsWith("del:")) {
    const id = parseId(data.slice(4));
    if (id === null) return;
    const ok = await rpc<boolean>("bot_delete_review", { p_id: id });
    revalidateTag(REVIEWS_TAG, "max");
    return send(chat, ok ? `Отзыв #${id} удалён с сайта.` : `Отзыв #${id} уже удалён.`, MENU);
  }
  if (data.startsWith("date:")) {
    const id = parseId(data.slice(5));
    if (id === null) return;
    await setState(chat, { step: "edit_date", reviewId: id });
    return send(chat, `Новая дата для отзыва #${id}.\n${DATE_ASK}`, CANCEL);
  }
  if (data.startsWith("vid:")) {
    const id = parseId(data.slice(4));
    if (id === null) return;
    await setState(chat, { step: "edit_video", reviewId: id });
    return send(chat, `Пришлите видео для отзыва #${id} (до 20 МБ). Старое видео, если было, заменится.`,
      inline([[{ text: "🗑 Убрать видео", data: `vdel:${id}` }, { text: "✖️ Отмена", data: "cancel" }]]));
  }
  if (data.startsWith("vdel:")) {
    const id = parseId(data.slice(5));
    if (id === null) return;
    const ok = await rpc<boolean>("bot_set_review_video", { p_id: id, p_video: null, p_thumb: null });
    revalidateTag(REVIEWS_TAG, "max");
    await setState(chat, {});
    return send(chat, ok ? `Видео у отзыва #${id} убрано.` : `Отзыв #${id} не найден.`, MENU);
  }
  if (data === "adm:add") {
    await setState(chat, { step: "admin_id" });
    return send(chat, [
      "Пришлите <b>Telegram ID</b> нового администратора — только цифры, например <code>123456789</code>.", "",
      "Узнать свой ID человек может у бота @userinfobot. Затем пусть напишет этому боту /start."
    ].join("\n"), CANCEL);
  }
  if (data === "adm:ok" && state.step === "admin_confirm" && state.adminId) {
    const added = await rpc<boolean>("bot_add_admin", { p_chat: state.adminId, p_name: state.draft?.name ?? null });
    await setState(chat, {});
    await send(chat, added ? `✅ Администратор <code>${state.adminId}</code> добавлен.` : `ℹ️ <code>${state.adminId}</code> уже администратор.`, MENU);
    if (added) await send(state.adminId, "Вам выдан доступ к служебному боту OnCarClick. Нажмите /start.").catch(() => {});
    return;
  }
  if (data.startsWith("adm:del:")) {
    const id = parseId(data.slice(8));
    if (id === null) return;
    if (id === q.from.id) return send(chat, "Себя убрать нельзя — попросите другого администратора.", MENU);
    const removed = await rpc<boolean>("bot_remove_admin", { p_chat: id });
    await send(chat, removed ? `Администратор <code>${id}</code> убран.` : "Не удалось: этого администратора уже нет или он последний.", MENU);
    return showAdmins(chat);
  }
  if (data === "adm:noname" && state.step === "admin_name" && state.adminId) return confirmAdmin(chat, state.adminId);
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
  if (data.startsWith("c:") && state.step === "country") {
    const country = parseCountry(data.slice(2));
    return country ? nextStep(chat, { ...state, draft: { ...draft, country } }) : undefined;
  }
  if (data.startsWith("r:") && state.step === "rating") {
    const rating = parseRating(data.slice(2));
    return rating ? nextStep(chat, { ...state, draft: { ...draft, rating } }) : undefined;
  }
  if (data === "skip" && STEPS.some((s) => s.step === state.step && s.skip)) return nextStep(chat, state);
}

async function handleMessage(m: Message) {
  // Группы и каналы молча игнорируем: бот работает только в личном чате
  if (m.chat.type !== "private" || !m.from) return;
  const chat = m.chat.id;
  const text = (m.text ?? "").trim();
  const admin = await isAdmin(m.from.id);

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
  if (text === BTN.admins || text === "/admins") return showAdmins(chat);

  const state = await getState(chat);
  // Курс принимаем после кнопки «Курс воны» или сразу из меню, если сообщение похоже на «1000 вон = 64 рубля»
  if (state.step === "rate" || (!state.step && looksLikeRate(text))) {
    const value = parseRateInput(text);
    if (value === null) {
      return send(chat, `Не понял курс. Пришлите так: <code>1000 вон = 64 рубля</code>\n(допустимо от ${RATE_MIN} до ${RATE_MAX} ₽ за 1 000 ₩)`);
    }
    await rpc("bot_set_setting", { p_key: "krw_rate", p_value: { perThousand: value } });
    revalidateTag(SETTINGS_TAG, "max");
    await setState(chat, {});
    return send(chat, `✅ Курс обновлён: <b>1 000 ₩ = ${fmt(value)} ₽</b>.\nЦены в каталоге пересчитаются в течение 5 минут.`, MENU);
  }
  if (state.step === "admin_id" || state.step === "admin_name") {
    if (state.step === "admin_id") {
      const id = parseTelegramId(text);
      if (id === null) return send(chat, "Это не похоже на Telegram ID. Пришлите только цифры, например <code>123456789</code>, или /cancel.");
      await setState(chat, { step: "admin_name", adminId: id });
      return send(chat, `ID <code>${id}</code>. Как подписать администратора? (например: <b>Евгений</b>)`, inline([[{ text: "Без имени →", data: "adm:noname" }]]));
    }
    if (!text) return send(chat, "Пришлите имя текстом или нажмите «Без имени».");
    return confirmAdmin(chat, state.adminId!, text.slice(0, 80));
  }
  if (state.step === "date" || state.step === "edit_date") {
    const date = parseReviewDate(text);
    if (!date) return send(chat, `Не понял дату. ${DATE_ASK}\nДата не может быть в будущем.`);
    if (state.step === "date") return nextStep(chat, { ...state, draft: { ...state.draft, date } });
    const ok = await rpc<boolean>("bot_set_review_date", { p_id: state.reviewId, p_date: date });
    revalidateTag(REVIEWS_TAG, "max");
    await setState(chat, {});
    return send(chat, ok ? `✅ Дата отзыва #${state.reviewId}: ${formatReviewDate(date)}.` : `Отзыв #${state.reviewId} не найден.`, MENU);
  }
  if (state.step === "video" || state.step === "edit_video") {
    const found = videoOf(m);
    if (!found) return send(chat, `Пришлите именно видео${state.step === "video" ? " или нажмите «Пропустить»" : " или /cancel"}.`);
    if ("error" in found) return send(chat, found.error);
    const thumb = found.file.thumbnail?.file_id ?? found.file.thumb?.file_id ?? "";
    if (state.step === "video") return nextStep(chat, { ...state, draft: { ...state.draft, video: found.file.file_id, videoThumb: thumb } });
    const ok = await rpc<boolean>("bot_set_review_video", { p_id: state.reviewId, p_video: found.file.file_id, p_thumb: thumb || null });
    revalidateTag(REVIEWS_TAG, "max");
    await setState(chat, {});
    return send(chat, ok ? `✅ Видео добавлено к отзыву #${state.reviewId}.` : `Отзыв #${state.reviewId} не найден.`, MENU);
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
  if (state.step === "country" || state.step === "rating" || state.step === "confirm" || state.step === "admin_confirm") return send(chat, "Выберите вариант кнопкой выше или /cancel.");
  return send(chat, "Выберите действие в меню ниже.", MENU);
}

export async function handleUpdate(update: Update) {
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message) return handleMessage(update.message);
}

/** Заявка с сайта → всем администраторам бота. */
export type Lead = { id: number; name: string; phone: string; comment?: string | null; page?: string | null };
export async function notifyLead(lead: Lead) {
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
