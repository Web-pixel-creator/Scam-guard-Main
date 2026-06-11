# Functions Map

Signatures and intent only. See file paths for source.

## Server functions

| Function                                                                                             | File                          | Auth   | Purpose                                                                                     |
| ---------------------------------------------------------------------------------------------------- | ----------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `checkInput({ input, type?, lang })`                                                                 | `src/lib/check.functions.ts`  | public | Web wrapper around `runCheck`; rate-limited 10/min/IP.                                      |
| `ocrExtract({ image, lang })`                                                                        | `src/lib/check.functions.ts`  | public | Web wrapper around `ocrExtractCore`; screenshot OCR + deterministic redaction.              |
| `submitReport({ value, type?, description, scamType?, city?, amountLostUzs?, incidentOnly?, lang })` | `src/lib/report.functions.ts` | public | Inserts a redacted report; upserts/bumps `entities` only when a concrete target is present. |
| `listReports({ status })`                                                                            | `src/lib/admin.functions.ts`  | admin  | Lists reports by status.                                                                    |
| `listEntities({ status })`                                                                           | `src/lib/admin.functions.ts`  | admin  | Lists moderated/known entities.                                                             |
| `moderateReport({ reportId, decision, riskLevel })`                                                  | `src/lib/admin.functions.ts`  | admin  | Confirms/rejects a report and syncs entity reputation unless the report is situation-only.  |
| `adminStats()`                                                                                       | `src/lib/admin.functions.ts`  | admin  | Dashboard counts.                                                                           |

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

**`src/lib/risk/check-core.ts`**

- `runCheck(params)` is the transport-independent check pipeline.
- `ocrExtractCore(dataUrl, lang, rateLimitKey)` is the transport-independent OCR pipeline.
- `analyzeImageCore(dataUrl, lang, rateLimitKey)` returns structured, redacted image evidence for Telegram photos/screenshots.
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

**`src/lib/risk/rate-limit.ts`**: in-memory sliding-window limiter.

**`src/lib/meta-intent.ts`**: pure deterministic router for questions to the bot itself, including Telegram-account visibility limits, with scam-context override before risk scoring.

## Telegram

- `src/lib/telegram/webhook.server.ts`: framework-agnostic webhook handler.
- `src/server.ts`: binds `POST /api/telegram/webhook` and `/healthz` before SSR.
- `src/lib/telegram/router.ts`: parses updates and routes commands/content; forwards `callback_query.id` so inline-button spinners are acknowledged; analyzes media captions before unsupported-media fallback; routes safe meta-questions before `handleCheck`; routes Telegram video thumbnails to the image pipeline when no stronger caption/link/button evidence exists; attaches sanitized public forward channel/group source context to check/image actions.
- `src/lib/telegram/handlers/*`: `/start`, `/check`, `/report`, safety/help, images, contacts, out-of-scope handling.
- `src/lib/telegram/session.server.ts`: Supabase-backed `telegram_sessions` state.
- `src/lib/telegram/api.server.ts`: Telegram Bot API calls.
- `src/lib/telegram/emergency.ts`: `buildPanicScenarioText`, panic keyboard builders, live-call callback parser, plus Emergency Copilot helpers: `classifyEmergencyFollowUp`, `buildEmergencyFollowUpText`, `buildEmergencyFollowUpKeyboard`. Follow-up answers are guided for stressed/elderly users and keep safe-callback boundaries.
- `src/lib/telegram/handlers/check.ts`: routes short post-panic, post-check and orphan helper follow-up questions before `runCheck`, handles structured image intelligence plus real pixel QR decoding for photos and routed Telegram video thumbnails, stores a safe `image_unreadable` last-check snapshot for OCR/QR failures, suppresses repeated album fallbacks, shortens repeated standalone image fallbacks, attaches unreadable-image triage buttons, fetches visible public Telegram post evidence before metadata-only fallback, and enriches Telegram username/link checks with best-effort public metadata plus moderated Ishonch Guard reputation and public forward-source context after scoring.
- `src/lib/telegram/forward-context.ts`: sanitizes visible public Telegram forward source metadata and builds RU/UZ/EN reply-only source briefs with scheme/goal/safe-step copy when deterministic reason codes reveal a concrete tactic. It never changes scoring input and never persists source metadata.
- `src/lib/telegram/image-fallback.ts`: builds `imgtriage:*` callback data, unreadable-image triage keyboards and scenario-specific safe-step copy; it is presentation-only and does not run scoring or persistence.
- `src/lib/telegram/check-followup.ts`: classifies and renders safe post-check follow-ups, including orphan phrases such as "Точно?", "что дальше?", "sure?" and "дай номер банка"; unreadable-image follow-ups explain the vision limitation and ask for concrete evidence instead of running a fake insufficient-data check.
- `src/lib/telegram/handlers/misc.ts`: handles callbacks and unsupported input; video/audio/voice fallback includes media-specific capture instructions and next-step buttons; `imgtriage:*` callbacks answer with scenario-specific safe steps for unreadable images.
- `src/lib/telegram/public-metadata.server.ts`: extracts public Telegram targets, preserves public post ids from `t.me/username/123` and `t.me/s/username/123`, skips lookup for private/internal links, calls `getChatInfo` via an injectable lookup for public usernames, and builds compact safe RU/UZ/EN metadata briefs. When Telegram/Web3 risk reasons exist, it renders a scenario-first evidence brief before hard Bot API limitations; profile-only checks keep limitation-first wording. Public post fallback copy says to forward/paste/screenshot the post when the public web page cannot be read. Enrichment never changes scoring.
- `src/lib/telegram/public-post.server.ts`: validates public Telegram post links, fetches only `https://t.me/s/<username>/<postId>` with timeout/body/rate limits, parses visible post text, outbound links, link previews and inline buttons from Telegram web HTML, redacts sensitive digits, builds rules-safe check input, and prepends a source limitation brief without changing score/level/reasons.
- `src/lib/telegram/format.ts`: formats result cards; Telegram profile/invite checks use a dedicated context prompt and high-risk Telegram explanations are shown before generic reason labels.
- `src/lib/telegram/reputation.server.ts`: observes Telegram targets by HMAC hash, registers unverified Telegram report candidates, syncs confirmed report counts after admin moderation, and renders source/confidence labels only for moderated reputation.
- `src/lib/telegram/handlers/misc.ts`: stores minimal panic context (`lastPanicId`, `lastPanicAt`) and handles `panicctx:*` follow-up callbacks.

## Auth and integration

- `requireSupabaseAuth` (`src/integrations/supabase/auth-middleware.ts`) validates Bearer tokens.
- `attachSupabaseAuth` (`src/integrations/supabase/auth-attacher.ts`) attaches the session token client-side.
- `supabase` / `supabaseAdmin`: browser RLS client vs server service-role client.

## DB functions

`has_role(uuid, app_role)`, `handle_new_user_role()`, `get_check_stats()`, `prune_telegram_sessions()`.

## Operational scripts

- `scripts/prod-smoke.ts`: one-shot production smoke test. Checks the public
  app, `/healthz`, Telegram webhook secret behavior, Telegram webhook pending
  state and the configured OpenAI-compatible AI provider. With `--live-telegram`
  it sends one synthetic high-risk text through the latest Telegram session
  without printing token, secret or chat id values.
