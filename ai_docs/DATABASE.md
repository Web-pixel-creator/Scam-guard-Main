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
cannot select; admins can read via admin server functions. Stores redacted/hashed
data only.

### `reports`

User-submitted reports: `id, entity_type, redacted_value, entity_hash, description, screenshot_url, scam_type, city, amount_lost_uzs, status, language, created_at`.

RLS/grants: public direct inserts are revoked. Reports are accepted through
`submitReport`, which validates payloads and redacts free-form `description`
before service-role insert. Anonymous by default; admins moderate through admin
server functions.

### `entities`

Aggregated suspicious identifiers: `id, entity_type, entity_hash, display_mask, risk_level, report_count, moderation_status, last_seen_at, created_at`.

RLS: public can select only `moderation_status='confirmed'`; admins select/update; service-role writes. This prevents unmoderated public accusations.

### `telegram_sessions`

Per-user Telegram bot state: `telegram_user_id, lang, scenario, scenario_step, scenario_data, updated_at`.

RLS: no public access. Service-role only. Used so bot state survives process restarts and multi-instance deploys.

`scenario_data` is also used for Emergency Copilot context after `/panic`: only `lastPanicId` and `lastPanicAt` are stored. Raw URLs, phone numbers, OTPs, card data, screenshots and user evidence must not be stored there by the panic flow.

### `user_roles`

RBAC rows: `id, user_id, role, created_at`, unique by `(user_id, role)`.

### `admin_allowlist`

Emails that become admin on signup. Managed by SQL/service-role only.

## Functions / triggers

- `has_role(_user_id uuid, _role app_role) -> boolean`
- `handle_new_user_role()` signup trigger
- `get_check_stats() -> (total, today, confirmed_entities)`
- `prune_telegram_sessions()` deletes sessions idle for more than 30 days

## Privacy model

- Identifiers are hashed into `entity_hash` / `input_hash`.
- Human-visible strings are masked (`display_mask`, `redacted_input`, `redacted_value`).
- OTP/SMS codes, full card numbers, full phones, PINs, passwords and passport data must be redacted before persistence.
- Screenshots are OCR'd in memory and discarded; image uploads for reports are not wired yet.
- Public exposure requires admin moderation.
