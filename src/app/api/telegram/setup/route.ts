import { NextRequest, NextResponse } from "next/server";
import { tg } from "@/server/telegram";
import { safeEqual } from "@/server/secure";
import { setWebhook, webhookUrl } from "@/server/webhook";

/** Однократная настройка: адрес вебхука и меню команд бота.
    Вызов: POST с заголовком x-setup-key = TELEGRAM_SETUP_SECRET. */
export async function POST(request: NextRequest) {
  const setupSecret = process.env.TELEGRAM_SETUP_SECRET;
  if (!setupSecret || !safeEqual(request.headers.get("x-setup-key"), setupSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || !webhookUrl()) {
    console.error("telegram setup: не задан TELEGRAM_WEBHOOK_SECRET или SITE_URL");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  try {
    const url = await setWebhook(true);
    await tg("setMyCommands", { commands: [
      { command: "menu", description: "Главное меню" },
      { command: "review", description: "Добавить отзыв на сайт" },
      { command: "reviews", description: "Отзывы на сайте" },
      { command: "rate", description: "Курс воны" },
      { command: "help", description: "Что умеет бот" },
      { command: "cancel", description: "Отменить действие" }
    ] });
    await tg("setMyDescription", { description: "Служебный бот сайта OnCarClick: заявки, отзывы и курс воны." });
    const me = await tg<{ username: string }>("getMe");
    return NextResponse.json({ ok: true, bot: `@${me.username}`, webhook: url });
  } catch (error) {
    // Текст ошибки Telegram — только в логи
    console.error("telegram setup failed", error);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
