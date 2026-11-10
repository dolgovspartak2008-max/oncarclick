import { NextResponse } from "next/server";
import { select } from "@/server/db";
import { REVIEWS_TAG } from "@/server/bot";

type Row = { id: number; name: string; city: string | null; car: string | null; country: string | null; rating: number; body: string; photo_file_id: string | null; created_at: string };

/** Опубликованные отзывы для главной страницы. */
export async function GET() {
  try {
    const rows = await select<Row[]>(
      "reviews?select=id,name,city,car,country,rating,body,photo_file_id,created_at&published=eq.true&order=created_at.desc&limit=30",
      [REVIEWS_TAG], 600
    );
    const reviews = rows.map((row) => ({
      id: row.id, name: row.name, city: row.city, car: row.car, country: row.country, rating: row.rating, text: row.body,
      date: row.created_at,
      photo: row.photo_file_id ? `/api/reviews/photo?f=${encodeURIComponent(row.photo_file_id)}` : null
    }));
    return NextResponse.json({ reviews }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=600" } });
  } catch {
    return NextResponse.json({ reviews: [] });
  }
}
