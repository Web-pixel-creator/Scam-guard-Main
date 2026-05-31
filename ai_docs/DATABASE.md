# Database

Postgres via Supabase (Lovable Cloud). Schema = `public`. RLS enabled on all tables. Source of truth: `supabase/migrations/*.sql`. Generated types: `src/integrations/supabase/types.ts`.

> Note: the migration `20260530112249_*.sql` re-declares the full schema in one file (consolidated). Earlier dated migrations are the incremental history. Treat the consolidated file as the current shape.

## Enums

- `risk_level`: `safe | unknown | suspicious | high_risk`
- `input_type`: `phone | telegram | url | text | payment | apk | unknown`
- `report_status`: `new | reviewing | confirmed | rejected | duplicate`
- `app_role`: `admin | moderator | user`

## Tables

### `checks` — log of every risk check
`id, input_type, redacted_input, input_hash, risk_level, risk_score, reason_codes text[], ai_explanation, language, created_at`. Indexes on `input_hash`, `created_at desc`.
RLS: anon/authenticated can **INSERT** (length + reason-code count limits); **no SELECT** for public; admins can SELECT. Stores only redacted/hashed data — no raw identifiers.

### `reports` — user-submitted scam reports
`id, entity_type, redacted_value, entity_hash, description, screenshot_url, scam_type, city, amount_lost_uzs bigint, status, language, created_at`. Indexes on `entity_hash`, `status`.
RLS: anon/authenticated can **INSERT** (desc 5–5000 chars, value ≤500); admins SELECT + UPDATE. Anonymous by default (no user_id column).

### `entities` — aggregated suspicious identifiers (public-readable)
`id, entity_type, entity_hash UNIQUE, display_mask, risk_level, report_count, moderation_status, last_seen_at, created_at`. Index on `entity_type`.
RLS: public can SELECT **only** rows where `moderation_status='confirmed'`; admins SELECT + UPDATE; service-role writes. This is the public reputation table — entries appear publicly only after moderation.

### `user_roles` — RBAC
`id, user_id -> auth.users, role app_role, created_at`, UNIQUE(user_id, role).
RLS: a user can SELECT own roles; service-role manages. Checked via `has_role`.

### `admin_allowlist` — emails auto-promoted to admin on signup
`email PK, created_at`. RLS: nobody can read (anon/auth SELECT = false); managed by service-role/SQL only.

## Functions / triggers

- `has_role(_user_id uuid, _role app_role) -> boolean` — `SECURITY DEFINER`, used in RLS + `assertAdmin`. Execute granted to authenticated only.
- `handle_new_user_role()` — `AFTER INSERT ON auth.users` trigger. Grants `admin` if email is in `admin_allowlist`, else `user`. (Earlier version made the *first* signup admin — superseded by allowlist.)
- `get_check_stats() -> (total, today, confirmed_entities)` — `SECURITY DEFINER` public RPC powering the homepage `StatsStrip` without exposing the admin-only `checks` table.

## Privacy model (important)

- Identifiers are **hashed** (`entity_hash` / `input_hash`) — the DB never holds raw phones/handles/URLs.
- Only `display_mask` / `redacted_input` (masked) strings are stored for human display.
- OTP/SMS codes, full card numbers, PINs, passwords are redacted **before** any insert; screenshots are OCR'd then discarded (not stored as files).
- Public exposure requires `moderation_status='confirmed'` — guards against doxxing / mass-false-reporting.
