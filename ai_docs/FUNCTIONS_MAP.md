# Functions Map

Signatures and intent only. See file paths for source.

## Server functions

| Function                                                                                             | File                                     | Auth   | Purpose                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkInput({ input, type?, lang })`                                                                 | `src/lib/check.functions.ts`             | public | Web wrapper around `runCheck`; shared rate-limited 10/min/IP.                                                                                                                                                        |
| `ocrExtract({ image, lang })`                                                                        | `src/lib/check.functions.ts`             | public | Web wrapper around `ocrExtractCore`; validates png/jpeg/webp base64 data URLs before screenshot OCR + deterministic redaction.                                                                                       |
| `getPublicStats()`                                                                                   | `src/lib/check.functions.ts`             | public | Cached server-side stats wrapper; calls service-role-only `get_check_stats()` instead of browser RPC, de-duplicates aggregate work, and keeps report/loss impact confirmed-only.                                     |
| `submitReport({ value, type?, description, scamType?, city?, amountLostUzs?, incidentOnly?, lang })` | `src/lib/report.functions.ts`            | public | Prepares a target hash/masked display, inserts a redacted report, stores same-day duplicates as private `duplicate` evidence without public entity side effects, and can trigger an opt-in private moderation alert. |
| `submitReputationAppeal({ target, reason, contact?, lang })`                                         | `src/lib/reputation-appeal.functions.ts` | public | Creates a privacy-safe appeal/removal request for reputation targets; can trigger an opt-in private moderation alert.                                                                                                |
| `listReports({ status })`                                                                            | `src/lib/admin.functions.ts`             | admin  | Lists reports by status, including retained `duplicate` evidence rows.                                                                                                                                               |
| `listEntities({ status })`                                                                           | `src/lib/admin.functions.ts`             | admin  | Lists moderated/known entities.                                                                                                                                                                                      |
| `moderateReport({ reportId, decision, riskLevel })`                                                  | `src/lib/admin.functions.ts`             | admin  | Confirms/rejects a report and syncs entity reputation/counts from confirmed reports unless the report is situation-only.                                                                                             |
| `listReputationAppeals({ status })` / `resolveReputationAppeal(...)`                                 | `src/lib/admin.functions.ts`             | admin  | Reviews appeal/removal requests and can hide public reputation with audit logging.                                                                                                                                   |
| `adminStats()`                                                                                       | `src/lib/admin.functions.ts`             | admin  | Dashboard counts.                                                                                                                                                                                                    |

## Risk engine

**`src/lib/request-ip.server.ts`**

- `publicRateLimitKey(scope)` returns `check:<ip>`, `report:<ip>` or
  `appeal:<ip>` for public server functions. It ignores client-supplied proxy
  IP headers unless `TRUST_PROXY_IP_HEADERS=true`.

**`src/lib/quick-report-payload.ts`**

- `buildQuickReportSubmitData({ value, description, lang })`: trims homepage
  quick-report input and marks empty optional targets as `incidentOnly: true`
  with the incident-only sentinel.

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

**`src/lib/risk/url-reputation.server.ts`**

- `checkUrlReputation(urls, options)` calls optional Google Safe Browsing,
  URLhaus and PhishTank providers as additive evidence only. It short-caches
  results, de-duplicates in-flight checks and returns only
  `external_phishing_url` / `external_malware_url` reason codes.
- `normalizeUrlForReputationProvider(raw)` keeps only HTTP(S) URL origin/path
  and strips credentials, query strings and fragments before any provider call.

**`src/lib/risk/check-core.ts`**

- `runCheck(params)` is the transport-independent check pipeline. It uses the shared production limiter with a local fallback. `persist:false` is reserved for non-final previews such as Telegram inline typing and skips the `checks` insert while preserving deterministic scoring.
- `ocrExtractCore(dataUrl, lang, rateLimitKey)` is the transport-independent OCR pipeline; it uses the same shared check limiter and rejects non-allowlisted image data URLs before building AI `image_url` messages.
- `analyzeImageCore(dataUrl, lang, rateLimitKey)` returns structured, redacted image evidence for Telegram photos/screenshots; it uses the same shared check limiter and validates png/jpeg/webp base64 data URLs before AI image analysis.
- `parseAllowedImageDataUrl(value, { maxBytes? })` in `src/lib/risk/media-data-url.ts` normalizes AI-bound image data URLs and enforces MIME/base64/decoded-size limits.
- Private AI helpers call an OpenAI-compatible Chat Completions provider, retry only transient provider failures (`429`, `500`, `502`, `503`, `504`) with bounded backoff, and degrade to `null`. User-facing AI explanations pass through `sanitizeAiExplanationWithFinding` before return or persistence, and repeated unsafe provider outputs for the same rate-limit key temporarily skip later AI explanation calls.

**`src/lib/risk/ai-output-safety.ts`**

- `findUnsafeAiOutput(text)` detects prompt-injection leakage and AI-authored requests for SMS/OTP/PIN/CVV/password/card/seed data, APK installs, wallet signing/connection or payments.
- `sanitizeAiExplanationWithFinding(text)` returns safe trimmed text or `null` plus the blocked finding, so callers can record repeated unsafe provider output without exposing it.
- `sanitizeAiExplanation(text)` returns safe trimmed text or `null`; legitimate negated warnings like "do not share SMS code" are preserved.
- `recordUnsafeAiExplanationBlock(rateLimitKey)` and `isUnsafeAiExplanationCooldownActive(rateLimitKey)` implement a short in-memory per-key slowdown after repeated unsafe AI explanation blocks.

**`src/lib/risk/image-intelligence.ts`**

- `sanitizeImageIntelligence(raw)` parses/clamps model JSON, sanitizes the optional AI summary, and merges deterministic risk hints.
- `fallbackImageIntelligence(text)` builds deterministic evidence when model JSON is invalid, including Telegram promo/Web3 screenshot hints. The precision pass also recognizes Stars/NFT spin/lucky-draw/777 mechanics and public voting/contest domains without turning ordinary Telegram news/product posts into scam results.
- `hasUsableImageEvidence(evidence)` rejects low-information model output such as "could not read the image" so blurry screenshots stay in the explicit fallback path.
- `mergeDecodedQrEvidence(evidence, decoded)` injects real pixel-decoded QR values into structured image evidence before scoring.
- `isEvidenceBackedBenignImageContext(evidence)` is the strict gate for final
  no-reasons `safe` image verdicts. It requires a benign category plus readable
  delivery/menu/QR/profile evidence and zero risk hints; category-only model
  labels stay `unknown`.
- `buildImageCheckInput(evidence)` converts benign/dangerous image evidence into a rules-safe input string; Telegram casino/free-spins, NFT/Stars giveaways, vote/captcha gates, task rewards, wallet urgency and TON referral screenshots feed the existing scam-research-feed-v2 reason codes.
- `buildImageUserExplanation(evidence, level, lang)` creates the short Telegram explanation for image results, with scenario-specific copy for casino/free-spins, NFT/Stars giveaways, task rewards, wallet/DeFi urgency, TON referrals, private invites and benign Telegram posts. QR copy now distinguishes real pixel-decoded payloads, URLs merely visible near a QR and QR codes that are visible but unreadable; Telegram login tokens and 2FA secrets stay hidden.

**`src/lib/risk/qr-decoder.ts`**

- `decodeQrFromDataUrl(dataUrl)` decodes PNG/JPEG QR pixels in memory with pixel limits, deduplicates/clamps values, and fails closed for unsupported or oversized images.

**`src/lib/risk/hash.ts`**: `hashIdentifier(value)`.

**`src/lib/risk/rate-limit.ts`**: in-memory sliding-window limiter for local/test fallback.

**`src/lib/risk/shared-rate-limit.server.ts`**

- `checkSharedRateLimit(scope, key, limit, windowMs)` HMAC-hashes the raw key,
  calls service-role-only `claim_rate_limit()` in production, and falls back to
  local in-memory throttling when shared storage is unavailable or unconfigured.
  Telegram image media fetches use a separate `telegram-image:<tg:userId>` key
  before `getFile`/download, while final image analysis and scoring keep the
  normal `tg:<userId>` check budget.

**`src/lib/meta-intent.ts`**: pure deterministic router for questions to the bot itself, including Telegram-account visibility limits, with scam-context override before risk scoring.

## Telegram result formatting

**`src/lib/telegram/format.ts`**

- `formatCheckResult(result, lang)` renders Telegram result cards and now routes
  shallow `unknown` phone/Telegram-profile checks through a Risk Passport card
  instead of the generic unknown verdict.
- `renderRiskPassport(result, lang)` is a pure formatter helper for Telegram
  passport cards. It preserves honest boundaries: visible facts, app-owned
  reputation and official-directory data may be shown; hidden Telegram scam
  labels, account age, spam history and unmoderated complaints must not be
  claimed. Missing local reports are phrased as "confirmed complaints not
  found", not as a safety guarantee.
- `buildResultKeyboard(result, lang)` attaches contextual "what did they ask
  for?" buttons to inconclusive phone/username checks before report/new-check
  actions.

**`src/lib/telegram/guardian-angel.ts`**

- `buildGuardianAngelSnapshot(result, now)` creates a post-high-risk guidance
  snapshot containing only risk level, input type, reason codes and timestamp.
- `buildGuardianAngelIntro(snapshot, lang)` renders the first one-step companion
  message after a high-risk Telegram result without repeating reassurance
  boilerplate already present in the scenario card.
- `buildGuardianAngelText(action, snapshot, lang)` renders next-step,
  done-confirmation, safe-callback and full-plan responses.
- `buildGuardianAngelKeyboard(lang, snapshot?)` returns compact `guardian:*`
  action buttons plus Family Shield notify and new-check actions. When a
  snapshot is present, it suppresses bank safe-callback actions for non-bank
  contexts such as crypto, QR and Telegram recovery.
- `classifyGuardianAngelFollowUp(text, scenarioData, now)` routes short
  follow-ups such as "что дальше?", "готово" and "дай номер банка" without
  swallowing new artifacts.

**`src/lib/telegram/scam-trainer.ts`**

- `buildTrainerIntro(lang)` renders the callback-only `/trainer` intro.
- `buildTrainerQuestion(questionId, lang, score)` renders one defensive
  mini-quiz situation with three safe/unsafe choices.
- `buildTrainerAnswer(questionId, optionIndex, lang, score)` returns feedback,
  advances the callback-encoded score and offers restart/emergency help at the
  end.
- `parseTrainerCallback(data)` / `buildTrainerCallbackResponse(data, lang)`
  handle `trainer:*` callbacks without session state, persistence or `checks`
  inserts. The trainer content is defensive and avoids exact scam scripts.

**`src/lib/telegram/digest.ts`**

- `WEEKLY_SCAM_DIGEST_ENTRIES` is the manual-publish data model behind
  `/digest`: each topic has source/status/updated-at metadata, tags and
  RU/UZ/EN funnel copy.
- `getWeeklyScamDigestSnapshot(lang, { now?, entries? })` selects fresh
  manually published entries, filters drafts/archived records and falls back to
  evergreen safety guidance when fewer than three fresh topics are available.
- `formatWeeklyScamDigest(lang)` preserves the existing Telegram contract by
  returning MarkdownV2-escaped text plus the compact check/emergency/report
  keyboard without exposing source labels or raw report-shaped evidence.

**`src/lib/telegram/voice-out.server.ts`**

- `parseVoiceOutCallback(data)` accepts `voiceout:panic`,
  scenario-bound `voiceout:panic:<panicId>`, follow-up-bound
  `voiceout:panic:<panicId>:<action>` and `voiceout:guardian`.
  `parseVoiceOutPanicId(data)` and `parseVoiceOutPanicAction(data)` extract
  only valid safe panic scenario ids/actions.
- `buildPanicVoiceOutText(panicId, lang)` and
  `buildGuardianVoiceOutText(snapshot, lang)` generate short safety scripts
  from safe scenario ids / summary metadata, not from raw user evidence.
- `synthesizeVoiceOut(text, userId)` applies a separate 5/day user budget,
  strips URLs, Telegram usernames and long digit runs, refuses
  code/PIN/CVV/password-like text and calls only a configured TTS endpoint.
  Gemini TTS is preferred when `GEMINI_TTS_API_KEY` exists, OpenAI TTS remains
  a fallback, and Gemini-like chat endpoints are not used as speech providers.
- `sendVoiceOutResponse(...)` sends a Telegram audio file when TTS is
  configured and falls back to a short text message when audio is unavailable.
  It sends a best-effort `upload_voice` chat action before synthesis and
  de-duplicates repeated taps for the same user/text so retries do not burn
  provider quota; first/repeated button taps answer the callback with a short
  "preparing" or "already preparing/sent" hint instead of staying silent.

## Website embed widget

**`src/lib/embed-widget.ts`**

- `normalizeEmbedLang(value) -> Lang` falls back unsupported values to `ru`.
- `sanitizePartner(value) -> string | null` strips markup/control punctuation
  and clamps partner labels for iframe query params.
- `buildEmbedWidgetUrl(baseUrl, options) -> string` builds `/embed/check`
  URLs with language and optional partner label.
- `buildEmbedIframeSnippet(baseUrl, options) -> string` returns the copyable
  iframe with fixed height and strict-origin referrer policy. It intentionally
  does not set `sandbox`; `/embed/check` framing is controlled by CSP
  `frame-ancestors`.

**`src/lib/security/csp.ts`**

- `parseEmbedFrameAncestorAllowlist(raw) -> string[]` accepts comma/space
  separated explicit HTTPS origins for `/embed/check` CSP and rejects unsafe
  schemes or malformed entries.
- `buildEmbedCheckContentSecurityPolicy(allowedFrameAncestors) -> string` builds
  the embed CSP with `'self'`, explicit partner origins and localhost dev
  ancestors; it does not trust the iframe `partner` query label.

**`src/components/EmbedCheckWidget.tsx`**

- Compact iframe UI for number/link/Telegram/text checks.
- Calls the existing `checkInput` server function, so shared rate limits,
  redaction, rules-first scoring and persistence remain centralized.
- Shows a concise verdict, up to three reasons and up to two safe steps; meta
  intent answers render as informational text.

## Website trust surface

**`src/lib/trust/official-directory.ts`**

- `getOfficialDirectoryStats()` returns static public counts from `VERIFIED_CONTACTS`.
- `filterOfficialContacts(query, filter)` performs case-insensitive search across organization names, display values, descriptions and sources.
- `getContactAction(contact)` returns `tel:`, Telegram or email actions where appropriate.
- `isUrlSource(source)` distinguishes external source links from plain source notes.

**`src/lib/trust/scheme-trends.ts`**

- `PUBLIC_SCHEME_TRENDS` contains public, non-personal scam tactic entries for
  bank/SMS-code calls, APK, casino/free-spins, NFT/Stars, TON/wallet,
  Telegram account-takeover, delivery/payment links and dropper recruitment.
- `getSchemeTrendStats()` returns static public counts for trends, active-watch
  entries, critical scenarios, categories and linked reason codes.
- `filterSchemeTrends({ category, query })` searches public RU/UZ/EN text and
  reason-code labels without touching private checks/reports.
- `getTopSchemeTrends(limit)` returns severity-ordered homepage teaser entries.

**`src/lib/trust/scam-map-index.ts`**

- `getPrivacySafeScamMapIndex()` builds the public scam map/index from
  non-personal scheme-trend entries only: category buckets, national layer,
  active-watch/critical counts and a suppressed regional layer.
- `isRegionBucketPublishable({ moderatedReports, distinctSchemes, sourceTypes })`
  is the future dynamic-data gate. Region buckets must meet all thresholds
  before publication.
- `SCAM_MAP_FORBIDDEN_PUBLIC_FIELDS` is a regression guard list for raw reports,
  screenshots, OCR, full targets, URLs, codes, cards and user/chat ids that must
  not appear as public map fields.

**`src/lib/trust/impact-stats.ts`**

- `normalizePublicStatsRow(row, overrides?)` converts RPC/server aggregate rows
  into the public stats contract, defaulting missing fields to zero.
- `formatImpactNumber(value, lang)` formats aggregate counts for public cards.
- `formatUzsCompact(value, lang)` formats user-reported UZS loss totals without
  implying recovered or prevented money.

## Telegram

- `src/lib/telegram/webhook.server.ts`: framework-agnostic webhook handler with fail-closed secret validation, capped body parsing and `update_id` dedup via an in-memory fast path plus shared Postgres claims; returns 503 before dispatch when the shared claim is unavailable.
- `src/lib/telegram/webhook-dedup.server.ts`: `claimTelegramWebhookUpdate(updateId)` inserts a service-role-only idempotency row into `telegram_webhook_updates`, returns `duplicate` for unique violations and `unavailable` for storage failures so the webhook can retry before side effects.
- `src/server.ts`: binds `POST /api/telegram/webhook` and `/healthz` before SSR.
- `src/lib/telegram/router.ts`: parses updates and routes commands/content, including direct `/call` and `/trainer`; handles `inline_query` before chat-target extraction; resets active/contextual session state when stored `scenario_data.chatScope` does not match the current chat; forwards `callback_query.id` so inline-button spinners are acknowledged; analyzes media captions before unsupported-media fallback; routes safe meta-questions before `handleCheck`; routes voice notes, short Telegram `audio` attachments and audio documents such as `.ogg`/`.m4a` through the same capped STT path while keeping non-audio documents unsupported; routes Telegram video thumbnails to the image pipeline with a `video_thumbnail` media marker when no stronger caption/link/button evidence exists; routes uncaptained images in `report_desc` to transient report screenshot evidence; attaches sanitized public forward channel/group source context to check/image actions.
- `src/lib/telegram/handlers/*`: `/start`, `/call`, `/check`, `/report`, safety/help, images, contacts, out-of-scope handling.
- `src/lib/telegram/session.server.ts`: Supabase-backed `telegram_sessions` state; `withSessionChatScope()` stamps chat id/type on state that can affect later replies, and `isSessionStateScopedToChat()` rejects mismatched or legacy unscoped contextual rows; `lastCheck` stores only non-sensitive summary metadata plus short reason codes for follow-up explanations, and `guardian` stores only high-risk summary metadata for post-verdict guidance.
- `src/lib/telegram/family-shield.server.ts`: service-role-only Family Shield helper. It creates HMAC-hashed one-use invite links, rejects duplicate active links, expires stale pending invites, sends redacted trusted-contact alerts with opt-out, provides the privacy-first family codeword guide, and revokes relationships from either guardian or trusted-contact side. The guide never asks users to send or store the actual codeword.
- `src/lib/telegram/api.server.ts`: Telegram Bot API calls, including `answerInlineQuery` for inline-mode article results and in-memory `sendAudio` for opt-in Voice-out.
- `src/lib/telegram/emergency.ts`: `buildPanicScenarioText` now returns compact panic first cards, `buildDetailedPanicScenarioText` keeps the full checklist for `panicctx:full`, plus panic keyboard builders, live-call callback parser and Emergency Copilot helpers: `classifyEmergencyFollowUp`, `buildEmergencyFollowUpText`, `buildEmergencyFollowUpKeyboard`. First panic cards keep the urgent action first and short human guidance cues without repeating "I am nearby" in every message; follow-up answers are guided for stressed/elderly users, keep safe-callback boundaries and use scenario-specific ready phrases/contact destinations for financial, APK, Telegram takeover, live-call, romance, sextortion/photo-video blackmail, publication threats, minor-safety, AI voice-clone, fake job/easy-money, delivery/top-up, crypto/TON/wallet and government grant/benefit cases. Minor-safety and publication-threat trusted-person flows have distinct copy instead of sharing the generic blackmail branch. The panic menu is paginated through page 3 (`panic:more2` / `panic:back2`) for scenarios `12..15`.
- `src/lib/telegram/handlers/check.ts`: routes short post-panic, post-guardian, post-check and orphan helper follow-up questions before `runCheck` (regressed for live phrases like "Точно?", "Что еще посоветуешь?" and "дай номер банка"), sends Guardian Angel companion guidance after high-risk results, checks an early shared image-download budget before Telegram `getFile`/download, handles structured image intelligence plus real pixel QR decoding for photos and routed Telegram video thumbnails, adds an honest preview-frame note to video-thumbnail result cards, allows final no-reasons `safe` image results only through `isEvidenceBackedBenignImageContext`, transcribes capped voice notes, short Telegram audio files and routed audio documents, shows a non-message activity indicator while voice STT is slow, uses a dedicated exhausted-STT-budget copy, routes obvious already-happened voice transcripts (including first RU/UZ mixed-speech patterns) directly to matching `/panic` scenarios, stops low-signal transcripts before scoring and asks for correction, adds a transcript-correction button so users can recheck fixed text without another STT call, stores a safe `image_unreadable` last-check snapshot for OCR/QR failures, suppresses repeated album fallbacks, shortens repeated standalone image fallbacks, attaches unreadable-image triage buttons, fetches visible public Telegram post evidence before metadata-only fallback, and enriches Telegram username/link checks with best-effort public metadata plus moderated Ishonch Guard reputation and public forward-source context after scoring.
- `src/lib/telegram/handlers/report.ts`: owns the `/report` state machine, stores only prepared target hashes/masked displays plus redacted draft text, and accepts screenshots only on the description step. Report screenshots are downloaded/analyzed in memory through structured image evidence, converted to a short redacted summary, and never stored as raw images, data URLs, decoded QR payloads or full OCR text.
- `src/lib/telegram/handlers/inline.ts`: answers Telegram inline-mode queries with one compact `InlineQueryResultArticle`; empty queries show usage help, non-empty queries call `runCheck(skipAi:true, persist:false)` and render a short masked card with one safe next step plus an "open bot" button.
- `src/lib/telegram/forward-context.ts`: sanitizes visible public Telegram forward source metadata and builds RU/UZ/EN reply-only source briefs with scheme/goal/safe-step copy when deterministic reason codes reveal a concrete tactic. It never changes scoring input and never persists source metadata.
- `src/lib/telegram/image-fallback.ts`: builds `imgtriage:*` callback data, the full unreadable-image category keyboard, compact post-category follow-up keyboards and hook/risk/safe-step copy; it is presentation-only and does not run scoring or persistence.
- `src/lib/telegram/moderation-notifier.server.ts`: sends optional private Telegram moderator alerts for new reports and reputation appeals when `TELEGRAM_MODERATION_CHAT_ID` is explicitly configured. It formats only redacted targets, high-level fields and admin links; raw descriptions, screenshots, OCR, codes, card data, full phone numbers and full URLs are never included.
- `src/lib/telegram/check-followup.ts`: classifies and renders safe post-check follow-ups, including orphan phrases such as "Точно?", "что дальше?", "sure?" and "дай номер банка"; unreadable-image follow-ups explain the vision limitation and ask for concrete evidence instead of running a fake insufficient-data check; `explain` follow-ups use context-specific wording and short reason labels without exposing internal scores; `simple_explain` handles "объясни как бабушке" / "простыми словами" / "oddiy qilib" / "simple words" with elder-friendly copy, no score/threshold wording, and no weak topic-only evidence for unknown phone/profile checks.
- `src/lib/telegram/handlers/misc.ts`: handles callbacks and unsupported input; video and unsupported/oversized media fallbacks include capture instructions and next-step buttons; `guardian:*` callbacks answer with stored high-risk guidance or an honest no-context fallback; `family:codeword` shows the offline family-codeword guide without persistence; `imgtriage:*` and `asked:*` callbacks answer with scenario-specific safe steps for unreadable images or low-context username/phone checks and avoid repeating generic risk verdicts; result `why` callbacks use recent `lastCheck` context when available.
- `src/lib/telegram/check-context-buttons.ts`: presentation-only "what did they ask for?" buttons for inconclusive phone/Telegram-profile checks. It maps `asked:*` callbacks to short RU/UZ/EN safe-step responses for code, card, transfer, APK, link/QR and live-call contexts without changing scoring or persistence.
- `src/lib/telegram/public-metadata.server.ts`: extracts public Telegram targets, preserves public post ids from `t.me/username/123` and `t.me/s/username/123`, skips lookup for private/internal links, calls `getChatInfo` via an injectable lookup for public usernames with a soft metadata timeout and bounded short in-memory cache, and builds compact safe RU/UZ/EN Telegram Passport briefs. Username-only checks show visible public data, Ishonch Guard confirmed-report status, hard Bot API limitations, conservative visible username hints (random/generated, brand/support lookalike, promo wording), a Telegram Native Passport Coach that teaches users how to read Telegram-client profile signals without claiming Bot API access, and one concrete next step instead of a raw "insufficient data" dead end; missing local reports are described as not found, never as proof of safety. Slow Telegram metadata responses fall back to an honest unavailable passport instead of blocking the whole check on the full Bot API timeout. When Telegram/Web3 risk reasons exist, it renders a scenario-first evidence brief before hard Bot API limitations; profile-only checks keep limitation-first wording. Public post fallback copy says to forward/paste/screenshot the post when the public web page cannot be read. Enrichment never changes scoring.
- `src/lib/telegram/public-post.server.ts`: validates public Telegram post links, fetches only `https://t.me/s/<username>/<postId>` with timeout/body/shared rate limits, parses visible post text, outbound links, link previews and inline buttons from Telegram web HTML, redacts sensitive digits, builds rules-safe check input, and prepends a source limitation brief without changing score/level/reasons.
- `src/lib/telegram/format.ts`: formats result cards; Telegram profile/invite checks use a dedicated context prompt and longer safe truncation budget so Telegram Passport limitations are not cut off, unknown phone cards render a visual Phone Passport, inconclusive phone/Telegram-profile cards add `asked:*` context buttons, unknown cards hide weak topic-only observations, suspicious cards use a compact "what noticed" evidence section, and high-risk first cards are compressed to urgent actions plus a short evidence summary instead of long generic explanation/reporting blocks. Visible-source briefs for forwarded Telegram posts remain as compact evidence.
- `src/lib/telegram/reputation.server.ts`: observes Telegram targets by HMAC hash, registers unverified Telegram report candidates, syncs confirmed report counts after admin moderation, and renders source/confidence labels only for moderated reputation.
- `src/lib/telegram/handlers/commands.ts`: `/call` stores minimal panic context `6` and opens the active live-call copilot directly with the hangup-first keyboard; `/trainer` opens the callback-only scam-call mini-quiz without persistence.
- `src/lib/telegram/handlers/misc.ts`: stores minimal panic context
  (`lastPanicId`, `lastPanicAt`) and handles both scenario-bound
  `panicctx:<panicId>:<action>` / `voiceout:panic:<panicId>` callbacks and
  legacy context callbacks that fall back through the latest stored panic id;
  `trainer:*` callbacks answer mini-quiz steps without session writes.

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
- `scripts/moderation-alert-smoke.ts`: one-shot smoke test for the optional
  private moderation chat. It requires `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_MODERATION_CHAT_ID`, sends a clearly marked non-user test alert and
  never prints secrets or user evidence.
- `scripts/prod-family-shield-smoke.ts`: one-shot production smoke test for
  Family Shield. It creates a synthetic invite, accepts it, verifies the safe
  notification failure path, revokes the relationship and confirms no open
  synthetic rows remain.
- `scripts/prod-security-smoke.ts`: one-shot production RLS/security smoke test.
  It also fails when `TRUST_PROXY_IP_HEADERS=true` is set without
  `TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true`.
  It verifies anon cannot read/write sensitive tables, including
  `reputation_appeals`, `telegram_webhook_updates` and `rate_limit_buckets`, or
  execute maintenance/stat/rate-limit RPCs, while service-role can count
  required tables and execute stats/rate-limit claims.
