import type { MetadataRoute } from "next";

const SITE = "https://www.oncarclick.com";

/** /sitemap.xml: страницы, которые реально есть в HTML. Карточки машин (car.html?id=…) сюда не входят:
    они рисуются в браузере, поисковику там пока нечего индексировать. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/catalog.html`, lastModified: now, changeFrequency: "daily", priority: 0.9 }
  ];
}
