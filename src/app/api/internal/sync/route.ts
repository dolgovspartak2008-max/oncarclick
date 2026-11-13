import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { parseCatalogParams } from "@/domain/catalog";
import { CATALOG_CACHE_TAG, getCatalog } from "@/server/trust-encar";
import { safeEqual } from "@/server/secure";
import { ensureWebhook } from "@/server/webhook";

/** Без CRON_SECRET доступа нет. Vercel Cron сам присылает `Authorization: Bearer <CRON_SECRET>`. */
export function isSyncAuthorized(headers: Headers, secret = process.env.CRON_SECRET) {
  if (!secret) return false;
  return safeEqual(headers.get("authorization"), `Bearer ${secret}`);
}

async function run(request: NextRequest) {
  if (!isSyncAuthorized(request.headers)) return NextResponse.json({ ok: false }, { status: 401 });
  const webhook = await ensureWebhook(); // раз в сутки заодно проверяем вебхук бота
  try {
    revalidateTag(CATALOG_CACHE_TAG, "max");
    const catalog = await getCatalog(parseCatalogParams({ page: "1", limit: "24" }));
    return NextResponse.json({ ok: true, received: catalog.items.length, total: catalog.total, webhook });
  } catch (error) {
    // Подробности — только в логи Vercel, наружу не отдаём
    console.error("catalog sync failed", error);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}

export const GET = run;
export const POST = run;
export const maxDuration = 60;
