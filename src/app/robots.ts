import type { MetadataRoute } from "next";

const SITE = "https://www.oncarclick.com";

/** /robots.txt: служебные API и личное «Избранное» не индексируем. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/favorites.html"] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE
  };
}
