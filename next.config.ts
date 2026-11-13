import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Технический адрес Vercel дублирует сайт — переводим посетителей и поисковики на основной домен.
  // /api/ не трогаем: Telegram-вебхук и крон могут быть привязаны к этому адресу, а редиректы они не проходят.
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "oncarclik.vercel.app" }],
        destination: "https://www.oncarclick.com/:path",
        permanent: true
      }
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/index.html" }],
      afterFiles: [],
      fallback: []
    };
  }
};

export default nextConfig;
