/* Общие проверки секретов. Сравнение за постоянное время, чтобы по скорости ответа
   нельзя было подбирать секрет посимвольно. */
import { createHmac, timingSafeEqual } from "node:crypto";

/** true только если обе строки непустые и совпадают. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual падает на разной длине, поэтому длину проверяем отдельно
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** IP клиента: первое значение x-forwarded-for (Vercel ставит его сам) или x-real-ip. */
export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "";
  return ip.slice(0, 64) || null;
}

/** В базу кладём не IP, а SHA-256 (HMAC) от IP с серверным секретом — сам адрес не восстановить. */
export function hashIp(ip: string | null, secret: string) {
  if (!ip) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}
