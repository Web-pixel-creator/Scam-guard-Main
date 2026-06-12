# Architecture

## Stack

- **Framework:** TanStack Start v1 (full-stack React, SSR) + TanStack Router + TanStack Query.
- **UI:** React 19, Tailwind CSS v4, shadcn/ui on Radix UI, lucide icons.
- **Backend:** TanStack server functions (`createServerFn`) plus a Node SSR entry at `src/server.ts`.
- **Runtime:** Nitro v3 `node-server` preset. The production artifact is `dist/server/index.mjs`; it runs on Node 22+ and is Docker/Railway/Render/Fly/VPS-friendly.
- **Data:** Supabase Postgres + Auth + RLS. The project owns its Supabase project; no Lovable Cloud runtime dependency.
- **AI:** Provider-neutral OpenAI-compatible Chat Completions. `OPENAI_API_KEY` enables explanations and screenshot OCR; `OPENAI_MODEL` and `OPENAI_BASE_URL` are optional.
- **Tooling:** Vite 7, Bun lockfile, TypeScript, Vitest, ESLint/Prettier.

## Clients and channels

- Web SSR app: `/`, `/check`, `/report`, `/emergency`, `/privacy`, `/login`, `/admin`.
- Telegram bot channel: webhook endpoint `POST /api/telegram/webhook` is intercepted in `src/server.ts` before SSR and delegated to `src/lib/telegram/webhook.server.ts`.
- Planned later: mobile app and B2B API.

## Main data flow: a check

1. User submits text/phone/Telegram/url/apk/payment-like text or screenshot.
2. Web screenshot OCR path: `ocrExtract` -> `ocrExtractCore` -> `ocrScreenshot`; the AI output is passed through deterministic `redactText` before returning.
3. Telegram image path: `analyzeImageCore` returns structured, redacted image evidence (visual category, QR purpose, risk hints, OCR text). The bot builds a safe rules-input from that evidence, runs `runCheck(skipAi=true)`, and uses the image evidence explanation for the reply.
4. Short questions to the bot itself go through `meta-intent.ts` before scoring; concrete URLs, phones, usernames, forwarded text, bank/payment terms, APK mentions and long text bypass this and still reach `runCheck`.
5. `runCheck` performs shared rate-limit, input detection, normalization, display masking, `redactText`, rule evaluation, entity lookup, scoring, optional AI explanation and a redacted `checks` insert. For phone inputs it also builds an honest `PhoneIntelligencePassport` with country/calling-code, Uzbekistan prefix/operator hints and official-directory status; this is explanatory metadata and does not claim an owner. If a phone `entities` row is confirmed, it also returns `PhoneReputationSummary` with Ishonch Guard moderated report count/confidence only.
6. `RiskResultCard` or Telegram formatting shows level, score, reason labels, advice and optional explanation.
7. User reports go through `submitReport`; both the identifier and the free-form description are redacted/hashed as appropriate before persistence.
8. Admins moderate reports in `/admin`; public `entities` reputation changes only after moderation.

## Risk engine

The engine is rules-first. `src/lib/risk/rules.ts` maps matched patterns to weighted `ReasonCode`s. Thresholds: score >= 50 => `high_risk`, score >= 20 => `suspicious`, score > 0 => `unknown`; `verified_official` forces `safe`.

AI never decides the score. It only explains the deterministic verdict or performs OCR extraction. If AI is unavailable, the verdict still works.

## Telegram bot architecture

- Webhook auth fails closed when `TELEGRAM_BOT_TOKEN` or `TELEGRAM_WEBHOOK_SECRET` is missing.
- The secret header is checked before body parsing.
- Invalid bodies after a valid token return 200 so Telegram stops retrying.
- Telegram `update_id` dedup uses an in-memory fast path plus the shared
  Supabase `telegram_webhook_updates` table, so retry deliveries are processed
  once across production instances. If the shared store is temporarily
  unavailable, the webhook fails open to local dedup so user updates are not
  dropped.
- Bot session state is stored in Supabase `telegram_sessions`, not memory.
- Images are downloaded in memory, capped at 6 MB, analyzed/OCR'd, and discarded. Telegram image scoring uses structured evidence so benign delivery SMS and restaurant/menu QR screenshots do not become high-risk unless a real dangerous request is visible.
- Telegram `@username` / `t.me/...` checks use a best-effort Bot API enrichment layer after deterministic scoring. It classifies public usernames, public links, private invite links and internal/private links; summarizes public chat type/title/access hints when visible; adds compact visible risk signals and next steps; and explicitly does not infer account age, hidden Telegram scam labels, Telegram report counts or spam history.
- Public forwarded Telegram channel/group source context is presentation-only. The router may pass a sanitized source title/public username into the reply so users understand where a forwarded post came from. When reason codes reveal a concrete tactic, the bot renders a compact mini-brief: source, scheme, attacker goal, safe step and Telegram visibility limit. Source metadata is not appended to `runCheck` input, does not affect score/level/reasons and is not persisted in `checks`.
- Telegram reputation is stored separately in `telegram_reputation_targets` using HMAC-hashed targets and masked display hints. New checks can record first/last seen observations, but user-facing reputation labels are shown only after admin-moderated Ishonch Guard reports or future official sources.
- Public check/report throttling uses a shared Supabase `rate_limit_buckets`
  table via service-role-only `claim_rate_limit()`, with raw rate-limit keys
  HMAC-hashed before persistence. Local/test environments fall back to the
  previous in-memory limiter when Supabase or `HASH_PEPPER_SECRET` is absent.

## Auth and roles

Supabase Auth powers browser sessions. Client middleware attaches the bearer token to server-function calls. Admin functions validate the session server-side (`requireSupabaseAuth`) and check `user_roles` via `assertAdmin`.

## Constraints

- Telegram private chats and live calls cannot be silently inspected. The model is user-forward/paste/screenshot.
- Rate limits are shared through Supabase for the current production topology.
  Redis/KV remains a later option only if traffic outgrows Postgres-backed
  buckets.
- Do not reintroduce Lovable Cloud/runtime coupling. Vite/TanStack/Nitro are configured directly in `vite.config.ts`.
