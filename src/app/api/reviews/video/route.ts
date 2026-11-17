import { NextRequest, NextResponse } from "next/server";
import { rpc } from "@/server/db";
import { fetchFilePart, fileInfo } from "@/server/telegram";

/** Отдаём видео кусками: так плеер на телефоне может перематывать, а ответ функции остаётся небольшим. */
const CHUNK = 3 * 1024 * 1024;

export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!size) return null;
  const match = (header ?? "bytes=0-").match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  let start: number, end: number;
  if (!match[1]) { start = Math.max(0, size - Number(match[2])); end = size - 1; }
  else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
  if (start > end || start >= size) return null;
  return { start, end: Math.min(end, start + CHUNK - 1) };
}

/** Видео отзыва из Telegram. Только видео опубликованных отзывов; ссылка с токеном бота наружу не уходит. */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("f") ?? "";
  if (!/^[\w-]{10,200}$/.test(fileId)) return new NextResponse(null, { status: 400 });
  try {
    if (!(await rpc<boolean>("bot_video_allowed", { p_file: fileId }))) return new NextResponse(null, { status: 404 });
    const { path, size } = await fileInfo(fileId);
    const range = parseRange(request.headers.get("range"), size);
    if (!range) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const file = await fetchFilePart(path, `bytes=${range.start}-${range.end}`);
    if (!file.ok) return new NextResponse(null, { status: 502 });
    const type = /\.webm$/i.test(path) ? "video/webm" : /\.mov$/i.test(path) ? "video/quicktime" : "video/mp4";
    if (file.status !== 206) {
      // Сервер Telegram проигнорировал Range — отдаём файл целиком (он не больше 20 МБ).
      return new NextResponse(file.body, { headers: { "Content-Type": type, "Accept-Ranges": "none", "Cache-Control": "private, max-age=3600" } });
    }
    return new NextResponse(file.body, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
        // Куски разные для разных Range — общий CDN-кеш их перепутает, кешируем только в браузере.
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}

export const maxDuration = 30;
