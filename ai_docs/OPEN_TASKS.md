# Open Tasks

## Fragile / risky spots (handle with care)

- **In-memory rate limit & entity reads** (`rate-limit.ts`) are per-worker on stateless edge — not a real global limit. Abuse protection is best-effort. Consider a shared store (KV/Redis) if abuse appears.
- **AI gateway dependency** — if `LOVABLE_API_KEY` is missing, explanations + OCR silently return `null`. Scoring still works, but the UX loses its "why".
- **`.env` ships public keys** — fine (publishable/anon), but make sure service-role / AI keys never land here or in client bundles.
- **`entities` boost hack** — in `checkInput`, a confirmed high-risk entity adds `asks_to_install_apk` as a proxy code to raise the score. Works, but it's a semantic hack; consider a dedicated `known_reported` reason code.
- **Telegram risk is a placeholder** — `evaluateTelegram` only returns `unknown_sender` (no account-age/lookup data yet).
- **Large route file** — `routes/index.tsx` is very large (inline trilingual content). Splitting into section components would help maintainability.
- **`payment` input_type** exists in the enum but has no dedicated detector/rules yet.

## Near-term product tasks

- [ ] **Telegram bot MVP** — `/start /check /report /help /safety`; reuse `lib/risk/*` and server fns. (Highest-leverage channel for UZ.)
- [ ] **New reason codes** (see `SCAM_COVERAGE.md`): `asks_to_scan_qr` (Telegram QR takeover → high_risk), `relative_in_distress` ("friend in an accident, send money"), `fake_delivery_payment`; add RU/UZ patterns + REASON_LABELS + weights.
- [ ] **Panic / live-call helper** + **emergency checklist** surfaced in the bot (time-wasting calls can't be detected by duration — handle behaviorally).
- [ ] **Vulnerable-user (elderly) layer**: simple language, trusted-contact / family-share of a verdict.
- [ ] **Screenshot reports** — `reports.screenshot_url` exists but the upload path (Supabase Storage + retention) isn't wired in the report flow.
- [ ] Add a real `known_reported` reason code + weight instead of the apk proxy.
- [ ] Phone enrichment (carrier/validity) and Telegram metadata lookup integrations.
- [ ] Official "verified" contacts seed (banks, operators, Central Bank) → `verified_official`.
- [ ] Recent scam alerts feed + ingestion of official warnings.

## Later / scaling

- [ ] Native mobile app (Android first for call/SMS protection).
- [ ] B2B API (`/v1/check/*`, `/v1/risk-score`) with API-key auth for banks/fintech/marketplaces.
- [ ] Shared rate-limit + caching layer.
- [ ] Analytics on scam trends (privacy-safe aggregates only).

## Compliance / legal (do before scaling reports)

- [ ] Review UZ personal-data law for storage of `redacted_value`, `description`, `amount_lost_uzs`, `city`.
- [ ] Define data-retention windows for `checks` and `reports`.
- [ ] Moderation guidelines + audit log for admin actions.

## Unknowns

- Production hosting target confirmation (Cloudflare assumed from Lovable default).
- Whether a Supabase Storage bucket is provisioned for screenshots.
- Real traffic volumes (affects rate-limit + DB indexing decisions).
