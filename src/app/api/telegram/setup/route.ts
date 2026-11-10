import { NextRequest, NextResponse } from "next/server";
import { tg } from "@/server/telegram";

/** Однократная настройка: адрес вебхука и меню команд бота. Доступно только с секретом. */
export async function GET(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.nextUrl.searchParams.get("key") !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const url = `https://${request.nextUrl.host}/api/telegram`;
    await tg("setWebhook", { url, secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
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
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "setup failed" }, { status: 502 });
  }
}
