/** Адрес сайта: SITE_URL, а если её нет — продакшен-домен Vercel. Заголовок Host не используем:
    его присылает клиент, и подделанный Host увёл бы вебхук на чужой сервер. */
type SiteEnv = { SITE_URL?: string; VERCEL_PROJECT_PRODUCTION_URL?: string };

export function siteOrigin(env: SiteEnv = process.env) {
  const raw = (env.SITE_URL || env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "https:" ? url.origin : null; // Telegram принимает только https
  } catch {
    return null;
  }
}
