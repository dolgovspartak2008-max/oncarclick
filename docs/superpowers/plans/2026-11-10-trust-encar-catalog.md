# Trust Encar Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve real Trust Encar vehicles in the existing ON Car Click catalog with daily refreshes and resilient cached fallback.

**Architecture:** Keep the existing visual site as static assets under Next.js `public/`. Add a focused Trust Encar parser/client and cached API routes, then update only the catalog browser logic to consume those routes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Cheerio, Zod, Vitest, existing HTML/CSS/JavaScript.

## Global Constraints

- Preserve the current ON Car Click design and contact flow.
- Refresh catalog data every 24 hours.
- Accept upstream URLs and images only from `trust-encar.ru` over HTTPS.
- Do not require a database or private feed credential.
- Keep implementation minimal and reuse the proven Trust Encar parsing behavior from ASIA Trade Car.

---

### Task 1: Next.js shell and Trust Encar domain parser

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/domain/catalog.ts`, `src/domain/trust-encar.ts`
- Test: `src/domain/catalog.test.ts`, `src/domain/trust-encar.test.ts`
- Move: existing static site files into `public/`

**Interfaces:**
- Produces: `parseCatalogParams()`, `parseTrustEncarBootstrap()`, `normalizeTrustEncarRecords()`, and `buildTrustEncarSearchBody()`.

- [ ] Write parser and query tests for valid, malformed, and hostile input.
- [ ] Run the focused tests and confirm they fail because the modules do not exist.
- [ ] Add the minimal Next.js shell and domain functions.
- [ ] Run focused tests until they pass.
- [ ] Commit the independently working parser and shell.

### Task 2: Daily cached catalog API

**Files:**
- Create: `src/server/trust-encar.ts`
- Create: `src/app/api/catalog/route.ts`
- Create: `src/app/api/internal/sync/route.ts`
- Create: `vercel.json`
- Test: `src/server/trust-encar.test.ts`, `src/app/api/catalog/route.test.ts`

**Interfaces:**
- Consumes: the Task 1 parser and validated `CatalogFilters`.
- Produces: `getCatalog(filters)` and JSON `{ items, total, page, hasMore, makes, models }`.

- [ ] Write failing tests for response mapping, 24-hour cache policy, authorization, and upstream failure handling.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the minimal server client, public API route, daily invalidation/warm route, and cron schedule.
- [ ] Run focused tests and the complete suite.
- [ ] Commit the working server integration.

### Task 3: Existing-design catalog client

**Files:**
- Create: `public/js/catalog-model.js`
- Modify: `public/js/catalog.js`, `public/catalog.html`, `public/css/style.css`
- Remove: `public/js/cars-data.js`
- Test: `tests/catalog-model.test.ts`, `tests/static-catalog.test.ts`

**Interfaces:**
- Consumes: `/api/catalog` JSON from Task 2.
- Produces: real cards, filters, pagination, favorites, loading/error states, and local cached fallback in the current visual design.

- [ ] Write failing tests for query creation, vehicle normalization, safe text output, real-image markup, and removal of demo data.
- [ ] Run the focused tests and confirm expected failures.
- [ ] Implement the browser model and update the existing catalog renderer and minimal supporting markup/styles.
- [ ] Run focused tests and the complete suite.
- [ ] Commit the completed catalog UI.

### Task 4: Documentation and end-to-end verification

**Files:**
- Modify: `README.md`
- Create: `.env.example`

**Interfaces:**
- Consumes: the finished application.
- Produces: deployable repository and operator instructions.

- [ ] Document local start, Vercel deployment, daily refresh, and optional `CRON_SECRET`.
- [ ] Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` with zero failures.
- [ ] Start the production server and verify `/`, `/catalog.html`, `/api/catalog?limit=1`, and `/api/internal/sync`.
- [ ] Review the final diff for design regressions, secrets, placeholders, and unrelated changes.
- [ ] Commit the verified documentation and deployment state.
