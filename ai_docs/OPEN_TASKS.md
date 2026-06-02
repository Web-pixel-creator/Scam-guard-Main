# Open Tasks

## Fragile / risky spots

- **In-memory rate limit** is per Node process. Good for MVP; use Redis/KV before scaling to multiple instances or hostile traffic.
- **AI provider is optional.** Without `OPENAI_API_KEY`, scoring still works but natural-language explanations and screenshot OCR return `null`.
- **Telegram risk enrichment is shallow:** `evaluateTelegram` returns `unknown_sender`; no account-age/metadata lookup yet.
- **`payment` input_type exists but has only text-pattern coverage; no dedicated detector/classifier yet.**
- **Large homepage route:** `src/routes/index.tsx` should eventually be split into smaller section components.

## Near-term product tasks

- [ ] Add official verified contacts seed (banks, operators, Central Bank) -> `verified_official`.
- [ ] Add screenshot report upload path only after retention policy is defined.
- [ ] Add panic/live-call helper and trusted-contact sharing for elderly/vulnerable users.
- [ ] Improve Telegram/account enrichment beyond `unknown_sender` (account age, official handles, metadata where legally available).
- [ ] Add a dedicated payment classifier/detector for marketplace and service-payment flows.

## Research feed

Use `https://t.me/pressauz` as a research feed for Uzbekistan scam patterns. Do not copy posts verbatim into the app. Summarize recurring tactics into:

1. a `SCAM_COVERAGE.md` category,
2. a reason-code proposal or education-only note,
3. RU/UZ/EN wording,
4. tests before enabling a scoring rule.

Recent useful feed themes: suspicious foreign calls asking for SMS/card data, malicious Telegram files/GIFs, fake boss/official requests, APK "security app" theft, fake service/payment intermediaries.

## Later / scaling

- [ ] Native mobile app (Android first for SMS/call protection).
- [ ] B2B API with API-key auth.
- [ ] Shared cache/rate-limit layer.
- [ ] Privacy-safe analytics on scam trends.

## Compliance / legal

- [ ] Review UZ personal-data law for `redacted_value`, `description`, `amount_lost_uzs`, `city`.
- [ ] Define retention windows for `checks`, `reports`, Telegram sessions and future screenshots.
- [ ] Moderation guidelines + admin audit log.
