import { NextRequest, NextResponse } from "next/server";
import { handleUpdate, type Update } from "@/server/bot";

/** Вебхук Telegram. Принимаем только запросы с секретом, который знает Telegram. */
export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    await handleUpdate(await request.json() as Update);
  } catch (error) {
    console.error("bot update failed", error instanceof Error ? error.message : error);
  }
  // Всегда 200, иначе Telegram будет повторять одно и то же сообщение
  return NextResponse.json({ ok: true });
}

export const maxDuration = 30;
