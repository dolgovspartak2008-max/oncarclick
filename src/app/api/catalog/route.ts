import { NextRequest, NextResponse } from "next/server";
import { parseCatalogParams } from "@/domain/catalog";
import { sortByFinalPrice } from "@/domain/car-price";
import { getCatalog, getCatalogCount } from "@/server/trust-encar";
import { priceCars } from "@/server/rate";

type CatalogLoader = typeof getCatalog;
type CountLoader = typeof getCatalogCount;

const CACHE_HEADERS = { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" };
const FAILURE = { message: "Источник временно не ответил. Показываем последнюю сохранённую версию, если она доступна." };

export function createCatalogHandler(loadCatalog: CatalogLoader = getCatalog, loadCount: CountLoader = getCatalogCount, price: typeof priceCars = priceCars) {
  return async function GET(request: NextRequest) {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const filters = parseCatalogParams(params);
    try {
      // ?count=1 — только число машин по фильтрам: для кнопки «Показать N авто».
      if (params.count === "1") {
        return NextResponse.json(await loadCount(filters), { headers: CACHE_HEADERS });
      }
      const result = await loadCatalog(filters);
      // курс воны из Telegram-бота и пошлина по курсам ЦБ применяются поверх кеша каталога — меняются сразу
      const items = sortByFinalPrice(await price(result.items), filters.sort);
      return NextResponse.json({
        ...result,
        items,
        page: filters.page,
        hasMore: filters.page * filters.limit < result.total && result.items.length > 0
      }, { headers: CACHE_HEADERS });
    } catch {
      return NextResponse.json(FAILURE, { status: 502 });
    }
  };
}

export const GET = createCatalogHandler();
export const maxDuration = 60;
