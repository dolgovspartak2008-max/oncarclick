/* Выполняется один раз при запуске серверного экземпляра (в том числе после каждого деплоя).
   Проверяем, что вебхук Telegram-бота указывает на сайт с актуальным секретом. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL_ENV !== "production") return;
  const { ensureWebhook, ensureGateWebhook } = await import("./server/webhook");
  await Promise.all([ensureWebhook(), ensureGateWebhook()]); // ошибки внутри уже перехвачены

}
