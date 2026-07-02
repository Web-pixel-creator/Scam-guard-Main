# API

There is no public standalone REST API yet. The web app uses TanStack Start server functions (`createServerFn`) as typed RPC from React. The Telegram bot uses one HTTP webhook endpoint.

## Server functions

`public` here means callable through the TanStack Start server-function surface.
It does not mean direct browser writes to Supabase tables: sensitive writes to
`checks` and `reports` are service-role-only behind these handlers.

| RPC                       | Auth   | Input                                                                                                | Returns                                                                                               |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `checkInput`              | public | `{ input: 1-2000, type?, lang, embed? }`                                                            | risk result or `{ metaIntent, response }` for questions to the bot                                    |
| `ocrExtract`              | public | `{ image: png/jpeg/webp base64 dataURL <= 4 MiB decoded, lang }`                                     | `{ text }`                                                                                            |
| `getPublicStats`          | public | none                                                                                                 | aggregate public stats; check/risk counters are raw activity, report/loss counters are confirmed-only |
| `submitReport`            | public | `{ value <= 500, type?, description 5-5000, scamType?, city?, amountLostUzs?, incidentOnly?, lang }` | `{ ok }` or `{ ok:false, error }`                                                                     |
| `listReports`             | admin  | `{ status }`                                                                                         | report rows (<= 200)                                                                                  |
| `listEntities`            | admin  | `{ status }`                                                                                         | entity rows (<= 200)                                                                                  |
| `moderateReport`          | admin  | `{ reportId, decision, riskLevel }`                                                                  | `{ ok }`                                                                                              |
| `submitReputationAppeal`  | public | `{ target, reason, contact?, lang }`                                                                 | `{ ok, duplicate? }` or safe error                                                                    |
| `listReputationAppeals`   | admin  | `{ status }`                                                                                         | appeal rows                                                                                           |
| `resolveReputationAppeal` | admin  | `{ appealId, decision, note? }`                                                                      | `{ ok }`                                                                                              |
| `adminStats`              | admin  | none                                                                                                 | `{ reports_new, reports_confirmed, entities_confirmed, checks_total, appeals_new }`                   |

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
  across production instances. If the shared store is temporarily unavailable
  before dispatch, the webhook returns HTTP 503 with `Retry-After` and does not
  process the update, allowing Telegram to retry without duplicate side effects.
- `/panic` behaves as a small emergency copilot: selected scenarios store only `lastPanicId`/`lastPanicAt`, and short follow-up questions such as "what next", "bank number" or "what should I say" are answered contextually. `/call` is a direct entrypoint into the same live-call scenario (`lastPanicId=6`) and stores no phone number, call recording or raw evidence. Suspicious payloads still go through the normal risk pipeline.
- `/trainer` opens a five-situation scam-call mini-quiz. It is callback-only:
  the score is encoded in `trainer:*` callback data, answers are not stored,
  and no `checks` rows are inserted.
- Stateful Telegram flows are scoped to the current chat via
  `scenario_data.chatScope`. `/report`, `/check`, `/call`, panic and
  post-check follow-up context created in a private chat is not reused from a
  group/supergroup chat by the same user; mismatched or legacy unscoped
  contextual rows are reset before routing the current update.
- `/report` can submit a situation-only incident when the user has no concrete
  target. `incidentOnly=true` stores the redacted incident for
  moderation/research but does not upsert or bump public `entities`. Telegram
  report drafts persist only a prepared target hash/masked display plus redacted
  narrative fields; final Telegram submit uses that prepared target without
  needing the raw identifier again.
- The homepage quick report uses the same incident-only path when its optional
  target field is empty; dash-only legacy placeholders are also treated as
  incident-only on the server.
- Targeted reports create or refresh private moderation candidates. Public
  `entities.report_count` changes only after admin moderation and represents
  confirmed reports, not raw unmoderated submissions. Same-day duplicate target
  reports are retained as redacted `reports.status='duplicate'` evidence for
  admin review/retention, but they do not refresh public entity state.
- Optional private moderation alerts use `TELEGRAM_MODERATION_CHAT_ID`. The
  alert body contains only redacted report/appeal summaries or public
  high-signal scheme metadata plus an admin link. It never includes raw report
  descriptions, screenshots, OCR, codes, cards, full phone numbers, full URLs or
  user ids. `npm run moderation:smoke -- --research` verifies the research alert
  wording separately from ordinary user-flow QA.
- `/appeal` submits a privacy-safe correction/removal request for phone,
  Telegram, URL or APK reputation. The server stores only target/contact hashes,
  masked display values and redacted reason text. Admin removal hides the public
  reputation label without deleting report history.
- Telegram photos/screenshots use structured image intelligence before scoring.
  Repeated image checks claim a shared `telegram-image:<tg:userId>` budget
  before Telegram file metadata/download, so media-cost throttling happens
  before bytes are fetched.
  Benign delivery SMS and restaurant/menu QR screenshots can be shown as `safe`
  only when no reason codes match and the benign category is backed by readable
  text/QR/profile evidence. Category-only model labels remain `unknown`;
  dangerous QR login/payment, OTP, APK and card-data requests still route
  through normal reason-code scoring.
- Web screenshot OCR accepts only server-validated base64 `image/png`,
  `image/jpeg` or `image/webp` data URLs within the decoded byte limit before
  any AI vision provider call.
- `getPublicStats` is served through the server function with a short
  server-side cache and in-flight de-duplication; browsers do not call
  `get_check_stats()` or service-role aggregate queries directly. Check and
  risk-alert counters are aggregate raw service activity; `reports_total`,
  `reports_with_loss_amount` and `reported_loss_uzs` include only
  `reports.status='confirmed'` rows.
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
- AI-authored check explanations are filtered by `ai-output-safety.ts` before they can be returned or stored. If a provider output asks the user for codes, CVV/PIN/password/card/seed data, APK installs, wallet signing or payments, `explanation` becomes `null` and the deterministic verdict/advice remains. Repeated unsafe provider outputs for the same rate-limit key open a short in-memory cooldown that skips further AI explanations for that key while keeping rules-first checks active.
- Telegram inline mode handles `inline_query` updates for `@scamguard_bot <number/link/text>`. Inline previews are rules-only (`skipAi=true`) and non-persistent (`persist=false`) so partial typed queries do not spam `checks` or AI providers. Enable inline mode separately in BotFather with `/setinline`.
- Telegram public username/link checks may call Bot API `getChat` after scoring to add a short metadata limitation/summary to the reply. Private invite/internal links skip lookup and receive an explicit limitation brief. This is presentation-only: score, level and reason codes remain deterministic.
- Telegram reputation labels come only from the app-owned `telegram_reputation_targets` source layer. Unverified user reports are not shown to users. Confirmed moderated reports may add a short source/confidence brief, explicitly distinguished from hidden Telegram SCAM labels or Telegram-internal report history.
- Family Shield uses `/family`, `family_*` deep links and `family:*` callbacks. Invite links are generated from HMAC-hashed tokens, pending invites expire after 24 hours, active-link duplicate creation is handled as a user-facing state, and trusted-contact alerts include no raw scam evidence. `family:codeword` is a teaching-only callback: it tells families how to agree on a voice-clone verification phrase offline and never asks the user to send or store the actual codeword. The trusted contact can opt out from future alerts from the alert itself.
- Plain questions to the bot are routed through `src/lib/meta-intent.ts` before risk scoring. Telegram account visibility questions explain that hidden scam labels, account age, report history and spam history are not available unless the user sends real context or a future moderated source exists.

## Website trust surfaces

- `/scam-trends` includes a privacy-safe scam map/index built from public
  scheme-trend categories, not raw reports. The public layer shows national
  tactics and category buckets only; regional buckets stay suppressed until a
  future dynamic source has at least 5 moderated records, 3 distinct scheme
  types and 2 source types for that region.
- The scam map/index does not expose raw complaint text, screenshots, OCR, full
  phone numbers, usernames, URLs, codes, cards, chat ids or user ids.

## Auth flow

Browser session token (Supabase) is attached by `attachSupabaseAuth` on every server-function call. Admin functions validate it server-side (`requireSupabaseAuth`) and check the `admin` role in `user_roles`.
Allowlisted admin signup is gated on Supabase email confirmation: a new account
gets at most the baseline `user` role until `auth.users.email_confirmed_at` is
set, then the database trigger may add `admin` if the email is still in
`admin_allowlist`.

## Website embed

- `/embed/check` is the iframe runtime. Its CSP `frame-ancestors` defaults to
  `'self'` plus localhost development origins and adds production partner
  origins only from server-side `EMBED_ALLOWED_FRAME_ANCESTORS`.
- The `partner` query parameter is sanitized for display only; it is not
  trusted as authorization to frame the widget.
- Low-signal phone/Telegram results may render as a compact Risk Passport in
  web/embed surfaces: visible public metadata, directory/reputation status,
  honest limitations and a next step. High-risk cards remain action-first.
- Iframe calls pass an optional `embed` context to `checkInput`. The server
  stores only privacy-safe usage telemetry in `embed_origin_events`: partner,
  referrer origin/host, language, event type and aggregate result shape. It
  does not store raw input, redacted input, input hashes, full referrer URLs,
  paths, query strings, fragments, phone numbers or Telegram ids.

## Database RPC

- `get_check_stats()` is service-role-only. The browser no longer calls it
  directly; `getPublicStats` calls it through a cached server function. It
  returns raw aggregate check activity plus confirmed-only report/loss impact.
- `claim_rate_limit()` is service-role-only. Server code calls it to atomically
  increment HMAC-hashed shared buckets for public checks, reports, Telegram
  public-post fetches, the voice STT daily budget and the opt-in Voice-out/TTS
  daily budget. Voice budgets use distinct key prefixes under the existing
  `check` scope so no raw Telegram id is persisted.
- `private.prune_app_retention()` is service-role/private maintenance SQL for retention cleanup. It is not exposed as a public API.
- `embed_origin_events` is service-role-only, RLS-protected `/embed/check`
  origin telemetry. Retention pruning deletes rows older than 180 days.

## External integrations

- **Supabase:** Postgres/Auth/RLS via `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **OpenAI-compatible AI provider:** `POST {OPENAI_BASE_URL}/chat/completions` (default `https://api.openai.com/v1`) with `OPENAI_API_KEY` and `OPENAI_MODEL` (default `gpt-4o-mini`). Used for explanations, web screenshot OCR and Telegram structured image analysis. Telegram voice STT uses Gemini native audio when `OPENAI_BASE_URL` points to `generativelanguage.googleapis.com`, otherwise OpenAI-compatible `/audio/transcriptions` with `OPENAI_TRANSCRIBE_MODEL` / `OPENAI_AUDIO_MODEL` / `gpt-4o-mini-transcribe`. Missing key, provider error or blocked unsafe explanation returns `null`; scoring continues where text evidence is available.
- **URL reputation providers:** optional Google Safe Browsing, URLhaus and
  PhishTank checks add `external_phishing_url` / `external_malware_url` reason
  codes only. The pipeline extracts URL tokens from mixed messages, strips
  credentials, query strings and fragments before provider calls, uses a short
  in-memory cache for successful provider responses with in-flight
  de-duplication, and never sends full message text, OTPs or report narratives
  to URL reputation providers.
- **Telegram Voice-out/TTS:** opt-in SOS/Guardian voice tips first use static main-SOS files from `VOICE_OUT_PRERECORDED_DIR` or `public/audio/voice-out` when a matching `panic-{id}-{lang}` audio file exists (`.ogg`, `.oga`, `.mp3` or `.wav`). Static files bypass provider calls and the daily TTS budget. Missing static audio falls back to Gemini TTS when `GEMINI_TTS_API_KEY` is present (`gemini-3.1-flash-tts-preview` / `Kore` by default), wrapping Gemini PCM audio as WAV for Telegram. OpenAI TTS remains a fallback through `POST {OPENAI_TTS_BASE_URL}/audio/speech` with `OPENAI_TTS_API_KEY`, `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`) and `OPENAI_TTS_VOICE` (default `alloy`). If no dedicated TTS key exists, the bot may reuse `OPENAI_API_KEY` only when `OPENAI_BASE_URL` is not Gemini-like. Gemini/OpenAI-compatible chat endpoints are never treated as speech endpoints. Audio failures degrade to a text fallback; raw user evidence is not spoken back.
- **Telegram Bot API:** used by the bot handlers for replies, inline query answers, file metadata/image downloads, and best-effort public `getChat` metadata on Telegram username/link checks.

## Future B2B API

Planned, not built: `/v1/check/*`, `/v1/risk-score`, `/v1/report` with API-key auth for banks, fintechs and marketplaces.
