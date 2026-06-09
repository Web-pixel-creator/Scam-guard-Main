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
5. `runCheck` performs rate-limit, input detection, normalization, display masking, `redactText`, rule evaluation, entity lookup, scoring, optional AI explanation and a redacted `checks` insert.
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
- Bot session state is stored in Supabase `telegram_sessions`, not memory.
- Images are downloaded in memory, capped at 6 MB, analyzed/OCR'd, and discarded. Telegram image scoring uses structured evidence so benign delivery SMS and restaurant/menu QR screenshots do not become high-risk unless a real dangerous request is visible.
- Telegram `@username` / `t.me/...` checks use a best-effort Bot API enrichment layer after deterministic scoring. It classifies public usernames, public links, private invite links and internal/private links; summarizes public chat type/title/access hints when visible; adds compact visible risk signals and next steps; and explicitly does not infer account age, hidden Telegram scam labels, Telegram report counts or spam history.

## Auth and roles

Supabase Auth powers browser sessions. Client middleware attaches the bearer token to server-function calls. Admin functions validate the session server-side (`requireSupabaseAuth`) and check `user_roles` via `assertAdmin`.

## Constraints

- Telegram private chats and live calls cannot be silently inspected. The model is user-forward/paste/screenshot.
- In-memory rate limit is best-effort per process. Use Redis/KV before multi-instance high-traffic production.
- Do not reintroduce Lovable Cloud/runtime coupling. Vite/TanStack/Nitro are configured directly in `vite.config.ts`.
