# Product Roadmap

Last updated: 2026-06-18.

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
- Official-number Lookalike v1: phone/short-code checks now compare unknown
  numbers with the verified contact directory and explain near misses without
  unsupported accusations.
- Live-call Copilot Polish v1: the active-call flow now starts with one safe
  action, hides safe-callback until hangup, and uses compact context-specific
  follow-up buttons.
- Weekly Scam Digest v1: Telegram `/digest` and the main menu now show a
  compact deterministic RU/UZ/EN digest for casino/frispin, NFT/Stars, TON,
  bank/SMS-code and APK funnels, with check/report/emergency next actions.
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

Remaining implementation order after the 2026-06-18 product feedback:

1. **Voice-in v2.** Add transcript preview/confirmation, edit-text recovery,
   confidence-aware fallback, RU/UZ mixed speech tests and direct routing from
   obvious panic/live-call transcripts.
2. **QR clarity pass.** Make every photo/QR result explicit about whether a QR
   was actually decoded, what destination type was found, and why benign menu
   QR differs from login/payment/device-link QR.
3. **Voice/STT UX hardening.** Waiting indicator, exhausted-STT-budget wording
   and direct voice-to-SOS routing are shipped. Next: transcript
   confirmation/edit recovery and confidence-aware fallback so users can fix
   bad recognition without re-spending STT budget.
4. **Latency pass.** Use timing diagnostics to isolate 5-10 second paths, then
   cache or skip AI on low-signal checks where deterministic output is enough.
5. **Phone Reputation v2 and Inline QA.** Improve phone reputation and inline
   answers only after the emergency context bugs are closed.
6. **Weekly schemes data model.** Move the weekly digest from static copy to a
   source/status/updated-at model with a safe stale fallback before automating
   any research-feed publishing.
7. **Private moderation chat.** If added, keep it operator-only with redacted
   summaries and links to admin review, not raw reports or user evidence.
8. **External signals and public trust surfaces.** Add Google Safe Browsing /
   URLhaus / PhishTank, public living-experience stories and the scam-call
   trainer after the bot trust fixes above. Paid line-type/VoIP providers stay
   optional.

Operational hardening that continues in parallel:

- Watch shared Postgres rate-limit behavior under real traffic; consider
  Redis/KV only if bucket writes become a bottleneck.
- Keep Reputation Appeals v1 decisions in the regular moderation review loop;
  production migration is applied and service-role-only access is verified.
- Keep retention/on-call monitor checks in the regular production smoke loop.
- Keep Voice-out/TTS daily limits. The current per-user cap is intentional cost
  protection; future tuning should improve the waiting state and idempotency,
  not remove the budget guard.
- Consider a private moderator Telegram chat for new reports and appeals. It
  should receive only redacted summaries and moderation links, never raw codes,
  cards, screenshots, full OCR text or unredacted phone numbers.

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

## Stage 3 - Website Trust And Distribution

1. Public official-number directory page for banks, payment systems, telecoms and agencies - shipped as Website Trust Surface v1.
2. Public scheme map/trends for Uzbekistan using aggregated, non-personal data - shipped as Website Public Scheme Trends v1.
3. Honest impact counters: checks, dangerous results, user-reported loss totals - shipped as Website Honest Impact Counters v1.
4. Embeddable check widget for media, banks and community sites - shipped as v1.
5. Public living-experience stories page: moderated, anonymized scam tactics and lessons.
6. Scam-call trainer: interactive education flow that people can share.
7. Scam map/index: aggregated trend surface only after data/compliance review.
8. "Verified by Ishonch Guard" badge only after manual moderation.

## Stage 4 - Reliability And Security

1. Monitor shared Postgres-backed rate limits; move to Redis/KV only if scale requires it.
2. Google Safe Browsing / URLhaus / PhishTank as additive URL signals.
3. Production observability: error rate, provider quota, Telegram webhook latency.
4. Compliance review for Uzbekistan personal-data law and retention windows.
5. Legal review of appeal/removal moderation guidelines before community reputation growth.

## Do Not Build Yet

- Separate bots for phone/usernames. The single Ishonch Guard brand is stronger.
- Public accusations based on unverified user reports.
- Claims about Telegram account creation date or hidden SCAM badges.
- Scraped contact-name databases.
- More long text before response-compression is finished.
