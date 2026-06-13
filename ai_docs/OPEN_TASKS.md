# Open Tasks

## Fragile / risky spots

- **Family Shield v1.1 hardening is shipped.** Active-link invite errors, stale invite expiry, trusted-contact opt-out, env-driven invite URLs, guardian-language notification and redacted trusted alerts are now covered by tests.
- **Telegram webhook `update_id` dedup is shared now.** The webhook uses an
  in-memory fast path plus service-role claims in `telegram_webhook_updates`, so
  Telegram retries are deduped across Node instances. If Supabase is temporarily
  unavailable, it fails open to local dedup so user messages are not dropped.
- **Retention cleanup is explicit, not scheduled.** `private.prune_app_retention()` defines the current windows and returns deletion counts, but no cron runs it yet.
- **Shared rate limit is shipped.** Public checks, reports, Telegram check/OCR/image
  paths and public Telegram post fetches use Supabase `rate_limit_buckets` with
  HMAC-hashed keys across Node instances. Local/test fallback remains
  in-memory; watch Postgres bucket write volume before deciding on Redis/KV.
- **AI provider is optional.** Without `OPENAI_API_KEY`, scoring still works but natural-language explanations, screenshot OCR/image understanding and voice STT return `null`.
- **Telegram account metadata enrichment is intentionally shallow:** public `getChat` metadata can be shown when available, and Telegram evidence briefs now put visible scam scenarios before generic API limits when local reason codes exist, but Telegram Bot API does not give reliable account age, hidden scam labels, Telegram report counts or spam history to this bot.
- **Telegram reputation is moderated and app-owned:** `telegram_reputation_targets` can show Ishonch Guard confirmed report counts, but unverified user reports stay hidden from user-facing labels.
- **`payment` input_type is heuristic.** It detects payment-flow text, but still needs real-world tuning from moderated reports.
- **Large homepage route:** `src/routes/index.tsx` should eventually be split into smaller section components.

## Near-term product tasks

- [x] ~~Harden Family Shield v1.1 before new large Telegram features.~~ Done: active-link guard, invite TTL, trusted-contact opt-out, env-driven bot username and redacted guardian alerts.
- [x] ~~Add Telegram webhook `update_id` deduplication to prevent duplicate processing on retries.~~ Done first as an in-memory LRU, then upgraded to shared Postgres `telegram_webhook_updates` claims for multi-instance safety.
- [x] ~~Enable GitHub secret scanning, push protection and Dependabot security updates.~~ Done on 2026-06-12; GitHub advanced non-provider/validity checks remain unavailable/disabled in current repo settings.
- [x] ~~Add production monitor script for app/webhook/Telegram/AI failures.~~ Done as `npm run monitor:prod` with optional sanitized Telegram alerts.
- [x] ~~Attach the production monitor to a real scheduler for public checks.~~ Done as `.github/workflows/prod-monitor.yml` every 30 minutes.
- [x] ~~Add production GitHub secrets for deeper scheduled monitor checks.~~ Done for `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `OPENAI_BASE_URL` and `OPENAI_MODEL`; manual GitHub Actions monitor run passed with webhook/Telegram/AI checks.
- [ ] Add `MONITOR_ALERT_CHAT_ID` (and optional `MONITOR_ALERT_BOT_TOKEN`) for sanitized Telegram operator alerts.
- [x] ~~Add official-number lookalike detection after Family Shield/webhook hardening.~~ Done: near-miss phone/short-code checks compare against verified contacts and render "similar but not exact" guidance without changing scoring.
- [x] ~~Polish live-call copilot after official-number lookalikes.~~ Done:
      active-call buttons now focus on hangup first, safe callback appears after
      hangup, and live-call follow-ups use compact context-specific keyboards.
- [x] ~~Add Weekly Scam Digest v1 as the next visible Telegram wow feature.~~
      Done: `/digest`, main-menu button, command-menu registration and compact
      RU/UZ/EN deterministic digest with check/report/emergency actions.
- [x] ~~Add Website Trust Surface v1 for official callback numbers.~~ Done:
      `/official-numbers`, homepage verified-contact count, trust block and
      non-accusatory moderated-risk wording.
- [x] ~~Add public scheme map/trends for Uzbekistan using only aggregated,
      non-personal data and moderated/research-feed categories.~~ Done:
      `/scam-trends`, homepage teaser, safe source labels, deterministic
      reason-code coverage and no raw reports/targets.
- [ ] Add honest impact counters: checks, dangerous results and prevented-loss
      survey totals without exposing private reports or unsupported savings
      claims.
- [ ] Add a scheduled maintenance path for `private.prune_app_retention()` after legal/compliance review confirms the windows.

- [x] ~~Add official verified contacts seed (banks, operators, Central Bank).~~ Done in PR #12–#14.
- [x] ~~Add panic/live-call helper.~~ Done in PR #15–#16 (/panic interactive mode).
- [ ] Add screenshot report upload path only after retention policy is defined.
- [x] ~~Improve Telegram/account enrichment with public Bot API metadata where available; do not invent account age, report counts or spam history when Telegram returns `chat not found`.~~ Done in Telegram Public Metadata v1 and Telegram Link & Account Intelligence v2 no-DB phase, including a Telegram-account "what I can/cannot check" help screen.
- [x] ~~Keep short Telegram follow-ups from becoming fake "not enough data" checks.~~ Done in Telegram Follow-up Memory v1 regression lock: post-check and orphan phrases such as "Точно?", "Что еще посоветуешь?" and "дай номер банка" bypass `runCheck` when no new artifact is present.
- [x] ~~Keep description-only Telegram reports out of public reputation.~~ Done in Report Flow Reputation Boundary v1.
- [x] ~~Add moderated Telegram reputation directory before showing community report labels, first-seen dates or confidence labels on Telegram targets.~~ Done for Telegram targets with hashed identifiers, source/confidence labels and moderation gate.
- [x] ~~Add honest phone intelligence before reputation claims.~~ Done in Phone Intelligence Passport v1: country/calling-code, Uzbekistan prefix/operator hints and official-directory status without owner/scam-label inference.
- [x] ~~Add moderated phone reputation directory before showing community report labels, first-seen dates or confidence labels on numbers.~~ Minimal v1 shipped using confirmed `entities` rows only: Telegram shows Ishonch Guard moderated report count + confidence, while owner/carrier/hidden-label claims stay forbidden.
- [x] ~~Add Telegram inline check for `@scamguard_bot <number/link/text>`.~~ Code shipped as rules-only, non-persistent previews; BotFather `/setinline` still must be enabled operationally.
- [x] ~~Add Telegram voice-note STT for elderly/stressed users.~~ Short voice notes are transcribed in memory, redacted and checked by the same rules pipeline; failure falls back to a typed-summary prompt with emergency actions.
- [ ] Add phone reputation appeal/removal flow and moderation guidelines before broader public launch.
- [x] ~~Automated production operational verification on Railway.~~ Passed on 2026-06-12: `npm run prod:smoke`, `npm run prod:family-smoke` and `npm run prod:security-smoke`.
- [ ] Confirm billing/AI quota and real Telegram `/start` UX manually. Current Gemini `gemini-3.5-flash` production probe can return provider quota `429`; the app degrades to rules-only scoring, but reliable AI explanations/OCR need billing/credits or an `OPENAI_FALLBACK_*` provider.

## Research feed

Use `https://t.me/pressauz` as a research feed for Uzbekistan scam patterns. Do not copy posts verbatim into the app. Summarize recurring tactics into:

1. a `SCAM_COVERAGE.md` category,
2. a reason-code proposal or education-only note,
3. RU/UZ/EN wording,
4. tests before enabling a scoring rule.

Recent useful feed themes: suspicious foreign calls asking for SMS/card data, malicious Telegram files/GIFs, fake boss/official requests, APK "security app" theft, fake service/payment intermediaries.

Weekly Digest v1 currently summarizes recurring themes manually and safely. Do
not automate feed ingestion until moderation, retention and source attribution
rules are reviewed.

Completed research-feed themes now covered by deterministic rules:

- Telegram account deletion / "Cancel" phishing -> `telegram_account_takeover_phishing`.
- Card/SIM/account transfer or dropper recruitment -> `dropper_recruitment`.
- Closed betting/prediction invite channel -> `gambling_prediction_promo`.
- Telegram/Web3 promo funnels -> `crypto_casino_bonus_funnel`, `fake_captcha_or_voting`, `task_reward_engagement_bait`, `wallet_action_urgency`, `ton_referral_earning_scheme`.

## Later / scaling

- [ ] Native mobile app (Android first for SMS/call protection).
- [ ] B2B API with API-key auth.
- [x] ~~Shared cache/rate-limit layer for API/check/report rate limits.~~ Done as Shared Rate Limits v1 with service-role-only Supabase buckets and local fallback.
- [ ] Privacy-safe analytics on scam trends.

## Compliance / legal

- [ ] Review UZ personal-data law for `redacted_value`, `description`, `amount_lost_uzs`, `city`.
- [x] ~~Define retention windows for `checks`, `reports`, Telegram sessions and future screenshots.~~ Implemented as explicit `private.prune_app_retention()` cleanup windows; scheduling remains a separate decision.
- [ ] Moderation guidelines + admin audit log.
