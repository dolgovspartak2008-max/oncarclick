/* Минимальный клиент Telegram Bot API. Токен берётся только из переменной окружения Vercel. */

function token() {
  const value = process.env.TELEGRAM_BOT_TOKEN;
  if (!value) throw new Error("Токен бота не задан");
  return value;
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json() as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`Telegram: ${data.description ?? response.status}`);
  return data.result as T;
}

/** Скачивает файл из Telegram (фото отзыва) — ссылка с токеном наружу не уходит. */
export async function downloadFile(fileId: string) {
  const file = await tg<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Файл недоступен");
  const response = await fetch(`https://api.telegram.org/file/bot${token()}/${file.file_path}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Telegram файл: ${response.status}`);
  return response;
}

export const esc = (value: unknown) => String(value ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
