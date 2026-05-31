# Architecture

## Stack (actual)

- **Framework:** TanStack Start v1 (full-stack React, SSR) + TanStack Router (file-based) + TanStack Query.
- **UI:** React 19, Tailwind CSS v4, shadcn/ui (new-york style) on Radix UI, lucide icons.
- **Backend:** TanStack **server functions** (`createServerFn`) — no separate API server. Runs on the SSR/edge runtime (Nitro; default target Cloudflare via Lovable config).
- **Data:** Supabase (Postgres + Auth + RLS), provisioned through **Lovable Cloud**.
- **AI:** Lovable AI Gateway (`https://ai.gateway.lovable.dev`), model `google/gemini-2.5-flash`, used for (a) scam explanations and (b) screenshot OCR + redaction.
- **Build/tooling:** Vite 7, Bun (lockfile `bun.lock`), ESLint + Prettier, TypeScript.

## Clients

Single **web app** today (SSR). Routes: `/`, `/check`, `/report`, `/emergency`, `/privacy`, `/login`, `/admin`. Planned: Telegram bot, mobile app, B2B API (see `OPEN_TASKS.md`).

## Main data flow — a "check"

1. User submits text/phone/Telegram/url/apk (or a screenshot) on `/` or `/check` (`CheckInput`).
2. (Screenshot path) `ocrExtract` server fn → Gemini Vision extracts + redacts text.
3. `checkInput` server fn runs:
   - rate limit per IP (10/min, in-memory),
   - `detectInputType` → `normalize` → `maskForDisplay` + `redactText`,
   - rule evaluators (`evaluateText/Url/Phone/Telegram`) produce **reason codes**,
   - lookup of the hashed identifier in `entities`; confirmed `high_risk` boosts score,
   - `scoreFromCodes` → numeric score + `risk_level`,
   - `aiExplain` → localized natural-language explanation,
   - logs a redacted row into `checks`.
4. `RiskResultCard` shows level, reasons, AI explanation, advice.
5. User may submit a report (`submitReport`) → stored in `reports`, bumps/creates an `entities` row (`moderation_status='new'`).
6. Admin (`/admin`) reviews via `listReports`/`listEntities`, calls `moderateReport` → confirms/rejects, syncing the `entities` risk + status.

## Risk engine (rules-first, AI second)

Deterministic rules live in `src/lib/risk/`. Each matched pattern maps to a weighted `ReasonCode` (e.g. `asks_for_otp`=45, `apk_download_link`=45, `verified_official`=-100). Thresholds: ≥50 → `high_risk`, ≥20 → `suspicious`, >0 → `unknown`. AI only *explains*; it does not decide the score. Patterns are bilingual (RU + UZ Latin) — see `rules.ts`.

## Auth & roles

Supabase Auth (email). Client attaches the bearer token to server fns via `attachSupabaseAuth` middleware; protected admin fns use `requireSupabaseAuth` + an `assertAdmin` DB check. Admin role is granted on signup only if the email is in `admin_allowlist` (DB trigger `handle_new_user_role`).

## Two Supabase clients

- `client.ts` — browser client, **publishable** key, RLS-enforced (used for auth/session + reading own roles).
- `client.server.ts` — **service-role** key, bypasses RLS, server-only (all writes/admin reads). Never import into client code.

## Error handling

`src/server.ts` wraps the SSR entry and normalizes catastrophic h3-swallowed 500s into a friendly HTML error page; `src/start.ts` registers request + function middleware. `error-capture.ts` / `lovable-error-reporting.ts` capture errors.

## Platform constraints (design implications)

- iOS can't fully inspect live calls; Telegram private chats can't be auto-scanned by third parties → UX is **forward / paste / screenshot**, not background interception.
- In-memory rate limit and `entities` cache are per-worker and best-effort, not a hard guarantee.
