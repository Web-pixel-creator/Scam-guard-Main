# API

There is no public standalone REST API yet. The web app uses TanStack Start server functions (`createServerFn`) as typed RPC from React. The Telegram bot uses one HTTP webhook endpoint.

## Server functions

`public` here means callable through the TanStack Start server-function surface.
It does not mean direct browser writes to Supabase tables: sensitive writes to
`checks` and `reports` are service-role-only behind these handlers.

| RPC              | Auth   | Input                                                                                                | Returns                                                                |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `checkInput`     | public | `{ input: 1-2000, type?, lang }`                                                                     | risk result or `{ metaIntent, response }` for questions to the bot     |
| `ocrExtract`     | public | `{ image: dataURL <= 6MB, lang }`                                                                    | `{ text }`                                                             |
| `submitReport`   | public | `{ value <= 500, type?, description 5-5000, scamType?, city?, amountLostUzs?, incidentOnly?, lang }` | `{ ok }` or `{ ok:false, error }`                                      |
| `listReports`    | admin  | `{ status }`                                                                                         | report rows (<= 200)                                                   |
| `listEntities`   | admin  | `{ status }`                                                                                         | entity rows (<= 200)                                                   |
| `moderateReport` | admin  | `{ reportId, decision, riskLevel }`                                                                  | `{ ok }`                                                               |
| `adminStats`     | admin  | none                                                                                                 | `{ reports_new, reports_confirmed, entities_confirmed, checks_total }` |

Input validation is zod. Rate limits throw an error with `status=429` and `retryAfter`. Admin functions throw `Unauthorized` or `Forbidden: admin only`.

## Telegram webhook

- Path: `POST /api/telegram/webhook`.
- Binding: `src/server.ts` intercepts the request before SSR.
- Handler: `src/lib/telegram/webhook.server.ts`.
- Auth: Telegram `X-Telegram-Bot-Api-Secret-Token` must equal `TELEGRAM_WEBHOOK_SECRET`.
- Missing secrets or bad token => HTTP 401. Valid token with invalid body => HTTP 200 and ignore.
- `/panic` behaves as a small emergency copilot: selected scenarios store only `lastPanicId`/`lastPanicAt`, and short follow-up questions such as "what next", "bank number" or "what should I say" are answered contextually. Suspicious payloads still go through the normal risk pipeline.
- `/report` can submit a situation-only incident when the user has no concrete target. `incidentOnly=true` stores the redacted incident for moderation/research but does not upsert or bump public `entities`.
- Telegram photos/screenshots use structured image intelligence before scoring. Benign delivery SMS and restaurant/menu QR screenshots can be shown as `safe` only when no reason codes match; dangerous QR login/payment, OTP, APK and card-data requests still route through normal reason-code scoring.
- Telegram public username/link checks may call Bot API `getChat` after scoring to add a short metadata limitation/summary to the reply. Private invite/internal links skip lookup and receive an explicit limitation brief. This is presentation-only: score, level and reason codes remain deterministic.
- Telegram reputation labels come only from the app-owned `telegram_reputation_targets` source layer. Unverified user reports are not shown to users. Confirmed moderated reports may add a short source/confidence brief, explicitly distinguished from hidden Telegram SCAM labels or Telegram-internal report history.
- Plain questions to the bot are routed through `src/lib/meta-intent.ts` before risk scoring. Telegram account visibility questions explain that hidden scam labels, account age, report history and spam history are not available unless the user sends real context or a future moderated source exists.

## Auth flow

Browser session token (Supabase) is attached by `attachSupabaseAuth` on every server-function call. Admin functions validate it server-side (`requireSupabaseAuth`) and check the `admin` role in `user_roles`.

## Public DB RPC

- `get_check_stats()` returns aggregate homepage counts without exposing the `checks` table.

## External integrations

- **Supabase:** Postgres/Auth/RLS via `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **OpenAI-compatible AI provider:** `POST {OPENAI_BASE_URL}/chat/completions` (default `https://api.openai.com/v1`) with `OPENAI_API_KEY` and `OPENAI_MODEL` (default `gpt-4o-mini`). Used for explanations, web screenshot OCR and Telegram structured image analysis. Missing key or provider error returns `null`; scoring continues where text evidence is available.
- **Telegram Bot API:** used by the bot handlers for replies, file metadata/image downloads, and best-effort public `getChat` metadata on Telegram username/link checks.

## Future B2B API

Planned, not built: `/v1/check/*`, `/v1/risk-score`, `/v1/report` with API-key auth for banks, fintechs and marketplaces.
