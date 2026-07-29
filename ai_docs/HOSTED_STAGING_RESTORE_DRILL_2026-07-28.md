# Hosted Staging Restore Drill

Status: v2 functional restore/service verification passed in isolated staging.
Direct same-client AAL1/AAL2 PostgREST proof also passed after the 2026-07-29
hardening migration. Complete RPO/RTO evidence is not closed. Staging is
retained pending separate operator approval for deletion.

This runbook records the functional hosted-service restore result without
changing production. It does not convert incomplete schema timing/error
evidence into an RTO measurement or a Free-plan snapshot into an RPO SLA.
Creating the external Supabase project, restoring data and deleting the staging
project each require explicit operator approval. No Railway deployment or real
Telegram QA is part of this drill.

## Verified starting point

- Source snapshot:
  `ishonch-guard-production-20260726-1139-restore-ready-v2.efs.zip`.
- SHA-256:
  `35889f4a8a90c216a4e94f00a761c27f9934b057755e3abd7af8ca3617b1b8ea`.
- Manifest format: `supabase-logical-portable-v2`.
- Source migration head: `20260726090000`.
- The archive contains only `roles.sql`, `schema.sql`, `data.sql` and
  `manifest.json`.
- Clean local restore, schema lint and pgTAP already passed. This document does
  not replace that evidence; it adds the hosted Auth/PostgREST/RLS service
  boundary that a local database alone cannot prove.

The hosted target must be a newly created, isolated project. The production
project reference is never a valid target.

## Free-plan gate

Supabase Free currently permits two active projects across organizations where
the operator is an Owner or Admin. A second hosted staging project can therefore
remain free only if an active-project slot is available. Free projects may
pause after low activity and do not include managed scheduled backups or PITR.

Read-only Dashboard verification on 2026-07-28:

- organization plan: Free;
- production project `scam-guard`: active, `AWS | ap-southeast-2`;
- second existing project: paused, `AWS | eu-north-1`;
- current Free usage displayed 29 MB / 500 MB database, 83 MB / 5 GB egress,
  2 / 50,000 monthly active users and 0 GB / 1 GB file storage;
- because the second project is paused, one active Free-project slot is
  available for this temporary staging drill.

No project, paid resource or configuration change was created during this
verification.

Approved staging creation on 2026-07-28:

- project name: `ishonch-guard-restore-drill`;
- project reference: `gwwcooupkmhihaigympb`;
- plan/compute: Free / nano;
- region: `AWS | ap-southeast-2` (Oceania, Sydney);
- initial status: Healthy;
- Data API enabled, automatic exposure of new tables disabled, automatic RLS
  creation trigger disabled;
- no GitHub repository, migration, backup, Edge Function, Storage file or
  application deployment was attached during creation.

The initial staging database password became visible in the Dashboard's
technical page representation during post-submit verification. Treat it as
compromised even though it was not copied into a file or repeated in evidence.
Rotate the staging-only database password in Dashboard before any connection or
restore. The replacement must be entered by the operator and must never be read,
printed or stored by the agent.

The operator completed that staging-only database-password rotation on
2026-07-28. The Dashboard dialog closed, the page recorded a successful HTTP
`201`, and the operator confirmed pressing the reset action. The replacement
value was not read, printed or stored by the agent. The password-rotation gate
is closed; no database connection or restore had been attempted before it.

The operator separately approved restoring the v2 archive into this staging
project on 2026-07-28. This approval does not authorize a production change,
Railway deployment, real Telegram traffic or later deletion of staging.

Hosted restore execution on 2026-07-28:

- target guard: database `postgres`, role `postgres`, project-ref-specific
  Session pooler user `postgres.gwwcooupkmhihaigympb`;
- server: PostgreSQL `17.6` (`server_version_num=170006`);
- fresh baseline: zero Auth users, Storage buckets/objects and application
  relations;
- `roles.sql` completed;
- the schema client crossed its 120-second evidence timeout after reaching the
  final grant section. The short-lived container subsequently exited, so its
  complete stderr classification log was not retained;
- before resuming, an exact catalog guard confirmed 15/15 application tables,
  RLS on 15/15 tables, 26/26 application functions, 14/14 application policies,
  the required allowlist trigger and zero application rows;
- `data.sql` then ran separately with the manifest-required
  `session_replication_role=replica`; duration 24,990 ms, exit code zero and
  zero SQL errors;
- the database credential was passed only through process memory and cleared
  from the environment and clipboard after the run.

Because the complete first schema stderr log was lost at the client timeout,
the original per-error schema classification evidence is incomplete. Do not
hide or reinterpret this gap. The exact post-schema catalog guard and the
remaining database/RLS/service tests provide independent result validation,
but a future fresh hosted restore should use a timeout above five minutes and
retain sanitized per-phase evidence before claiming a fully reproducible
error-classification record.

Before creation:

1. sign in to Supabase Dashboard;
2. count active projects across all owned/administered organizations;
3. stop if two active Free projects already exist;
4. keep the new project on Free and decline any paid compute, backup or PITR
   option;
5. use the same region as production when available, but verify it in Dashboard
   rather than guessing.

References:

- <https://supabase.com/pricing>
- <https://supabase.com/docs/guides/platform/billing-on-supabase>
- <https://supabase.com/docs/guides/platform/free-project-pausing>

## Isolation contract

The staging project receives production-derived database rows and is therefore
sensitive even though it is temporary.

- Do not deploy a second Railway service. Run the built application locally
  against hosted staging.
- Do not copy production Telegram, AI, reputation-provider, SMTP or hash-pepper
  secrets.
- Do not register a webhook, start polling, send a moderation alert, request an
  email or message a real user.
- Do not test login with either restored production account.
- Do not copy the production JWT secret. Existing production sessions must
  remain invalid in staging.
- Do not print emails, user ids, Telegram ids, hashes, MFA secrets, tokens or
  database credentials in logs or evidence.
- Use synthetic `example.invalid` identities and high-range synthetic Telegram
  ids for write-path checks, then delete them and verify absence.
- Keep the project only until the evidence record is complete. Deletion is a
  separate destructive action and requires operator approval.

### Local application environment

Use an untracked, temporary environment with the staging project's own URL,
publishable key and service-role key:

```dotenv
SUPABASE_URL="<staging-url>"
SUPABASE_PUBLISHABLE_KEY="<staging-publishable-key>"
SUPABASE_SERVICE_ROLE_KEY="<staging-service-role-key>"
HOSTED_STAGING_PROJECT_REF="gwwcooupkmhihaigympb"
VITE_SUPABASE_PROJECT_ID="<staging-project-ref>"
VITE_SUPABASE_URL="<staging-url>"
VITE_SUPABASE_PUBLISHABLE_KEY="<staging-publishable-key>"

TELEGRAM_UPDATE_DELIVERY_MODE="disabled"
TELEGRAM_BOT_USERNAME="staging_disabled"
REQUIRE_ADMIN_MFA_AAL2="true"
PUBLIC_APP_URL="http://127.0.0.1:3100"

URLHAUS_ENABLED="false"
URL_REPUTATION_PROVIDERS=""
TRUST_PROXY_IP_HEADERS="false"
```

All of the following must be absent:

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
  `TELEGRAM_MODERATION_CHAT_ID`, `TELEGRAM_QA_CHAT_ID`;
- `OPENAI_API_KEY`, every `OPENAI_FALLBACK_*`, every `OPENAI_TTS_*`,
  `GEMINI_TTS_API_KEY`, `GOOGLE_TTS_API_KEY`;
- `GOOGLE_SAFE_BROWSING_KEY`, `GOOGLE_SAFE_BROWSING_API_KEY`,
  `URLHAUS_AUTH_KEY`, `PHISHTANK_API_KEY`;
- production `HASH_PEPPER_SECRET`, `HASH_PEPPER_ACTIVE_SECRET` and
  `HASH_PEPPER_PREVIOUS_SECRET`.

Generate two new staging-only random peppers in memory. Use one as
`HASH_PEPPER_ACTIVE_SECRET` with active version `v2`, and the other as the
legacy `HASH_PEPPER_SECRET`. This proves version-aware synthetic writes without
making production hashes searchable. Historical hash-match lookup is explicitly
outside this drill.

The staging ref and both Supabase URLs must agree with
`HOSTED_STAGING_PROJECT_REF`. Linked migration commands use only the repository
guard wrapper. It hard-blocks the known production ref and requires an explicit
`--confirm-project-ref=gwwcooupkmhihaigympb`; raw linked list/push commands are
not an approved operator path.

The code boundary was inspected before execution:

- `TELEGRAM_UPDATE_DELIVERY_MODE=disabled` prevents the polling supervisor from
  starting;
- with valid Telegram secrets, the Telegram webhook returns `503` before
  dispatch when delivery is disabled; with secrets deliberately absent it
  fails closed earlier with `401`;
- missing moderation chat id prevents moderation delivery;
- missing AI and URL-reputation credentials leaves deterministic scoring active
  without provider calls;
- the restored `pg_cron` job runs only
  `private.prune_app_retention()` inside the database.

Public Telegram metadata and public-post enrichment can still perform network
lookups when deliberately invoked. Do not use Telegram usernames or public-post
URLs in hosted staging smokes.

## Project configuration before restore

After creation and before any Auth request:

1. record only project reference, region, plan and creation time;
2. keep external OAuth providers disabled;
3. disable public signups for the duration of the drill;
4. do not configure custom SMTP;
5. set Auth Site URL and the only additional redirect URL to the local drill
   origin if an interactive synthetic Auth check is required;
6. confirm there are no Edge Functions, database webhooks or Storage files;
7. record extension state and compare it with the source manifest/migrations.

Restored Auth rows include password hashes and MFA records. A manual logical
restore does not copy the source project's encryption root key or JWT secret.
Therefore restored sessions must be treated as invalid and restored MFA factors
must not be used as the functional Auth test. Use a new synthetic staging-only
account and factor instead.

Dashboard isolation verification on 2026-07-28:

- global Auth signup disabled; anonymous sign-ins, manual linking, external
  OAuth, SAML and Web3 providers disabled;
- Email provider remains enabled for existing accounts, confirmation remains
  enabled, and custom SMTP is disabled;
- no Edge Functions and no Storage buckets/files;
- no third-party integrations; only the default Supabase Data API and Vault
  integrations are installed;
- Session pooler target verified as
  `aws-0-ap-southeast-2.pooler.supabase.com:5432`, database `postgres`, user
  `postgres.gwwcooupkmhihaigympb`.

## Restore procedure

Use PostgreSQL 17 client tools and the Session pooler connection string from the
new project's Connect dialog. The operator enters the new staging database
password directly into a hidden local prompt; it must not appear in a command,
chat, document or saved script.

The v2 manifest's `singleTransaction` instruction applies to the already
completed clean local reconstruction. A new hosted Supabase project already has
platform-managed `auth` and `storage` schemas. The v2 schema intentionally
contains full `CREATE SCHEMA`/`CREATE TABLE` definitions for those schemas, so a
single hosted `ON_ERROR_STOP` transaction would abort at the first expected
collision.

For hosted staging only:

1. verify the connection target by project reference, database name and region;
2. save count-only baseline facts for the empty new project;
3. run `roles.sql`, `schema.sql` and `data.sql` as three separately logged
   phases using the official Dashboard-backup restore behavior;
4. keep SQL logs outside the repository and encrypted at rest;
5. classify every SQL error. Existing-object/duplicate platform bootstrap
   collisions in `auth` or `storage` may be expected; an error involving an
   Ishonch Guard `public`/`private` object, permissions, missing columns,
   foreign keys or a failed application `COPY` is not expected;
6. do not declare success from the `psql` exit code alone;
7. stop before application access if any unexpected error remains.

Supabase documents that full logical backups may report existing-object errors
on a newly provisioned project's default `auth` and `storage` schemas:

- <https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore>
- <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>

Do not use `supabase db reset --linked` as a shortcut. It is a destructive remote
reset and is unnecessary for this evidence run.

## Database and service gates

Record only pass/fail, duration, migration head and counts.

1. Confirm the expected app schemas, tables, views, functions, triggers, grants
   and RLS policies exist.
2. The restored snapshot head was `20260726090000`. Only the reviewed
   `20260729105030` and `20260729131000` migrations were then applied through
   explicit staging SQL Editor transactions. The guarded official repair later
   recorded exactly those two versions; the post-repair list matches local
   history and guarded `db push --dry-run` reports no pending migration.
3. Run schema lint and every pgTAP file. The original hosted result was 53/53;
   the later Family-retention pgTAP passed 10/10 and the admin-AAL2 pgTAP passed
   in the same restored staging database.
4. Compare count-only invariants:

   | Invariant          | Expected |
   | ------------------ | -------: |
   | Auth users         |        2 |
   | Admin allowlist    |        2 |
   | User roles         |        4 |
   | Checks             |      235 |
   | Reports            |        8 |
   | Entities           |        7 |
   | Appeals            |        2 |
   | Family Shield rows |        7 |
   | Reputation targets |        9 |
   | Telegram sessions  |        4 |

Hosted post-data counts on 2026-07-28 matched all ten expected invariants
exactly: `2, 2, 4, 235, 8, 7, 2, 7, 9, 4` in the table order above.

Hosted database verification on 2026-07-28:

- catalog guard: 15/15 application tables with RLS enabled, 26/26 application
  functions, 14/14 application policies and both required Auth triggers;
- pgTAP extension enabled in the isolated staging project;
- `admin_role_lifecycle.test.sql`: 18/18, zero failures, 10,686 ms;
- `telegram_update_lifecycle.test.sql`: 35/35, zero failures, 11,976 ms;
- the Telegram lifecycle test now removes the restored polling-leader row only
  inside its test transaction. Its `ROLLBACK` was verified to restore the
  original single row and fence value unchanged;
- Supabase CLI `2.104.0` schema lint for `public,private`: exit code zero and
  `No schema errors found`;
- the portable logical archive correctly contained no Supabase CLI migration
  history table. After comparing the repository's exact 31 migration versions
  and rejecting unexpected remote versions, official
  `supabase migration repair --status applied` recorded all 31 already-restored
  versions without replaying migration SQL;
- repaired migration history: 31 versions, first `20260528182724`, head
  `20260726090000`;
- final count invariants remained exactly
  `2, 2, 4, 235, 8, 7, 2, 7, 9, 4`.

These are historical results for migration head `20260726090000`. The two
2026-07-29 migrations were later applied and pgTAP-verified in the retained
staging database. Their guarded official migration-history repair is now
complete. Keep the historical counts above unchanged and record the later
function/policy/pgTAP and same-client HTTP evidence separately.

The database password existed only in the operator clipboard and process
environment. The successful verifier cleared both and did not return the
credential to the clipboard.

5. Run the Supabase/RLS portion of `npm run prod:security-smoke` against staging
   without a public app URL.
6. Verify anonymous reads/writes remain denied, service-role count access works,
   admin roles match confirmed allowlist eligibility, and maintenance/stat RPCs
   remain unavailable to anonymous clients.
7. Run bounded synthetic report, appeal, admin moderation, Family Shield and
   hash-version checks. Transport must remain disabled; verify cleanup by
   reading every synthetic marker back as absent.
8. Create one synthetic confirmed `example.invalid` Auth user through the Admin
   API without sending email. Add temporary allowlist eligibility, verify admin
   projection, enroll and verify a new staging-only TOTP factor, obtain AAL2 and
   exercise one read-only protected admin action. Before TOTP, use that same
   ordinary user client to prove the private fixture is absent/denied through
   PostgREST; after TOTP, prove the same client reads exactly the fixture. A
   service-role read is not evidence for this boundary.
9. Remove the synthetic factor, user, allowlist row, role and related audit
   rows; verify all are absent.
10. Re-run count-only invariants. They must return to the restored baseline.

The restored production users and MFA factors are count evidence only. A
successful synthetic TOTP flow proves the hosted Auth/MFA service path without
using a real account or requiring the source encryption root key.

Hosted service verification on 2026-07-28:

- `prod:security-smoke` completed with every anonymous read/write and privileged
  RPC boundary in the expected state;
- service-role counts matched the restored baseline, confirmed allowlist/admin
  projection had no drift, and both synthetic rate-limit rows were removed;
- dedicated `staging:service-smoke` used an exact staging-project guard and
  fresh in-memory `legacy`/`v2` peppers;
- deterministic high-risk checking, report submission, appeal submission,
  admin moderation/audit, Family Shield create/accept/revoke, and active `v2`
  hash-version writes all passed;
- cleanup was verified by exact HMAC and high-range synthetic identifiers;
  final application counts returned to
  `2, 2, 4, 235, 8, 7, 2, 7, 9, 4`;
- dedicated `staging:mfa-smoke` created one confirmed
  `example.invalid` Auth user through the Admin API without email delivery;
- temporary allowlist eligibility projected both `user` and `admin` roles;
- the application-level protected admin gate rejected the AAL1 token and
  staging-only TOTP verification upgraded the session to AAL2. The final
  read-only database count used service role, so this historical run did not
  prove direct user-client PostgREST denial/allow behavior;
- the factor, session, Auth user, allowlist row and cascaded roles were removed;
  Auth users, allowlist and role counts returned to `2`, `2` and `4`;
- staging API keys and TOTP material were held only in process memory. Secret
  values were not printed or written to the repository.

## 2026-07-29 hardening validation

The operator approved continuing against the retained isolated staging project
`gwwcooupkmhihaigympb`. Production, Railway, Telegram delivery and paid AI
providers were not touched.

- Applied `20260729105030_family_notification_claim_retention.sql` first and
  `20260729131000_admin_mfa_aal2_rls.sql` second through Dashboard SQL Editor.
  Each exact file ran in its own explicit transaction with a 5-second lock
  timeout and 60-second statement timeout.
- Source SHA-256 values were
  `0720b1885fc25f1feef815b0157399b7dbb5c320608691561fbb9358b5859741`
  for retention and
  `4ece19feeeb38a9f01c48608fafe2e76a28756b48a0009131061754b97083ff7`
  for the final admin-AAL2 migration.
- Hosted retention pgTAP passed 10/10. Hosted admin-AAL2 pgTAP initially exposed
  two pre-release test/runtime defects: a nested `private.has_role()` lookup
  failed because later hardening intentionally closes `private` schema usage,
  and five data-modifying CTE assertions were not top-level. The helper now
  reads `public.user_roles` directly under RLS, no schema grant was broadened,
  the CTEs are top-level, and the final exact pgTAP file passed 23/23, including
  denial for an AAL2 authenticated user without the admin role.
- The final catalog postflight passed 12/12: retention body/result key,
  SECURITY DEFINER/search path, AAL2 inline role/JWT predicate,
  SECURITY INVOKER/stability/empty search path, all seven protected policies,
  both UPDATE `WITH CHECK` clauses, function ACLs, five RLS-enabled tables,
  closed `private` schema usage and zero remaining test fixtures.
- Dashboard SQL Editor did not update
  `supabase_migrations.schema_migrations`. The fixed staging-only guard verified
  the linked/env/manual project refs, the exact applied-version acknowledgement
  and LF-normalized SHA-256 for both regular files before invoking official
  `supabase migration repair`. It recorded only `20260729105030` and
  `20260729131000` as applied; no manual history insert was used.
- The post-repair migration list fully matched local history. Guarded
  `db push --dry-run` returned `Remote database is up to date`, so no ordinary
  `db push` ran.
- This restored staging project currently has no `cron.job` relation. The
  retention function is verified, but the production cron schedule is not
  staging-parity evidence.
- The revised real HTTP/PostgREST smoke passed with the same ordinary user
  client before and after TOTP: the protected direct read was denied/hidden at
  AAL1 and returned exactly one fixture at AAL2. The synthetic factor, Auth
  user, allowlist row, projected roles and protected fixture were deleted;
  final Auth/allowlist/role counts returned to `2, 2, 4`. Staging API keys and
  generated MFA material were held only in process memory and were not printed
  or written to the repository.

## Application gates

With outbound credentials absent and Telegram delivery disabled:

1. run the full repository test suite;
2. run TypeScript, lint, production build and `npm audit`;
3. start the production build locally on `127.0.0.1:3100`;
4. verify `/healthz`, homepage, login, report, appeal, admin denial and synthetic
   admin AAL2 access against hosted staging;
5. verify `/api/telegram/webhook` cannot dispatch and polling never starts;
6. do not run any `prod:telegram-*`, `telegram:*`, `moderation:smoke`,
   `tts:smoke` or `--live-telegram` command.

Executed results:

- the full local repository suite passed: `160` files and
  `12,780 / 12,780` tests;
- `npx tsc --noEmit` passed;
- ESLint passed with zero errors and eight existing React Fast Refresh
  warnings;
- the production build passed. Its only diagnostics were non-blocking
  dependency/tree-shaking notices and the existing large-chunk warning;
- `npm audit --audit-level=high` reported zero vulnerabilities;
- targeted Prettier checks passed for every file changed by this drill. The
  repository-wide check still reports twenty older, unrelated Markdown files;
  this pre-existing formatting debt was not rewritten as part of the restore;
- the locally built application returned `200` for `/healthz`, `/`, `/login`,
  `/report`, `/appeal` and the `/admin` shell;
- after the client-side access check, an anonymous `/admin` visit redirected
  to `/login` without exposing protected data;
- both `/` and `/admin` were checked at `320`, `375`, `390`, `768`, `1024`,
  `1280`, `1440` and `1920` CSS pixels. All sixteen measurements had no
  horizontal overflow;
- an unauthenticated synthetic webhook POST failed closed with `401
unauthorized` before body dispatch because Telegram secrets were absent;
- runtime logs contained no polling start, no `api.telegram.org` access and no
  fatal or uncaught error;
- the historical staging MFA smoke proved application AAL1 denial and TOTP/AAL2
  upgrade, but not the direct PostgREST boundary. After migration
  `20260729131000`, the revised hosted smoke proved that boundary with the same
  client at AAL1 and AAL2 and completed exact cleanup. The local browser check
  deliberately did not recreate another Auth user;
- no live Telegram, paid AI, reputation-provider or moderation-delivery smoke
  was run.

No visual release or design change is part of this drill.

## Evidence and completion

The evidence record must contain:

- source archive timestamp and SHA-256;
- target project reference, Free plan and region;
- restore start/end time and per-phase duration;
- sanitized expected/unexpected SQL error counts;
- migration head;
- database/RLS/Auth/application gate results;
- before/after count-only invariants;
- synthetic cleanup verification;
- operator responsible for eventual project deletion.

The 2026-07-28 evidence is sufficient for functional hosted restore/service
validation, but it does not contain a complete schema error log, complete
per-phase timing, an RPO basis or measured RTO. A future fresh restore must
retain those fields before the DR timing gate is closed. Railway rollback/return,
and the production MFA factor-reset recovery rehearsal remain separate approved
operations.

The staging project was deliberately retained after verification. Its eventual
deletion remains the project operator's responsibility and requires a separate
explicit approval; this drill does not authorize it.
