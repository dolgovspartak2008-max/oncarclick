/* Supabase через REST (без лишних пакетов). Публичный ключ даёт только чтение опубликованного,
   всё остальное — через функции базы, которые требуют серверный секрет BOT_DB_SECRET. */

type RpcArgs = Record<string, unknown>;

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("База не настроена");
  return { url: url.replace(/\/$/, ""), key };
}

export function dbSecret() {
  const secret = process.env.BOT_DB_SECRET;
  if (!secret) throw new Error("Секрет базы не задан");
  return secret;
}

export async function rpc<T>(fn: string, args: RpcArgs = {}): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ p_secret: dbSecret(), ...args }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`База ответила ${response.status}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Чтение публичных данных (опубликованные отзывы, курс) с коротким кешем. */
export async function select<T>(path: string, tags: string[], revalidate = 300): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Accept: "application/json" },
    next: { revalidate, tags },
    signal: AbortSignal.timeout(8_000)
  } as RequestInit);
  if (!response.ok) throw new Error(`База ответила ${response.status}`);
  return response.json() as Promise<T>;
}
