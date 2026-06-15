# Product Roadmap

Last updated: 2026-06-15.

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

Immediate implementation order after the 2026-06-15 product feedback:

1. **SOS Ready Phrase Fix.** Ready phrases must be context-specific. Bank
   callback wording is wrong for romance scams, blackmail, minors, fake jobs,
   voice-clone family scams and delivery/top-up scams.
2. **Live-call `/call`.** The existing live-call copilot is shipped inside
   emergency flows, but a direct `/call` command should open a one-screen
   "someone is calling me right now" flow with one primary button: "I hung up".
3. **New SOS scenarios.** Add AI voice-clone, romance scam, fake job/easy
   money, fake delivery/top-up, crypto/TON/card and government-grant scenarios.
4. **Guardian Angel v1.** After high-risk results, the bot should not end the
   conversation; it should guide the user through one safe step at a time,
   offer trusted-contact help, and optionally follow up later.
5. **Voice-out / TTS v1.** Let elderly or stressed users hear short safety
   guidance, not only read it. This must be opt-in and never speak secrets back.
6. **External signals.** Add Google Safe Browsing / URLhaus / PhishTank first;
   line-type/VoIP providers stay optional and paid.
7. **Website distribution and public trust.** Embed Widget v1 is shipped. Next
   website features should be public living-experience stories, a scam-call
   trainer, and later a scam map/index, all using aggregated or moderated data.

Operational hardening that continues in parallel:

- Watch shared Postgres rate-limit behavior under real traffic; consider
  Redis/KV only if bucket writes become a bottleneck.
- Keep Reputation Appeals v1 decisions in the regular moderation review loop;
  production migration is applied and service-role-only access is verified.
- Keep retention/on-call monitor checks in the regular production smoke loop.

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
7. SOS ready phrase cleanup for non-bank emergency scenarios - next.
8. Direct `/call` live-call entrypoint - next after SOS phrase cleanup.
9. Guardian Angel v1: step-by-step post-high-risk guidance and optional follow-up.
10. Voice-out / TTS v1 for short opt-in safety answers.

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
