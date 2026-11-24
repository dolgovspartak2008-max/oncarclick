import { NextRequest, NextResponse } from "next/server";
import type { Update } from "@/server/bot";
import { handleGateUpdate } from "@/server/gate";
import { safeEqual } from "@/server/secure";

/** Вебхук бота-фильтра заявок. Принимаем только запросы с секретом, который знает Telegram. */
export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_GATE_WEBHOOK_SECRET;
  if (!secret || !safeEqual(request.headers.get("x-telegram-bot-api-secret-token"), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let update: Update;
  try { update = await request.json() as Update; }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  try {
    await handleGateUpdate(update);
  } catch (error) {
    console.error("gate bot update failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

export const maxDuration = 90;
