import { NextRequest, NextResponse } from "next/server";
import { getCarDetails } from "@/server/trust-encar";
import { withOurRate } from "@/server/rate";

type CarLoader = typeof getCarDetails;

export function createCarHandler(loadCar: CarLoader = getCarDetails) {
  return async function GET(request: NextRequest) {
    const id = (request.nextUrl.searchParams.get("id") ?? "").trim();
    if (!/^\d{4,12}$/.test(id)) return NextResponse.json({ message: "Неверный номер автомобиля." }, { status: 400 });
    try {
      const car = await loadCar(id);
      if (!car) return NextResponse.json({ message: "Автомобиль не найден — возможно, он уже продан." }, { status: 404 });
      const [priced] = await withOurRate([car]);
      return NextResponse.json(priced, { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } });
    } catch {
      return NextResponse.json({ message: "Источник временно не ответил. Попробуйте обновить страницу." }, { status: 502 });
    }
  };
}

export const GET = createCarHandler();
export const maxDuration = 30;
