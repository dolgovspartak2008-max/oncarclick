/* Самопочинка вебхука Telegram.
   Если в Vercel поменяли TELEGRAM_WEBHOOK_SECRET или адрес сайта, Telegram продолжает слать старый секрет,
   сайт отвечает 401, и кнопки бота «молча» перестают работать. Здесь мы сверяем вебхук и при расхождении
   переустанавливаем его с текущим секретом. Вызывается при старте сервера (instrumentation) и ежедневным кроном. */
import { tg } from "./telegram";
import { siteOrigin } from "./site";

type WebhookInfo = { url?: string; pending_update_count?: number; last_error_date?: number; last_error_message?: string };

export const ALLOWED_UPDATES = ["message", "callback_query"];

export function webhookUrl() {
  const origin = siteOrigin();
  return origin ? `${origin}/api/telegram` : null;
}

/** Нужно ли переустановить вебхук: другой адрес или Telegram получает отказ (401/403) на свежие обновления. */
export function needsReset(info: WebhookInfo, expectedUrl: string, nowSec = Math.floor(Date.now() / 1000)) {
  if (info.url !== expectedUrl) return true;
  const rejected = /\b(401|403)\b|unauthorized|forbidden/i.test(info.last_error_message ?? "");
  const recent = (info.last_error_date ?? 0) > nowSec - 15 * 60;
  return rejected && (recent || (info.pending_update_count ?? 0) > 0);
}

export async function setWebhook(dropPending = false) {
  const url = webhookUrl();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!url || !secret) throw new Error("не задан TELEGRAM_WEBHOOK_SECRET или SITE_URL");
  await tg("setWebhook", { url, secret_token: secret, allowed_updates: ALLOWED_UPDATES, drop_pending_updates: dropPending });
  return url;
}

/** Проверяет вебхук и чинит его. Ошибки не пробрасывает — только в логи. */
export async function ensureWebhook(): Promise<"ok" | "reset" | "skipped"> {
  const url = webhookUrl();
  if (!url || !process.env.TELEGRAM_WEBHOOK_SECRET || !process.env.TELEGRAM_BOT_TOKEN) return "skipped";
  try {
    const info = await tg<WebhookInfo>("getWebhookInfo");
    if (!needsReset(info, url)) return "ok";
    await setWebhook(false); // накопленные нажатия не выбрасываем — Telegram их дошлёт
    console.info("telegram webhook restored", url);
    return "reset";
  } catch (error) {
    console.error("telegram webhook check failed", error instanceof Error ? error.message : error);
    return "skipped";
  }
}
