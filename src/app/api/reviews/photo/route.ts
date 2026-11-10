import { NextRequest, NextResponse } from "next/server";
import { rpc } from "@/server/db";
import { downloadFile } from "@/server/telegram";

/** Фото отзыва из Telegram. Отдаём только фото опубликованных отзывов; ссылка с токеном наружу не уходит. */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("f") ?? "";
  if (!/^[\w-]{10,200}$/.test(fileId)) return new NextResponse(null, { status: 400 });
  try {
    if (!(await rpc<boolean>("bot_photo_allowed", { p_file: fileId }))) return new NextResponse(null, { status: 404 });
    const file = await downloadFile(fileId);
    const type = file.headers.get("content-type") ?? "";
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": type.startsWith("image/") ? type : "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, immutable"
      }
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
