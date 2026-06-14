# Database

Postgres via Supabase. Schema = `public`. RLS is enabled on all app tables. Source of truth: `supabase/migrations/*.sql`; generated TypeScript types live in `src/integrations/supabase/types.ts`.

## Enums

- `risk_level`: `safe | unknown | suspicious | high_risk`
- `input_type`: `phone | telegram | url | text | payment | apk | unknown`
- `report_status`: `new | reviewing | confirmed | rejected | duplicate`
- `app_role`: `admin | moderator | user`

## Tables

### `checks`

Risk-check log: `id, input_type, redacted_input, input_hash, risk_level, risk_score, reason_codes, ai_explanation, language, created_at`.

RLS/grants: public direct inserts are revoked. Writes go through server functions
using the service-role client after validation, redaction and hashing. Public
cannot select; admins can read via admin server functions. Rows older than 90
days are eligible for retention cleanup. Stores redacted/hashed data only.

### `reports`

User-submitted reports: `id, entity_type, redacted_value, entity_hash, description, screenshot_url, scam_type, city, amount_lost_uzs, status, language, created_at`.

RLS/grants: public direct inserts are revoked. Reports are accepted through
`submitReport`, which validates payloads and redacts free-form `description`
before service-role insert. Anonymous by default; admins moderate through admin
server functions. Terminal reports (`confirmed`, `rejected`, `duplicate`) older
than 365 days and stale open reports (`new`, `reviewing`) older than 180 days
are eligible for retention cleanup.

Situation-only reports from Telegram (`/report` with no number/link/username)
are stored as incident evidence with the reserved redacted value
`__ishonch_guard_incident_only__`. They do not upsert or increment `entities`,
and admin moderation skips entity sync for that marker. This avoids turning a
description-only complaint into public reputation for an unknown person or
account.

### `entities`

Aggregated suspicious identifiers: `id, entity_type, entity_hash, display_mask, risk_level, report_count, moderation_status, last_seen_at, created_at`.

RLS: public can select only `moderation_status='confirmed'`; admins select/update; service-role writes. This prevents unmoderated public accusations.

Phone Reputation v1 reads confirmed phone rows from this table only after
moderation. User-facing output may show the Ishonch Guard confirmed report count
and derived confidence, but must not claim a number owner, carrier-private data,
hidden scam labels, account age or spam history.

### `telegram_reputation_targets`

DB-backed reputation for Telegram usernames/links: `id, target_hash, target_type,
display_hint, source_type, confidence, risk_level, moderation_status,
unverified_report_count, moderated_report_count, first_seen_at, last_seen_at,
metadata, created_at, updated_at`.

RLS/grants: public can read only confirmed rows from official or moderated-report
sources with at least one moderated report. Admins can read via RBAC; service
role writes. Raw Telegram usernames, invite tokens, public titles and public
descriptions are not stored. New checks may update only observation timestamps;
user-submitted unverified reports do not affect public risk or user-facing scam
labels. Unconfirmed system/public/unverified observations older than 180 days
are eligible for retention cleanup; confirmed rows are retained until moderated
removal.

### `telegram_sessions`

Per-user Telegram bot state: `telegram_user_id, lang, scenario, scenario_step, scenario_data, updated_at`.

RLS: no public access. Service-role only. Used so bot state survives process restarts and multi-instance deploys.

`scenario_data` is also used for Emergency Copilot context after `/panic`: only `lastPanicId` and `lastPanicAt` are stored. Raw URLs, phone numbers, OTPs, card data, screenshots and user evidence must not be stored there by the panic flow.
Rows idle for more than 30 days are eligible for retention cleanup.

Telegram image intelligence is not stored as a separate table. Only the final `checks` row is persisted, with redacted input, hash, risk level, reason codes and optional explanation; raw images and data URLs are discarded.

### `telegram_webhook_updates`

Short-lived Telegram webhook idempotency claims: `update_id, first_seen_at,
expires_at`.

RLS/grants: no public access; service-role only. The table stores only Telegram
`update_id` values for retry deduplication across multiple Node instances. It
does not store chat ids, user ids, usernames, message text, URLs, phone numbers,
OCR text or screenshots. Rows are eligible for cleanup after 2 days or when
`expires_at <= now()`.

### `rate_limit_buckets`

Short-lived shared rate-limit buckets:
`scope, key_hash, bucket_start, window_seconds, count, expires_at, created_at,
updated_at`.

RLS/grants: no public access; service-role only. The table stores only
HMAC-SHA256 hashes of rate-limit keys such as `check:<ip>` or `tg:<userId>`.
Raw IPs, Telegram ids, phone numbers, URLs, message text, OCR text and
screenshots are never stored here. Used by public web checks, report submission,
Telegram checks/OCR/image analysis and public Telegram post fetch throttling.
Rows are eligible for cleanup when `expires_at <= now()`.

### `telegram_family_shield`

Private trusted-contact mapping for Family Shield:
`id, guardian_telegram_user_id, trusted_telegram_user_id, trusted_chat_id,
invite_code_hash, status, created_at, accepted_at, revoked_at,
last_notified_at, updated_at`.

RLS/grants: no public access; service-role only. Invite tokens are HMAC-hashed
before storage and raw deep links are not persisted. v1 allows one open
`pending` or `active` relationship per guardian. Pending invites expire in app
logic after 24 hours, trusted contacts can opt out, and alerts intentionally do
not include checked numbers, links, OCR text, screenshots, SMS codes, card data
or report descriptions. Revoked links older than 30 days and stale pending rows
older than 7 days are eligible for retention cleanup. Active trusted-contact
relationships are retained until revoked.

### `user_roles`

RBAC rows: `id, user_id, role, created_at`, unique by `(user_id, role)`.

### `admin_allowlist`

Emails that become admin on signup. Managed by SQL/service-role only.

## Functions / triggers

- `private.has_role(_user_id uuid, _role app_role) -> boolean` is the private RLS helper for admin policies.
- `has_role(_user_id uuid, _role app_role) -> boolean` remains as a legacy service-role-only helper; public/authenticated RPC execution is revoked.
- `handle_new_user_role()` signup trigger
- `get_check_stats() -> (total, today, confirmed_entities)` is service-role-only and called through the web server function, not directly from the browser.
- `claim_rate_limit(scope, key_hash, limit, window_seconds) -> (allowed, remaining, retry_after_sec, current_count)` is service-role-only and atomically increments one shared rate-limit bucket.
- `private.prune_app_retention(as_of timestamptz default now()) -> jsonb` deletes rows eligible under the retention windows and returns per-table counts.
- `prune_telegram_sessions()` remains as a legacy service-role-only helper for sessions idle more than 30 days.

## Retention windows

Retention cleanup is scheduled through Supabase/Postgres Cron job
`ishonch_prune_app_retention_daily` at `17 20 * * *` (daily 20:17 UTC). The job
runs `select private.prune_app_retention();` and deletes only rows eligible
under the windows below.

- `checks`: 90 days.
- `reports`: terminal states after 365 days; stale `new`/`reviewing` after 180 days.
- `telegram_sessions`: 30 days after last update.
- `telegram_webhook_updates`: 2 days / `expires_at <= as_of`.
- `rate_limit_buckets`: `expires_at <= as_of` (normally one request window plus a short buffer).
- `telegram_reputation_targets`: unconfirmed system/public/unverified observations after 180 days; confirmed rows retained until moderated removal.
- `telegram_family_shield`: revoked rows after 30 days; stale pending rows after 7 days; active relationships retained until revoked.

## Privacy model

- Identifiers are hashed into `entity_hash` / `input_hash`.
- Human-visible strings are masked (`display_mask`, `redacted_input`, `redacted_value`).
- OTP/SMS codes, full card numbers, full phones, PINs, passwords and passport data must be redacted before persistence.
- Screenshots are OCR'd/analyzed in memory and discarded; image uploads for reports are not wired yet.
- Public exposure requires admin moderation.
- Description-only incident reports are useful for review/research, but they do
  not affect public entity reputation.
