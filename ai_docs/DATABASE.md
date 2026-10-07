# Database

Postgres via Supabase. `public` is the primary exposed application schema;
internal operational/security objects also live in `private`. RLS is enabled on
all app tables, and private objects additionally rely on explicit least-
privilege schema/table/function grants. Source of truth:
`supabase/migrations/*.sql`; generated TypeScript types live in
`src/integrations/supabase/types.ts`.

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
cannot select; admins read through AAL2-protected admin server functions.
Migration `20260729131000` also requires an authenticated admin JWT at `aal2`
for direct RLS/PostgREST SELECT. It was staging-verified and applied to
production on `2026-08-01` UTC. Rows older than 90 days are eligible for
retention cleanup. Stores redacted/hashed data only;
decoded QR Wi-Fi/password/OTP/recovery/authenticator secrets are removed before
the check input is constructed or inserted.

### `reports`

User-submitted reports: `id, entity_type, redacted_value, entity_hash, description, screenshot_url, scam_type, city, amount_lost_uzs, status, language, created_at`.

RLS/grants: public direct inserts are revoked. Reports are accepted through
`submitReport`, which validates payloads and redacts free-form `description`
plus target, scam type and city fields before service-role insert. The shared
sink sanitizer covers labeled passwords, separated codes, recovery phrases and
private keys before reports, entity candidates or moderation notifications.
Anonymous by default; admins moderate through AAL2-protected admin server
functions. Migration `20260729131000` requires AAL2 for direct authenticated
admin SELECT and for both `USING` and `WITH CHECK` on UPDATE; isolated staging
pgTAP and production read-only postflight both passed.
Terminal reports (`confirmed`, `rejected`, `duplicate`) older
than 365 days and stale open reports (`new`, `reviewing`) older than 180 days
are eligible for retention cleanup.

Same-day duplicates for an existing target are stored as redacted
`status='duplicate'` report rows. They preserve independent evidence for admin
review and retention/audit policy, but they do not refresh `entities`, change
public `report_count`, or count as confirmed reputation evidence.

Situation-only reports from Telegram (`/report` with no number/link/username)
are stored as incident evidence with the reserved redacted value
`__ishonch_guard_incident_only__`. They do not upsert or increment `entities`,
and admin moderation skips entity sync for that marker. This avoids turning a
description-only complaint into public reputation for an unknown person or
account.

### `entities`

Aggregated suspicious identifiers: `id, entity_type, entity_hash, display_mask, risk_level, report_count, moderation_status, last_seen_at, created_at`.

RLS: public can select only `moderation_status='confirmed'`. Migration
`20260729131000` requires AAL2 for direct authenticated admin SELECT/UPDATE;
service role retains its normal RLS bypass. Isolated staging verified the
policy behavior and production postflight confirmed it after apply. This prevents
unmoderated public accusations without removing the confirmed-row public
policy.

`report_count` is the moderated confirmed report count. Public report submission
creates or refreshes a candidate without incrementing this field; admin
moderation resyncs it from `reports.status='confirmed'`. Migration
`20260629153000_entities_report_count_confirmed_only.sql` backfills existing
rows to that definition.

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
sources with at least one moderated report. Migration `20260729131000`
requires AAL2 for the broader direct authenticated admin read; service role
writes and retains its RLS bypass. It is staging-verified and production-applied.
Raw Telegram usernames, invite tokens, public titles and public descriptions
are not stored. New checks may update only observation timestamps;
user-submitted unverified reports do not affect public risk or user-facing scam
labels. Unconfirmed system/public/unverified observations older than 180 days
are eligible for retention cleanup; confirmed rows are retained until moderated
removal.

### `reputation_appeals`

Privacy-safe correction/removal queue for public reputation:
`id, target_type, target_hash, target_display, reason, contact_hash,
contact_display, status, resolution, created_at, updated_at`.

RLS/grants: enabled; `anon` and `authenticated` have no direct table access.
Submissions and admin decisions go through server functions using the
service-role client. Targets and optional contacts are HMAC-hashed before
storage. Display fields are masked/redacted and intended for admin triage only.
Reason and contact display use the same sink credential sanitizer; contact
hashing still uses the normalized original value so deduplication remains stable.
The local P1 candidate keeps whether an open appeal already existed private:
new and already-open targets return the same public `{ ok: true }` response.
This changes no table, RLS or retention behavior.

Admin decisions do not delete reports. A successful removal moves the public
`entities` record to `moderation_status='rejected'` and `risk_level='unknown'`;
Telegram reputation targets are disabled the same way.

### `telegram_sessions`

Per-user Telegram bot state: `telegram_user_id, lang, scenario, scenario_step,
scenario_data, updated_at, last_update_id, last_update_at`.

RLS: no public access. Service-role only. Used so bot state survives process restarts and multi-instance deploys.

`scenario_data` is also used for Emergency Copilot, Guardian Angel and bounded
Direct victim follow-up context: `lastPanicId`, `lastPanicAt`, `lastCheck`
summary metadata, `guardian` high-risk summary metadata and
`lastVictimIntent = { kind, askedContext?, scenario?, at }` may be stored.
Guardian Angel stores only risk level, input type, reason codes and timestamp;
the victim snapshot stores enum-only routing metadata for at most 20 minutes.
Raw text, amounts, recipients, URLs, phone numbers, OTPs, card data, screenshots,
OCR text, files and user evidence must not be stored there by panic, follow-up,
victim or guardian flows.
State that can affect a later bot reply also carries
`scenario_data.chatScope = { chatId, chatType }`. The Telegram router treats
active/contextual rows without a matching chat scope as stale and resets them,
so private report/check/panic context cannot cross into group chats or another
private chat by user id alone.
Telegram `/report` drafts store concrete targets as `{ type, hash, display,
incidentOnly }`, not raw phone numbers, usernames or URLs. Draft narrative
fields such as description, scam type and city are redacted before persistence;
legacy raw `scenario_data.value` rows are converted or reset before the next
save.
Rows idle for more than 30 days are eligible for retention cleanup.

Legacy webhook-context writes call the service-role-only
`save_telegram_session_sequenced(telegram_user_id, update_id, patch)` RPC.
It atomically applies same/newer update patches and makes an older late write a
stale no-op. Because Telegram may choose a new random `update_id` after at least
one week without updates, a lower id is accepted after a seven-day session
update-id inactivity epoch and becomes the new baseline. This is a last-write
guard, not a durable cross-instance inbox:
Durable processing instead calls `load_telegram_session_fenced` and
`save_telegram_session_fenced`; both reject stale update/leader leases before
reading or mutating session state.

Telegram image intelligence is not stored as a separate table. Only the final
`checks` row is persisted, with redacted input, hash, risk level, reason codes
and optional explanation; raw images and data URLs are discarded. Web OCR and
core image-intelligence paths validate data URL MIME, base64 form and decoded
byte size before an image can reach an external AI provider. Category-only
benign image labels are not persisted as `safe` without readable supporting
evidence and deterministic destination scoring; low-signal image checks remain
`unknown`.

### `private.telegram_media_provider_consents` (local candidate only)

Migration `20260904120000_telegram_media_provider_consent_claim.sql` proposes a
dedicated metadata-only consent row keyed by `(telegram_user_id, chat_id)`:
`chat_type, media_kind, report_flow_id, prompt_message_id, requested_at,
granted_at, terminal_at, terminal_reason, expires_at, last_update_id`. Allowed
media kinds are `image`, `voice` and `report_image`; terminal reasons are
`consumed` and `revoked`. `report_flow_id` is required exactly for
`report_image`, and registration/grant/claim must match the active report
generation. The UUID itself remains non-secret report-session routing metadata;
it is not a consent grant in `telegram_sessions`.

The table is private, has RLS enabled and grants no direct access to `PUBLIC`,
`anon`, `authenticated` or `service_role`. Only service-role execution of the
SECURITY DEFINER register/grant/revoke/claim RPCs may mutate it. Every RPC first
validates the current Telegram update lease and processing/leader fences.
Grant is bound to the exact user, chat, chat type, kind and prompt message.
Report-image grant and claim also match `report_flow_id`. Claim is one atomic
conditional update: only one concurrent/replayed handler can write the
`consumed` tombstone and receive `applied=true`; SQL claim additionally refuses
execution without a polling-leader token. Revocation writes a `revoked`
tombstone. Neither terminal transition changes `expires_at`: the tombstone lasts
only for the remainder of the original request's ten-minute TTL. A non-older
valid prompt registration may replace the row earlier. After expiry, the
candidate SQL currently permits a registration with an older `update_id` to
replace the row; whether expiry should override monotonic ordering is an open P2
review item and is safe only behind the ordered polling frontier.

The application store exposes these transitions only inside the ordered
single-leader polling lifecycle. An RPC error, malformed result or lost response
is storage uncertainty, never a semantic miss/success. It propagates to keep the
polling update retryable. Register/grant/revoke support same-update replay;
claim remains one-winner, so a committed claim with a lost response is not
claimable on replay and cannot cause provider I/O.

Rows contain no Telegram file id, filename, media bytes, text, OCR, transcript,
provider payload or secret value. This candidate migration is not applied to
production. It must be applied and verified before the application version that
calls the new RPCs is deployed. The candidate pgTAP plan now contains 62
assertions, including DML privilege denials, wrong-scope cases and grant-after-
revoke denial; those counts are source definitions, not passing database
evidence. Candidate completion additionally requires the real clean-database CI
migration/pgTAP run and its loopback two-session proof of exactly one winner
across two concurrent claims followed by a third replay miss; the structural
contract test alone is not that database evidence. Production use must then
follow the delivery-disabled, drained, migration-first rollout in
`DEPLOYMENT.md`.

### `telegram_webhook_updates`

Telegram update lifecycle metadata: `update_id, first_seen_at, expires_at,
status, processing_fence, lease_token, leader_token, leader_fence,
lease_expires_at, attempt_count, started_at, completed_at, updated_at,
last_error_stage`.

RLS/grants: no public access; service-role only. The table stores only Telegram
`update_id` and operational lease/fence values for crash recovery. It
does not store chat ids, user ids, usernames, message text, URLs, phone numbers,
OCR text or screenshots. Processing rows retain up to 7 days of recovery
metadata and completed rows approximately 3 days; cleanup removes rows when
`expires_at <= now()`.

`private.telegram_update_leaders` stores the singleton polling leader
token/fence/expiry and no Telegram payload or user data.

### `rate_limit_buckets`

Short-lived shared rate-limit buckets:
`scope, key_hash, bucket_start, window_seconds, count, expires_at, created_at,
updated_at`.

RLS/grants: no public access; service-role only. The table stores only
HMAC-SHA256 hashes of rate-limit keys such as `check:<ip>`, `tg:<userId>` or
`telegram-image:<tg:userId>`. Raw IPs, Telegram ids, phone numbers, URLs,
message text, OCR text and screenshots are never stored here. Used by public
web checks, report submission, Telegram checks/OCR/image analysis, pre-download
Telegram image media throttling and public Telegram post fetch throttling.
Rows are eligible for cleanup when `expires_at <= now()`.

### `embed_origin_events`

Privacy-safe `/embed/check` usage telemetry:
`id, created_at, event_type, partner, referrer_origin, referrer_host, language,
input_type, risk_level, reason_count`.

RLS/grants: no public access; service-role only. The table records where the
iframe is used and aggregate result shape only. It does not store raw input,
redacted input, input hashes, full referrer URLs, paths, query strings,
fragments, phone numbers, Telegram ids, screenshots or OCR text. Rows older
than 180 days are eligible for retention cleanup.

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

### `private.telegram_family_notification_claims`

Metadata-only idempotency claims for manual/automatic Family Shield alerts:
`id, family_id, idempotency_key, mode, claimed_at, expires_at`. The private
table stores no message body, checked identifier, Telegram evidence, OTP, card
data or raw user text. The claim RPC may delete expired rows opportunistically.
Migration `20260729105030` also deletes every row with `expires_at <= as_of`
through the existing daily retention function, so an inactive family does not
retain an expired claim indefinitely. Isolated staging pgTAP passed 10/10, and
production postflight confirmed the updated function and unchanged cron.

### `admin_actions`

Redacted admin audit records. Direct authenticated admin reads become
role-plus-AAL2 under migration `20260729131000`; it is verified in isolated
staging and applied in production. Public/anonymous access remains denied and service
role retains its normal RLS bypass.

### `user_roles`

RBAC rows: `id, user_id, role, created_at`, unique by `(user_id, role)`.

### `admin_allowlist`

Emails eligible for admin access after mailbox verification. Managed by
SQL/service-role only. Signup creates a baseline `user` role unless Supabase has
already set `auth.users.email_confirmed_at`; an allowlisted account is promoted
to `admin` only after `email_confirmed_at` is non-null. Migration
`20260712142514_reconcile_admin_role_lifecycle.sql` makes the durable role an
exact projection: allowlist removal/update, confirmed-email drift or loss of
confirmation revokes `admin` immediately while preserving the baseline `user`.
Email identity is `lower(btrim(email))` in both SQL and the preflight. Migration
repair is set-based, so it does not retain one advisory transaction lock per
existing Auth user; runtime transitions remain serialized per user.
Before applying that migration to a live project, run
`npm run admin-role:preflight` in the production environment and require zero
stale and zero missing roles. The command emits aggregate counts only.

## Functions / triggers

- `private.has_role(_user_id uuid, _role app_role) -> boolean` is the private
  role helper.
- Migration `20260729131000`, applied in production after isolated staging and
  pgTAP verification, adds `private.is_admin_aal2() -> boolean`, a
  `SECURITY INVOKER` predicate that requires both the current `admin` role and
  JWT `aal='aal2'`. Protected authenticated admin policies use it; service role
  remains a separate server-only RLS-bypass boundary.
- `has_role(_user_id uuid, _role app_role) -> boolean` remains as a legacy service-role-only helper; public/authenticated RPC execution is revoked.
- `handle_new_user_role()` signup trigger; it no longer grants allowlisted
  admins before email confirmation.
- `handle_confirmed_admin_allowlist_role()` email-confirmation trigger; grants
  or revokes `admin` after email/confirmation changes.
- `private.reconcile_admin_role(user_id)` serializes one user's entitlement
  transition with an advisory transaction lock and projects current confirmed
  allowlist eligibility; direct execution is revoked from API roles.
- `private.handle_admin_allowlist_role_change()` reconciles users affected by
  allowlist INSERT/UPDATE/DELETE in the same transaction.
- `get_check_stats() -> (total, today, confirmed_entities, high_risk,
suspicious, dangerous, reports_total, reports_with_loss_amount,
reported_loss_uzs)` is service-role-only and called through the web server
  function, not directly from the browser. Check/risk counters are raw
  aggregate activity; report/loss counters include only
  `reports.status='confirmed'`.
- `claim_rate_limit(scope, key_hash, limit, window_seconds) -> (allowed, remaining, retry_after_sec, current_count)` is service-role-only and atomically increments one shared rate-limit bucket.
- Telegram lifecycle RPCs `acquire/renew/release_telegram_update_leader`,
  `telegram_update_leader_status`, `begin/renew/complete_telegram_update`,
  `mark_telegram_update_failure`, `telegram_update_lease_current`,
  `load_telegram_session_fenced` and `save_telegram_session_fenced` are
  service-role-only SECURITY DEFINER functions with empty `search_path`.
- Candidate RPCs `register_telegram_media_provider_consent`,
  `grant_telegram_media_provider_consent`,
  `revoke_telegram_media_provider_consent` and
  `claim_telegram_media_provider_consent` are service-role-only SECURITY
  DEFINER transitions over the private consent table. They validate the current
  Telegram update lease/fences; report registration/grant/claim additionally
  bind `report_flow_id`; `claim` requires polling-leader ownership, atomically
  returns one winner and leaves a terminal tombstone without extending expiry.
- `private.prune_app_retention(as_of timestamptz default now()) -> jsonb`
  deletes rows eligible under the retention windows and returns per-table
  counts. Migration `20260729105030`, applied and pgTAP-verified in isolated
  staging and later applied in production, adds
  `telegram_family_notification_claims_deleted` to that result.
  Candidate migration `20260904120000` additionally proposes expired consent
  cleanup and a `telegram_media_provider_consents_deleted` count; it is not
  production behavior until separately applied and verified.
- `prune_telegram_sessions()` remains as a legacy service-role-only helper for sessions idle more than 30 days.

## Retention windows

Retention cleanup is scheduled through Supabase/Postgres Cron job
`ishonch_prune_app_retention_daily` at `17 20 * * *` (daily 20:17 UTC). The job
runs `select private.prune_app_retention();` and deletes only rows eligible
under the windows below. Migration `20260729105030` updates the called function;
the existing schedule does not need to be recreated. The migration and its
pgTAP passed 10/10 in isolated staging; that restored project lacks `cron.job`,
so schedule parity was not claimed from staging. Production postflight
confirmed the existing job at `17 20 * * *` and the updated function.

- `checks`: 90 days.
- `reports`: terminal states after 365 days; stale `new`/`reviewing` after 180 days.
- `telegram_sessions`: 30 days after last update.
- `private.telegram_media_provider_consents`: candidate ten-minute expiry;
  the clock starts at registration. Consumed/revoked tombstones last only until
  that original `expires_at`, unless a non-older valid prompt registration
  replaces the row earlier; after migration apply, scheduled retention removes
  expired rows.
- `telegram_webhook_updates`: processing up to 7 days, completed approximately
  3 days / `expires_at <= as_of`.
- `rate_limit_buckets`: `expires_at <= as_of` (normally one request window plus a short buffer).
- `embed_origin_events`: 180 days.
- `telegram_reputation_targets`: unconfirmed system/public/unverified observations after 180 days; confirmed rows retained until moderated removal.
- `reputation_appeals`: retained until legal/compliance policy is finalized; contains hashes, masked displays and redacted reason text only.
- `telegram_family_shield`: revoked rows after 30 days; stale pending rows after 7 days; active relationships retained until revoked.
- `private.telegram_family_notification_claims`: `expires_at <= as_of`.

## Privacy model

- Identifiers are hashed into `entity_hash` / `input_hash`.
- Human-visible strings are masked (`display_mask`, `redacted_input`, `redacted_value`).
- OTP/SMS codes, full card numbers, full phones, PINs, labeled passwords,
  recovery phrases, private keys and passport data must be redacted before
  persistence or Telegram publication.
- Screenshots are OCR'd/analyzed in memory and discarded. Telegram report
  screenshots are supported only as transient description evidence after the
  shared media admission check; raw images and decoded QR payloads are not stored.
  In the local P1 candidate, an external Direct-image, Voice or report-image
  provider call additionally requires a fresh exact prompt/chat/kind grant that
  wins the atomic lease-fenced database claim before provider I/O. Report images
  also require the active `reportFlowId`; the whole boundary is polling-only.
  Consent is not stored in `telegram_sessions`; within polling, local QR decoding
  without provider I/O is not an external transfer.
  Web OCR does not use this durable table: its candidate
  `externalProviderConsent=true` is scoped to one HTTP request and is not stored
  as an idempotency claim, so a retry/re-dispatch may transmit the image again.
- Public exposure requires admin moderation.
- Description-only incident reports are useful for review/research, but they do
  not affect public entity reputation.
- Public reputation has a correction/removal path through `/appeal`; appeals are
  stored as hashes and masked display values, not raw targets.
