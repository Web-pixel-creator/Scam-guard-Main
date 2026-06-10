# Changelog (AI memory)

Newest first. This tracks documentation/memory files, not every code commit.

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
