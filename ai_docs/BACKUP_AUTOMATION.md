# Backup Automation (Supabase Free pilot)

Implemented 2026-08-25. This document describes the automated encrypted
backup loop that closes the highest-severity recovery gap while the project
remains on Supabase Free (no managed backups, no PITR). It follows the
recovery contract in `RECOVERY_AND_KEY_ROTATION.md` and the decision recorded
in `DECISIONS.md` (2026-08-25).

## What runs automatically

| Workflow | Schedule (UTC) | What it does |
| --- | --- | --- |
| `Supabase Encrypted Backup` (`.github/workflows/backup.yml`) | daily 03:00, plus manual dispatch | logical `pg_dump` of `public`, `auth` and `storage` schemas, encrypts with AES-256-CBC/PBKDF2 (600k iterations), uploads one encrypted artifact with 90-day retention, then a separate read-back job downloads, decrypts and checksum-verifies it |
| `Backup Restore Drill` (`.github/workflows/backup-restore-drill.yml`) | Saturdays 05:00, plus manual dispatch | downloads the latest successful backup artifact, decrypts, restores it into an isolated throwaway PostgreSQL container matching the dump version, and prints count-only invariants to the job summary |

Both workflows fail loudly when required secrets are missing. A failed
scheduled run is the failure alert: keep GitHub watch notifications enabled
for this repository.

## One-time enablement (owner)

1. Generate a long random passphrase (for example `openssl rand -base64 32`).
   Store it in the owner password manager.
2. Add repository secrets:
   - `SUPABASE_DB_URL` — the Supabase **session pooler** connection string
     (IPv4-reachable from GitHub runners; the direct `db.<ref>.supabase.co`
     host may be IPv6-only). Use the read-capable `postgres` role.
   - `BACKUP_ENCRYPTION_PASSPHRASE` — the passphrase from step 1.
3. Trigger `Supabase Encrypted Backup` once via `workflow_dispatch` and
   confirm both jobs pass.
4. Trigger `Backup Restore Drill` once and confirm the invariant summary.

Never commit either value. The dump itself is never written to the repository,
workspace or logs; only the encrypted artifact leaves the runner.

## Guarantees and honest limits

- Proven automatically, every day: the dump exists, contains
  `CREATE TABLE auth.users` and at least one `CREATE TABLE`, the encrypted
  artifact downloads, decrypts and matches the original checksum.
- Proven weekly: the latest artifact restores into a clean PostgreSQL of the
  matching major version with `ON_ERROR_STOP=1`, and count-only invariants
  (auth users, checks, reports, entities, user roles, admin allowlist,
  reputation appeals) are printed. No identifiers are exported.
- Not covered by the dump: database roles (application authorization lives in
  `public.user_roles` and Supabase Auth, not in login roles), Supabase
  internal schemas, and any storage objects (Ishonch Guard persists no user
  screenshots in Supabase Storage). Extensions are recreated by the restore
  drill from the dump's `CREATE EXTENSION` statements against the PostgreSQL
  contrib set.
- The artifact retention is 90 days; older restore points expire. Download the
  latest artifact monthly into owner custody for a second, independent
  offsite copy if longer history is wanted.
- A logical snapshot proves recoverability of one point in time. It does not
  provide PITR and does not meet the launch RPO target while the project stays
  on Supabase Free; that remains an explicit pilot risk acceptance.

## Manual restore procedure (owner)

1. Download the latest `supabase-backup-*` artifact from a successful run.
2. Decrypt:
   `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in backup.sql.enc -out backup.sql -pass pass:<passphrase>`.
3. Restore into an isolated PostgreSQL (never into production):
   `psql -v ON_ERROR_STOP=1 -f backup.sql`.
4. Apply migrations newer than the restore point, then follow the
   non-production restore drill in `RECOVERY_AND_KEY_ROTATION.md` (schema
   lint, pgTAP, count-only invariants, isolated smokes, evidence record,
   approved destructive cleanup).
