import { NextRequest, NextResponse } from "next/server";
import { parseCatalogParams } from "@/domain/catalog";
import { getCatalogOptions } from "@/server/trust-encar";

type OptionsLoader = typeof getCatalogOptions;

export function createOptionsHandler(loadOptions: OptionsLoader = getCatalogOptions) {
  return async function GET(request: NextRequest) {
    const filters = parseCatalogParams(Object.fromEntries(request.nextUrl.searchParams));
    try {
      const result = await loadOptions(filters);
      return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" } });
    } catch (error) {
      console.error("catalog options failed", JSON.stringify({ make: filters.make, model: filters.model, generation: filters.generation }), error);
      return NextResponse.json({ message: "Не удалось загрузить список вариантов." }, { status: 502 });
    }
  };
}

export const GET = createOptionsHandler();
export const maxDuration = 60;
