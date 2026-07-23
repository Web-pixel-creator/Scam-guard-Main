# Recovery and Key Rotation

Operator checklist for Ishonch Guard. A drill must never overwrite production,
print credentials, copy user rows into CI artifacts, or use a destructive
command without a separately approved maintenance window.

## Current recovery contract

- Application rollback unit: one immutable Git commit and its Railway
  deployment/image digest.
- Database change unit: forward-only files in `supabase/migrations/`; repair a
  bad migration with a reviewed follow-up migration unless an approved database
  restore is required.
- Proposed launch target: RPO <= 24 hours with managed daily backups and RTO <=
  4 hours. PITR should replace this with the explicitly purchased recovery
  window before higher-volume launch.
- Current pilot plan: Supabase Free. It has no managed scheduled backups or
  PITR, so the proposed launch RPO is not guaranteed while the project remains
  on Free. Until an upgrade, create an encrypted logical export at least weekly
  and immediately before every approved risky schema or Auth change.
- Supabase documents managed daily backups for paid projects and optional PITR:
  <https://supabase.com/docs/guides/platform/backups>.

## Backup verification

1. In Supabase Dashboard, record plan, backup type, earliest/latest restore
   point and retention. Record metadata only; never attach a backup to the repo.
2. On Free, confirm a successful encrypted logical export exists before every
   risky schema or Auth change. If no approved encrypted offsite destination is
   available, record the recovery gate as open and do not claim the target RPO.
3. When a portable logical export is required, use an authorized operator shell
   and `supabase db dump`/`pg_dump`; store the encrypted output outside GitHub,
   Codex logs and the workspace. Do not pass a database password on the command
   line or paste it into an issue.
4. Include schema, roles and data in the inventory, and separately record any
   non-database asset store. Ishonch Guard currently persists no user screenshots
   in Supabase Storage.
5. Retain an owner, creation time, expiry, encryption/key owner and restore-test
   date for each export.

## Non-production restore drill

1. Create an isolated staging/duplicate project with no production Telegram,
   moderation, email or webhook credentials.
2. Restore the selected backup there. A local Supabase restore is inspection
   evidence only and is not a production replacement:
   <https://supabase.com/docs/guides/local-development/restoring-downloaded-backup>.
3. Apply any migrations newer than the restore point, then run schema lint,
   pgTAP, application tests and a production build.
4. Verify count-only invariants: Auth users, roles, allowlist, reports by status,
   appeals, checks, Telegram sessions/lifecycle rows and retention jobs. Do not
   export identifiers or matched secret values.
5. Run app/RLS/admin/report/appeal/Telegram smokes against the isolated project;
   disable all real outbound integrations.
6. Destroy the staging copy only after the evidence record contains the backup
   timestamp, restore duration, migration head, invariant counts and cleanup
   owner. The destructive cleanup itself requires operator approval.

## Application rollback drill

1. Record current commit, Railway deployment id, image digest and database
   migration head.
2. Select the latest previously successful deployment compatible with the
   current schema. Do not roll application code behind an incompatible
   forward-only migration.
3. Redeploy that immutable Railway artifact in a maintenance window, then run
   `/healthz`, `prod:smoke`, `prod:security-smoke`, polling leader and production
   monitor checks.
4. Redeploy the current release and repeat the same checks. Record both
   directions and elapsed recovery time.
5. Telegram rollback from polling to webhook follows the fenced procedure in
   `DEPLOYMENT.md`; never use `drop_pending_updates=true`.

## Key rotation matrix

| Secret                          | Safe rotation order                                                                                                                                      | Required verification                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY` / fallback key | Create new provider key, update Railway/GitHub consumers, verify primary/fallback, then revoke old key.                                                  | AI monitor 200 plus deterministic no-key/429/5xx fallback tests.                                                     |
| `TELEGRAM_WEBHOOK_SECRET`       | Generate a new high-entropy value, update Railway and GitHub monitor in one window, restart, then remove the old value.                                  | Missing secret 401, valid secret expected 503 in polling, leader 200, monitor green.                                 |
| `TELEGRAM_BOT_TOKEN`            | Rotate in BotFather, update every Railway/GitHub consumer, restart polling without dropping updates, then verify the old token is rejected.              | `getMe`, pending queue, leader health, approved QA chat dispatch and cleanup.                                        |
| Supabase service/secret key     | Use the Supabase Dashboard rotation workflow and overlap keys only when the platform supports it; update Railway and operator tooling before revocation. | App/RLS/security/admin smokes and no service key in client bundle/logs.                                              |
| Supabase publishable key        | Rotate through the Dashboard, update server and `VITE_*` build variables, rebuild the client, then revoke the old key.                                   | Login, public check/report/appeal and RLS-deny checks.                                                               |
| `HASH_PEPPER_SECRET`            | **Not safely rotatable today.** A direct replacement changes every deterministic identifier hash.                                                        | First implement versioned pepper ids, dual-read/new-write and a privacy-reviewed backfill; only then drill rotation. |

Every rotation record contains only secret name, owners, timestamps, consumer
list, validation run ids and revocation confirmation. It never contains values.

## Supabase Auth hardening gate

Before public launch, an authorized Dashboard operator must verify and record:

- leaked-password protection enabled (available on Pro and above);
- minimum password length at least 12 and digits/lowercase/uppercase/symbols
  required;
- email confirmation enabled;
- recent authentication required for password changes;
- admin accounts enrolled in MFA or an equivalent separately approved control;
- recovery and redirect URLs restricted to owned HTTPS origins.

Supabase documents password-strength and leaked-password settings here:
<https://supabase.com/docs/guides/auth/password-security>. Existing users may
need to replace weak passwords after the policy is strengthened, so capture the
user-support plan before enabling the gate.

## Evidence required to close the release gates

- one successful isolated restore and application rollback/return drill;
- measured RPO/RTO and named owners;
- one rotation drill for AI, Telegram webhook and one Supabase key class;
- a design and tested migration path for versioned hash-pepper rotation;
- count-only evidence that leaked-password protection and Auth policy are on;
- no credential values or production user data in evidence artifacts.
