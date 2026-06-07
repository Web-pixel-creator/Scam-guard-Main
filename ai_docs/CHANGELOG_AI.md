# Changelog (AI memory)

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

Newest first. This tracks documentation/memory files, not every code commit.

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
