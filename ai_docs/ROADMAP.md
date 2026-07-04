# Product Roadmap

Last updated: 2026-07-04.

This roadmap is the canonical implementation order for turning Ishonch Guard from a useful Telegram bot into a trusted anti-scam assistant for Uzbekistan. It intentionally separates honest, shippable user value from features that require paid providers, moderation, or legal review.

## Principles

- Rules first, AI second. Deterministic scoring must work when AI/OCR is down.
- Do not invent hidden Telegram facts. Bot API does not expose account age, hidden scam labels, private report history, or spam history.
- Separate "publicly observable" from "moderated reputation". A country code or prefix is not a scam verdict.
- One next best action beats a long checklist in panic flows.
- Privacy by default: raw numbers, URLs, cards, codes, screenshots and OCR text must not be stored in session state.

## Stage 0 - Control The Plan

Status: in progress.

- Keep this file as the single roadmap.
- Keep feature specs in `.kiro/specs/*` aligned with implementation state.
- Keep `OPEN_TASKS.md` only for current risks, blockers and near-term work.

### Current checkpoint after the 2026-06-12 audit

Already shipped:

- Phone Intelligence Passport v1.
- Moderated Phone Reputation v1.
- Telegram inline check code path.
- Result/message UX compression and follow-up memory.
- Public Telegram post visible-evidence parsing.
- Family Shield v1 code, production migration and production smoke test.
- Family Shield Hardening v1.1: active-link handling, invite TTL, trusted-contact opt-out, env-driven bot username, guardian-language notification and clearer trusted alerts.
- Telegram webhook `update_id` deduplication as an in-memory fast path plus shared Postgres `telegram_webhook_updates` claims.
- Retention Cleanup v1: explicit cleanup windows and private maintenance function, plus production RLS/security smoke.
- Security Definer Hardening v1: browser stats moved behind a server function and admin RLS helper moved to private schema.
- GitHub security baseline: secret scanning, push protection and Dependabot security updates are enabled.
- Production Monitor v1: recurring app/webhook/Telegram/AI monitor script with optional sanitized Telegram alerts.
- Scheduled Production Monitor v1: GitHub Actions cron runs production checks every 30 minutes; repository secrets are configured for webhook, Telegram and AI provider checks.
- Shared Rate Limits v1: public check/report/Telegram throttling now uses
  Supabase HMAC-hashed buckets across Node instances with in-memory fallback.
- Telegram Voice STT v1: short voice notes are transcribed in memory, redacted
  and checked by the existing rules pipeline.
- Telegram Voice-in/STT replay corpus v1.1: production-like and live sanitized
  transcript rows now cover RU/UZ/EN emergency routing, negated already-done
  phrases, Uzbek Cyrillic and live Uzbek provider variants such as
  `SMS kodni yubardim` without committing raw audio.
- Official-number Lookalike v1: phone/short-code checks now compare unknown
  numbers with the verified contact directory and explain near misses without
  unsupported accusations.
- Live-call Copilot Polish v1: the active-call flow now starts with one safe
  action, hides safe-callback until hangup, and uses compact context-specific
  follow-up buttons.
- Weekly Scam Digest v1: Telegram `/digest` and the main menu now show a
  compact deterministic RU/UZ/EN digest for casino/frispin, NFT/Stars, TON,
  bank/SMS-code and APK funnels, with check/report/emergency next actions.
- Weekly Scam Digest data model: `/digest` now renders from manual
  source/status/updated-at records, filters drafts and stale records, and uses a
  safe evergreen fallback before any future research-feed automation.
- Private moderation chat workflow: optional moderator alerts now cover new
  reports, reputation appeals and high-signal research items using redacted
  summaries/admin links only.
- Website Trust Surface v1: the website now has `/official-numbers`, a
  searchable verified-contact directory, safer homepage trust counters and a
  callback guidance block that warns caller ID can be spoofed.
- Website Public Scheme Trends v1: the website now has `/scam-trends`, a
  searchable public map of scam tactics using only research-feed categories,
  deterministic reason-code coverage and non-personal educational metadata.
- Website Honest Impact Counters v1: the homepage now shows aggregate checks,
  risk alerts, moderated records and user-reported loss totals with conservative
  wording and no public raw report data.
- Reputation Appeals v1: public `/appeal` correction path, privacy-safe
  appeal queue, admin remove/keep decision and audit logging.
- Telegram Main Menu UX v2: `/start` and `/menu` now behave as an action hub
  with a full-width emergency entry first, clearer "new check" wording and
  grouped quick actions for Family Shield, weekly schemes, reports and safety.
- Telegram Passport Copy Polish v1: username-only Telegram checks now read as
  a structured passport of visible facts, Ishonch Guard confirmed-report count,
  Bot API limitations and the next useful evidence to send, without inventing
  hidden account age, scam labels or Telegram complaint history.
- Telegram Passport Context Buttons v1: inconclusive username/phone checks now
  ask what the caller/sender requested via compact buttons for code, card,
  transfer, APK, link/QR and live call, then answer with a concrete safe next
  step instead of another generic verdict.
- Phone Passport UX Polish v1: unknown phone cards now show country/operator,
  official-directory status, Ishonch Guard report count and the honest
  "number alone is not proof" boundary as short visual sections.
- Website Embed Widget v1: `/embed` now generates a sandboxed iframe snippet
  and `/embed/check` renders a compact partner-site checker that reuses the
  existing server-side check pipeline.
- Unified Risk Passport v1 (Telegram): shallow `unknown` username/phone checks
  now render as passport cards instead of generic "not enough data" verdict
  cards, while contextual follow-up buttons stay attached.
- SOS Ready Phrase Fix v1: existing panic follow-ups now use scenario-specific
  ready phrases, trusted-person wording and contact/help destinations for bank,
  APK, Telegram takeover, live call, romance, blackmail and minor-safety cases.
- Direct Live-call `/call` v1: Telegram users can open the active-call copilot
  directly from a command, with the hangup-first keyboard and existing
  live-call follow-up memory.
- AI Voice-Clone SOS v1: panic scenario `11` guides users to verify a familiar
  voice through a saved number, code word/private question and trusted-person
  help without claiming biometric voice proof.
- Telegram Modern SOS Scenarios v1: `/panic` now has a third page for fake
  job/easy money, delivery/top-up, crypto/TON/wallet and government
  grant/benefit pressure, with `panic:12..15`, compact first cards, detailed
  checklists and scenario-specific follow-ups.
- Guardian Angel v1: high-risk Telegram checks now continue with one safe step
  at a time, safe-callback guidance, trusted-contact help, a done confirmation
  and a concise full plan, while storing only safe summary metadata.
- Voice-out / TTS v1: SOS and Guardian Angel screens now have an opt-in short
  voice guidance button. The speech path uses a separate TTS configuration,
  strips unsafe evidence before synthesis and falls back to text when audio is
  unavailable.
- Voice-out Contextual Follow-ups v1: follow-up voice buttons now preserve the
  originating action (`more`, `contacts`, `script`, `trusted_person`, `full`)
  instead of replaying the generic scenario summary. Repeated taps are
  de-duplicated and Telegram gets an `upload_voice` action while synthesis is
  running.
- Telegram Latency/Cost Pass v1: slow text checks show a delayed visible
  checking status, repeated normalized text checks use a short per-user
  cache/in-flight de-duplication, public Telegram metadata has a soft
  timeout/cache, low-signal passports skip AI, decoded login/payment/wallet QR
  payloads bypass visual AI, URL reputation is cached/de-duplicated, and
  voice STT / Voice-out paths keep cache, duplicate and budget guards.
- Emergency Callback Context Binding v1: panic follow-up and Voice-out buttons
  now carry the originating scenario id, while legacy callbacks remain a
  fallback. Stale keyboards from older emergency scenarios no longer answer
  using the latest panic context by accident.
- Emergency Keyboard Profile Pass v1: `/panic` and Guardian Angel keyboards now
  match the scenario context. Financial/APK/live-call cases keep safe callback
  actions; blackmail, minor-safety, romance, voice-clone, Telegram recovery,
  fake job, delivery, crypto and grant cases prioritize trusted-person help,
  official destinations, voice verification, wallet safety or source checks.
- Telegram Recovery Safety Copy v1: Telegram takeover guidance no longer
  recommends arbitrary recovery usernames and instead points to official
  Telegram app settings/support wording.
- Emergency Copy Trust Polish v1: SOS and Guardian Angel copy now avoids
  repeated "I am nearby" boilerplate, and Telegram/phone passports phrase
  missing local complaints as "not found in Ishonch Guard", not as proof of
  safety.
- Telegram Conversation Check v1: `/conversation` and the main-menu whole-chat
  action collect a bounded 2-8 message conversation, store only derived
  stage/action/reason metadata in the session, and render how the scam pressure
  evolves without persisting raw chat text.
- Telegram Simple Explanation v1: result cards now include a simple-words
  explanation button, and RU/UZ/EN phrases such as "объясни как бабушке",
  "oddiy qilib" and "simple words" reuse the last check context without
  exposing internal score/threshold/weight details or weak unknown-result
  evidence.
- Family Codeword Guide v1: Family Shield now includes a privacy-first
  codeword guide for voice-clone/deepfake prevention. The bot teaches families
  to agree on a phrase offline, verifies suspicious voice/video pressure through
  saved-number callback plus a codeword/private question, and never asks users
  to send the actual codeword to the bot.
- Telegram Scam-call Trainer v1: `/trainer` and the main menu now open a
  five-situation defensive mini-quiz. Score stays in callback data, no answer
  state or `checks` rows are stored, and content avoids attacker-ready scripts.
- Website Privacy-safe Scam Map/Index v1: `/scam-trends` now includes a
  national tactics index, category buckets and a locked regional layer with
  explicit publication thresholds. It does not read private reports or expose
  raw targets, screenshots, OCR, URLs, phone numbers, usernames or low-count
  region data.
- Embed Origin Analytics v1: `/embed/check` now records service-role-only
  privacy-safe usage telemetry with partner/referrer origin metadata and
  aggregate result shape only. It does not store raw input, redacted input,
  hashes, full referrer URLs, paths, query strings, fragments, phone numbers or
  Telegram ids.

Remaining implementation order after the 2026-07-02 reconciliation:

1. **Voice-in/STT regression corpus and confidence tuning.** Transcript
   preview, correction, low-signal fallback, waiting state, STT-budget wording
   and direct voice-to-SOS routing are shipped. The first production-like STT
   corpus slices now cover RU/UZ/EN SMS-code, card security-code,
   remote-access, money-transfer, Telegram login-QR, live-call and negated
   already-happened phrases. The local real-provider capture/replay workflow is
   also in place and now has manifest/audio path validation tests. Next: collect
   real provider audio/transcript fixtures from live QA when `OPENAI_API_KEY`
   and local audio are available, then tune confidence heuristics from
   production examples.
2. **Prerecorded Voice-out release QA.** Static SOS OGG architecture is closed;
   keep human listen-through for tone/pronunciation in the release checklist.
3. **Phone Reputation v2 and Inline QA.** First inline QA and phone reputation
   wording/source-confidence slices shipped: low-signal phone/Telegram inline
   answers reuse the shared Risk Passport, and phone reputation copy now names
   moderator-confirmed Ishonch Guard reports plus public-scope limits. The
   automated inline regression matrix now covers phone, Telegram username and
   phone-reputation source/scope cases, and a production synthetic inline smoke
   now verifies webhook handling plus non-persistence. The real Telegram-client
   checklist is documented in `ai_docs/TELEGRAM_INLINE_QA.md`. Next: collect
   sanitized inline QA examples/screenshots from a real client.
4. **Public living-experience stories.** Build only after moderation,
   compliance and privacy review; never publish raw reports or low-count
   regional details.
5. **External signals and public trust surfaces.** Google Safe Browsing /
   URLhaus / PhishTank are shipped as optional additive URL signals with
   sanitized provider payloads. Paid line-type/VoIP providers stay optional.

Operational hardening that continues in parallel:

- Watch shared Postgres rate-limit behavior under real traffic; consider
  Redis/KV only if bucket writes become a bottleneck.
- Keep Reputation Appeals v1 decisions in the regular moderation review loop;
  production migration is applied and service-role-only access is verified.
- Keep retention/on-call monitor checks in the regular production smoke loop.
- Keep Voice-out/TTS daily limits. The current per-user cap is intentional cost
  protection; future tuning should improve the waiting state and idempotency,
  not remove the budget guard.
- Web/embed Risk Passport compact reuse shipped: the shared passport presenter
  now feeds website and partner iframe low-signal phone/Telegram checks without
  changing scoring or making high-risk cards less urgent.
- Embed origin analytics/logging shipped: `/embed/check` origin usage telemetry
  is service-role-only, RLS-protected and stores no raw checked evidence.
- P1 user-story QA for web and Telegram flows passed in production on
  2026-07-02: homepage high-risk, report success, appeal/admin moderation,
  live Telegram image/QR, Guardian Angel high-risk and private/group scoping.
- CSP/security headers reconciliation passed in production on 2026-07-02:
  main-site and embed headers now have server-level regression coverage, and
  `prod:security-smoke -- <public-url>` verifies live `/healthz` and
  `/embed/check` headers.
- Emergency profile-map refactor shipped on 2026-07-02: `/panic` scenario ids,
  menu pages, contact-button roles and family-first follow-up ordering now
  derive from `PANIC_SCENARIO_PROFILES` / `PANIC_SCENARIO_IDS`, with existing
  SOS copy unchanged.
- Voice-out prerecorded SOS assets revalidated again on 2026-07-04: all 45
  RU/UZ/EN OGG files for panic scenarios 1-15 pass `tts:validate-assets`, and
  the focused Telegram voice-out/emergency/webhook suite passes (`3 files /
  135 tests`). With explicit action-time approval, the production
  `prod:telegram-voice-out-smoke` also passed: Telegram accepted RU/UZ/EN
  `panic-6` OGG audio, the production webhook accepted a `voiceout:panic:6`
  callback, and cleanup completed.
- Voice-in/STT corpus slices shipped on 2026-07-02: production-like RU/UZ/EN
  transcripts for SMS-code, card security-code, remote-access, money-transfer,
  Telegram login-QR and live-call emergencies route to SOS, and negated
  already-happened phrases do not. On 2026-07-04 the replay corpus added UZ
  Cyrillic SMS-code, money-transfer, active-call and negated-code coverage.
- Voice-in/STT fixture workflow shipped on 2026-07-02: replay rows live in
  `voice-stt-provider-fixtures.ts`, local audio captures stay ignored, and
  `npm run stt:transcribe-fixtures` emits sanitized transcripts for manual
  review. Collector helper tests now cover manifest validation, supported audio
  extensions, expected transcript fragments and scoped local audio paths. On
  2026-07-04 the first provider-sanitized transcript rows were captured through
  production STT provider from ignored local English audio; RU/UZ human/live
  provider examples remain the next corpus expansion.
- Inline Risk Passport QA slice shipped on 2026-07-02: Telegram inline
  low-signal phone/Telegram results now show honest passport sections with
  limitations and the next context prompt; high-risk inline cards stay urgent.
- Phone Reputation v2 wording/source-confidence slice shipped on 2026-07-02:
  Telegram, inline and shared Risk Passport copy now distinguishes
  moderator-confirmed Ishonch Guard reports from unverified complaints, number
  owner data, carrier data and hidden external labels.
- Inline QA regression matrix expanded on 2026-07-02: automated coverage now
  includes low-signal Telegram username passports and phone reputation
  source/scope rendering in inline mode, while high-risk inline cards stay
  action-first.
- Production Telegram inline smoke added on 2026-07-02: synthetic inline
  updates for high-risk text, low-signal phone and low-signal username previews
  pass through the deployed webhook and verify no `checks` or chat-scoped
  sessions are persisted. Real Telegram-client screenshots remain a manual QA
  follow-up.
- Telegram inline real-client QA checklist added on 2026-07-02: `ai_docs/TELEGRAM_INLINE_QA.md`
  defines safe visual cases, capture/redaction rules, moderator-chat
  non-delivery expectations and an evidence-log template. Next queue item is
  capturing the sanitized screenshots/examples, plus real provider Voice-in/STT
  audio/transcript examples when key/audio access is available.
- TG-006 tracker reconciliation completed on 2026-07-02: the stale Partial
  status for Risk Passport username/phone checks is closed with focused
  formatter, public metadata, shared Risk Passport and inline regression
  evidence. The tracker now has no Partial or Planned rows.
- Conversation Check v1 reconciliation completed on 2026-07-02: the
  pig-butchering / romance-grooming memory gap is covered by explicit
  `/conversation` mode, which stores only derived stage/action/reason metadata
  and catches romance/trust-building to investment/crypto/payment escalation.
  Passive always-on profiling remains a future product/privacy decision, not a
  current implementation blocker.
- The private moderator Telegram chat must receive only redacted summaries and
  moderation links, never raw codes, cards, screenshots, full OCR text or
  unredacted phone numbers.

Important boundary: do not copy MTProto-style account-age, hidden scam-label,
DC/country or private spam-history claims from third-party Telegram tools. Our
"wow" must come from an honest risk passport, moderated app-owned reports,
official sources and scenario rescue flows.

## Stage 1 - Phone Trust Layer

### 1A. Phone Intelligence Passport v1

Status: shipped.

Goal: make phone checks immediately useful without pretending we know the caller.

Shipped behavior:

- Detect country/calling code for common numbers.
- Detect Uzbekistan mobile/landline prefix where possible.
- Show whether the number matches the official Ishonch Guard directory.
- Show when a number is only similar to a verified official contact, while
  clearly saying it is not an exact match and not proof of fraud.
- For foreign numbers, explain the callback risk when someone claims to be an Uzbek bank/service.
- Never claim owner, hidden scam label, account age, spam history or report volume without a real source.

### 1B. Moderated Phone Reputation v1

Status: shipped as a minimal v1.

Goal: "there are confirmed reports about this number" only after moderation.

Scope:

- Reuses the existing `entities` HMAC hash and moderation boundary.
- Surfaces counts only for confirmed phone records with positive report counts.
- Shows source and confidence as Ishonch Guard moderated reports, not carrier data.
- Never claims owner, SIM age, hidden scam label, spam history or unmoderated community reputation.
- Appeal/removal v1 exists as a privacy-safe correction path. Richer evidence
  source fields and legal review remain later compliance work.

### 1C. Optional Paid Enrichment

Status: later.

Possible providers: Twilio Lookup, IPQualityScore or a regional telecom data provider.

Allowed claims:

- line type: mobile, landline, VoIP, toll-free, unknown;
- country/region metadata from provider;
- provider confidence.

Disallowed claims:

- "this person is a scammer" from an unmoderated third-party label;
- contact names from scraped address books;
- private spam history without a lawful source.

## Stage 2 - Telegram-First Wow Features

1. Inline check in any Telegram chat: `@scamguard_bot <number/link/text>` - shipped in code and BotFather inline mode enabled on 2026-06-14.
2. Live-call copilot polish: one step at a time, fewer buttons, "what to say" and "call safely" actions - shipped as v1.
3. Family Shield: trusted contact setup; high-risk result can notify a relative with one tap. v1 and v1.1 hardening are shipped.
4. Voice messages: voice -> STT -> existing rules pipeline, especially for elderly users - shipped as v1.
5. Weekly scam digest from the research feed: shipped as Telegram v1; later can
   be automated from moderated aggregate trends.
6. Unified Risk Passport v1 for Telegram username/phone checks - shipped.
7. SOS ready phrase cleanup for non-bank emergency scenarios - shipped.
8. Direct `/call` live-call entrypoint - shipped.
9. AI voice-clone SOS scenario - shipped.
10. Modern SOS Scenarios v1: fake job/easy money, delivery/top-up,
    crypto/TON/wallet and government grant/benefit panic scenarios - shipped.
11. Guardian Angel v1: step-by-step post-high-risk guidance, done
    confirmation, safe callback and trusted-contact help - shipped as immediate
    v1; timed reminders remain later.
12. Voice-out / TTS v1 for short opt-in safety answers - shipped with text fallback when TTS is not configured.
13. Simple explanation follow-up for elder-friendly verdict explanations -
    shipped as Telegram Simple Explanation v1.

## Stage 3 - Website Trust And Distribution

1. Public official-number directory page for banks, payment systems, telecoms and agencies - shipped as Website Trust Surface v1.
2. Public scheme map/trends for Uzbekistan using aggregated, non-personal data - shipped as Website Public Scheme Trends v1.
3. Honest impact counters: checks, dangerous results, user-reported loss totals - shipped as Website Honest Impact Counters v1.
4. Embeddable check widget for media, banks and community sites - shipped as v1.
5. Public living-experience stories page: moderated, anonymized scam tactics and lessons.
6. Scam-call trainer: shipped first as Telegram Scam-call Trainer v1.
7. Scam map/index: shipped as Website Privacy-safe Scam Map/Index v1.
8. "Verified by Ishonch Guard" badge only after manual moderation.

## Stage 4 - Reliability And Security

1. Monitor shared Postgres-backed rate limits; move to Redis/KV only if scale requires it.
2. Google Safe Browsing / URLhaus / PhishTank as additive URL signals - shipped.
3. Production observability: error rate, provider quota, Telegram webhook latency.
4. Compliance review for Uzbekistan personal-data law and retention windows.
5. Legal review of appeal/removal moderation guidelines before community reputation growth.

## Do Not Build Yet

- Separate bots for phone/usernames. The single Ishonch Guard brand is stronger.
- Public accusations based on unverified user reports.
- Claims about Telegram account creation date or hidden SCAM badges.
- Scraped contact-name databases.
- More long text before response-compression is finished.
