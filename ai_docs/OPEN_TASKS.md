# Open Tasks

## Fragile / risky spots

- **Family Shield v1.1 hardening is shipped.** Active-link invite errors, stale
  invite expiry, trusted-contact opt-out, env-driven invite URLs,
  guardian-language notification, redacted trusted alerts and explicit
  invite-handoff copy are now covered by tests.
- **Telegram webhook `update_id` dedup is shared now.** The webhook uses an
  in-memory fast path plus service-role claims in `telegram_webhook_updates`, so
  Telegram retries are deduped across Node instances. If shared dedup storage is
  temporarily unavailable before dispatch, the webhook returns 503 so Telegram
  retries instead of risking duplicate side effects.
- **Retention cleanup is scheduled.** Supabase/Postgres Cron job `ishonch_prune_app_retention_daily` runs `private.prune_app_retention()` daily at 20:17 UTC and deletes only rows eligible under the documented windows.
- **Shared rate limit is shipped.** Public checks, reports, Telegram check/OCR/image
  paths and public Telegram post fetches use Supabase `rate_limit_buckets` with
  HMAC-hashed keys across Node instances. Local/test fallback remains
  in-memory; watch Postgres bucket write volume before deciding on Redis/KV.
- **AI provider is optional.** Without `OPENAI_API_KEY`, scoring still works but natural-language explanations, screenshot OCR/image understanding and voice STT return `null`. Voice-out/TTS is separately opt-in through `GEMINI_TTS_API_KEY` or `OPENAI_TTS_API_KEY`; without either, the bot sends a short text fallback instead of audio.
- **Telegram account metadata enrichment is intentionally shallow:** public `getChat` metadata can be shown when available, and Telegram evidence briefs now put visible scam scenarios before generic API limits when local reason codes exist, but Telegram Bot API does not give reliable account age, hidden scam labels, Telegram report counts or spam history to this bot.
- **Telegram reputation is moderated and app-owned:** `telegram_reputation_targets` can show Ishonch Guard confirmed report counts, but unverified user reports stay hidden from user-facing labels.
- **Pig-butchering / romance grooming still needs session memory.** The current
  deterministic rules can catch a single-message trust-to-investment pivot, but
  slow schemes need a cumulative chat-session risk profile: repeated
  trust-building plus a later crypto/investment/transfer ask should lower the
  alert threshold without flagging ordinary friendly messages.
- **SOS ready phrases are scenario-specific for current panic IDs.** Existing
  bank/card/APK/Telegram/live-call/romance/blackmail/minor flows no longer
  reuse one bank callback script. Already-happened financial cases (SMS-code,
  transfer and card data) now use their own escalation phrases instead of the
  generic incoming-call script. AI voice-clone and modern non-bank pressure
  scenarios are now their own SOS flows with scenario-specific first cards,
  ready phrases, trusted-person copy and help directories.
- **Main-site CSP no longer allows untrusted inline scripts or broad inline
  styles.** `script-src` is restricted to a request-scoped nonce, `'self'` and
  the pinned Unicorn Studio CDN script; `script-src-attr 'none'` and
  `object-src 'none'` are enforced. Inline styling is now narrowed to
  `style-src-attr 'unsafe-inline'` for React style attributes; broad
  `style-src 'unsafe-inline'` is not allowed.
- **Embed widget CSP is origin-allowlisted.** `/embed/check` keeps
  `frame-ancestors` to `'self'`, localhost development origins and explicit
  HTTPS origins from `EMBED_ALLOWED_FRAME_ANCESTORS`; the `partner` query label
  does not grant framing access. Add origin analytics before broad public
  distribution.
- **Direct `/call` is shipped.** It reuses the live-call copilot without
  exposing bank callback before hangup; command-menu registration must be kept
  in the release checklist whenever command payloads change.
- **Emergency callback context binding is shipped.** New panic follow-up and
  Voice-out callback payloads carry the originating scenario id, while legacy
  callbacks still fall back through `lastPanicId`. This prevents old keyboards
  from answering with the wrong emergency scenario after the user opens another
  panic flow.
- **Emergency keyboards are now profiled by scenario.** Financial/APK/live-call
  cases keep safe bank callback actions, while Telegram takeover, blackmail,
  romance, minor-safety, AI voice-clone, fake job, delivery, crypto and grant
  cases show context-specific buttons such as trusted-person help, help
  directory, voice verification, wallet safety or official-channel checks.
- **Telegram recovery copy no longer recommends arbitrary recovery usernames.**
  Telegram takeover guidance now points users to official Telegram app
  settings/support wording instead of direct third-party recovery contacts.
- **Telegram bot response QA is reproducible now.** `npm run
qa:telegram-report` regenerates `ai_docs/TELEGRAM_BOT_QA_REPORT.md` from the
  current TypeScript formatters, covering main menus, result cards, media
  fallbacks, image triage, asked-context hints, `/panic`, `/call`, Guardian
  Angel, Family Shield and report flow. `npm run qa:telegram-visual` renders
  that report as a Telegram-like HTML review board under `output/playwright/`;
  use Playwright screenshots to inspect mobile/desktop readability when copy or
  keyboards change. `npm run qa:qr-decode -- <image>` checks whether a real
  screenshot's QR payload is pixel-decoded before Telegram copy review. Run
  these QA commands whenever bot copy/buttons or image/QR handling change.
- **`payment` input_type is heuristic.** It detects payment-flow text, but still needs real-world tuning from moderated reports.
- **Large homepage route:** `src/routes/index.tsx` should eventually be split into smaller section components.

## Near-term product tasks

- [x] ~~Emergency keyboard profile pass. Audit every `/panic`, `/call` and
      Guardian Angel keyboard so each scenario shows the right next actions:
      bank callback for financial cases, help/evidence/trusted-person actions
      for blackmail/minor/threats, romance-specific pauses, and AI voice-clone
      verification actions.~~ Done: `/panic` follow-up keyboards now use
      scenario-specific contact/help labels and trusted-person ordering where
      it matters, while Guardian Angel suppresses bank-callback buttons for
      crypto/QR/Telegram contexts.
- [x] ~~Emergency copy trust polish. Reduce repeated "I am nearby" wording,
      make follow-up copy more adult/neutral, and update reputation wording so
      "0 confirmed complaints" is clearly "not found in Ishonch Guard yet",
      never a safety guarantee.~~ Done: SOS/Guardian copy now avoids repeated
      reassurance boilerplate, and Telegram/phone passport cards say confirmed
      Ishonch Guard complaints were not found instead of implying safety from a
      zero count.
- [x] ~~**Voice-in v2.** Add transcript preview, "edit recognized text" recovery,
      confidence-aware fallback, RU/UZ mixed-speech fixtures and direct routing
      from obvious panic/live-call transcripts to the matching emergency flow.
      First slices are shipped: slow STT now shows a quick Telegram activity
      indicator, exhausted STT budget has its own cost/spam-guard copy, clear
      "I already sent code / installed APK / transferred money / entered card /
      lost Telegram / on a call" transcripts route to `/panic`, and transcript
      previews include an "edit recognized text" recovery path that rechecks
      corrected text without another STT call.~~ Done: low-signal transcripts
      now ask for correction instead of producing a risk card, and RU/UZ
      mixed-speech fixtures cover code, money and live-call routing.
- [x] ~~**QR clarity pass.** Make every photo/QR response explicit about
      whether a QR was actually decoded, what kind of destination was found,
      and why a menu/loyalty QR differs from Telegram login, payment or
      device-link QR.~~ Done: image replies now separate pixel-decoded QR
      payloads, visible URLs near QR codes and unreadable QR codes, while
      keeping Telegram login tokens/2FA secrets hidden.
- [x] ~~Voice-out contextual follow-up hardening.~~ Done: voice buttons under
      "what next", "ready phrase", contacts and full-plan emergency follow-ups
      now encode the originating action, show an `upload_voice` Telegram action
      while synthesis runs, de-duplicate repeated taps for the same text, and
      answer repeated voice-button clicks with a short "already preparing/sent"
      callback hint instead of burning another TTS request.
- [ ] **Voice-out pre-record architecture pass.** QA feedback shows the
      "🔊 Озвучить главный шаг" button still appears in too many SOS contexts
      and provider-backed TTS failures can break trust. Keep the cost guards,
      but move common panic/lang scripts to static pre-recorded `.ogg` assets,
      keep live TTS only for rare dynamic guidance, and hide or soften the
      button when audio is not reliably available. Architecture and first asset
      slice shipped: main SOS voice callbacks now look for static
      `panic-{id}-{lang}` audio before TTS/budget, follow-up screens no longer
      repeat the voice button, and RU/UZ/EN Gemini WAV assets are generated for
      all 15 SOS scenarios. Remaining: human audio review, optional `.ogg`
      compression if a converter is available, and a decision on whether
      Guardian Angel should also get static audio.
- [ ] **Voice-in/STT UX hardening.** Keep the daily TTS/STT cost guards, but
      improve transcript confirmation/edit recovery, confidence-aware fallback
      and user-facing wording when daily voice hints are exhausted. Waiting
      state, STT-budget wording, direct voice-to-SOS routing and transcript
      correction, low-signal fallback and first RU/UZ mixed-speech fixtures are
      shipped. Remaining: broaden the real-audio regression corpus and tune
      confidence heuristics from production examples.
- [x] ~~**Latency pass.** Use sanitized `telegram_timing` logs to identify 5-10
      second paths, then cache or skip AI on low-signal checks where
      deterministic output is enough.~~ Done: Telegram text checks show a
      delayed visible checking status for noticeable work, repeated normalized
      text checks use a short per-user cache/in-flight de-duplication, public
      Telegram metadata has a soft timeout/cache, low-signal passports skip AI,
      pixel-decoded login/payment/wallet QR payloads bypass slower visual AI,
      URL reputation has cache/in-flight de-duplication, and voice STT /
      Voice-out paths keep cache, duplicate and budget guards. Continue tuning
      STT/image-analysis thresholds from production `telegram_timing` logs as
      operational follow-up.
- [x] ~~**Conversation check implementation.** ROAD-004 design is now captured in
      `.kiro/specs/telegram-conversation-check-v1`: grouped checks must be an
      explicit mode, drafts must expire, and session state may store only
      derived stage/action/reason metadata.~~ Done: `/conversation` starts an
      explicit short conversation collector, stores only safe stage/action/
      reason metadata, renders a compact RU/UZ/EN conversation result and keeps
      ordinary URL/phone/username checks outside the mode on the normal
      pipeline.
- [x] ~~**Explain like grandmother.** Add a discoverable simple-words
      explanation path after check results, so elder/family users can get the
      verdict translated into calm practical language without changing the
      score.~~ Done: result keyboards include a simple-words callback; RU/UZ/EN
      free-text phrases reuse the latest check, avoid score/threshold wording,
      hide weak topic-only unknown evidence and do not insert a new `checks`
      row.
- [x] ~~**Family codeword / voice-clone prevention.** Keep it privacy-first:
      prefer a teaching/reminder flow for families to define their own codeword
      offline unless a design explicitly avoids storing the actual codeword in
      plaintext or recoverable form.~~ Done: Family Shield now has a
      codeword-guide callback and RU/UZ/EN copy that tells families to agree on
      the secret offline, not send it to the bot; trusted-contact alerts mention
      saved-number callback plus codeword/private-question verification.
- [x] ~~**Scam-call trainer and mini-quiz.** ROAD-007 / T-039 is the next P5
      queue item. Start with safe educational scenarios and defensive feedback;
      avoid precise attacker bypass scripts or operational scam playbooks.~~
      Done: `/trainer` and the main-menu Trainer button now run a five-situation
      defensive mini-quiz. Score is encoded in callback data, no user answers or
      `checks` rows are stored, and tests guard against attacker-ready scripts.
- [x] ~~**Privacy-safe scam map/index.** ROAD-008 / T-040 is the next P5 queue
      item. Keep it aggregated, non-personal and moderation/research-source
      driven; do not expose raw reports, screenshots, OCR, full phone numbers,
      URLs or accusations against unverified people.~~ Done: `/scam-trends` now
      includes a national privacy-safe map/index, category buckets and a locked
      regional layer. Region publication requires 5 moderated records, 3 scheme
      types and 2 source types, and tests guard against private evidence fields.
- [x] ~~**Weekly Scam Digest data model.** ROAD-009 / T-041 is the next queue
      item. Move the current deterministic digest toward records with `source`,
      `status`, `updated_at`, manual publish and safe stale fallback before any
      automation from research feeds.~~ Done: `/digest` now renders from manual
      `WEEKLY_SCAM_DIGEST_ENTRIES` records with source/status/update metadata,
      filters drafts, refuses partial/stale weekly sets and falls back to
      evergreen safety guidance instead of stale "current" trends.
- [x] ~~**Private moderation chat for reports/appeals.** ROAD-010 / T-042 is the
      next queue item. Add/finish an operator-only Telegram notification path
      for new reports, appeals and high-signal research items. Notifications
      must contain redacted summaries and admin links only, not raw report
      text, screenshots, OCR, codes, card data, full phone numbers or URLs.
      First slice shipped: new reports and reputation appeals now send optional
      `TELEGRAM_MODERATION_CHAT_ID` alerts with redacted targets and an admin
      link. A dedicated `npm run moderation:smoke` verifies the private chat
      without user evidence. Remaining: high-signal research item notifications
      and operator workflow wording.~~ Done: high-signal research alerts now
      use only public scheme-trend metadata, send category/severity/source and
      reason-code ids to the private moderator chat, and can be explicitly
      verified with `npm run moderation:smoke -- --research`.
- [ ] **Web/embed Risk Passport compact reuse.** ROAD-011 / T-043 is the next
      queue item. Telegram Risk Passport v1 is shipped; reuse the same passport
      structure on the website and iframe widget where it improves shallow
      username/phone checks without making partner embeds too tall.
- [x] ~~Add AI voice-clone as its own SOS scenario.~~ Done: second panic-menu
      page now includes `panic:11`, with saved-number verification,
      code-word/private-question guidance, help-directory copy and
      scenario-specific ready/trusted-person text.
- [x] ~~Add remaining new SOS scenarios for fake job/easy money, fake
      delivery/top-up, crypto/TON/card and government grant.~~ Done:
      `/panic` now has a third page with `panic:12` through `panic:15`,
      modern-scam first cards, detailed checklists with verified contact paths
      and scenario-specific follow-up copy.
- [x] ~~Add Guardian Angel v1 after high-risk results: one safe step at a time,
      trusted-contact help and optional follow-up, without storing raw evidence.~~
      Done as immediate post-high-risk guidance: one safe step, done
      confirmation, safe callback, trusted-contact help and full plan. Timed
      reminders remain a later scheduler/opt-out task.
- [x] ~~Add opt-in Voice-out / TTS v1 for short safety guidance. Never speak
      SMS codes, card numbers, seed phrases or other secrets back to the
      user.~~ Done: SOS and Guardian Angel keyboards now include opt-in short
      voice guidance. The TTS path has its own daily budget, sanitizes links,
      usernames and long digit runs before synthesis, refuses unsafe
      code/PIN/CVV/password-like text, prefers Gemini TTS when configured, and
      degrades to text when no TTS provider is configured.
- [ ] Add origin analytics/logging for `/embed/check` frame usage before broad
      distribution of the public embed widget. Partner allow-listing is shipped
      through `EMBED_ALLOWED_FRAME_ANCESTORS`.
- [ ] Refactor `src/lib/telegram/emergency.ts` emergency scenario copy into a
      data-driven profile map before adding many more SOS scenarios.
- [x] ~~Add external URL signals as additive checks: Google Safe Browsing first,
      then URLhaus/PhishTank. Paid line-type/VoIP providers remain optional.~~
      Done: optional provider layer adds `external_phishing_url` /
      `external_malware_url` reason codes only when provider env vars are
      configured. Successful provider responses are short-cached and in-flight
      checks are de-duplicated; provider calls receive only normalized URL
      tokens with credentials, query strings and fragments stripped. No full
      message text, OTPs, report narratives or moderation evidence is sent to
      URL reputation providers.
- [ ] Add public living-experience stories page after moderation/compliance
      wording is reviewed. Use anonymized tactics and lessons, not public
      accusations against unverified people.
- [x] ~~Add scam-call trainer as the next viral/education website surface after
      the current bot safety polish.~~ Done first as Telegram `/trainer` v1 with
      a callback-only mini-quiz; a public web/share surface can reuse the same
      defensive scenarios later.
- [x] ~~Harden Family Shield v1.1 before new large Telegram features.~~ Done: active-link guard, invite TTL, trusted-contact opt-out, env-driven bot username and redacted guardian alerts.
- [x] ~~Add Telegram webhook `update_id` deduplication to prevent duplicate processing on retries.~~ Done first as an in-memory LRU, then upgraded to shared Postgres `telegram_webhook_updates` claims for multi-instance safety.
- [x] ~~Enable GitHub secret scanning, push protection and Dependabot security updates.~~ Done on 2026-06-12; GitHub advanced non-provider/validity checks remain unavailable/disabled in current repo settings.
- [x] ~~Add production monitor script for app/webhook/Telegram/AI failures.~~ Done as `npm run monitor:prod` with optional sanitized Telegram alerts.
- [x] ~~Attach the production monitor to a real scheduler for public checks.~~ Done as `.github/workflows/prod-monitor.yml` every 30 minutes.
- [x] ~~Add production GitHub secrets for deeper scheduled monitor checks.~~ Done for `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `OPENAI_BASE_URL` and `OPENAI_MODEL`; manual GitHub Actions monitor run passed with webhook/Telegram/AI checks.
- [x] ~~Add `MONITOR_ALERT_CHAT_ID` (and optional `MONITOR_ALERT_BOT_TOKEN`) for sanitized Telegram operator alerts.~~ Done on 2026-06-14: Railway and GitHub Secrets have the alert chat id, and a direct Telegram alert test returned `ok: true`.
- [x] ~~Document the lightweight on-call runbook for production monitor alerts.~~ Done in `ai_docs/ON_CALL_RUNBOOK.md`.
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
- [x] ~~Add honest impact counters: checks, dangerous results and prevented-loss
      survey totals without exposing private reports or unsupported savings
      claims.~~ Done as Website Honest Impact Counters v1 with aggregate-only
      checks, risk alerts, moderated records and confirmed-report loss wording.
      Production migration `20260613182647_honest_impact_counters_v1` was
      applied on 2026-06-14 and `get_check_stats()` was verified; follow-up
      migration `20260629163000_public_impact_counters_confirmed_reports.sql`
      keeps report/loss impact confirmed-only.
- [x] ~~Add a scheduled maintenance path for `private.prune_app_retention()` after legal/compliance review confirms the windows.~~ Done on 2026-06-14 with Supabase/Postgres Cron job `ishonch_prune_app_retention_daily`.
- [x] ~~Add embeddable check widget for trusted media/community sites.~~ Done as
      Website Embed Widget v1: `/embed` generates a sandboxed iframe snippet,
      and `/embed/check` runs compact checks through the existing server-side
      pipeline without exposing raw input to the partner page.
- [x] ~~Add Unified Risk Passport v1 for Telegram username and phone checks.~~
      Done: shallow `unknown` username/phone checks now render passport cards
      instead of generic "not enough data" verdict cards, while contextual
      code/card/transfer/APK/link/call buttons stay attached.
- [x] ~~Fix SOS ready phrases for current emergency scenarios.~~ Done: ready
      phrases, trusted-person copy and contact/help buttons now differ for
      financial, APK, Telegram takeover, live-call, romance, blackmail and
      minor-safety scenarios.
- [x] ~~Add direct `/call` live-call entrypoint.~~ Done: `/call` opens the
      active live-call copilot directly, stores only panic context `6`, and is
      included in `/help` plus localized Telegram command payloads.
- [x] ~~Harden main-site CSP `script-src`.~~ Done: replaced untrusted inline
      scripts with request-scoped SSR nonces, removed `unsafe-inline` from the
      main and embed script policies, pinned the one external Unicorn script,
      added `script-src-attr 'none'` and regression coverage. Embed
      `frame-ancestors` is now separately restricted by an explicit partner
      origin allowlist.

- [x] ~~Add official verified contacts seed (banks, operators, Central Bank).~~ Done in PR #12–#14.
- [x] ~~Add panic/live-call helper.~~ Done in PR #15–#16 (/panic interactive mode).
- [x] ~~Add screenshot report upload path only after retention policy is defined.~~ Done as Report Screenshot Evidence v1: Telegram `/report` accepts screenshots during the description step, extracts a short redacted summary in memory and stores only that summary in the report draft; raw images, data URLs, QR payloads and full OCR text are not persisted.
- [x] ~~Improve Telegram/account enrichment with public Bot API metadata where available; do not invent account age, report counts or spam history when Telegram returns `chat not found`.~~ Done in Telegram Public Metadata v1 and Telegram Link & Account Intelligence v2 no-DB phase, including a Telegram-account "what I can/cannot check" help screen.
- [x] ~~Keep short Telegram follow-ups from becoming fake "not enough data" checks.~~ Done in Telegram Follow-up Memory v1 regression lock: post-check and orphan phrases such as "Точно?", "Что еще посоветуешь?" and "дай номер банка" bypass `runCheck` when no new artifact is present.
- [x] ~~Keep description-only Telegram reports out of public reputation.~~ Done in Report Flow Reputation Boundary v1.
- [x] ~~Add moderated Telegram reputation directory before showing community report labels, first-seen dates or confidence labels on Telegram targets.~~ Done for Telegram targets with hashed identifiers, source/confidence labels and moderation gate.
- [x] ~~Add honest phone intelligence before reputation claims.~~ Done in Phone Intelligence Passport v1: country/calling-code, Uzbekistan prefix/operator hints and official-directory status without owner/scam-label inference.
- [x] ~~Add moderated phone reputation directory before showing community report labels, first-seen dates or confidence labels on numbers.~~ Minimal v1 shipped using confirmed `entities` rows only: Telegram shows Ishonch Guard moderated report count + confidence, while owner/carrier/hidden-label claims stay forbidden.
- [x] ~~Add Telegram inline check for `@scamguard_bot <number/link/text>`.~~ Code shipped as rules-only, non-persistent previews.
- [x] ~~Enable BotFather inline mode for `@scamguard_bot` with `/setinline` and a short RU placeholder such as `Введите номер, ссылку или текст для проверки`.~~ Done on 2026-06-14.
- [x] ~~Add Telegram voice-note STT for elderly/stressed users.~~ Short voice
      notes, native Telegram audio attachments and audio documents such as
      `.ogg`/`.m4a` are transcribed in memory, redacted and checked by the same
      rules pipeline; failure falls back to a typed-summary prompt with
      emergency actions. Non-audio documents remain unsupported and are not
      downloaded.
- [x] ~~Add phone reputation appeal/removal flow and moderation guidelines before broader public launch.~~ Done as Reputation Appeals v1: `/appeal`, privacy-safe `reputation_appeals`, admin review actions and audit logging.
- [x] ~~Automated production operational verification on Railway.~~ Passed on 2026-06-12: `npm run prod:smoke`, `npm run prod:family-smoke` and `npm run prod:security-smoke`.
- [ ] Confirm billing/AI quota and real Telegram `/start` UX manually. Gemini `gemini-3.5-flash` returned `200` in the 2026-06-14 production probe; keep billing/credits on watch because reliable AI explanations/OCR still depend on provider quota or an `OPENAI_FALLBACK_*` provider.

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
- [x] ~~Define retention windows for `checks`, `reports`, Telegram sessions and future screenshots.~~ Implemented as `private.prune_app_retention()` cleanup windows and scheduled through Supabase/Postgres Cron on 2026-06-14.
- [ ] Legal/compliance review of moderation guidelines and appeal decisions before high-volume public launch.
