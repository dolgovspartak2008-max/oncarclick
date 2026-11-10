# Trust Encar catalog integration design

## Goal

Replace the demo inventory in ON Car Click with real South Korean vehicles and calculated Vladivostok prices from the public Trust Encar catalog. Keep the current ON Car Click layout, colors, typography, navigation, and contact flow unchanged.

## Architecture

The existing static pages move under `public/` and continue to render unchanged. A small Next.js server adds catalog endpoints while serving the same HTML, CSS, images, and browser JavaScript. The server reads Trust Encar's public catalog, validates its response, normalizes vehicle records, and returns a stable JSON shape to the existing catalog page.

Catalog responses use Next.js' persistent data cache with a 24-hour revalidation period. A daily Vercel cron invalidates and warms the first catalog page. When refresh fails, the previously cached response remains usable; the browser also keeps its last successful catalog response in local storage and shows a clear non-blocking warning when it must use that copy.

## Data flow

1. `catalog.html` requests `/api/catalog` with page, make, model, engine, and sort parameters.
2. The API validates all query parameters and retrieves the matching Trust Encar catalog page.
3. Trust Encar records are normalized into ON Car Click fields: id, make, model, trim, year, mileage, engine, fuel, drive, price in rubles, photos, and lot metadata.
4. The browser renders real photos and data inside the existing card design, maintains favorites, and supports pagination.
5. At 02:00 UTC every day, `/api/internal/sync` invalidates the cache and warms page one.

## Safety and failure behavior

- Only HTTPS URLs on `trust-encar.ru` are accepted for catalog configuration and images.
- User-controlled pagination, sorting, and filters are bounded before being forwarded.
- Upstream calls have timeouts and malformed responses are rejected.
- The API never exposes upstream nonces or internal response bodies.
- Failed refreshes return a friendly 502 response; the browser falls back to its last successful page.

## Testing

- Parser tests cover valid catalog HTML, malicious upstream URLs, and malformed configuration.
- Query tests cover page limits, sort mapping, and filter serialization.
- Browser-model tests cover normalized cards, engine labels, and request URLs.
- Final verification runs tests, lint, type checking, a production build, and a live Trust Encar smoke request.

## Deployment

The project targets Vercel because server-side catalog access and scheduled refreshes cannot run on GitHub Pages. No database or private Trust Encar credentials are required for the public-catalog integration. An optional `CRON_SECRET` protects manual cache refreshes when configured.
