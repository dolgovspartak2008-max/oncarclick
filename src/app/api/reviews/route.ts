import { NextResponse } from "next/server";
import { select } from "@/server/db";
import { REVIEWS_TAG } from "@/server/bot";

type Row = { id: number; name: string; city: string | null; car: string | null; country: string | null; rating: number; body: string; photo_file_id: string | null; photo_url: string | null; created_at: string;
  review_date: string | null; video_file_id: string | null; video_thumb_file_id: string | null };

const photoUrl = (fileId: string) => `/api/reviews/photo?f=${encodeURIComponent(fileId)}`;

/** Опубликованные отзывы для главной страницы. */
export async function GET() {
  try {
    const rows = await select<Row[]>(
      "reviews?select=id,name,city,car,country,rating,body,photo_file_id,photo_url,created_at,review_date,video_file_id,video_thumb_file_id&published=eq.true&order=position.asc.nullsfirst,created_at.desc&limit=30",
      [REVIEWS_TAG], 600
    );
    const reviews = rows.map((row) => ({
      id: row.id, name: row.name, city: row.city, car: row.car, country: row.country, rating: row.rating, text: row.body,
      // Дата, которую указал администратор; у старых отзывов без неё — дата публикации
      date: row.review_date ?? row.created_at,
      photo: row.photo_url ? row.photo_url : row.photo_file_id ? photoUrl(row.photo_file_id) : null,
      video: row.video_file_id ? `/api/reviews/video?f=${encodeURIComponent(row.video_file_id)}` : null,
      poster: row.video_thumb_file_id ? photoUrl(row.video_thumb_file_id) : null
    }));
    return NextResponse.json({ reviews }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=600" } });
  } catch {
    // Сбой базы не кешируем, иначе браузер минуту показывает пустой блок вместо отзывов
    return NextResponse.json({ reviews: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
