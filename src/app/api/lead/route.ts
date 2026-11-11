import { NextRequest, NextResponse } from "next/server";
import { DbError, dbSecret, rpc } from "@/server/db";
import { notifyLead } from "@/server/bot";
import { clientIp, hashIp } from "@/server/secure";

const clean = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Код, которым site_add_lead сообщает о превышении лимита заявок с одного IP. */
const TOO_MANY_LEADS = "P0429";

/** Заявка с сайта: сохраняем в базу и сразу отправляем администраторам в Telegram. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Некорректная заявка" }, { status: 400 }); }
  if (clean(body.website, 50)) return NextResponse.json({ ok: true }); // ловушка для спам-ботов
  const name = clean(body.name, 80);
  const phone = clean(body.phone, 30);
  if (name.length < 2 || phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ message: "Укажите имя и телефон" }, { status: 400 });
  }
  const comment = String(body.comment ?? "").trim().slice(0, 1_500);
  const page = clean(body.page, 300);
  try {
    const ip_hash = hashIp(clientIp(request.headers), dbSecret());
    // Отрицательный id — тот же телефон уже присылал заявку за 10 минут: сохранили, но в Telegram не шлём
    const result = await rpc<number>("site_add_lead", { p_lead: { name, phone, comment, page, ip_hash } });
    const id = Math.abs(result);
    const delivered = result > 0 ? await notifyLead({ id, name, phone, comment, page }).catch(() => 0) : 0;
    return NextResponse.json({ ok: true, id, delivered: delivered > 0 });
  } catch (error) {
    if (error instanceof DbError && error.code === TOO_MANY_LEADS) {
      return NextResponse.json({ message: "Слишком много заявок, попробуйте позже или позвоните нам" }, { status: 429 });
    }
    console.error("lead failed", error instanceof DbError ? `${error.message}: ${error.details}` : error);
    return NextResponse.json({ message: "Не удалось отправить заявку. Позвоните или напишите нам в мессенджер." }, { status: 502 });
  }
}

export const maxDuration = 20;
