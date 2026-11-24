# Public Gate Leads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public client lead form to `@OnCarClickk_bot`, notify its owners, and add Telegram ID `944732927` as an owner.

**Architecture:** Extend the existing gate-bot handler with a small client state machine. Reuse `bot_get_state`, `bot_set_state`, `site_add_lead`, existing rate limits, and existing Telegram clients; no dependency or schema change.

**Tech Stack:** Next.js 16, TypeScript, Telegram Bot API, Supabase RPC, Vitest.

## Global Constraints

- Keep existing owner workflow and main service bot unchanged.
- Store no raw IP or Telegram ID in the rate-limit field.
- Escape all client text sent with Telegram HTML mode.
- Catalogue URL is `https://www.oncarclick.com/catalog.html`.
- Add owner `944732927` idempotently.

---

### Task 1: Client form and delivery

**Files:**
- Modify: `src/server/gate.ts`
- Test: `src/server/gate.test.ts`

**Interfaces:**
- Consumes: `rpc`, `dbSecret`, `hashIp`, `notifyLead`, `gateTg`.
- Produces: public `/start`, `/request`, client form callbacks, saved `Lead` notification.

- [ ] **Step 1: Write failing tests**

Add tests asserting that non-owners receive the public menu, complete name/car/budget/phone steps, can send a Telegram contact, preview escaped data, cancel, save via `site_add_lead`, notify `gate_owner_ids`, receive the catalogue link, fall back to `notifyLead`, and see rate-limit errors.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run src/server/gate.test.ts --reporter=dot`

Expected: failures because non-owners currently receive “Доступа нет” and no client state machine exists.

- [ ] **Step 3: Implement minimal state machine**

Add `ClientDraft`, `ClientState`, public keyboards, validation helpers, client message/callback handlers, existing-state RPC calls, `site_add_lead` with `hashIp('telegram:' + chat, dbSecret())`, owner notification, main-bot fallback, and success message with URL button.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm exec vitest run src/server/gate.test.ts --reporter=dot`

Expected: all gate tests pass.

### Task 2: Second owner and webhook setup

**Files:**
- Modify: `src/server/webhook.ts`
- Test: `src/server/webhook.test.ts`

**Interfaces:**
- Consumes: `rpc('gate_claim', ...)`.
- Produces: `ensureGateOwners()` called by `ensureGateWebhook()`.

- [ ] **Step 1: Write failing test**

Assert that production gate webhook setup calls `gate_claim` with `{ p_chat: 944732927, p_name: null, p_by_code: true }`, and setup remains resilient when the row already exists.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run src/server/webhook.test.ts --reporter=dot`

Expected: `gate_claim` was not called.

- [ ] **Step 3: Implement owner seeding**

Add constant `DEFAULT_GATE_OWNER_IDS = [944732927]` and idempotent RPC calls before checking/resetting the gate webhook. Log errors and retain existing webhook behavior.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm exec vitest run src/server/webhook.test.ts --reporter=dot`

Expected: all webhook tests pass.

### Task 3: Documentation and deployment

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: operator documentation for public client flow and owner access.

- [ ] **Step 1: Update documentation**

Document the four fields, owner-only administrative path, catalogue link, rate limits, fallback delivery, and new owner ID.

- [ ] **Step 2: Full verification**

Run: `pnpm test --reporter=dot`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

Expected: zero failures and successful production build.

- [ ] **Step 3: Publish and observe**

Commit, push `main`, wait for Vercel success, call the live webhook endpoint without a secret and verify HTTP 401, then ask the user to inspect the public `/start` flow only if direct Telegram interaction cannot be performed without sending messages from their account.
