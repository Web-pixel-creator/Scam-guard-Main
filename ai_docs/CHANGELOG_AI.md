# Changelog (AI memory)

Newest first. This tracks documentation/memory files, not every code commit.

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
