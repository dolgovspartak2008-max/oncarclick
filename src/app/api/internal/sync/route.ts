import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { parseCatalogParams } from "@/domain/catalog";
import { CATALOG_CACHE_TAG, getCatalog } from "@/server/trust-encar";

export function isSyncAuthorized(headers: Headers, secret = process.env.CRON_SECRET) {
  return !secret || headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  if (!isSyncAuthorized(request.headers)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    revalidateTag(CATALOG_CACHE_TAG, "max");
    const catalog = await getCatalog(parseCatalogParams({ page: "1", limit: "24" }));
    return NextResponse.json({ ok: true, received: catalog.items.length, total: catalog.total });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Sync failed" }, { status: 502 });
  }
}

export const GET = run;
export const POST = run;
export const maxDuration = 60;
