# Product Roadmap

Last updated: 2026-06-11.

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

## Stage 1 - Phone Trust Layer

### 1A. Phone Intelligence Passport v1

Status: in progress.

Goal: make phone checks immediately useful without pretending we know the caller.

Shipped behavior:

- Detect country/calling code for common numbers.
- Detect Uzbekistan mobile/landline prefix where possible.
- Show whether the number matches the official Ishonch Guard directory.
- For foreign numbers, explain the callback risk when someone claims to be an Uzbek bank/service.
- Never claim owner, hidden scam label, account age, spam history or report volume without a real source.

### 1B. Moderated Phone Reputation v1

Status: next.

Goal: "there are confirmed reports about this number" only after moderation.

Scope:

- Store phone targets by HMAC hash, not raw number.
- Add admin moderation source/confidence fields.
- Surface counts only for confirmed records.
- Add appeal/removal and false-positive handling before public launch.

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

1. Inline check in any Telegram chat: `@scamguard_bot <number/link/text>`.
2. Live-call copilot polish: one step at a time, fewer buttons, "what to say" and "call safely" actions.
3. Family Shield: trusted contact setup; high-risk result can notify a relative with one tap.
4. Voice messages: voice -> STT -> existing rules pipeline, especially for elderly users.
5. Weekly scam digest from the research feed: short, local, shareable.

## Stage 3 - Website Trust And Distribution

1. Public official-number directory page for banks, payment systems, telecoms and agencies.
2. Public scheme map/trends for Uzbekistan using aggregated, non-personal data.
3. Honest impact counters: checks, dangerous results, prevented-loss survey totals.
4. Embeddable check widget for media, banks and community sites.
5. "Verified by Ishonch Guard" badge only after manual moderation.

## Stage 4 - Reliability And Security

1. Redis/KV-backed rate limits before multiple production instances.
2. Google Safe Browsing / URLhaus / PhishTank as additive URL signals.
3. Production observability: error rate, provider quota, Telegram webhook latency.
4. Compliance review for Uzbekistan personal-data law and retention windows.
5. Admin audit log and moderation guidelines before community reputation growth.

## Do Not Build Yet

- Separate bots for phone/usernames. The single Ishonch Guard brand is stronger.
- Public accusations based on unverified user reports.
- Claims about Telegram account creation date or hidden SCAM badges.
- Scraped contact-name databases.
- More long text before response-compression is finished.
