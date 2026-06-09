# Open Tasks

## Fragile / risky spots

- **In-memory rate limit** is per Node process. Good for MVP; use Redis/KV before scaling to multiple instances or hostile traffic.
- **AI provider is optional.** Without `OPENAI_API_KEY`, scoring still works but natural-language explanations and screenshot OCR return `null`.
- **Telegram account metadata enrichment is intentionally shallow:** public `getChat` metadata can be shown when available, and v2 now adds visible local risk signals/next steps, but Telegram Bot API does not give reliable account age, hidden scam labels, report counts or spam history to this bot.
- **`payment` input_type is heuristic.** It detects payment-flow text, but still needs real-world tuning from moderated reports.
- **Large homepage route:** `src/routes/index.tsx` should eventually be split into smaller section components.

## Near-term product tasks

- [x] ~~Add official verified contacts seed (banks, operators, Central Bank).~~ Done in PR #12–#14.
- [x] ~~Add panic/live-call helper.~~ Done in PR #15–#16 (/panic interactive mode).
- [ ] Add screenshot report upload path only after retention policy is defined.
- [x] ~~Improve Telegram/account enrichment with public Bot API metadata where available; do not invent account age, report counts or spam history when Telegram returns `chat not found`.~~ Done in Telegram Public Metadata v1 and Telegram Link & Account Intelligence v2 no-DB phase, including a Telegram-account "what I can/cannot check" help screen.
- [x] ~~Keep description-only Telegram reports out of public reputation.~~ Done in Report Flow Reputation Boundary v1.
- [ ] Add moderated Telegram/phone reputation directory before showing community report labels, first-seen dates or confidence labels on public profiles or numbers.
- [ ] Production operational verification on Railway: endpoint responds, but confirm billing, env secrets, Supabase migrations, webhook registration and `/start` live flow.

## Research feed

Use `https://t.me/pressauz` as a research feed for Uzbekistan scam patterns. Do not copy posts verbatim into the app. Summarize recurring tactics into:

1. a `SCAM_COVERAGE.md` category,
2. a reason-code proposal or education-only note,
3. RU/UZ/EN wording,
4. tests before enabling a scoring rule.

Recent useful feed themes: suspicious foreign calls asking for SMS/card data, malicious Telegram files/GIFs, fake boss/official requests, APK "security app" theft, fake service/payment intermediaries.

Completed research-feed themes now covered by deterministic rules:

- Telegram account deletion / "Cancel" phishing -> `telegram_account_takeover_phishing`.
- Card/SIM/account transfer or dropper recruitment -> `dropper_recruitment`.
- Closed betting/prediction invite channel -> `gambling_prediction_promo`.

## Later / scaling

- [ ] Native mobile app (Android first for SMS/call protection).
- [ ] B2B API with API-key auth.
- [ ] Shared cache/rate-limit layer.
- [ ] Privacy-safe analytics on scam trends.

## Compliance / legal

- [ ] Review UZ personal-data law for `redacted_value`, `description`, `amount_lost_uzs`, `city`.
- [ ] Define retention windows for `checks`, `reports`, Telegram sessions and future screenshots.
- [ ] Moderation guidelines + admin audit log.
