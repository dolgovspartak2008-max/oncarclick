import { NextRequest, NextResponse } from "next/server";
import { parseCatalogParams } from "@/domain/catalog";
import { getCatalog } from "@/server/trust-encar";

type CatalogLoader = typeof getCatalog;

export function createCatalogHandler(loadCatalog: CatalogLoader = getCatalog) {
  return async function GET(request: NextRequest) {
    const filters = parseCatalogParams(Object.fromEntries(request.nextUrl.searchParams));
    try {
      const result = await loadCatalog(filters);
      return NextResponse.json({
        ...result,
        page: filters.page,
        hasMore: filters.page * filters.limit < result.total && result.items.length > 0
      }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" } });
    } catch {
      return NextResponse.json({
        message: "Источник временно не ответил. Показываем последнюю сохранённую версию, если она доступна."
      }, { status: 502 });
    }
  };
}

export const GET = createCatalogHandler();
