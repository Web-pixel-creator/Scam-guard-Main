# Functions Map

Signatures and intent only. See file paths for source.

## Server functions

| Function                                                                                             | File                          | Auth   | Purpose                                                                                        |
| ---------------------------------------------------------------------------------------------------- | ----------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `checkInput({ input, type?, lang })`                                                                 | `src/lib/check.functions.ts`  | public | Web wrapper around `runCheck`; shared rate-limited 10/min/IP.                                  |
| `ocrExtract({ image, lang })`                                                                        | `src/lib/check.functions.ts`  | public | Web wrapper around `ocrExtractCore`; screenshot OCR + deterministic redaction.                 |
| `getPublicStats()`                                                                                   | `src/lib/check.functions.ts`  | public | Server-side stats wrapper; calls service-role-only `get_check_stats()` instead of browser RPC. |
| `submitReport({ value, type?, description, scamType?, city?, amountLostUzs?, incidentOnly?, lang })` | `src/lib/report.functions.ts` | public | Inserts a redacted report; upserts/bumps `entities` only when a concrete target is present.    |
| `listReports({ status })`                                                                            | `src/lib/admin.functions.ts`  | admin  | Lists reports by status.                                                                       |
| `listEntities({ status })`                                                                           | `src/lib/admin.functions.ts`  | admin  | Lists moderated/known entities.                                                                |
| `moderateReport({ reportId, decision, riskLevel })`                                                  | `src/lib/admin.functions.ts`  | admin  | Confirms/rejects a report and syncs entity reputation unless the report is situation-only.     |
| `adminStats()`                                                                                       | `src/lib/admin.functions.ts`  | admin  | Dashboard counts.                                                                              |

## Risk engine

**`src/lib/risk/detect.ts`**

- `detectInputType(raw) -> InputType`
- `normalizePhone`, `normalizeTelegram`, `normalizeUrl`, `normalize(input, type)`
- `maskForDisplay(value, type)`
- `redactText(s)` masks full cards, inline phones and OTP-like digit runs.

**`src/lib/risk/rules.ts`**

- `ReasonCode` union + weights.
- `evaluateText`, `evaluateUrl`, `evaluatePhone`, `evaluateTelegram`.
- Research-feed text rules include `telegram_account_takeover_phishing`, `dropper_recruitment`, `gambling_prediction_promo`, and Telegram/Web3 promo funnel codes for casino/free-spins, CAPTCHA/voting, task rewards, wallet urgency and TON referral earning.
- `scoreFromCodes(codes) -> { score, level }`.
- `REASON_LABELS`, `ADVICE` in RU/UZ/EN.

**`src/lib/risk/phone-intelligence.ts`**

- `buildPhoneIntelligencePassport(raw, normalized, verifiedContact)` returns honest phone metadata: country/calling code, Uzbekistan prefix/operator hint, format status, official-directory status and optional verified-contact lookalike evidence. It never infers owner, hidden scam labels, account age, spam history or report volume.

**`src/lib/risk/phone-reputation.ts`**

- `buildPhoneReputationSummary(row)` exposes confirmed phone reputation only from moderated `entities` rows with positive report counts.
- `phoneReputationConfidence(count)` maps confirmed report counts to conservative `low | medium | high` confidence labels.

**`src/lib/risk/check-core.ts`**

- `runCheck(params)` is the transport-independent check pipeline. It uses the shared production limiter with a local fallback. `persist:false` is reserved for non-final previews such as Telegram inline typing and skips the `checks` insert while preserving deterministic scoring.
- `ocrExtractCore(dataUrl, lang, rateLimitKey)` is the transport-independent OCR pipeline and uses the same shared check limiter.
- `analyzeImageCore(dataUrl, lang, rateLimitKey)` returns structured, redacted image evidence for Telegram photos/screenshots and uses the same shared check limiter.
- Private AI helpers call an OpenAI-compatible Chat Completions provider, retry only transient provider failures (`429`, `500`, `502`, `503`, `504`) with bounded backoff, and degrade to `null`.

**`src/lib/risk/image-intelligence.ts`**

- `sanitizeImageIntelligence(raw)` parses/clamps model JSON and merges deterministic risk hints.
- `fallbackImageIntelligence(text)` builds deterministic evidence when model JSON is invalid, including Telegram promo/Web3 screenshot hints. The precision pass also recognizes Stars/NFT spin/lucky-draw/777 mechanics and public voting/contest domains without turning ordinary Telegram news/product posts into scam results.
- `hasUsableImageEvidence(evidence)` rejects low-information model output such as "could not read the image" so blurry screenshots stay in the explicit fallback path.
- `mergeDecodedQrEvidence(evidence, decoded)` injects real pixel-decoded QR values into structured image evidence before scoring.
- `buildImageCheckInput(evidence)` converts benign/dangerous image evidence into a rules-safe input string; Telegram casino/free-spins, NFT/Stars giveaways, vote/captcha gates, task rewards, wallet urgency and TON referral screenshots feed the existing scam-research-feed-v2 reason codes.
- `buildImageUserExplanation(evidence, level, lang)` creates the short Telegram explanation for image results, with scenario-specific copy for casino/free-spins, NFT/Stars giveaways, task rewards, wallet/DeFi urgency, TON referrals, private invites and benign Telegram posts.

**`src/lib/risk/qr-decoder.ts`**

- `decodeQrFromDataUrl(dataUrl)` decodes PNG/JPEG QR pixels in memory with pixel limits, deduplicates/clamps values, and fails closed for unsupported or oversized images.

**`src/lib/risk/hash.ts`**: `hashIdentifier(value)`.

**`src/lib/risk/rate-limit.ts`**: in-memory sliding-window limiter for local/test fallback.

**`src/lib/risk/shared-rate-limit.server.ts`**

- `checkSharedRateLimit(scope, key, limit, windowMs)` HMAC-hashes the raw key,
  calls service-role-only `claim_rate_limit()` in production, and falls back to
  local in-memory throttling when shared storage is unavailable or unconfigured.

**`src/lib/meta-intent.ts`**: pure deterministic router for questions to the bot itself, including Telegram-account visibility limits, with scam-context override before risk scoring.

## Telegram

- `src/lib/telegram/webhook.server.ts`: framework-agnostic webhook handler with fail-closed secret validation, capped body parsing and `update_id` dedup via an in-memory fast path plus shared Postgres claims.
- `src/lib/telegram/webhook-dedup.server.ts`: `claimTelegramWebhookUpdate(updateId)` inserts a service-role-only idempotency row into `telegram_webhook_updates`, returns `duplicate` for unique violations and `unavailable` for storage failures so the webhook can fail open to local dedup.
- `src/server.ts`: binds `POST /api/telegram/webhook` and `/healthz` before SSR.
- `src/lib/telegram/router.ts`: parses updates and routes commands/content; handles `inline_query` before chat-target extraction; forwards `callback_query.id` so inline-button spinners are acknowledged; analyzes media captions before unsupported-media fallback; routes safe meta-questions before `handleCheck`; routes Telegram video thumbnails to the image pipeline when no stronger caption/link/button evidence exists; attaches sanitized public forward channel/group source context to check/image actions.
- `src/lib/telegram/handlers/*`: `/start`, `/check`, `/report`, safety/help, images, contacts, out-of-scope handling.
- `src/lib/telegram/session.server.ts`: Supabase-backed `telegram_sessions` state; `lastCheck` stores only non-sensitive summary metadata plus short reason codes for follow-up explanations.
- `src/lib/telegram/family-shield.server.ts`: service-role-only Family Shield helper. It creates HMAC-hashed one-use invite links, rejects duplicate active links, expires stale pending invites, sends redacted trusted-contact alerts with opt-out, and revokes relationships from either guardian or trusted-contact side.
- `src/lib/telegram/api.server.ts`: Telegram Bot API calls, including `answerInlineQuery` for inline-mode article results.
- `src/lib/telegram/emergency.ts`: `buildPanicScenarioText` now returns compact panic first cards, `buildDetailedPanicScenarioText` keeps the full checklist for `panicctx:full`, plus panic keyboard builders, live-call callback parser and Emergency Copilot helpers: `classifyEmergencyFollowUp`, `buildEmergencyFollowUpText`, `buildEmergencyFollowUpKeyboard`. First panic cards keep the urgent action first and add short human guidance cues; follow-up answers are guided for stressed/elderly users and keep safe-callback boundaries.
- `src/lib/telegram/handlers/check.ts`: routes short post-panic, post-check and orphan helper follow-up questions before `runCheck` (regressed for live phrases like "Точно?", "Что еще посоветуешь?" and "дай номер банка"), handles structured image intelligence plus real pixel QR decoding for photos and routed Telegram video thumbnails, stores a safe `image_unreadable` last-check snapshot for OCR/QR failures, suppresses repeated album fallbacks, shortens repeated standalone image fallbacks, attaches unreadable-image triage buttons, fetches visible public Telegram post evidence before metadata-only fallback, and enriches Telegram username/link checks with best-effort public metadata plus moderated Ishonch Guard reputation and public forward-source context after scoring.
- `src/lib/telegram/handlers/inline.ts`: answers Telegram inline-mode queries with one compact `InlineQueryResultArticle`; empty queries show usage help, non-empty queries call `runCheck(skipAi:true, persist:false)` and render a short masked card with one safe next step plus an "open bot" button.
- `src/lib/telegram/forward-context.ts`: sanitizes visible public Telegram forward source metadata and builds RU/UZ/EN reply-only source briefs with scheme/goal/safe-step copy when deterministic reason codes reveal a concrete tactic. It never changes scoring input and never persists source metadata.
- `src/lib/telegram/image-fallback.ts`: builds `imgtriage:*` callback data, the full unreadable-image category keyboard, compact post-category follow-up keyboards and hook/risk/safe-step copy; it is presentation-only and does not run scoring or persistence.
- `src/lib/telegram/check-followup.ts`: classifies and renders safe post-check follow-ups, including orphan phrases such as "Точно?", "что дальше?", "sure?" and "дай номер банка"; unreadable-image follow-ups explain the vision limitation and ask for concrete evidence instead of running a fake insufficient-data check; `explain` follow-ups use context-specific wording and short reason labels without exposing internal scores.
- `src/lib/telegram/handlers/misc.ts`: handles callbacks and unsupported input; video/audio/voice fallback includes media-specific capture instructions and next-step buttons; `imgtriage:*` callbacks answer with scenario-specific safe steps for unreadable images and avoid repeating the full category menu; result `why` callbacks use recent `lastCheck` context when available.
- `src/lib/telegram/public-metadata.server.ts`: extracts public Telegram targets, preserves public post ids from `t.me/username/123` and `t.me/s/username/123`, skips lookup for private/internal links, calls `getChatInfo` via an injectable lookup for public usernames, and builds compact safe RU/UZ/EN metadata briefs. When Telegram/Web3 risk reasons exist, it renders a scenario-first evidence brief before hard Bot API limitations; profile-only checks keep limitation-first wording. Public post fallback copy says to forward/paste/screenshot the post when the public web page cannot be read. Enrichment never changes scoring.
- `src/lib/telegram/public-post.server.ts`: validates public Telegram post links, fetches only `https://t.me/s/<username>/<postId>` with timeout/body/shared rate limits, parses visible post text, outbound links, link previews and inline buttons from Telegram web HTML, redacts sensitive digits, builds rules-safe check input, and prepends a source limitation brief without changing score/level/reasons.
- `src/lib/telegram/format.ts`: formats result cards; Telegram profile/invite checks use a dedicated context prompt, unknown cards hide weak topic-only observations, suspicious cards use a compact "what noticed" evidence section, and high-risk first cards are compressed to urgent actions plus a short evidence summary instead of long generic explanation/reporting blocks. Visible-source briefs for forwarded Telegram posts remain as compact evidence.
- `src/lib/telegram/reputation.server.ts`: observes Telegram targets by HMAC hash, registers unverified Telegram report candidates, syncs confirmed report counts after admin moderation, and renders source/confidence labels only for moderated reputation.
- `src/lib/telegram/handlers/misc.ts`: stores minimal panic context (`lastPanicId`, `lastPanicAt`) and handles `panicctx:*` follow-up callbacks.

## Auth and integration

- `requireSupabaseAuth` (`src/integrations/supabase/auth-middleware.ts`) validates Bearer tokens.
- `attachSupabaseAuth` (`src/integrations/supabase/auth-attacher.ts`) attaches the session token client-side.
- `supabase` / `supabaseAdmin`: browser RLS client vs server service-role client.

## DB functions

`private.has_role(uuid, app_role)`, legacy service-role-only `has_role(uuid, app_role)`, `handle_new_user_role()`, service-role-only `get_check_stats()`, service-role-only `claim_rate_limit(text,text,int,int)`, `private.prune_app_retention(timestamptz)`, `prune_telegram_sessions()`.

## Operational scripts

- `scripts/prod-smoke.ts`: one-shot production smoke test. Checks the public
  app, `/healthz`, Telegram webhook secret behavior, Telegram webhook pending
  state and the configured OpenAI-compatible AI provider. With `--live-telegram`
  it sends one synthetic high-risk text through the latest Telegram session
  without printing token, secret or chat id values.
- `scripts/prod-monitor.ts`: recurring production monitor for the public app,
  `/healthz`, Telegram webhook secret behavior, Telegram Bot API health,
  webhook URL/pending/recent-error state and the configured AI provider. It can
  send sanitized Telegram alerts to an operator chat without printing token,
  secret or chat id values.
- `scripts/prod-family-shield-smoke.ts`: one-shot production smoke test for
  Family Shield. It creates a synthetic invite, accepts it, verifies the safe
  notification failure path, revokes the relationship and confirms no open
  synthetic rows remain.
- `scripts/prod-security-smoke.ts`: one-shot production RLS/security smoke test.
  It verifies anon cannot read/write sensitive tables, including
  `telegram_webhook_updates` and `rate_limit_buckets`, or execute
  maintenance/stat/rate-limit RPCs, while service-role can count required
  tables and execute stats/rate-limit claims.
