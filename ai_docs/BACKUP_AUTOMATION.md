# Backup Automation (Supabase Free pilot)

Workflow files merged 2026-08-26. Operational status:
**NOT ENABLED / NOT VERIFIED**. The independent audit found zero backup runs,
zero restore-drill runs, zero backup artifacts and no required backup
credentials. This file describes a candidate loop; it does not close the
recovery gap or prove a daily RPO while the project remains on Supabase Free (no
managed backups, no PITR).

The names and AES/PBKDF2 details below describe the unverified PR #133 candidate
only. A separate backup-hardening track is replacing the crypto/credential
contract; do not provision secrets from this document until that final infra
diff is merged and this runbook is reconciled to it.

## Candidate behavior after approval and activation

| Workflow                                                              | Schedule (UTC)                                  | What it does                                                                                                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Supabase Encrypted Backup` (`.github/workflows/backup.yml`)          | candidate daily 03:00, plus manual dispatch     | currently proposes a logical `pg_dump` of `public`, `auth` and `storage`, AES-256-CBC/PBKDF2 encryption, a 90-day artifact and checksum read-back; this path has not run successfully |
| `Backup Restore Drill` (`.github/workflows/backup-restore-drill.yml`) | candidate Saturdays 05:00, plus manual dispatch | currently proposes download/decrypt/restore into ordinary PostgreSQL plus count-only invariants; this path has not run and is not Supabase restore proof                              |

Both workflows are designed to fail when required secrets are missing. No
scheduled or manual execution exists yet, so the failure-alert path itself is
also unverified.

## Activation gate — do not add production secrets yet

1. Replace or independently validate the raw `pg_dump public+auth+storage`
   approach against Supabase's supported migration/restore sequence. The
   current ordinary `postgres:<major>` restore cannot by itself prove that
   Supabase-managed Auth/Storage objects will restore correctly. Supabase's
   documented path separates roles, schema and data with `supabase db dump`;
   see <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>.
2. Rehearse the revised export/read-back/restore against an approved
   non-production Supabase target and retain run ids, artifact identity,
   count-only invariants, cleanup and timing evidence.
3. Treat the sole-owner `main` ruleset with `0` approvals as an interim
   integrity control only. It does **not** protect a secret-consuming backup
   workflow from an unreviewed change by the same owner and is not an eligible
   credential gate.
4. Before adding a production database credential or backup decryption identity,
   implement and prove one of these controls:
   - add a second independent trusted reviewer with verified recovery access;
     make backup workflow paths owned by `CODEOWNERS`, require at least one
     approval with stale approvals dismissed on push, and require code-owner
     review with no bypass; or
   - scope every secret-consuming backup job and credential to a protected
     environment that requires trusted manual approval before the job can read
     secrets. Enable prevent-self-review and disable bypass for this gate. A
     scheduled run will wait for approval, so this path is manual-gated and must
     not be described as an unattended daily backup or proven 24-hour RPO.
5. In a separately approved canary restart window, provision only the minimum
   production database credential and backup encryption/decryption identity
   required by the final reviewed hardening workflow. Use its final secret
   names and custody model; do not provision the obsolete PR #133 passphrase
   contract from this historical candidate.
6. Trigger `Supabase Encrypted Backup` once via `workflow_dispatch` and confirm
   both jobs pass.
7. Trigger `Backup Restore Drill` once and confirm the invariant summary.
8. Only after the protection gate, both runs and retained evidence pass may this
   document change status from `NOT ENABLED / NOT VERIFIED`.

Never commit any credential or decryption identity. The current jobs create plaintext SQL transiently in
the ephemeral runner workspace during export, read-back and restore. It must
never be uploaded, logged or committed and must be removed on every success and
failure path; failure-path cleanup still requires hardening. The encrypted
artifact itself contains sensitive production rows and must be handled as such.

## Intended checks and honest limits

- **Not yet proven.** The candidate daily job intends to prove that a dump
  exists, contains
  `CREATE TABLE auth.users` and at least one `CREATE TABLE`, the encrypted
  artifact downloads, decrypts and matches the original checksum.
- **Not yet proven.** The candidate weekly job intends to show that the latest
  artifact restores into a clean PostgreSQL of the
  matching major version with `ON_ERROR_STOP=1`, and count-only invariants
  (auth users, checks, reports, entities, user roles, admin allowlist,
  reputation appeals) are printed. No identifiers are intended to be printed
  in the job summary; the encrypted artifact still contains production rows and
  identifiers.
- The current raw dump/restore design omits database roles, migration-history
  and platform configuration, and it does not include Storage objects. It has
  not proven Supabase Auth/Storage portability. Application authorization also
  lives in `public.user_roles` and Supabase Auth, not only in login roles.
  Extension recreation against ordinary PostgreSQL is unverified.
- The artifact retention is 90 days; older restore points expire. Download the
  latest artifact monthly into owner custody for a second, independent
  offsite copy if longer history is wanted.
- A logical snapshot proves recoverability of one point in time. It does not
  provide PITR and does not meet the launch RPO target while the project stays
  on Supabase Free; that remains an explicit pilot risk acceptance.

## Restore procedure status

There is no approved automated-artifact restore runbook yet. The obsolete PR
#133 AES/passphrase commands must not be used after the hardening track changes
the crypto and credential contract. The final infrastructure PR must update
this section with its verified decrypt command, Supabase-compatible
roles/schema/data restore order, failure cleanup and count-only evidence. Until
then follow only the separately approved non-production procedure in
`RECOVERY_AND_KEY_ROTATION.md`; never restore this candidate into production.
