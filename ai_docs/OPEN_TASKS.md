# Open Tasks

## Fragile / risky spots

- **2026-07-12 security revalidation fixes are deployed, live closure evidence
  remains open.** The independent repository pass produced 15 findings
  (1 High, 9 Medium, 5 Low). The current branch adds exact-subject trust,
  sink credential minimization, QR/provider/domain corrections, admin-role
  revocation, admission-before-side-effects, step-scoped monitor secrets and
  passport follow-up precedence. Integration proof: 4227/4227 tests, TypeScript,
  build, npm audit, 28-migration reset, 38/38 pgTAP and schema lint pass. The
  application patch is deployed at `fdbc6ff8`; the exact admin-role migration
  still requires authenticated production Supabase apply. Do not mark findings
  Closed until their targeted live/read-back evidence and privacy-safe
  historical-data review are complete.

- **Family Shield v1.1 hardening is shipped.** Active-link invite errors, stale
  invite expiry, trusted-contact opt-out, env-driven invite URLs,
  guardian-language notification, redacted trusted alerts and explicit
  invite-handoff copy are now covered by tests.
- **Telegram durable lifecycle is deployed in polling mode.** Single-leader
  `getUpdates(limit=1)`, metadata-only processing/completion leases, fenced
  session I/O/outbound effects and completion-before-offset crash recovery pass
  local PostgreSQL and application tests. Production deployment `8064b403` at
  revision `4bd9403` reports a healthy polling leader; the scheduled monitor
  observes `mode=polling`, an empty pending queue and the intentionally disabled
  webhook. Targeted multi-instance failover and provider-failure evidence remain
  open, and the system is not claimed to provide exactly-once delivery.
- **Retention cleanup is scheduled.** Supabase/Postgres Cron job `ishonch_prune_app_retention_daily` runs `private.prune_app_retention()` daily at 20:17 UTC and deletes only rows eligible under the documented windows.
- **Shared rate-limit degraded mode is fixed locally.** Public checks, reports,
  appeals, Telegram check/OCR/image/voice-out paths and public Telegram post
  fetches use Supabase `rate_limit_buckets` with HMAC-hashed keys across Node
  instances. The reproducer showed RPC failure granting a new process-local
  budget and more than 6100 live fallback keys remaining in an unbounded map.
  Production/Railway now fails closed on missing config, hash/RPC error or
  invalid response. Dev/test fallback is capped at 4096 TTL/LRU keys, denies
  new identities at capacity and rate-limits full cleanup. Focused degraded-
  policy/cap tests pass 13/13, owning consumers pass 534/534 and the repository
  suite passes 2652/2652. Railway forced-failure smoke and Postgres bucket-volume
  observation remain open; Redis/KV is not required unless those measurements
  show the database path cannot meet the agreed budget.
- **Windows Vite/toolchain exposure is fixed locally.** The starting npm graph
  reported seven findings (one high) and the canonical Bun graph later exposed
  two additional transitive findings. Vite is pinned to 7.3.6, esbuild to
  0.28.1, compatible Babel/js-yaml/brace-expansion fixes are locked, and both
  `npm audit` and `bun audit` now report zero. The real Vite process was observed
  listening only on `127.0.0.1:8080`; external bind now requires an explicit
  CLI `--host`. Frozen Bun lock, Bun production build, three security regressions
  and repository tests 2655/2655 pass. Docker image build could not run because
  the local Docker Desktop Linux engine was not started; rerun it before commit/
  deployment if container-level proof is required.
- **AI-to-evidence provenance confusion is fixed locally.** A forged model
  `Telegram passport:` marker could previously select a low-signal Telegram
  presenter or promote invented official/safe lines into canonical sections.
  Passport kind now depends only on deterministic input type, and structured
  Telegram sections parse only a separate typed
  `TelegramPassportEvidence { provenance, text }` value. The AI `explanation`
  field is never authorized as evidence. Web/embed/Inline/check ownership tests
  pass 198/198 and the repository suite passes 2667/2667. Deployment plus a
  forged-marker live smoke across all three renderers remains open.
- **Mixed-clause AI safety bypass is fixed locally.** A safe warning prefix no
  longer exempts a sibling transfer, wallet or APK command separated by a
  semicolon or common English/Russian/Uzbek contrast/sequence boundary. Six
  adversarial mixed-clause cases and legitimate independently-negated warnings
  pass; the 31-test focus also passed five consecutive executions. Deployment
  and provider-output adversarial smoke remain open.
- **AI provider is optional.** Without `OPENAI_API_KEY`, scoring still works but natural-language explanations, screenshot OCR/image understanding and voice STT return `null`. Voice-out/TTS is separately opt-in through `GEMINI_TTS_API_KEY` or `OPENAI_TTS_API_KEY`; without either, the bot sends a short text fallback instead of audio.
- **Telegram account metadata enrichment is intentionally shallow:** public `getChat` metadata can be shown when available, and Telegram evidence briefs now put visible scam scenarios before generic API limits when local reason codes exist, but Telegram Bot API does not give reliable account age, hidden scam labels, Telegram report counts or spam history to this bot.
- **Telegram reputation is moderated and app-owned:** `telegram_reputation_targets` can show Ishonch Guard confirmed report counts, but unverified user reports stay hidden from user-facing labels.
- **Telegram reputation partial failures are fixed locally.** Confirmed and
  unverified count errors, missing exact counts and aggregate upsert failures
  now reject with a typed stage-only error; the admin caller cannot return
  `{ok:true}` after divergence. Logs omit database messages and target hashes.
  Ownership tests pass 158/158 and the repository suite passes 2738/2738.
  Railway forced-failure telemetry, operator retry UX and reconciliation smoke
  remain open; the current multi-statement flow is not claimed to be atomic.
- **Phone reputation wording is source-scoped.** Phone reputation cards name
  only moderator-confirmed Ishonch Guard reports and explicitly exclude
  unverified complaints, number owner data, carrier data and hidden external
  labels.
- **Verified-contact trust is now exact-subject locally.** A real reproducer
  combining official short code `1344` with unrelated attacker content returned
  `safe` and exposed whole-result verified metadata. Badge, phone passport and
  Safe now require an exact standalone destination; embedded tokens return no
  verified metadata. Exhaustive reason trust classification remains defense in
  depth, and warning-prefix sibling clauses no longer suppress recruitment
  risk. Deployment and the real-client RU/UZ/EN conflict matrix remain open.
- **Missing high-risk protective actions are fixed locally.** Confirmed-report,
  external-phishing and external-malware reason codes previously reached the
  high-risk Telegram template with a generic request for more context. All 55
  ReasonCodes now compile through exhaustive
  `REASON_PROTECTIVE_ACTION`; every high-risk single/pair combination has a
  non-empty immediate action, including stop/official verification and link/APK
  avoidance in RU/UZ/EN. Telegram focus passes 227/227 and the repository suite
  passes 2675/2675. Deployment and direct-bot RU/UZ/EN client proof remain open.
- **Unicode/IDNA brand verdict defects are fixed locally.** Registered Cyrillic
  text aliases, fully Cyrillic and hybrid-script IDNs, browser Punycode and
  official domains with one terminal DNS root dot now share a two-sided
  comparison policy. Official/news allowlists now use a separate lossless DNS
  identity, so `kapita1bank.uz`/`sp0t.uz` cannot inherit trust from a lossy
  similarity skeleton. The original downgrade/bypass/false-positive cases pass,
  as do every registered Cyrillic alias and official domain plus longer-token
  negatives. Risk/core focus passes 165/165 and the repository suite passes
  2733/2733. Deployment, external reputation compatibility and RU/UZ/EN client
  presentation smoke remain open.
- **Expired Telegram directory handles now fail closed locally.** The eight
  mutable handles last checked on 2026-06-03 no longer enter verified lookup,
  public directory results/counts or Telegram action links after the 30-day
  freshness window. Focused registry/directory/check tests pass 47/47. Before
  any handle is reactivated, its exact username must be confirmed from a current
  primary source. `TRUST-002` remains in progress because phone/emergency source
  ownership, explicit expiry and refresh operations are not yet implemented.
- **External URL reputation is origin-only locally.** A bearer token embedded in
  a URL path was reproduced in the Google Safe Browsing request body. Provider
  payloads now contain only scheme/origin; userinfo, path, query and fragment are
  excluded, while local rules retain full-path `.apk` and scam-signal analysis.
  Risk tests pass 479/479. Deployment and a provider-compatibility smoke remain
  open; path-specific provider detection is an explicit privacy tradeoff.
- **Malformed URL and Telegram custom-scheme redaction is fixed locally.** The
  reproducer showed raw `https://victim:secret-token@%`, `tg://` and
  `telegram://` identifiers reaching report/appeal displays, narrative fields
  or a Telegram report draft. Malformed URL/APK displays now fail closed to
  `[link]`, and custom schemes are redacted centrally before persistence,
  session or moderation use. The original seven failures now pass; focused
  boundary tests pass 71/71, the owning risk/report/appeal/Telegram suite passes
  528/528, and the repository suite passes 2643/2643. Railway deployment plus
  report/appeal/Telegram draft smoke remain open release evidence.
- **Synchronous QR CPU amplification is fixed locally.** A valid 4000x3000
  uniform PNG compressed to about 50 KiB and blocked the Node event loop for
  about 4.2 seconds because it triggered full-image plus overlapping tile scans.
  PNG/JPEG QR decode now runs in one isolated worker with 4 MiB/4 MP input,
  1.5 MP scan, five-attempt/350 ms work, four-job backlog, 900 ms deadline and
  worker-memory budgets. Real PNG/JPEG QR plus Telegram webhook focus passes
  104/104; the repository suite passes 2645/2645. A local four-job 3.6 MP burst
  completed in about 91 ms with roughly 11 ms maximum observed event-loop lag.
  This is a single synthetic measurement, not the required p99/soak proof:
  Railway legitimate-corpus smoke, runtime CPU/RAM profile, 60-minute bounded-
  memory soak and worker crash/restart validation remain open under `RES-004`.
- **Telegram inline low-signal checks use Risk Passport now.** Inline mode stays
  rules-only and non-persistent while phone/Telegram username checks can show
  honest passport sections, limitations and the next context question instead
  of a generic insufficient-data card. Automated regressions cover low-signal
  phone, low-signal Telegram username, phone reputation source/scope copy and
  high-risk action-first inline cards; production synthetic inline smoke now
  verifies webhook `200` plus no `checks`/session persistence. The manual
  real-client checklist now lives in `ai_docs/TELEGRAM_INLINE_QA.md`; remaining
  QA is capturing sanitized Telegram-client visual examples/screenshots.
  2026-07-06 note: Telegram Web in the current session did not render inline
  result lists in the bot chat or Saved Messages and only left a local draft,
  while production inline smoke still passed. Defer this visual check to mobile
  Telegram or Telegram Desktop in Saved Messages / a private non-moderator QA
  chat.
  2026-07-10 local P0 hardening: Inline now re-masks all inserted displays,
  fails malformed URL displays closed, uses the first-contact RU/UZ/EN language
  hint, skips external URL-reputation providers while typing, enforces the
  256-character Bot API boundary and observes `answerInlineQuery` failures.
  The hardened Inline build is deployed at revision `fdbc6ff8`; real
  Desktop/Android/iOS RU/UZ/EN visual and insertion evidence remains the open
  release gate. The 2026-07-12 credential sanitizer for Markdown and plaintext
  retry is deployed. The synthetic Inline smoke is now polling-aware and proves
  authenticated webhook shutdown plus zero `checks`/session side effects; it
  intentionally does not claim real handler rendering or insertion.
- **Pig-butchering / romance grooming has explicit conversation memory now.**
  `/conversation` collects a short user-supplied thread, stores only derived
  stage/action/reason metadata in the Telegram session, and flags chains such
  as romance/trust-building followed by investment/crypto/payment pressure
  without persisting raw chat text. Passive background profiling across every
  ordinary message remains intentionally unshipped until there is a separate
  privacy/product decision; the supported path is explicit user-triggered
  conversation analysis.
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
- **Embed widget CSP is origin-allowlisted and logged safely.** `/embed/check`
  keeps `frame-ancestors` to `'self'`, localhost development origins and
  explicit HTTPS origins from `EMBED_ALLOWED_FRAME_ANCESTORS`; the `partner`
  query label does not grant framing access. ROAD-012 now records
  service-role-only origin telemetry with partner/referrer origin metadata and
  aggregate result shape only, never raw input or full URLs.
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
- **Voice-in negated already-done acknowledgement is shipped.** Short voice
  transcripts such as RU "I did not send SMS code" and UZ
  `Men esa SMS-kod yubormadim.` now receive a calm "good, do not send it"
  acknowledgement before the generic risk engine. Keep adding sanitized live
  transcript variants to the replay corpus when STT provider wording changes.
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
- [x] ~~**Voice-out pre-record architecture pass.**~~ Done: main SOS voice
      callbacks now prefer committed `panic-{id}-{lang}.ogg` assets before
      WAV, TTS budget and provider calls; provider-only Guardian/follow-up
      voice buttons are stripped from rate-limit fallbacks; and all 45 RU/UZ/EN
      SOS OGG assets for panic scenarios 1-15 validated again on 2026-07-02.
      Keep live TTS for rare dynamic guidance only.
- [ ] **Prerecorded Voice-out release QA.** Human listen-through remains a
      release checklist item for tone/pronunciation. Automated release QA was
      re-run on 2026-07-04: `npm run tts:validate-assets` passed for all 45
      RU/UZ/EN `.ogg` assets, and the focused Telegram voice-out/emergency/
      webhook suite passed (`3 files / 135 tests`). With explicit action-time
      approval, production Telegram Voice-out smoke also passed on 2026-07-04:
      Telegram accepted RU/UZ/EN `panic-6` audio and the production webhook
      accepted a `voiceout:panic:6` callback.
- [ ] **Voice-in/STT UX hardening.** Keep the daily TTS/STT cost guards, but
      improve transcript confirmation/edit recovery, confidence-aware fallback
      and user-facing wording when daily voice hints are exhausted. Waiting
      state, STT-budget wording, direct voice-to-SOS routing and transcript
      correction, low-signal fallback and first RU/UZ mixed-speech fixtures are
      shipped. First two production-like corpus/confidence slices are also
      shipped: RU/UZ/EN SMS-code, card security-code, remote-access,
      money-transfer, Telegram login-QR and live-call transcripts route to the
      right SOS, while negated "I did not send/scan/dictate" phrases stay on
      the normal check pipeline. Uzbek Cyrillic replay fixtures now cover
      sent SMS-code, transferred money, active-call pressure and negated code
      wording. A local real-provider capture workflow is documented in
      `ai_docs/VOICE_STT_FIXTURES.md` and backed by
      `npm run stt:transcribe-fixtures`; the collector has manifest/audio path
      validation tests and keeps audio reads inside the manifest folder.
      First provider-sanitized transcript slice landed on 2026-07-04 from
      ignored local audio through the production STT provider: English active
      call routes to SOS, while English negated SMS-code stays normal-check.
      Remaining: collect human/live RU and UZ provider examples, then tune
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
- [x] ~~**Web/embed Risk Passport compact reuse.** ROAD-011 / T-043 is the next
      queue item. Telegram Risk Passport v1 is shipped; reuse the same passport
      structure on the website and iframe widget where it improves shallow
      username/phone checks without making partner embeds too tall.~~ Done:
      shared `risk-passport` presenter now feeds the website result card and
      `/embed/check`; low-signal phone/Telegram checks show compact honest
      passport sections, while high-risk results remain action-first.
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
- [x] ~~**Embed origin analytics/logging.** ROAD-012 / T-044 is the next queue
      item. Add privacy-safe origin usage telemetry for `/embed/check` before
      broad distribution of the public embed widget. Partner allow-listing is
      shipped through `EMBED_ALLOWED_FRAME_ANCESTORS`.~~ Done: `/embed/check`
      now sends a small embed context to `checkInput`; the server stores only
      partner, referrer origin/host, language and aggregate result shape in
      `embed_origin_events`, with RLS, service-role-only access and 180-day
      retention.
- [x] ~~**P1 user-story QA flows.** Next queue item after ROAD-012. Re-run the
      real web/Telegram user-story flows from the tracker: homepage high-risk
      result, report success path, appeal success plus admin moderation, live
      Telegram image/QR, Guardian Angel high-risk, and private/group session
      scoping.~~ Done: production web smoke, admin moderation smoke,
      Telegram user-story smoke, live QR/Guardian smoke, private/group scope
      smoke and production security smoke passed on 2026-07-02. Synthetic rows
      were cleaned, and user-facing Telegram smokes used a private
      non-moderation QA chat, not the moderator chat.
- [x] ~~**SEC-002 CSP/security headers final reconciliation.** Next queue item
      after QA-001. Review current server CSP/header code, docs and production
      headers; either close the stale Partial tracker row with current evidence
      or define the exact remaining header gap.~~ Done: server-level regression
      now covers baseline headers, main-site nonce/CSP and `/embed/check`
      frame behavior. `prod:security-smoke -- <public-url>` verifies live
      `/healthz` and `/embed/check` headers plus Supabase/RLS checks; production
      passed on 2026-07-02.
- [x] ~~Refactor `src/lib/telegram/emergency.ts` emergency scenario copy into a
      data-driven profile map before adding many more SOS scenarios.~~ Done:
      `PANIC_SCENARIO_PROFILES` / `PANIC_SCENARIO_IDS` now drive menu pages,
      panic-id parsing, contact-button roles and family-first keyboard ordering
      without changing existing SOS copy. Targeted emergency/i18n/voice-out
      tests, full Telegram suite, `tsc` and scoped eslint passed on 2026-07-02.
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
- [x] ~~Replace Telegram claim-only dedup with a durable lifecycle.~~ Fixed
      locally in D-072: single-leader polling, metadata-only leases/fences,
      completion-gated offsets, fenced session/effect boundaries and 20 pgTAP
      database assertions. Production deploy/cutover evidence remains open.
- [x] ~~Enable GitHub secret scanning, push protection and Dependabot security updates.~~ Done on 2026-06-12; GitHub advanced non-provider/validity checks remain unavailable/disabled in current repo settings.
- [x] ~~Add production monitor script for app/webhook/Telegram/AI failures.~~ Done as `npm run monitor:prod` with optional sanitized Telegram alerts.
- [x] ~~Attach the production monitor to a real scheduler for public checks.~~ Done as `.github/workflows/prod-monitor.yml` every 30 minutes.
- [x] ~~Add production GitHub secrets for deeper scheduled monitor checks.~~ Done for `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `OPENAI_BASE_URL` and `OPENAI_MODEL`; manual GitHub Actions monitor run passed with webhook/Telegram/AI checks.
- [x] ~~Make required scheduled monitor checks fail hard when a Telegram secret
      is absent.~~ Fixed locally on 2026-07-11: the committed schedule sets
      `MONITOR_REQUIRE_SECRET_CHECKS=true`, and policy tests prove a required
      skip fails even when fail-on-warning is disabled.
- [x] ~~Capture release evidence for the fail-hard monitor policy.~~ Done on
      2026-07-11 without changing production secrets: the normal scheduled
      configuration passed, a controlled missing-secret drill failed the job,
      and the restored normal run passed again.
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
- [x] ~~Keep short Telegram follow-ups from becoming fake "not enough data" checks.~~ Done in Telegram Follow-up Memory v1 and extended on 2026-07-11: confidence, methodology, trusted-person, recheck and disagreement phrases in RU/UZ/EN bypass `runCheck` when no new artifact is present. Methodology uses enum-only provenance, trusted-person text has no side effect and recheck requires resubmission.
- [x] ~~Implement Telegram session/update reliability locally.~~ Done: durable
      lifecycle, global polling leader, failure reacquisition, stale-fence
      rejection, fenced session I/O and outbound effects, safe webhook fallback,
      clean DB reset/lint and crash regressions.
- [x] ~~Deploy the two 20260711 migrations and polling build; switch production
      and the scheduled monitor to polling; verify leader health and normal
      multi-step delivery.~~ Done on 2026-07-11/12. Deployment `8064b403` at
      revision `4bd9403` is healthy, polling leader health returns 200, pending
      updates remain empty, the scheduled production monitor passes, and the
      bounded five-action Telegram dialogue smoke passes. Pending updates were
      preserved; exactly-once delivery is not claimed.
- [ ] Capture a dedicated multi-instance polling failover/re-election drill and
      a forced Telegram provider-failure recovery trace without destructive
      production traffic.
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
