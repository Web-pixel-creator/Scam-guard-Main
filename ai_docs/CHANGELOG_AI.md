# Changelog (AI memory)

Newest first. This tracks documentation/memory files, not every code commit.

## 2026-07-01 - TG-015 Voice-out deploy and full playback smoke

- Refreshed `bun.lock` after adding Voice-out scripts; first Railway deploy
  failed at `bun install --frozen-lockfile`, then deployment
  `962b98c9-b600-4c51-8e6d-98e14ebb15fd` succeeded.
- Full production Voice-out smoke passed against
  `https://scam-guard-main-production.up.railway.app`: Telegram accepted
  panic-6 RU/UZ/EN OGG files and the deployed webhook accepted
  `voiceout:panic:6`.
- General `prod:smoke` also passed: home/healthz/webhook auth checks,
  Telegram webhook info, and AI provider check were healthy.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `QA-2026-07-01-006`, `TG-015`,
  `T-011`, and Status Summary now point to the remaining P2 provider-limit UX
  decision or the next web/Telegram live QA pass.

## 2026-07-01 - TG-015 Voice-out Telegram OGG smoke harness

- Added `prod:telegram-voice-out-smoke`, a production-oriented smoke that sends
  committed panic OGG files through Telegram Bot API `sendAudio` and can trigger
  the app webhook voice-out callback after deployment.
- Added `--skip-webhook` mode for pre-deploy validation: it verifies Telegram
  accepts the local OGG assets without depending on the deployed app bundle.
- Verification passed: scoped eslint for the new script, `npm run
  tts:validate-assets`, and `railway run npx vite-node
  scripts/prod-telegram-voice-out-smoke.ts --skip-webhook`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: fixed TG-015/T-011 column drift,
  added `QA-2026-07-01-005`, and kept full app webhook playback as post-deploy
  follow-up.

## 2026-07-01 - TG-015 Voice-out SOS OGG assets

- Added production-preferred `.ogg`/Opus Voice-out files for all main SOS
  panic scenarios: `panic-1..15` in `ru`, `uz`, and `en` (`45` assets total).
- Added `tts:validate-assets`, which checks required OGG files, Ogg/Opus
  headers, duration bounds, size limits, and safe short SOS scripts.
- Voice-out unit coverage now locks that prerecorded OGG is selected before WAV,
  TTS budget checks, or provider calls.
- Verification passed: scoped eslint, voice-out suite `1 file / 13 tests`,
  `npm run tts:validate-assets`, and `npm run build`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-015`, `T-011`,
  `QA-2026-07-01-004`, and Status Summary now point to live Telegram playback
  smoke plus the provider-limit button UX decision.

## 2026-07-01 - TG-009 profile screenshot intelligence final-card QA

- Profile screenshot explanations are now treated as Telegram-profile context
  in the final formatter, so the user-facing card keeps visible native fields,
  the fakeable-screenshot caveat, and quick "what did they ask for" buttons.
- Added a formatter regression for Telegram profile screenshots and added a
  synthetic profile screenshot fixture to the Telegram QA report/visual board.
- Verification passed: scoped eslint, focused formatter/image-intelligence
  suites `2 files / 70 tests`, `qa:telegram-report`, `qa:telegram-visual`, and
  `npm run build`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-009`, `T-007`,
  `QA-2026-07-01-003`, and Status Summary now point to Voice-out audio review
  or live username/profile screenshot smoke after deploy.

## 2026-07-01 - TG-007/TG-008 username passport coach visible in final card

- Fixed Telegram passport formatting so the Native Passport Coach block survives
  the final user-facing `formatCheckResult` card instead of being truncated.
- `telegram-bot-qa-report` now builds its username passport fixture through
  `buildTelegramPublicMetadataBrief`, keeping the report aligned with the real
  Telegram metadata builder.
- Regenerated `TELEGRAM_BOT_QA_REPORT.md` and the Telegram visual QA board.
- Verification passed: scoped eslint, focused Telegram suites `5 files / 83
  tests`, `qa:telegram-report`, and `qa:telegram-visual`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-007`, `TG-008`, `T-005`,
  `T-006`, `QA-2026-07-01-002`, and Status Summary now point to the next
  UX/logistics slice: Profile Screenshot Intelligence or Voice-out audio
  review/compression.

## 2026-07-01 - ROAD-002 / TG-019 report duplicate-signal polish

- Web `/report` success copy is warmer and explicitly says public labeling is
  manual; similar reports help raise review priority without revealing whether
  this submission was a duplicate.
- Admin `listReports` now attaches operator-only `target_signal_count` and
  `target_last_report_at` from active report rows. Queue priority and admin
  cards use that raw signal count while public `target_report_count` remains
  confirmed-only.
- Verification passed: scoped eslint for touched files, focused
  admin/report tests `3 files / 28 tests`, `git diff --check`, and
  `npm run build`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-019`, `ROAD-002`, `T-012`,
  `T-034`, `QA-2026-07-01-001`, and Status Summary now point to continuing
  UX/logistics fixes; production/live report smoke remains a post-deploy check.

## 2026-06-30 - P1 production Telegram user-story smoke passed

- Added `prod:telegram-user-story-smoke`, a guarded production smoke for the
  remaining Telegram P1 user-story flows.
- The smoke verifies `/start`, RU/UZ/EN language callback persistence, a
  synthetic UZ phone passport, benign delivery false-positive handling, and
  RU/UZ/EN acknowledgement + confirmation follow-ups that must not create
  `checks` rows.
- Cleanup removes synthetic `checks`, `telegram_sessions` and
  `telegram_webhook_updates` rows; secrets, chat ids and synthetic user ids are
  not printed.
- Verification passed: scoped eslint for the new script, focused Telegram/risk
  suite `5 files / 198 tests`, `railway run npm run
  prod:telegram-user-story-smoke`, and general `railway run npm run prod:smoke`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `QA-2026-06-30-012`, `T-001` -
  `T-004`, `TG-001`, `TG-002`, `TG-005`, `TG-006`, and Status Summary now point
  to UX/logistics fixes next. Voice-out real RU/UZ/EN `.ogg` SOS assets and
  compression remain a separate follow-up.

## 2026-06-30 - P1 production Telegram QR + Guardian smoke passed

- Added `prod:telegram-live-qa-smoke`, a guarded production smoke that uses
  synthetic Telegram users and `TELEGRAM_MODERATION_CHAT_ID` without printing
  secrets, chat ids or user ids.
- The smoke verifies a high-risk verification-code/CVV text creates safe
  `lastCheck` + Guardian Angel session metadata, then verifies a real Telegram
  `sendPhoto` QR image goes through file_id download and pixel QR decode as
  `asks_to_scan_qr`.
- Cleanup removed synthetic `checks`, `telegram_sessions`,
  `telegram_webhook_updates` rows and the uploaded QA Telegram photo.
- Verification passed: scoped eslint for the new script, focused Telegram suite
  `4 files / 127 tests`, `railway run npm run prod:telegram-live-qa-smoke`, and
  general `railway run npm run prod:smoke`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `QA-2026-06-30-011`, `T-008 /
  TG-010`, `TG-022`, `T-003 / TG-005`, and Status Summary now reflect that
  image/QR + high-risk Guardian are no longer the next blocker. Remaining P1 is
  Telegram start/check/passport/conversational live RU/UZ/EN and false-positive
  user-story QA, then UX/logistics fixes; Voice-out human audio review/compression
  remains separate.

## 2026-06-30 - P1 Telegram private/group scope production QA passed

- Added `prod:telegram-scope-smoke`, a guarded production smoke that sends
  synthetic Telegram webhook callbacks, verifies private `/report` session
  `chatScope`, verifies a supergroup callback resets instead of reusing private
  state, and cleans synthetic `telegram_sessions` / `telegram_webhook_updates`
  rows.
- Production initially lagged the current session-scoping code, so
  `prod:telegram-scope-smoke` correctly failed on missing `chatScope`; redeployed
  current app to Railway deployment `53f77ca3...`.
- After deployment, `railway run npm run prod:telegram-scope-smoke -- https://scam-guard-main-production.up.railway.app`
  passed, and the general `prod:smoke` passed on the same production URL.
- Added explicit `vite-node` dev dependency and scoped the `brace-expansion`
  override so existing `prod:*` npm scripts run directly without the stale local
  shim / ESLint minimatch failure.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `T-014 / TG-027` now records the
  production pass; Status Summary now points to remaining P1 Telegram live QA
  (image/QR, high-risk Guardian Angel, conversational follow-ups) before
  UX/logistics fixes.

## 2026-06-30 - P1 production web user-story QA passed

- Production browser QA passed for the homepage high-risk result, `/report`
  success path and `/appeal` success path against
  `https://scam-guard-main-production.up.railway.app`.
- Added `prod:admin-moderation-smoke`, a guarded production smoke that finds the
  synthetic report/appeal by marker or hashed target, runs the same admin
  moderation core functions, verifies audit actions, and cleans synthetic rows.
- QA marker `QA-P1-WEB-20260630111649` was cleaned from reports, appeals,
  entities, admin actions and checks after verification.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `QA-2026-06-30-010` records the
  run, and WEB-002 / WEB-003 / WEB-007 now point to production-pass status.
- Next recommended P1 remains Telegram/private-group user-story QA or
  UX/logistics fixes; Voice-out human audio review/compression is a separate
  follow-up.

## 2026-06-30 - Voice-out pre-record architecture first slice

- Main SOS `voiceout:panic:{id}` callbacks now look for static audio before
  live TTS. Default path: `public/audio/voice-out/panic-{id}-{lang}.ogg`,
  overrideable with `VOICE_OUT_PRERECORDED_DIR`.
- Static Voice-out audio bypasses Gemini/OpenAI calls and does not spend the
  daily TTS budget; missing static audio falls back to the existing provider
  chain and text fallback.
- Emergency follow-up screens no longer repeat the "Озвучить главный шаг"
  button, reducing the broad voice-button surface that QA flagged.
- Generated static Gemini WAV assets for all 15 SOS panic scripts in RU, UZ and
  EN. Remaining work is human audio review, optional `.ogg` compression when a
  converter is available, and a separate decision on static Guardian Angel
  audio.

## 2026-06-30 - Telegram conversational follow-ups after QA feedback

- Added post-check/post-SOS handling for short acknowledgements like
  "Хорошо сделаю" so the bot answers warmly instead of running a fake
  insufficient-data check.
- Added handling for ambiguous confirmation requests such as
  "Попросил подтверждение": the bot now warns about SMS codes, push
  confirmations, QR login and card operations without changing the previous
  verdict.
- Voice transcript previews now trim on a word boundary with an ellipsis while
  the risk check continues to use the full transcript.
- Guardian Angel intro copy now uses human-facing companion wording instead of
  explaining internal auto-prompt mechanics.
- Recorded the remaining Voice-out pre-record architecture pass as an open
  task after QA found live TTS buttons too broad and too provider-dependent.

## 2026-06-29 - Proxy IP header trust is fail-closed and documented

- Documented `TRUST_PROXY_IP_HEADERS` as an explicit opt-in for public
  rate-limit identity behind a trusted edge proxy only.
- Confirmed focused tests prove spoofable forwarding headers are ignored by
  default and used only when the opt-in is set.
- Added a `prod:security-smoke` env guard: if proxy IP header trust is enabled,
  the smoke requires `TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true`.
- Railway production security smoke confirmed `TRUST_PROXY_IP_HEADERS` is
  unset/false and the full RLS/RPC smoke still passes.

## 2026-06-29 - Public impact loss counters require confirmed reports

- Public check and risk-alert counters remain aggregate raw service activity.
- Public report/loss impact counters now count only
  `reports.status='confirmed'` rows in both the `get_check_stats()` RPC and the
  server-side fallback queries.
- Updated homepage copy so loss totals are presented as moderator-confirmed
  report impact, not unreviewed user-submitted amounts.

## 2026-06-29 - Embed widget framing requires an origin allowlist

- `/embed/check` no longer ships with broad `frame-ancestors https:`.
- The embed CSP now defaults to `'self'` plus localhost development origins and
  adds production partner origins only from `EMBED_ALLOWED_FRAME_ANCESTORS`.
- Added regression coverage for rejecting unsafe allowlist entries and for
  building CSP from explicit HTTPS partner origins.

## 2026-06-29 - Same-day duplicate reports keep durable evidence

- Same-day report dedupe now stores a redacted `reports.status='duplicate'`
  row instead of relying only on a best-effort moderation notification.
- Duplicate report rows do not refresh public `entities`, do not change
  `entities.report_count`, and cannot be moderated as new reports.
- Added regression coverage proving duplicate evidence is persisted while public
  entity state remains unchanged, plus an admin `duplicate` report filter.

## 2026-06-29 - Webhook dedup outages retry before dispatch

- Telegram webhook processing now returns HTTP 503 before dispatch when the
  shared `telegram_webhook_updates` dedup claim is unavailable.
- The in-memory duplicate marker is written only after a successful shared claim
  so a Telegram retry after a temporary storage outage is not lost locally.
- Added regression coverage proving unavailable shared dedup does not dispatch
  and a later successful retry can process the same `update_id`.

## 2026-06-29 - Public stats use a short server cache

- Added a 30-second in-process cache and in-flight de-duplication around
  `getPublicStats` so repeated public requests do not each run the service-role
  stats RPC and aggregate count/select queries.
- Kept the existing aggregate-only public stats shape and fallback amount bound.
- Added regression coverage proving two immediate public stats requests share
  one set of service-role aggregate queries.

## 2026-06-29 - Empty homepage quick reports stay incident-only

- Added a shared quick-report payload helper so the homepage form sends
  `incidentOnly: true` with the incident-only sentinel when the optional target
  field is empty.
- Added a server-side placeholder guard so dash-only legacy targets are treated
  as situation-only reports and cannot create public entity candidates or daily
  entity dedupe keys.
- Added regression coverage for both the UI payload builder and the server path.

## 2026-06-29 - Public entity report counts require moderation

- `submitReportCore` now creates or refreshes entity moderation candidates
  without incrementing public `entities.report_count`.
- `moderateReportCore` recalculates `report_count` from confirmed reports when
  a moderator confirms or rejects a report, so public reputation counts reflect
  moderated evidence only.
- Added a Supabase migration to backfill existing `entities.report_count` values
  from `reports.status='confirmed'`, plus regression coverage for an
  unmoderated follow-up report on an already confirmed entity.

## 2026-06-29 - Telegram image downloads are rate-limited before file fetch

- Added an early Telegram image-download budget before `getFile` and
  `downloadFileAsDataUrl`, using the shared privacy-safe rate limiter with a
  separate `telegram-image:<tg:userId>` key.
- The final `analyzeImageCore`/`runCheck` limits remain in place as defense in
  depth, but repeated screenshots are now rejected before Telegram media
  metadata/download cost is incurred.
- Added webhook regression coverage that first reproduced an 11th repeated
  image reaching `getFile`, then passed with only 10 file fetch/download/OCR
  calls and a friendly rate-limit reply.

## 2026-06-29 - Telegram image safe verdicts require supporting evidence

- Split benign image context from final safe-verdict eligibility. Telegram image
  checks now use `isEvidenceBackedBenignImageContext` for `safeIfNoReasons`.
- A model-only benign category such as `delivery_sms`, with no readable text,
  QR signal or risk hints, now remains `unknown` instead of forcing `safe`.
- Added unit and webhook regression coverage proving the model-only path no
  longer reproduces while normal delivery/menu screenshots still stay out of
  high-risk false positives.

## 2026-06-29 - Web OCR image data URLs are server-validated

- Added a shared image data URL validator for web OCR and image-intelligence
  core paths. Only `image/png`, `image/jpeg` and `image/webp` base64 data URLs
  within the screenshot byte limit are accepted.
- The public `ocrExtract` server function rejects non-image, malformed,
  non-base64 and oversized payloads before calling `ocrExtractCore`.
- `ocrExtractCore` and `analyzeImageCore` now re-check the data URL before
  building AI `image_url` messages, so direct core callers cannot forward
  invalid media payloads to the AI provider.

## 2026-06-29 - Telegram report drafts stop storing raw identifiers

- Hardened the Telegram `/report` draft path so `telegram_sessions.scenario_data`
  stores a prepared target `{ type, hash, display, incidentOnly }` instead of
  raw usernames, phone numbers or URLs.
- Free-form draft fields that may contain user evidence (`description`,
  `scamType`, `city`) are redacted before session persistence, including retry
  drafts after a failed final submit.
- Added regression coverage for raw handle/email/link/code leakage in report
  drafts, prepared Telegram target submission, and webhook callback retry
  fixtures.

## 2026-06-29 - Telegram session state is chat-scoped

- Hardened `telegram_sessions.scenario_data` with a `chatScope` boundary so
  `/report`, `/check`, `/call`, panic and follow-up context created in one
  Telegram chat cannot be reused by the same user from another private/group
  chat.
- The router now resets active or contextual legacy session rows when they lack
  a matching chat scope, then handles the current update as fresh input.
- Added router, webhook and full Telegram regression coverage for scoped
  scenarios, unscoped legacy resets and normal same-chat continuation.

## 2026-06-29 - Admin allowlist gated on email confirmation

- Added a Supabase migration so `admin_allowlist` no longer grants `admin` on
  signup before `auth.users.email_confirmed_at` is set.
- Added a confirmation update trigger that promotes allowlisted users only
  after Supabase marks the mailbox verified, plus cleanup for previously
  auto-granted unverified allowlisted admin rows.
- Added focused migration regression coverage and updated deployment/database
  docs with the email-confirmation requirement.

## 2026-06-22 - Telegram Native Passport Coach shipped

- Username passports now teach users how to read Telegram's native profile card:
  phone country, registration month, "not official" labels and recent
  name/photo changes are framed as user-visible Telegram-client signals, not Bot
  API data.
- Added conservative visible username hints for random/generated usernames,
  brand/support lookalikes and promo wording around investments, betting,
  bonuses, crypto or gifts.
- Kept the hard boundary: no claims about hidden Telegram SCAM labels, account
  age, Telegram complaint history or who the account messaged.

## 2026-06-22 - Unified execution plan refreshed after PR #66/#67

- Updated `EXECUTION_PLAN_2026-06-21.md` after PR #66 and PR #67 were merged
  into `main`.
- Added Telegram Native Passport Coach, username risk heuristics, and Profile
  Screenshot Intelligence as explicit P8.1/P8.2/P8.5 follow-ups.
- Reordered the nearest plan around deploy, dashboard operator UX v2, honest
  username/profile passport work, voice-in v2, QR precision, speed/cost and
  security hardening.

## 2026-06-22 - Risk Passport phone next step polish

- Phone risk passports now include the next safe step inside the passport card
  instead of repeating a separate generic context prompt below it.
- Reused the shared `prompt_more_context_phone` i18n string so RU/UZ/EN copy
  stays consistent.
- Added regression coverage so phone passports ask for context exactly once
  while preserving the honest "number alone does not prove scam" boundary.

## 2026-06-21 - P7 report flow moderation signals

- Warmed the final `/report` confirmation: users now see that they helped warn
  others, while public labels still require manual moderation.
- Humanized private moderation Telegram alerts: duplicate reports are framed as
  an additional signal instead of database/internal wording.
- Enriched admin report cards with the target report count from the reputation
  entity row, so repeated complaints are visible before a public moderation
  decision.
- No schema migration: duplicate public rows are still suppressed; duplicate
  alerts remain moderation-only and masked.

## 2026-06-19 - Report flow copy and moderation alert UX polished

- Rewrote `/report` prompts to feel less like a cold form and more like a safe
  moderated incident submission.
- Clarified the final `/report` confirmation: only a safe short moderation
  notice is sent, and public visibility requires manual review.
- Reformatted private moderation Telegram alerts into a structured Russian
  operator card with privacy reminders and a localized admin button.
- Simplified duplicate-report alert wording so moderators see a human cue:
  "already reported today; look closer" instead of database-oriented copy.
- Clarified that moderation chat alerts are operator-only, intentionally mask
  targets, and require opening the protected admin panel for full review.
- Updated login copy/errors to match the production admin allowlist model.

## 2026-06-19 - Hidden Telegram chat id command shipped

- Added hidden `/chatid` Telegram command for private moderation group setup.
- The command is intentionally not registered in the public Telegram command
  menu, so regular users do not see operator tooling.
- Updated deployment/on-call docs to use `/chatid` instead of third-party bots
  for `TELEGRAM_MODERATION_CHAT_ID`.

## 2026-06-19 - Moderation alert smoke test shipped

- Added `scripts/moderation-alert-smoke.ts` and `npm run moderation:smoke` to
  verify the optional private moderation chat from Railway env.
- The smoke test sends a clearly marked non-user alert and never prints bot
  tokens, chat ids or user evidence.
- Updated deployment and on-call docs with the setup/test path for
  `TELEGRAM_MODERATION_CHAT_ID`.

## 2026-06-19 - Private moderation alerts first slice shipped

- New report and reputation appeal submissions can now notify an explicit
  private Telegram moderator chat via `TELEGRAM_MODERATION_CHAT_ID`.
- The moderation alert is opt-in and contains only redacted targets, high-level
  fields and an admin link; raw report text, screenshots, OCR, codes, card
  data, full phone numbers and full URLs are not sent to the chat.
- High-signal research-feed moderation alerts remain a follow-up task.

## 2026-06-19 - Decoded QR fast path shipped

- Telegram photo checks now skip slower visual AI when pixel decoding already
  proves an actionable QR payload: Telegram login, 2FA/authenticator, payment
  or wallet/deep-link QR.
- Plain URL QR codes, restaurant/menu QR and suspicious HTTP URLs still use the
  normal image-context path to avoid overcalling risk without visual context.
- Added regression coverage for decoded-only QR evidence so the fast path stays
  narrow.

## 2026-06-19 - Telegram metadata latency guard shipped

- Public Telegram username/post passport enrichment now uses a 1.2s soft
  metadata lookup budget before falling back to an honest "public data
  unavailable" passport instead of waiting for the full Bot API timeout.
- Added a bounded short in-memory metadata cache for repeat username/post
  checks, reducing repeated Telegram API calls without persisting usernames or
  raw user input.
- Latency pass remains open for OCR/STT/image-analysis timing-log tuning.

## 2026-06-19 - Voice-in confidence fallback and RU/UZ fixtures shipped

- Low-signal voice transcripts now stop before the normal risk pipeline and ask
  the user to correct or type the text, avoiding misleading risk cards from
  weak STT output.
- Added RU/UZ mixed-speech voice fixtures so "kod yubordim",
  "pul o'tkazdim" and "qo'ng'iroq qilishyapti" route directly to the matching
  emergency flows.
- Updated Voice-in v2 specs and regression coverage.

## 2026-06-18 - Voice-in transcript correction shipped

- Telegram voice transcript previews now include a localized "Correct text"
  button so users can fix misheard STT output instead of resending audio.
- The correction callback stores `await_check` state and asks for one corrected
  text message; the next message runs through the normal text risk pipeline
  without another voice download, STT call or voice-budget spend.
- Added regression coverage for the correction button, callback routing and
  no-extra-STT path. Voice-in v2 remains open for confidence-aware fallback and
  RU/UZ mixed-speech fixtures.

## 2026-06-18 - QR clarity pass shipped

- Telegram image explanations now distinguish real pixel-decoded QR payloads
  from URLs merely visible near a QR, and from QR codes that are visible but
  not reliably readable.
- Benign menu/loyalty/informational QR replies now say what was actually seen
  and which requests would make the next page risky: login, payment, SMS code,
  card data or APK.
- QR-login/payment explanations still hide Telegram login tokens and 2FA
  secrets while preserving high-risk guidance.

## 2026-06-18 - Voice-out duplicate-click feedback shipped

- Voice-out callbacks now own their `answerCallbackQuery` response: the first
  tap shows a short "preparing voice" status, while repeated taps for the same
  text return a duplicate hint instead of silently doing nothing.
- The duplicate guard still blocks repeated TTS provider calls for the same
  user/chat/text window, reducing accidental API spend when users tap the
  voice button several times while waiting.

## 2026-06-18 - Voice-in/STT UX first slice shipped

- `handleVoice` now starts a fast non-message Telegram typing indicator while
  STT is running, and repeats it for long provider calls so users do not think
  the bot froze during 5-10 second voice transcription.
- Voice STT daily-budget exhaustion now uses a dedicated message explaining
  that the limit protects against spam/cost abuse, then asks for a typed
  summary or emergency action instead of a generic rate-limit line.
- Obvious already-happened voice transcripts such as "I sent the SMS code",
  "installed an APK", "transferred money", "entered card data", "lost Telegram"
  or "I am on a call" route directly to the matching `/panic` scenario before
  the normal risk-card path.
- Added regression coverage for slow-STT waiting state and voice-to-panic
  routing, and updated the Voice STT spec plus `OPEN_TASKS.md`.

## 2026-06-18 - Contextual Voice-out hardening shipped

- Voice-out callbacks under SOS follow-ups now preserve the exact originating
  follow-up action, so "ready phrase", "what next", contacts and full-plan
  buttons speak the same short card the user is reading instead of replaying a
  generic scenario summary.
- Added a best-effort Telegram `upload_voice` chat action before TTS synthesis
  and regression coverage that repeated taps do not create duplicate provider
  calls.
- Added a regression fixture for the real voice transcript pattern "delivery
  only by card" so it stays mapped to `fake_delivery_payment` instead of
  falling back to an empty "not enough data" answer.
- Updated `FUNCTIONS_MAP.md`, `ROADMAP.md` and `OPEN_TASKS.md` to split the
  completed Voice-out hardening from the still-open Voice-in/STT UX work.

## 2026-06-18 - Emergency copy trust polish shipped

- Removed repeated "I am nearby" prefixes from SOS first cards, follow-up
  answers and Guardian Angel copy where the repetition made the bot feel
  templated instead of calm.
- Changed zero-report reputation wording for Telegram/phone passport cards to
  "confirmed complaints not found in Ishonch Guard" so absence of local reports
  is never presented as proof of safety.
- Updated the Telegram QA report generator fixture, regenerated
  `ai_docs/TELEGRAM_BOT_QA_REPORT.md` and refreshed regression expectations for
  emergency copy and reputation wording.

## 2026-06-18 - Emergency keyboard profile pass shipped

- `/panic` follow-up keyboards now use scenario-specific next-action buttons
  instead of reusing one bank/help template. Financial/APK/live-call cases keep
  safe callback; Telegram takeover shows recovery; blackmail/minor cases
  prioritize trusted help and help directory; romance uses pause/review; AI
  voice-clone uses voice verification; crypto uses wallet safety; job and grant
  cases point to source/official-channel checks.
- Guardian Angel keyboards now suppress bank-callback actions for non-bank
  contexts such as crypto, QR and Telegram recovery, keeping trusted-person,
  full-plan, Voice-out and new-check actions instead.
- Regenerated `ai_docs/TELEGRAM_BOT_QA_REPORT.md` and added regression tests
  for scenario-specific SOS and Guardian Angel button profiles.

## 2026-06-18 - Emergency callback context binding shipped

- Panic follow-up buttons and Voice-out callbacks now carry the originating
  scenario id, with legacy callback fallback retained for older keyboards.
- Added stale-keyboard regression coverage so an old APK follow-up button keeps
  answering as APK even after the user opens a different panic scenario.
- Removed unsafe Telegram recovery username guidance from takeover recovery
  copy; user-facing instructions now point to official Telegram app
  settings/support wording.
- Regenerated `ai_docs/TELEGRAM_BOT_QA_REPORT.md` and updated roadmap/open
  tasks/functions map to mark the first two 2026-06-18 emergency trust fixes as
  shipped.

## 2026-06-18 - Roadmap update after emergency UX feedback

- Updated `ai_docs/ROADMAP.md` with the new canonical implementation order from
  the 2026-06-18 Telegram bot feedback.
- The next priority is no longer adding broad new features first; it is closing
  trust-breaking emergency UX issues: scenario-bound panic callbacks, safe
  Telegram recovery wording, context-specific emergency keyboards, softer
  reputation wording and Voice-in v2.
- Added `OPEN_TASKS.md` items for private redacted moderation-chat
  notifications, weekly-scheme data modeling and stale-keyboard regression
  tests.
- Confirmed that Voice-out/TTS daily limits remain intentional cost protection;
  future work should improve waiting/idempotency UX rather than removing the
  quota guard.

## 2026-06-18 - Telegram timing diagnostics and delivery voice pattern

- Added sanitized `telegram_timing` diagnostics for Telegram text, image and
  voice handlers. The logs identify slow stages without printing raw user
  messages, transcripts, links, phone numbers, usernames, OCR text or QR
  payloads.
- Documented `TELEGRAM_TIMING_LOGS` and `TELEGRAM_TIMING_LOG_THRESHOLD_MS` for
  short production latency investigations.
- Added Telegram-specific AI latency budgets for explanations, image
  intelligence and voice STT, and documented the Railway env overrides.
- Low-signal username, phone and generic URL passport checks now skip AI so the
  bot answers quickly and avoids over-explaining when the honest result is
  "send the message/screen for context".
- Tightened `fake_delivery_payment` so plain payment-on-delivery text stays
  benign while delivery/card-only wording from voice transcripts becomes a
  risk signal.

## 2026-06-17 - Gemini TTS provider for Voice-out

- Voice-out now prefers `GEMINI_TTS_API_KEY` with
  `gemini-3.1-flash-tts-preview` and falls back to OpenAI TTS when configured.
- Gemini `audio/l16` responses are wrapped as WAV before sending to Telegram.
- `npm run tts:smoke` now verifies Gemini or OpenAI TTS without printing
  secrets, request bodies, audio, or provider error bodies.

## 2026-06-16 - Telegram OGG audio documents route to STT

- Telegram `.ogg`/`.m4a`/audio files sent as `document` messages now route to
  the same capped voice STT pipeline as voice notes and native Telegram audio.
- Non-audio documents such as PDF/APK/video files still stay in the safe
  unsupported-document path and are not downloaded.
- Fixed TypeScript strictness in Voice-out audio upload/fallback so `tsc`
  remains clean with the TTS code path.

## 2026-06-16 - QR decoded evidence in Telegram replies

- Telegram image explanations now surface decoded safe QR destinations such as
  `chenson.uz/loyalty` or `t.me/chensonuz_bot` so restaurant/menu QR results
  feel evidence-based instead of guessed.
- Sensitive QR payloads are not echoed: Telegram login tokens and 2FA secrets
  are summarized as hidden login/authenticator QR values in user-facing copy.
- Added `npm run qa:qr-decode -- <image>` for local QR checks against real
  screenshots and regenerated Telegram QA coverage for benign QR and login-QR
  cases.

## 2026-06-16 - Telegram visual QA board

- Added `scripts/telegram-bot-qa-visual.ts` and `npm run
qa:telegram-visual`.
- The visual board renders `ai_docs/TELEGRAM_BOT_QA_REPORT.md` as
  Telegram-like message cards under `output/playwright/` for desktop/mobile
  screenshot inspection.
- Updated open tasks so future bot copy/button changes include both textual
  and visual QA review.

## 2026-06-16 - QR auth and audio-file check polish

- Tightened Telegram image intelligence so QR-login/device-link/2FA screens
  such as Telegram "connect device", bank QR-login and authenticator QR prompts
  produce `qr_login` evidence and a QR-specific warning instead of a generic
  insufficient-data/menu answer.
- Kept restaurant/menu/program-loyalty QR posters below high risk unless a
  payment, login, code, card, wallet or APK request appears.
- Routed short Telegram `audio` files with `file_id` through the same capped
  voice STT pipeline as voice notes. Oversized or unclear voice/audio messages
  keep the safe text fallback.
- Clarified Telegram user-facing copy: unsupported-media fallback now says
  short voice/audio up to 60 seconds is supported, and restaurant/menu QR
  results no longer imply that the hidden QR payload was definitely decoded.

## 2026-06-16 - Telegram Voice-out / TTS v1

- Added opt-in `voiceout:*` callbacks for SOS follow-ups and Guardian Angel.
- Added `src/lib/telegram/voice-out.server.ts` with short RU/UZ/EN safety
  scripts, a 5/day user budget, TTS endpoint isolation and sanitization before
  speech synthesis.
- Voice-out strips links, Telegram usernames and long digit runs, refuses
  unsafe code/PIN/CVV/password-like text and never treats Gemini chat endpoints
  as speech endpoints.
- If `OPENAI_TTS_API_KEY` is missing or TTS fails, the bot sends a short text
  fallback and keeps the same recovery buttons.
- Regenerated the Telegram QA report to include Voice-out samples and buttons.

## 2026-06-16 - Telegram bot QA report

- Added `scripts/telegram-bot-qa-report.ts` and `npm run
qa:telegram-report`.
- The generated `ai_docs/TELEGRAM_BOT_QA_REPORT.md` renders current Telegram
  bot copy and keyboards from TypeScript formatters for product review.
- Coverage includes main menus, result cards, media fallbacks, image triage,
  asked-context hints, `/panic`, `/call`, Guardian Angel, Family Shield and
  report flow.
- Documented that the report should be regenerated whenever bot copy or
  buttons change.

## 2026-06-16 - Family Shield invite UX clarification

- Clarified Family Shield invite copy so the guardian understands the invite
  link is not for them and must be sent to another Telegram contact.
- Renamed the invite action to make the Telegram share flow explicit.
- Improved the self-link error to explain that opening your own invite does not
  enable the trusted-contact relationship.
- Added regression coverage for the invite handoff copy and `t.me/share/url`
  keyboard behavior.

## 2026-06-16 - Guardian Angel v1

- Added `.kiro/specs/telegram-guardian-angel-v1/`.
- High-risk Telegram check results now send a short companion message after
  the verdict: one safe step, done confirmation, safe callback, trusted-contact
  help, full plan and new-check actions.
- Added `src/lib/telegram/guardian-angel.ts` with privacy-safe snapshots,
  tri-lingual guidance, callback parsing and short follow-up routing.
- `telegram_sessions.scenario_data.guardian` stores only risk level, input
  type, reason codes and timestamp; raw messages, URLs, phone numbers, OCR,
  screenshots, codes and card data remain forbidden.
- Added regressions for snapshot privacy, high-risk companion messages and
  `guardian:*` callbacks.
- Roadmap now moves the next implementation slot to opt-in Voice-out/TTS v1.

## 2026-06-16 - Telegram Modern SOS Scenarios v1

- Added `.kiro/specs/telegram-modern-sos-scenarios-v1/`.
- Expanded `/panic` to a third page with `panic:12` through `panic:15`:
  fake job/easy money, delivery/top-up, crypto/TON/wallet and government
  grant/benefit.
- Added compact first cards, detailed checklists with verified contact paths
  and scenario-specific follow-up copy for next step, ready phrase,
  trusted-person guidance and help-directory actions.
- Updated regression coverage for page-3 keyboard routing, callback parsing,
  localization completeness and emergency text well-formedness.
- Roadmap now moves the next implementation slot to Guardian Angel v1, then
  opt-in Voice-out/TTS v1.

## 2026-06-16 - AI Voice-Clone SOS Scenario v1

- Added panic scenario `11` for AI voice-clone / fake relative calls.
- The second panic-menu page now includes the new scenario and callback parsing
  accepts `panic:11`.
- Added compact first-card guidance: verify the person via a saved number,
  family code word or private question before sending money or codes.
- Added scenario-specific follow-up copy for next step, ready phrase,
  trusted-person guidance and help-directory contacts, avoiding bank-first
  wording unless money was already sent.
- Updated regression coverage so the voice-clone flow stays in the correct SOS
  profile.

## 2026-06-15 - Financial ready phrases and CSP hardening

- Already-happened financial SOS scenarios now use their own ready phrases:
  SMS-code sent, transfer made and card data entered no longer reuse the generic
  incoming-call callback script.
- Added regression coverage that keeps financial ready phrases scenario-specific
  and verifies blackmail/minor flows do not fall back to bank-callback copy.
- Moved CSP policies into `src/lib/security/csp.ts`; main-site and embed
  `script-src` now use request-scoped SSR nonces instead of `unsafe-inline`,
  while the Unicorn Studio script is pinned to the exact CDN URL used by the
  component.
- Documented the intentional embed boundary: `/embed/check` remains frameable
  for partner sites, with partner allow-listing/logging tracked as a follow-up.

## 2026-06-15 - Direct Live-Call `/call` v1

- Added `.kiro/specs/telegram-live-call-direct-entry-v1/`.
- `/call` is now a known Telegram command and opens the live-call copilot
  directly, without first showing the broader `/panic` scenario menu.
- The command stores only the existing panic context id `6` plus timestamp so
  short follow-up questions stay in live-call context.
- Added `/call` to `/help`, localized `setMyCommands` payloads and webhook
  regression coverage.

## 2026-06-15 - SOS Ready Phrase Fix v1

- Added `.kiro/specs/sos-ready-phrase-fix-v1/`.
- Existing panic follow-ups now choose a scenario profile before rendering
  ready phrases, trusted-person guidance and contact/help destinations.
- Financial/APK/live-call cases keep safe official-callback wording, while
  Telegram takeover, romance, blackmail and minor-safety cases no longer get
  irrelevant "call the bank" copy.
- Expanded emergency follow-up routing for "куда обратиться", police/support
  and UZCERT wording.

## 2026-06-15 - Unified Risk Passport v1 (Telegram)

- Telegram `unknown` phone and username checks now render as a Risk Passport
  card instead of the generic "not enough data" verdict card.
- The passport keeps the honest boundary: visible facts, app-owned reputation
  and official-directory signals are allowed; hidden Telegram scam labels,
  account age, spam history and unmoderated complaints are not claimed.
- Contextual "what did they ask for?" buttons remain attached to shallow
  phone/username checks so users can continue with code/card/transfer/APK/QR
  or live-call guidance.
- Added formatter regressions that passport cards suppress the old generic
  unknown verdict while normal result cards still keep their verdict line.

## 2026-06-15 - Roadmap correction after Risk Passport feedback

- Promoted Unified Risk Passport v1 to the next implementation task after
  Website Embed Widget v1.
- Added `.kiro/specs/risk-passport-v1/` with requirements, design and tasks.
- Reordered near-term work around the latest Telegram UX feedback: Risk
  Passport v1, SOS ready phrase fixes, direct `/call`, new SOS scenarios,
  Guardian Angel, Voice-out/TTS, external URL signals and then public website
  trust surfaces.
- Reconfirmed the product boundary: do not copy MTProto-style hidden Telegram
  facts such as account age, hidden scam labels, DC/country or spam history.

## 2026-06-15 - Website Embed Widget v1

- Added `.kiro/specs/website-embed-widget-v1/`.
- Added `/embed`, a partner-facing page that explains the iframe widget, shows a
  live preview and generates a copyable snippet with sandbox and strict-origin
  referrer policy.
- Added `/embed/check`, a compact no-chrome iframe runtime that reuses the
  existing `checkInput` server function, shared rate limits, redaction and
  rules-first scoring.
- Added `src/lib/embed-widget.ts` helper tests for language fallback, partner
  label sanitization and iframe snippet safety.

## 2026-06-15 - Telegram Passport Context Buttons v1

- Telegram username and phone checks that cannot reach a firm verdict now add
  compact "what did they ask for?" buttons: code, card, transfer, APK, link/QR
  or live call.
- Button callbacks answer with one concrete safe next step instead of routing a
  user's follow-up question back into the generic risk pipeline.
- Phone Passport cards now use small visual sections for country/operator,
  official directory status, Ishonch Guard report count and the honest
  "number alone is not proof" boundary.
- Telegram Passport copy now avoids appending a second generic AI paragraph for
  low-signal username-only checks.

## 2026-06-15 - Telegram Passport Copy Polish v1

- Telegram username-only checks now render as a small "Telegram Passport":
  visible public facts, Ishonch Guard confirmed-report count, hard Bot API
  limitations and a concrete next step.
- Increased Telegram-result explanation truncation only for Telegram Passport
  cards so the limitation and next-step lines are not cut into an unhelpful
  ellipsis.
- Updated regression tests and `.kiro/specs/telegram-link-account-intelligence-v2/tasks.md`.

## 2026-06-15 - Telegram Main Menu UX v2

- Updated `.kiro/specs/telegram-main-menu-ux/` to match the current eight-action
  Telegram main menu.
- `/start` and `/menu` now present the in-chat menu as an action hub: emergency
  help is the first full-width action, while new check, Family Shield, weekly
  schemes, reports, safety, explanation and language are grouped below it.
- Clarified quick-action labels so users understand that "new check" starts a
  fresh number/link/text/screenshot check instead of repeating the previous
  result.

## 2026-06-14 - Report Screenshot Evidence v1

- Added `.kiro/specs/report-screenshot-evidence-v1/`.
- Telegram `/report` now accepts screenshots during the description step and
  converts usable structured image evidence into a short redacted report
  description.
- The feature intentionally avoids Supabase Storage: raw images, data URLs,
  decoded QR payloads and full OCR text are not persisted.
- Router and report handler tests cover screenshot routing, unreadable-image
  fallback, oversized images and redaction of URLs/usernames/phones/codes in
  saved report drafts.

## 2026-06-14 - Reputation Appeals v1

- Added `.kiro/specs/reputation-appeals-v1/`.
- Added privacy-safe `reputation_appeals` storage for correction/removal
  requests: raw targets and contact details are never stored, direct
  anon/authenticated access is revoked, and server code writes with service-role
  after hashing, masking and redaction.
- Added public `/appeal` page plus `submitReputationAppeal` server function for
  phone, Telegram, URL and APK targets.
- Extended the admin dashboard with an appeal queue. Admins can remove public
  reputation labels or keep them after review; decisions are recorded in
  `admin_actions`.
- Added `ai_docs/MODERATION_GUIDELINES.md` and updated the roadmap/open tasks,
  API, database, file/function maps and AI index.
- Applied the production migration and verified the table exists with RLS
  enabled, a service-role-only policy and no direct `anon`/`authenticated`
  table grants.
- Railway deployment `51bbcd7c-1c5c-4d70-89a3-50733674adaa` passed public
  `/appeal` HTTP smoke, `prod:security-smoke`, `prod:smoke`,
  `prod:family-smoke` and `monitor:prod`.

## 2026-06-14 - Bot Safety Firewall v1

- Added `.kiro/specs/bot-safety-firewall-v1/`.
- Added `src/lib/risk/ai-output-safety.ts`, a user-facing AI output firewall
  that blocks prompt-injection leakage and any AI-authored request for SMS/OTP,
  PIN, CVV/CVC, passwords, card/seed data, APK installs, wallet signing or
  payments.
- `aiExplain` now returns `null` for unsafe provider output before it can be
  persisted in `checks.ai_explanation` or rendered in Telegram/web.
- Structured image `summary` is also sanitized before it can become fallback
  user-facing text; OCR evidence remains available for deterministic scoring.

## 2026-06-14 - Production operational follow-up

- Hardened Telegram Voice STT cost controls: voice notes are now capped at 60
  seconds / 2 MB, STT has a separate 5/day per-user budget, repeated Telegram
  `file_unique_id` values reuse a short-lived in-memory redacted transcript
  cache, and `transcribeVoiceCore` no longer double-consumes the normal check
  rate limit.
- Added Supabase migration `20260614064831_schedule_retention_cleanup_v1` to
  enable `pg_cron` and schedule `ishonch_prune_app_retention_daily` at
  `17 20 * * *` (daily 20:17 UTC).
- Verified the production cron job exists exactly once and is active, then ran
  `prod:security-smoke`, `prod:smoke` and `monitor:prod` successfully.
- Applied Supabase migration `20260613182647_honest_impact_counters_v1` to the
  linked production project and verified `get_check_stats()` returns the new
  aggregate-only impact fields.
- Railway `prod:smoke` and `monitor:prod` passed against
  `https://scam-guard-main-production.up.railway.app`; Telegram webhook health,
  Telegram `getMe`, and AI provider probe were green.
- Production AI is currently configured as `gemini-3.5-flash`; the provider
  probe returned `200` during this verification.
- `MONITOR_ALERT_CHAT_ID` is configured in Railway and GitHub Secrets, and a
  direct Telegram alert test returned `ok: true`.
- Inline check code is shipped and tested; BotFather inline mode was enabled
  with the RU placeholder `Введите номер, ссылку или текст для проверки`.
- Added `ai_docs/ON_CALL_RUNBOOK.md` for sanitized monitor-alert triage,
  recovery commands and security boundaries.

## 2026-06-13 - Website Honest Impact Counters v1

- Added `.kiro/specs/website-honest-impact-counters-v1/`.
- Added aggregate-only homepage impact counters for checks, risk alerts,
  moderated records and user-reported loss totals.
- Extended `get_check_stats()` migration and the TanStack server function with
  backward-compatible count fallbacks.
- Added `src/lib/trust/impact-stats.ts` with normalization/formatting tests.
- Recorded the safety boundary: these counters do not expose raw reports,
  targets, descriptions or unsupported "money saved" claims.
- Railway deployment `0629556b-1fda-4c76-a703-e5db2983f66e` passed
  `prod:smoke` and `monitor:prod`; the homepage returned 200 with the impact
  counter section.

## 2026-06-13 - Website Public Scheme Trends v1

- Added `.kiro/specs/website-public-scheme-trends-v1/`.
- Added `/scam-trends`, a public non-personal trend map of common tactics:
  bank/SMS-code calls, APK, casino/free-spins, NFT/Stars, TON/wallet,
  Telegram account-takeover, delivery/payment links and dropper recruitment.
- Added homepage scheme-trends teaser and navigation/footer entry points.
- Added `src/lib/trust/scheme-trends.ts` with stats, category filters,
  severity ordering and tests.
- Recorded the safety boundary: trends describe tactics, not accused people,
  channels, numbers or raw reports.
- Railway deployment `16633468-c6b6-4466-9d97-ab5b7899ad0a` passed
  `prod:smoke` and `monitor:prod`; `/scam-trends` returned 200 with trend
  content.

## 2026-06-13 - Website Trust Surface v1

- Added `.kiro/specs/website-trust-surface-v1/`.
- Added `/official-numbers`, a searchable public directory backed only by
  `VERIFIED_CONTACTS`.
- Added homepage trust block and a verified-contact count in `StatsStrip`.
- Changed aggregate reputation wording from direct "confirmed scammers" to
  moderated risk records.
- Recorded the safety boundary: official contacts are callback destinations,
  not proof that an incoming caller ID is safe.
- Railway deployment `766306d6-ba44-4fb5-9ce2-5abe3eb16415` passed
  `prod:smoke` and `monitor:prod`; `/official-numbers` returned 200 with
  directory content.

## 2026-06-13 - Weekly Scam Digest v1

- Added `.kiro/specs/telegram-weekly-scam-digest-v1/`.
- Added deterministic Telegram `/digest` with compact RU/UZ/EN wording for
  casino/frispin/VIP forecast, NFT/Stars/gift, TON/wallet, bank/SMS-code and
  APK funnels.
- Added a digest entry to `/start` and `/menu`, plus callback routing and
  localized `setMyCommands` registration.
- The digest avoids raw reports, copied Telegram posts and unverifiable
  accusations; it offers check/report/emergency next actions.
- Added unit/QA coverage for digest length, content, keyboard callbacks, command
  menus and welcome-menu structure.
- Railway deployment `bd6ff05b-abde-44eb-8203-ffe4ede4e736` passed
  `prod:smoke`, `monitor:prod`, `prod:security-smoke` and
  `prod:family-smoke`; Telegram command scopes were registered successfully.

## 2026-06-13 - Live-call Copilot Polish v1

- Added `.kiro/specs/telegram-live-call-copilot-polish-v1/`.
- The active live-call emergency screen now focuses on ending the call first and
  no longer offers safe callback before the user confirms hangup.
- `livecall:hangup` now routes to a compact post-call next step with safe
  callback, trusted-person support, ready phrase and full checklist actions.
- Ready-phrase callbacks use a smaller keyboard focused on hangup confirmation
  and trusted help.
- Updated targeted webhook/emergency tests for the compressed live-call flow.
- Railway deployment `b6b29704-d119-4053-a3dc-d209cc5722ef` passed
  `prod:smoke`, `prod:security-smoke`, `prod:family-smoke` and `monitor:prod`.

## 2026-06-13 - Official-number Lookalike v1

- Added `.kiro/specs/official-number-lookalike-v1/`.
- Extended `PhoneIntelligencePassport` with optional verified-contact lookalike
  evidence for near-miss phone numbers and short codes.
- Telegram and web result cards now say when a number is similar to an official
  contact but not an exact match, and advise safe callback through the app,
  card, official site or verified directory.
- The feature does not change score/level/reasons and does not claim owner,
  hidden spam history, SCAM labels or fraud by itself.
- Railway production deploy passed `prod:smoke`, `prod:security-smoke`,
  `prod:family-smoke` and `monitor:prod`.
- Updated roadmap/open-tasks/file/function/architecture docs.

## 2026-06-12 - Telegram Voice STT v1

- Added `.kiro/specs/telegram-voice-stt-v1/`.
- Telegram `message.voice` now routes to a dedicated handler when no stronger
  text/caption/link evidence exists.
- Short voice files are downloaded only in memory, transcribed through the
  configured AI provider, redacted and passed into the existing rules-first
  `runCheck` pipeline.
- STT supports Gemini native audio for `generativelanguage.googleapis.com`
  providers and OpenAI-compatible `/audio/transcriptions` for other providers.
- If STT is unavailable, oversized or unreliable, the bot gives a localized
  fallback asking for one short typed summary and offers emergency actions.

## 2026-06-12 - Shared Rate Limits v1

- Added service-role-only `rate_limit_buckets` and `claim_rate_limit()` for
  cross-instance public check/report/Telegram throttling.
- Added `checkSharedRateLimit(scope, key, limit, windowMs)`, which HMAC-hashes
  raw keys before persistence and falls back to the existing in-memory limiter
  when Supabase or `HASH_PEPPER_SECRET` is unavailable locally.
- Wired `runCheck`, OCR/image analysis, report submission and public Telegram
  post fetch limits to the shared limiter.
- Extended retention cleanup and production security smoke coverage for the new
  table/RPC, and moved the roadmap task from pending to shipped.

## 2026-06-12 - Telegram Webhook Shared Dedup v1

- Added service-role-only `telegram_webhook_updates` table for short-lived
  Telegram `update_id` idempotency claims across production Node instances.
- Added `claimTelegramWebhookUpdate(updateId)` and wired the webhook to use
  local in-memory dedup as a fast path plus shared Postgres dedup as the source
  of truth.
- Chose fail-open behavior when the shared store is unavailable: the webhook
  keeps processing through local dedup rather than dropping user updates.
- Extended retention cleanup and production security smoke coverage for the new
  service-only table.

## 2026-06-12 - Scheduled Production Monitor

- Added `.github/workflows/prod-monitor.yml` to run public production checks every
  30 minutes and on manual dispatch.
- Updated `prod-monitor` so secret-backed Telegram checks are skipped as warnings
  when secrets are absent, while private schedulers can enforce them with
  `MONITOR_REQUIRE_SECRET_CHECKS=true`.
- Documented the GitHub secrets needed for full scheduled monitoring and alerts.
- Configured repository secrets for scheduled webhook, Telegram Bot API and AI
  provider checks; manual `Production Monitor` workflow run passed.

## 2026-06-12 - Production Monitor v1

- Added `scripts/prod-monitor.ts` plus `npm run monitor:prod` for recurring
  production checks: homepage, `/healthz`, Telegram webhook auth,
  `getWebhookInfo`, pending/recent Telegram errors and AI provider status.
- Added optional sanitized Telegram operator alerts via
  `MONITOR_ALERT_CHAT_ID`, using `TELEGRAM_BOT_TOKEN` by default or
  `MONITOR_ALERT_BOT_TOKEN` for a separate operations bot.
- Documented monitor variables and runbook in `DEPLOYMENT.md`, `.env.example`,
  `FILE_MAP.md`, `FUNCTIONS_MAP.md`, `ROADMAP.md` and `OPEN_TASKS.md`.

## 2026-06-12 - Retention cleanup and RLS hardening

- Added Retention Cleanup v1: `private.prune_app_retention()` defines explicit
  cleanup windows for `checks`, `reports`, `telegram_sessions`,
  `telegram_reputation_targets` and `telegram_family_shield`. It returns
  deletion counts and does not run automatically.
- Added `scripts/prod-security-smoke.ts` plus `npm run prod:security-smoke` to
  verify anon cannot read/write sensitive tables or execute maintenance/stat
  RPCs, while service-role can count required tables.
- Moved homepage stats behind `getPublicStats()` server function and hardened
  `get_check_stats()` to service-role-only `SECURITY INVOKER`.
- Moved the admin RLS helper to `private.has_role()` and revoked public
  execution of legacy `public.has_role()`.
- Applied both production migrations and verified Railway production with
  `prod:smoke`, `prod:family-smoke`, `prod:security-smoke` and Supabase
  Security Advisors (`No issues found`).
- Confirmed GitHub secret scanning and push protection are enabled, then enabled
  Dependabot security updates for dependency vulnerability PRs.

## 2026-06-12 - Audit action plan, Family Shield hardening and webhook dedup

- Updated `ROADMAP.md` with the post-audit checkpoint: shipped phone/Telegram
  trust work, Family Shield production verification, and the immediate order of
  Family Shield hardening -> webhook dedup -> retention/compliance -> security
  hygiene.
- Marked Family Shield v1.1 as shipped: active-link guard, invite TTL,
  trusted-contact opt-out, env-driven bot username and redacted trusted alerts.
- Added Telegram webhook `update_id` deduplication as an in-memory LRU for the
  current single-instance Railway deploy, with docs noting the shared-store
  requirement before multi-instance scaling.
- Kept official-number lookalike detection as the next visible trust feature.
- Documented Family Shield storage and webhook behavior in `DATABASE.md`,
  `API.md`, `FILE_MAP.md` and `FUNCTIONS_MAP.md`.

## 2026-06-12 - Family Shield production verification

- Applied the `telegram_family_shield` production migration through Supabase SQL
  Editor and verified service-role-only access.
- Added `scripts/prod-family-shield-smoke.ts` plus `npm run prod:family-smoke`
  for repeatable invite/accept/notify/revoke production checks with synthetic
  Telegram ids and no secret output.
- Updated Family Shield documentation to match the actual invite hash prefix
  used by the implementation.

## 2026-06-11 - Telegram Inline Check v1

- Added `.kiro/specs/telegram-inline-check-v1/`.
- Telegram webhook/router now handles `inline_query` updates without requiring a chat id.
- Added `answerInlineQuery` Bot API helper and `src/lib/telegram/handlers/inline.ts` for compact inline result articles.
- Inline checks call `runCheck(skipAi:true, persist:false)`, so typed previews do not call AI/OCR and do not insert partial queries into `checks`.
- Deployment docs now call out the BotFather `/setinline` operational step.

## 2026-06-11 - Roadmap and Phone Intelligence Passport v1

- Added `ai_docs/ROADMAP.md` as the canonical product implementation order.
- Added `src/lib/risk/phone-intelligence.ts` for honest phone metadata: country/calling code, Uzbekistan prefix/operator hint, format status and official-directory status.
- `runCheck` now returns `phoneIntelligence` for phone inputs; Telegram result cards use it for compact, useful phone explanations without inventing owner, hidden scam labels, account age, spam history or report volume.
- Kept moderated phone reputation as a separate next-stage task.

## 2026-06-11 - Telegram Response UX Compression v1

- Added `.kiro/specs/telegram-response-ux-compression-v1/`.
- Split panic scenario rendering into compact first cards and detailed full checklists.
- The first `/panic` scenario card now shows one urgent action, a calm cue and three immediate steps; verified contacts remain behind `panicctx:full` / safe-callback buttons.
- Lightened the default emergency follow-up keyboard by removing the repeated generic share-advice button while keeping the legacy callback supported.
- Compressed unreadable-image fallback and image triage copy into shorter hook/risk/safe-step answers.
- Image triage category callbacks now use a compact follow-up keyboard instead of repeating the full category menu under every answer.
- High-risk check result first cards now show urgent actions plus a short evidence summary; long generic explanation/reporting detail is not printed in the initial result card. Short visible-source briefs for forwarded Telegram posts remain visible.
- Unknown check result cards now hide weak topic-only observations such as `unknown_sender`, suspicious cards use "what I noticed" wording, and the result `why` button explains the latest check context when available.
- High-risk confidence follow-ups such as "Точно?" now answer with action-first safe steps, and unknown phone/Telegram-profile explanations no longer surface weak topic-only evidence such as valid phone format or unknown sender.

## 2026-06-11 - Emergency First-Card Human Guidance

- Added short human reassurance/explanation cues to the first `/panic` scenario cards for SMS-code, APK, transfer, card-data, lost-Telegram and live-call cases.
- Preserved the urgent action as the first content line so stressed users still see the safest next step immediately.
- Added regression tests for APK, card-data and live-call first-card wording.

## 2026-06-11 - Telegram Follow-up Memory v1 regression lock

- Added `.kiro/specs/telegram-followup-memory-v1/`.
- Added handler-level regression coverage proving short Telegram follow-ups such as "Точно?", "Что еще посоветуешь?" and "дай номер банка" bypass `runCheck` when no new artifact is present.
- This keeps post-check and orphan helper questions from rendering a fake "Недостаточно данных" risk card.

## 2026-06-11 - Telegram Public Post Evidence v2

- Added `.kiro/specs/telegram-public-post-evidence-v2/`.
- Public Telegram post checks now include visible link preview fields and inline-button labels/URLs in the rules-first evidence.
- This improves detection of visible casino/free-spins, betting/VIP, NFT/Stars, voting/captcha and reward mechanics hidden in Telegram previews/buttons.
- False-positive coverage keeps ordinary Telegram news/product previews and buttons non-accusatory.

## 2026-06-11 - Telegram Public Post Fetch v1

- Added `.kiro/specs/telegram-public-post-fetch-v1/`.
- Public Telegram post links now get a best-effort fetch of the public `t.me/s/<channel>/<post>` web page before the metadata-only fallback.
- The parser extracts only visible post text and visible outbound links, redacts sensitive digits, clamps evidence and sends it through the existing rules-first pipeline as text.
- The user-facing brief keeps the safety boundary: no hidden SCAM labels, account age, Telegram report counts or spam-history claims.

## 2026-06-10 - Telegram Public Post Link Boundary

- Public Telegram post links now preserve the post id from `t.me/username/123` and `t.me/s/username/123`.
- Metadata briefs now say clearly that Bot API can identify the public channel/account but does not read the specific post body from a bare link; users are asked to forward the post, paste the text, or send a screenshot.
- Added regression coverage so post-link handling stays non-accusatory and does not invent account age, hidden SCAM labels, report history or spam behavior.

## 2026-06-10 - Telegram Image Intelligence precision pass

- Improved Telegram screenshot explanations so casino/free-spins, NFT/Stars gifts, voting/contest gates, task rewards, wallet/DeFi actions and TON referral posts get scenario-specific copy instead of a generic image-analysis paragraph.
- Added deterministic coverage for Stars/NFT spin/lucky-draw/777 mechanics and public contest/voting domains tied to prizes.
- Split Telegram promo advice so casino/free-spins, betting predictions, giveaways and task/referral loops no longer share one generic recommendation.
- Preserved the false-positive boundary for ordinary Telegram news, product announcements and advertising posts.

## 2026-06-10 - Telegram Image Fallback Triage v1

- Added `.kiro/specs/telegram-image-fallback-triage-v1/`.
- Unreadable Telegram images now show quick scenario buttons for NFT/Stars gifts, casino/free-spins, TON/wallet, bank/code and menu/QR instead of ending at a generic OCR failure.
- `imgtriage:*` callbacks return scenario-specific safe steps without changing scoring or persisting checks.
- Safety boundary: the bot still does not guess unreadable image content or claim hidden Telegram SCAM labels, account age, report history or spam behavior.

## 2026-06-10 - Telegram Forward Scheme Brief v1

- Added `.kiro/specs/telegram-forward-scheme-brief-v1/`.
- Forwarded Telegram post replies now preserve a mini-brief with source, likely scheme, likely attacker goal, safe next step and Telegram visibility limit.
- Formatter truncation was adjusted only for forward-source briefs so scheme/goal/step lines survive mobile result-card formatting.
- The safety boundary remains unchanged: no hidden SCAM-label, account-age, Telegram report-history or spam-history claims.

## 2026-06-10 - Telegram Forward Source Context v1

- Added `.kiro/specs/telegram-forward-source-context-v1/`.
- Forwarded public Telegram channel/group posts now include a short source note in bot replies when Telegram exposes title/username.
- The source note is reply-only: it is not appended to `runCheck` input, does not affect score/level/reasons and is not persisted in `checks`.
- Hidden/private forward origins remain excluded, and the copy explicitly avoids hidden SCAM-label, account-age, report-history or spam-history claims.

## 2026-06-10 - Telegram Video Thumbnail Intelligence v1

- Added `.kiro/specs/telegram-video-thumbnail-intelligence-v1/`.
- Telegram videos with no caption/link/button evidence now use the Telegram-provided thumbnail as image evidence when available.
- Full video files are still not downloaded; thumbnail analysis reuses the existing in-memory image/QR/OCR path and size limits.
- Unsupported-video copy now explains that preview frames are checked automatically when Telegram provides them, otherwise the user should send a link, screenshot frame or short description.

## 2026-06-10 - Telegram Evidence Brief v1

- Added `.kiro/specs/telegram-evidence-brief-v1/`.
- Telegram username/link/private invite explanations now put the visible scenario first when risk reasons are present: betting/VIP, casino/free-spins, NFT/Stars giveaways, captcha/voting gates, task rewards, wallet urgency, TON referrals, account takeover and official-looking credential requests.
- The brief still keeps the no-false-authority boundary: no account age, hidden Telegram SCAM labels, Telegram report counts or spam history unless a real trusted source exists.
- Profile-only and not-found checks without scam context still use the honest limitation-first answer and ask for the actual message, preview or screenshot.

## 2026-06-10 - Telegram QR Decoder v1

- Added `.kiro/specs/telegram-qr-decoder-v1/`.
- Added a bounded pure-JS QR decoder for Telegram PNG/JPEG images; images stay in memory and oversized decoded dimensions fail closed.
- Decoded QR values now merge into structured image evidence, so QR URLs can be scored even when AI image analysis returns `null`.
- Added embedded-URL scoring for text/multiline check inputs, allowing decoded QR URLs inside image evidence to trigger existing URL reason codes.

## 2026-06-10 - Telegram Image Intelligence v3

- Added `.kiro/specs/telegram-image-intelligence-v3/` for forwarded Telegram promo screenshots and video frames.
- Image evidence now recognizes Telegram casino/free-spins funnels, NFT/Stars giveaway gates, task-reward campaigns, wallet/DeFi urgency, TON referral earning, and private invite hints, then feeds existing scam-research-feed-v2 reason codes.
- Added false-positive coverage so ordinary news/product Telegram screenshots do not become scam promo results just because they mention Telegram, TON, NFT, wallet or Web3.

## 2026-06-10 - Telegram Image Fallback Follow-Ups

- Unreadable Telegram photos/screenshots now persist a safe `image_unreadable` last-check snapshot, so short follow-ups like "Точно?" / "sure?" answer the image limitation instead of creating a generic insufficient-data risk card.
- Repeated standalone unreadable images now get a shorter second fallback, while album duplicates remain suppressed.
- Image evidence usability now rejects model text that only says the image was unreadable, preventing pseudo-analysis from blurry screenshots.

## 2026-06-10 - Scam Research Feed v2

- Added `.kiro/specs/scam-research-feed-v2/` for Telegram/Web3 promo funnels from user screenshots plus external scam research.
- Added deterministic reason codes for casino/free-spins bonus funnels, CAPTCHA/voting prize gates, task-reward engagement bait, wallet/DeFi urgency and TON/crypto referral earning schemes.
- Extended Telegram advice and public metadata labels so these posts get contextual next steps instead of generic "insufficient data" or unrelated OTP/card advice.
- Added regression tests and false-positive guards for ordinary sports/news posts, Telegram product announcements, wallet feature news and non-crypto battery/top-up wording.

## 2026-06-09 - Production Smoke Script

- Added `scripts/prod-smoke.ts` and `npm run prod:smoke` as a repeatable Railway/Telegram/AI verification command that does not print secrets or chat ids.
- Deployment docs now include the normal smoke command and optional `--live-telegram` mode for one synthetic high-risk Telegram update.

## 2026-06-09 - AI Provider Resilience v1

- Added bounded retry for transient OpenAI-compatible provider failures (`429`, `500`, `502`, `503`, `504`) in the shared AI chat-completion helper.
- Provider `429` responses that contain Gemini/GCP-style quota exhaustion (`RESOURCE_EXHAUSTED`, `quota exceeded`, `generate_content_free_tier_requests`) are now treated as non-retryable, so one user check does not burn multiple quota attempts.
- `OPENAI_FALLBACK_*` is now attempted immediately after a failed primary AI provider call, including primary quota exhaustion, instead of only when the primary circuit breaker was already open.
- Non-retryable provider errors such as `401` still degrade immediately to rules-only results.
- Local AI request aborts/timeouts are not retried, preventing a hung provider from multiplying Telegram webhook latency.
- Circuit-breaker accounting now treats exhausted retries as one logical AI failure, while a successful retry resets the failure counter.

## 2026-06-09 - Telegram Link/Account QA Polish

- Telegram username and invite-link result cards now use shorter "what I can see / what I cannot see / safe next step" copy.
- Telegram profile-only checks now get a dedicated context prompt asking for the suspicious message or screenshot instead of a generic "send link/number/full text" fallback.
- High-risk Telegram invite/support-name results now show the Telegram limitation brief before reason labels, so useful context is not truncated behind generic reasons.
- Test mocks for Telegram handler property tests were updated to cover metadata enrichment without accidental Supabase or Bot API noise.
- Unsupported video/audio replies now include a media-specific "What to send?" button with concrete capture instructions instead of a generic how-it-works action.

## 2026-06-09 - Emergency Copilot Guided UX

- Live-call panic mode now starts with a guided "say this, hang up, then tap the button" flow instead of a plain warning.
- Emergency follow-up buttons were made more action-oriented: "Позвонить безопасно" and "Готовая фраза".
- Bank callback, trusted-person and post-call follow-ups now use step-by-step language for stressed or elderly users, while preserving the no-SMS-code/no-card-data safety boundary.

## 2026-06-09 - Telegram Orphan Follow-Up UX

- Short follow-up phrases without a stored last-check context, such as "Точно?", "что дальше?" and "дай номер банка", now receive helper guidance instead of a generic "insufficient data" risk card.
- Unsupported video/audio guidance now asks for the useful evidence: caption link, screenshot frame, visible QR/username/payment details, or the promise/request from the video.
- Private Telegram invite copy now explicitly says the bot can judge only the invite link and user-provided context, then asks for Telegram preview/channel/post screenshots before stronger conclusions.

## 2026-06-09 - Telegram Reputation Targets v1

- Added `telegram_reputation_targets` as a privacy-safe DB layer for Telegram targets.
- Telegram target observations and report candidates use HMAC-hashed identifiers and masked display hints only.
- Unverified user reports stay hidden from user-facing reputation; confirmed moderator decisions can add source/confidence labels.
- Updated Telegram Link & Account Intelligence v2 tasks 11-13 from future work to implemented.

## 2026-06-09 - Telegram Account Limits Help

- Extended `.kiro/specs/meta-intent-router/` from six to seven intents with `telegram_account_limits`.
- Added a user-facing RU/UZ/EN explanation of what Telegram account data the bot can and cannot see.
- Marked Telegram Link & Account Intelligence v2 task 14 complete.
- Covered scam-label/account-age/report-history questions so they no longer fall into generic "insufficient data" replies.

## 2026-06-09 - Report Flow Reputation Boundary v1

- Added `.kiro/specs/report-flow-reputation-boundary-v1/`.
- Added an incident-only report boundary for Telegram `/report` flows with no concrete target.
- Situation-only reports are stored for moderation/research but do not upsert or increment public `entities`.
- Admin moderation now skips entity sync for the incident-only marker, preserving audit logging.

## 2026-06-09 - Telegram Link & Account Intelligence v2

- Added `.kiro/specs/telegram-link-account-intelligence-v2/`.
- Extended Telegram username/link enrichment with compact visible risk signals and next steps.
- Clarified public/private/internal Telegram link handling and the no-false-authority boundary: no account age, hidden scam labels, Telegram report counts or spam history unless a real source is added later.
- Added regression coverage for private invite betting/prediction links and rendered not-found username limitations.

## 2026-06-07 - Telegram Public Metadata v1

- Added `.kiro/specs/telegram-public-metadata-v1/`.
- Added Bot API `getChatInfo` and Telegram-channel enrichment for public `@username` / `t.me/...` checks.
- Private invite/internal Telegram links now get an explicit limitation brief instead of a generic answer.
- Added `telegram_profile` last-check context so short follow-ups stay contextual.
- Suspicious Telegram results can render a short `brief` block when an explanation is available.

## 2026-06-07 - Telegram Media & Link Intelligence v1

- Added `.kiro/specs/telegram-media-link-intelligence-v1/`.
- Fixed Telegram routing so video/audio/voice/non-image document captions are analyzed before unsupported-media fallback.
- Added private invite normalization for `t.me/+...` links.
- Added `gambling_prediction_promo` for closed betting/prediction invite channels with false-positive guards for ordinary sports/news/restaurant QR contexts.
- Added context-specific advice for betting/prediction invite links and a more useful unsupported-media fallback.

## 2026-06-06 - Scam Research Feed v1

- Added `.kiro/specs/scam-research-feed-v1/`.
- Added deterministic rules for Telegram account deletion/"Cancel" phishing and card/SIM/account dropper recruitment.
- Added context-specific Telegram advice so these cases do not fall back to unrelated generic guidance.
- Updated scam coverage and open-task docs with source-backed research-feed handling.

## 2026-06-06 - Result Message UX live hardening

- Tightened Telegram result messages after live feedback: unknown crypto/investment, restaurant QR/menu, delivery SMS and phone checks now render shorter contextual briefs.
- Fixed scam-pattern matching so weak context codes such as `unknown_sender` no longer invent a specific scheme like "Fake bank in Telegram".
- Safe phone results now explain that a number alone does not prove risk and ask for the caller's request if they asked for a code, money or app.

## 2026-06-06 - Emergency follow-up hardening

- Broadened Telegram Emergency Copilot follow-up routing for live-user phrases like "what should I do next?", "bank hotline", "I'm nervous", and "what should I tell a close person?".
- Added a one-tap `panicctx:more` button so users can continue from an emergency answer without typing.
- Added regression tests for exact post-panic follow-up phrases that previously felt like dead ends.

# 2026-06-11 - Phone Reputation v1

- Added `.kiro/specs/phone-reputation-v1/`.
- Added a confirmed-only phone reputation summary built from moderated `entities` rows.
- Telegram result cards now show Ishonch Guard moderated report count and confidence for confirmed phone numbers, while explicitly avoiding owner/carrier/hidden-label claims.
- Updated roadmap, database, architecture, file/function maps and decisions.

## 2026-06-19 - Moderation duplicate report alerts

- Fixed `/report` duplicate handling: same-day reports for an already-seen target still avoid creating a duplicate DB row, but now send a safe "повторная жалоба" alert to the moderation chat.
- Moderation duplicate alerts keep the target masked and explicitly tell operators that the full review belongs in the admin panel.
- Added regression tests for duplicate report notification and duplicate alert formatting.

## 2026-06-06 - Telegram Image Intelligence v2

- Added `.kiro/specs/telegram-image-intelligence-v2/`.
- Added structured image evidence for Telegram photos/screenshots: visual category, QR purpose, risk hints, redacted OCR text and short explanation.
- Benign delivery SMS and restaurant/menu QR screenshots no longer become high-risk from negative safety wording; dangerous QR login/payment still scores through reason codes.
- Updated architecture, API, database, file/function maps and decisions.

## 2026-06-05 - Emergency Copilot v2

- Added a new Telegram emergency copilot layer for post-`/panic` follow-up questions.
- Panic context now stores only `lastPanicId` and `lastPanicAt` in `telegram_sessions.scenario_data`.
- Short follow-ups like "what next?", "bank number" and "what should I say?" get contextual replies; suspicious payloads still route to the risk pipeline.
- Added the `.kiro/specs/telegram-emergency-copilot-v2/` spec and updated file/function/API/database decision docs.

## 2026-06-02 - Live QA hardening

- Fixed Telegram inline callback acknowledgement: router now forwards
  `callback_query.id`; report skip callbacks also clear the Telegram spinner.
- Added integration coverage for `/start`, quick buttons, panic callback and
  report skip callback.
- Fixed Telegram short description script to respect Telegram's 120-character
  `setMyShortDescription` limit.
- Fixed mobile accessibility floating-button overlap on check/home forms.
- Railway `/healthz` currently responds; remaining deploy work is operational
  verification of secrets, migrations and live bot flow.

## 2026-06-02 - Sensitive DB write lockdown

- Revoked direct public inserts into `checks` and `reports`; writes now go
  through server functions/service-role after validation, redaction and hashing.
- Updated `DATABASE.md`, `API.md` and `DECISIONS.md` to reflect the security
  boundary.

## 2026-06-01 — Production deploy + pre-deploy hardening

- **Deployed to Railway** (https://scam-guard-main-production.up.railway.app). Telegram webhook registered, bot live at @scamguard_bot.
- PR #17: pre-deploy hardening — fixed .gitignore NUL bytes, removed duplicate consolidated migration, switched Dockerfile to Bun, enabled short-code verified lookup in pipeline, added verified contact UI to web RiskResultCard, fixed check logging order (finalLevel), updated README/OPEN_TASKS.
- PR #16: `/panic` interactive emergency mode — inline buttons for 6 scenarios instead of one big text wall.
- PR #15: dynamic `/emergency` checklist pulling real numbers from verified-contacts module.
- PR #14: integrated verified contacts into risk engine + Telegram formatter (badge + spoofing warning, dangerous override).
- PR #13: expanded verified contacts seed to 27 entries (banks, telecoms, payment systems, government, UZCERT).
- PR #12: initial verified contacts module.
- PR #11: public README + CONTRIBUTING.md.
- PR #10: CI workflow, /healthz endpoint, Dockerfile VITE\_\* ARGs, .gitignore fix.
- Supabase migrations applied (8 migrations; consolidated duplicate removed).
- 215+ tests, CI green, production build verified.

## 2026-06-02 - Payment input detector

- Added a conservative `payment` input detector for payment-flow text.
- Updated `OPEN_TASKS.md` and `SCAM_COVERAGE.md` so payment detection is no longer listed as missing.
- Recorded the detector boundaries: pure URLs/APKs/Telegram links keep their primary type.

## 2026-06-02 - Lovable build wrapper removed

- Updated architecture/deployment/tooling docs for direct Vite/TanStack/Nitro configuration.
- Recorded that the Lovable-authored design remains, but Lovable-specific build tooling is no longer part of the production path.
- Removed the stale `lovable-error-reporting.ts` file map reference.

## 2026-06-02 - Research-feed scam coverage rules

- Documented `known_reported`, `fake_delivery_payment`, `fake_boss_request`, `malicious_file_bait`, and stronger `payment_before_service` coverage.
- Updated `SCAM_COVERAGE.md` and `OPEN_TASKS.md` so completed research-feed patterns no longer appear as planned work.
- Recorded the removal of the old high-risk entity APK proxy in favor of `known_reported`.

## 2026-06-01 - Production-readiness sync

- Updated AI memory to reflect the actual runtime: self-hosted Node/Nitro `node-server`, Docker/Railway-ready, no Lovable Cloud production dependency.
- Updated AI integration docs from Lovable/Gemini to provider-neutral OpenAI-compatible Chat Completions (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`).
- Marked Telegram bot MVP as implemented and documented the webhook/session architecture.
- Added `pressauz` as a local research feed for new Uzbekistan scam patterns.
- Recorded privacy hardening: report descriptions and OCR model output must be deterministically redacted before persistence/use.

## 2026-05-30 - Initial AI memory created

- Analyzed the real codebase and supplied zip.
- Created `AI_INDEX.md`, `AGENTS.md`, and `ai_docs/`.
- Mapped TanStack Start + React 19 + Supabase stack, server-function RPC layer, rules-first risk engine, DB schema/RLS, auth/role model and deployment notes.
- Documented competitor/market research and current Uzbekistan scam landscape.
