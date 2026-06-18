# API

There is no public standalone REST API yet. The web app uses TanStack Start server functions (`createServerFn`) as typed RPC from React. The Telegram bot uses one HTTP webhook endpoint.

## Server functions

`public` here means callable through the TanStack Start server-function surface.
It does not mean direct browser writes to Supabase tables: sensitive writes to
`checks` and `reports` are service-role-only behind these handlers.

| RPC                       | Auth   | Input                                                                                                | Returns                                                                             |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `checkInput`              | public | `{ input: 1-2000, type?, lang }`                                                                     | risk result or `{ metaIntent, response }` for questions to the bot                  |
| `ocrExtract`              | public | `{ image: dataURL <= 6MB, lang }`                                                                    | `{ text }`                                                                          |
| `getPublicStats`          | public | none                                                                                                 | `{ total, today, confirmed_entities }`                                              |
| `submitReport`            | public | `{ value <= 500, type?, description 5-5000, scamType?, city?, amountLostUzs?, incidentOnly?, lang }` | `{ ok }` or `{ ok:false, error }`                                                   |
| `listReports`             | admin  | `{ status }`                                                                                         | report rows (<= 200)                                                                |
| `listEntities`            | admin  | `{ status }`                                                                                         | entity rows (<= 200)                                                                |
| `moderateReport`          | admin  | `{ reportId, decision, riskLevel }`                                                                  | `{ ok }`                                                                            |
| `submitReputationAppeal`  | public | `{ target, reason, contact?, lang }`                                                                 | `{ ok, duplicate? }` or safe error                                                  |
| `listReputationAppeals`   | admin  | `{ status }`                                                                                         | appeal rows                                                                         |
| `resolveReputationAppeal` | admin  | `{ appealId, decision, note? }`                                                                      | `{ ok }`                                                                            |
| `adminStats`              | admin  | none                                                                                                 | `{ reports_new, reports_confirmed, entities_confirmed, checks_total, appeals_new }` |

Input validation is zod. Check/OCR rate limits throw an error with `status=429`
and `retryAfter`; report rate limits return `{ ok:false, error:"rate_limited",
retryAfterSec }`. Admin functions throw `Unauthorized` or `Forbidden: admin only`.

## Telegram webhook

- Path: `POST /api/telegram/webhook`.
- Binding: `src/server.ts` intercepts the request before SSR.
- Handler: `src/lib/telegram/webhook.server.ts`.
- Auth: Telegram `X-Telegram-Bot-Api-Secret-Token` must equal `TELEGRAM_WEBHOOK_SECRET`.
- Missing secrets or bad token => HTTP 401. Valid token with invalid body => HTTP 200 and ignore.
- Duplicate valid `update_id` deliveries are acknowledged with HTTP 200 and
  ignored. The handler uses an in-memory fast path plus the shared Supabase
  `telegram_webhook_updates` table, so Telegram retry duplicates are deduped
  across production instances. If the shared store is temporarily unavailable,
  the webhook falls back to local dedup and still processes the update rather
  than dropping user messages.
- `/panic` behaves as a small emergency copilot: selected scenarios store only `lastPanicId`/`lastPanicAt`, and short follow-up questions such as "what next", "bank number" or "what should I say" are answered contextually. `/call` is a direct entrypoint into the same live-call scenario (`lastPanicId=6`) and stores no phone number, call recording or raw evidence. Suspicious payloads still go through the normal risk pipeline.
- `/report` can submit a situation-only incident when the user has no concrete target. `incidentOnly=true` stores the redacted incident for moderation/research but does not upsert or bump public `entities`.
- `/appeal` submits a privacy-safe correction/removal request for phone,
  Telegram, URL or APK reputation. The server stores only target/contact hashes,
  masked display values and redacted reason text. Admin removal hides the public
  reputation label without deleting report history.
- Telegram photos/screenshots use structured image intelligence before scoring. Benign delivery SMS and restaurant/menu QR screenshots can be shown as `safe` only when no reason codes match; dangerous QR login/payment, OTP, APK and card-data requests still route through normal reason-code scoring.
- Telegram voice notes, native audio attachments and audio documents such as
  `.ogg`/`.m4a` use `handleVoice` -> `transcribeVoiceCore` -> `runCheck`.
  Audio is downloaded only in memory, files are capped at 60 seconds / 2 MB
  before transcription, and only the redacted transcript reaches the check
  pipeline. STT calls are protected by a separate 5/day per-user budget and
  repeated Telegram `file_unique_id` values reuse a short-lived in-memory
  redacted transcript cache. If STT is slow, the bot shows a Telegram activity
  indicator; if STT is missing or unreliable, it asks for a short typed summary
  and offers emergency actions. Clear "already sent code / installed APK /
  transferred money / entered card / lost Telegram / on a call" transcripts
  route directly to `/panic` instead of waiting for a generic risk card.
- AI-authored check explanations are filtered by `ai-output-safety.ts` before they can be returned or stored. If a provider output asks the user for codes, CVV/PIN/password/card/seed data, APK installs, wallet signing or payments, `explanation` becomes `null` and the deterministic verdict/advice remains.
- Telegram inline mode handles `inline_query` updates for `@scamguard_bot <number/link/text>`. Inline previews are rules-only (`skipAi=true`) and non-persistent (`persist=false`) so partial typed queries do not spam `checks` or AI providers. Enable inline mode separately in BotFather with `/setinline`.
- Telegram public username/link checks may call Bot API `getChat` after scoring to add a short metadata limitation/summary to the reply. Private invite/internal links skip lookup and receive an explicit limitation brief. This is presentation-only: score, level and reason codes remain deterministic.
- Telegram reputation labels come only from the app-owned `telegram_reputation_targets` source layer. Unverified user reports are not shown to users. Confirmed moderated reports may add a short source/confidence brief, explicitly distinguished from hidden Telegram SCAM labels or Telegram-internal report history.
- Family Shield uses `/family`, `family_*` deep links and `family:*` callbacks. Invite links are generated from HMAC-hashed tokens, pending invites expire after 24 hours, active-link duplicate creation is handled as a user-facing state, and trusted-contact alerts include no raw scam evidence. The trusted contact can opt out from future alerts from the alert itself.
- Plain questions to the bot are routed through `src/lib/meta-intent.ts` before risk scoring. Telegram account visibility questions explain that hidden scam labels, account age, report history and spam history are not available unless the user sends real context or a future moderated source exists.

## Auth flow

Browser session token (Supabase) is attached by `attachSupabaseAuth` on every server-function call. Admin functions validate it server-side (`requireSupabaseAuth`) and check the `admin` role in `user_roles`.

## Database RPC

- `get_check_stats()` is service-role-only. The browser no longer calls it directly; `getPublicStats` calls it through a server function.
- `claim_rate_limit()` is service-role-only. Server code calls it to atomically
  increment HMAC-hashed shared buckets for public checks, reports, Telegram
  public-post fetches, the voice STT daily budget and the opt-in Voice-out/TTS
  daily budget. Voice budgets use distinct key prefixes under the existing
  `check` scope so no raw Telegram id is persisted.
- `private.prune_app_retention()` is service-role/private maintenance SQL for retention cleanup. It is not exposed as a public API.

## External integrations

- **Supabase:** Postgres/Auth/RLS via `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **OpenAI-compatible AI provider:** `POST {OPENAI_BASE_URL}/chat/completions` (default `https://api.openai.com/v1`) with `OPENAI_API_KEY` and `OPENAI_MODEL` (default `gpt-4o-mini`). Used for explanations, web screenshot OCR and Telegram structured image analysis. Telegram voice STT uses Gemini native audio when `OPENAI_BASE_URL` points to `generativelanguage.googleapis.com`, otherwise OpenAI-compatible `/audio/transcriptions` with `OPENAI_TRANSCRIBE_MODEL` / `OPENAI_AUDIO_MODEL` / `gpt-4o-mini-transcribe`. Missing key, provider error or blocked unsafe explanation returns `null`; scoring continues where text evidence is available.
- **Telegram Voice-out/TTS:** opt-in SOS/Guardian voice tips prefer Gemini TTS when `GEMINI_TTS_API_KEY` is present (`gemini-3.1-flash-tts-preview` / `Kore` by default), wrapping Gemini PCM audio as WAV for Telegram. OpenAI TTS remains a fallback through `POST {OPENAI_TTS_BASE_URL}/audio/speech` with `OPENAI_TTS_API_KEY`, `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`) and `OPENAI_TTS_VOICE` (default `alloy`). If no dedicated TTS key exists, the bot may reuse `OPENAI_API_KEY` only when `OPENAI_BASE_URL` is not Gemini-like. Gemini/OpenAI-compatible chat endpoints are never treated as speech endpoints. Audio failures degrade to a text fallback; raw user evidence is not spoken back.
- **Telegram Bot API:** used by the bot handlers for replies, inline query answers, file metadata/image downloads, and best-effort public `getChat` metadata on Telegram username/link checks.

## Future B2B API

Planned, not built: `/v1/check/*`, `/v1/risk-score`, `/v1/report` with API-key auth for banks, fintechs and marketplaces.
