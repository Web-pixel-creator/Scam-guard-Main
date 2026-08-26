# Backup Automation (Supabase Free pilot)

Status: **HOLD candidate, not enabled and not restore-proven**. The workflows
exist in this branch for review. Do not add credentials until the workflow
trust boundary and required-review rules for the whole `.github/workflows/`
are enforced. A zero-approval ruleset and the CODEOWNERS file alone do not
satisfy this gate. Before secrets are added, either a second independent
trusted reviewer must be enrolled with required CODEOWNER approval (at least
one approval and stale-approval dismissal), or a protected GitHub Environment
with manual approval must gate every secret-bearing job. A protected
Environment also means scheduled runs wait for approval; that tradeoff must be
accepted explicitly.

Supabase recommends that Free projects regularly export with `supabase db
dump` and keep off-site copies. The current official logical migration format
is three files: roles, schema and data. This candidate follows that format
instead of running raw `pg_dump` against the managed `auth` and `storage`
schemas.

Official references:

- <https://supabase.com/docs/guides/platform/backups>
- <https://supabase.com/docs/guides/deployment/ci/backups>
- <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>
- <https://supabase.com/docs/reference/cli/supabase-db-dump>
- <https://github.com/supabase/cli/releases/tag/v2.104.0>
- <https://github.com/FiloSottile/age/releases/tag/v1.3.1>

## Workflow design

| Workflow                                                              | Schedule (UTC)                            | Boundary                                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Supabase Encrypted Backup` (`.github/workflows/backup.yml`)          | HOLD: manual only; planned daily 03:17    | pinned Supabase CLI exports roles/schema/data plus migration history and the reviewed managed-schema hook; the privacy-safe bundle is encrypted to a code-pinned age recipient, retained for 90 days and separately read back |
| `Backup Restore Drill` (`.github/workflows/backup-restore-drill.yml`) | HOLD: manual only; planned Saturday 05:23 | accepts only a successful main-branch artifact no older than 36 hours, authenticates it with age, restores into a pinned Supabase-local database and emits only PASS/FAIL assertions                                          |

Both cron triggers stay disabled in this HOLD candidate. The reviewed
enablement PR may add the documented non-zero-minute schedules only after all
approval, Environment, recipient, freshness-monitor and first-proof gates are
ready; known-red scheduled runs would weaken the monitoring signal.

The export uses the official commands:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql --keep-comments
supabase db dump --db-url "$SUPABASE_DB_URL" -f data.sql \
  --data-only --use-copy \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"
supabase db dump --db-url "$SUPABASE_DB_URL" -f history_schema.sql \
  --schema supabase_migrations --keep-comments
supabase db dump --db-url "$SUPABASE_DB_URL" -f history_data.sql \
  --schema supabase_migrations --data-only --use-copy
```

The workflow does not delegate CLI installation to `supabase/setup-cli`: that
action downloads an asset but does not independently verify its checksum. It
downloads the official Supabase CLI `2.104.0` Linux amd64 tarball directly and
checks the release-published SHA-256
`5a0d3ed4c44f8dd1520a9f7ed6309aa60ef3bfc6c5483c9b11f70191f9d74cf6`
before installation. The age v1.3.1 Linux amd64 tarball is likewise downloaded
from its immutable official release URL and checked against the release asset's
published SHA-256
`bdc69c09cbdd6cf8b1f333d372a1f58247b3a33146406333e30c0f26e8f51377`.
age provides authenticated encryption; modifying the ciphertext, encrypted
manifest or SQL files causes decryption or manifest verification to fail. The
unkeyed outer SHA-256 is transport-corruption evidence only and is not
presented as authentication. age does not prove who created a new ciphertext:
the public recipient lets anyone encrypt to it. Origin trust comes from the
immutable artifact attached to the reviewed successful `main` workflow run;
this is why workflow review protection is part of the cryptographic boundary.

The age recipient is public but integrity-sensitive: redirecting it would
exfiltrate a newly encrypted dump. It is pinned directly in the reviewed
workflow, never read from a mutable repository variable. The HOLD placeholder
must be replaced by the exact offline-derived `age1...` recipient in a reviewed
commit before a job can receive the production URL.

The Supabase CLI uses a containerized database toolchain for `db dump`. Before
the production database URL is made available to any step, the workflow forces
the internal image registry to `docker.io`, pulls
`supabase/postgres:17.6.1.132` by immutable OCI index digest, verifies its
linux/amd64 image ID and tags that verified image for the CLI. The restore job
does the same before the age identity is made available. This keeps mutable
registry tags and unauthenticated installer behavior outside both secret-bearing
steps.

The restore initialization additionally uses CLI-pinned Realtime, Storage and
Auth migration images with local database credentials. All three are pulled by
immutable OCI digest, checked by exact linux/amd64 image ID and retagged before
the age identity is exposed; their tag-to-ID mappings are asserted again after
initialization and before decrypted data is copied.

Supabase CLI 2.104.0 can echo a nested raw URL parse error even when its outer
error masks the password. Every `db dump` stdout/stderr byte is therefore
redirected to a private `RUNNER_TEMP` log; only a generic failure annotation is
public, and `if: always()` cleanup deletes the diagnostic with the plaintext.

The encrypted manifest contains only:

- format version;
- pinned Supabase CLI version;
- source PostgreSQL major;
- reviewed GitHub repository, run, attempt and commit provenance (inside the
  ciphertext, not in the public summary);
- SHA-256 of the roles/schema/data files, migration-history pair, reviewed
  managed-schema hook, expected migration inventory and the private count
  inventory derived from the exact `data.sql` COPY sections.

The encrypted count inventory contains no values or identifiers, only exact
per-relation row totals needed to detect an omitted or partial data replay. The
manifest itself contains no row counts, project ref, database URL, account
identifier or user data. Job output and summaries contain PASS/FAIL evidence
only.

## Restore isolation

The drill does not use a stock `postgres` image. Pinned Supabase CLI `2.104.0`
creates a clean PostgreSQL 17 Supabase-local database, including managed Auth
and Storage schemas. The encrypted manifest must name an allowlisted logical
dump source major (`15` or `17`); any other value fails closed. Supabase's
official logical migration flow supports restoring an older logical dump into
a newer PostgreSQL target. This candidate therefore restores either allowlisted
source into the single pinned PostgreSQL 17 target; it does not claim binary or
physical cross-major compatibility. The expected Supabase Postgres tag, OCI
index digest, linux/amd64 image ID and running target major are asserted before
production-derived data is copied into the container.

Supabase CLI temporarily publishes its database port while it initializes the
local services. Before decryption, the expected CLI bridge is pre-created with
Docker's default host binding fixed to `127.0.0.1`; startup must prove the
actual `5432/tcp` binding is exactly that address and port. Exact, run-tagged
IPv4 and IPv6 `INPUT` plus `DOCKER-USER` DROP rules are also installed and
verified before startup as defense in depth. If either firewall backend or
chain is unavailable, the drill aborts before the age identity is exposed.
After initialization, the database is moved to a Docker `--internal` network
and detached from the CLI NAT network.
Restore and verification use container-local `psql`; there is no production
write path and no outbound integration credential in the job. The published
port remains present but firewall-protected between start and container
removal; cleanup must prove every resource in the unique CLI project namespace
and all four IPv4/IPv6 rules are absent or fail the drill.

The normal roles/schema/data export intentionally excludes managed Auth and
Storage DDL. Ishonch Guard owns two triggers on `auth.users`, so the encrypted
bundle includes the reviewed idempotent
`supabase/recovery/managed-schema-hooks.sql`. It is applied after application
schema and before data. The drill asserts both Auth triggers, the allowlist
lifecycle trigger and their exact function bindings/enabled state. The
official `supabase_migrations` schema/data pair is also encrypted, restored and
compared privately with the ordered migration inventory from the same reviewed
commit; future migration replay must not rely on a guessed snapshot head. The
export brackets all five logical dumps with private live migration-history and
managed-schema checks, and fails when normal migration or managed-schema drift
occurs during that multi-file window.

Before restored cron rows can commit, the drill sets and verifies
`cron.launch_active_jobs=off`. This prevents the retained
`ishonch_prune_app_retention_daily` job from mutating the snapshot while it is
being validated.

The restore is one transaction with `ON_ERROR_STOP=1`. The assertions require:

- Supabase roles (`anon`, `authenticated`, `authenticator`, `service_role`);
- managed `auth.users` and `storage.objects` relations;
- all 13 public and two private Ishonch Guard relations;
- RLS enabled on all 13 public and two private application relations;
- critical function/policy inventory and all three role-lifecycle triggers;
- exact restored migration inventory;
- exact encrypted-source versus restored row-count parity for all 15
  application relations plus `auth.users`, `storage.objects` and
  `storage.buckets`;
- readable Auth and Storage metadata relations.

No real counts or identifiers are printed. The count file is derived from the
same authenticated COPY snapshot, avoiding a second live count query that can
race concurrent production writes; exact private comparison after restore is
the data-load fidelity evidence.

## One-time enablement (owner, only after workflow protection)

1. Enforce one of the independent approval gates stated at the top of this
   document. The included CODEOWNERS ownership of the file itself, all
   workflows, contract tests and recovery files is an audit signal only until
   GitHub actually requires an independent CODEOWNER approval with stale
   approvals dismissed.
2. Implement an independent backup-freshness monitor in a different schedule
   failure domain. It must alert when no successful backup exists within the
   agreed threshold. Workflow failure notifications alone do not detect a
   schedule that never started, and GitHub can disable scheduled workflows in
   inactive public repositories.
3. Download checksum-verified age v1.3.1 on a trusted workstation.
4. Generate a dedicated key pair offline:

   ```bash
   age-keygen -o ishonch-backup-identity.txt
   age-keygen -y ishonch-backup-identity.txt
   ```

5. Store the identity file in the owner's password manager and independent
   recovery custody. Never put it in the repository, issue, chat or DB URL.
6. Replace `UNCONFIGURED_REVIEWED_RECIPIENT_REQUIRED` in `backup.yml` with the
   exact public `age1...` recipient through a reviewed PR. Do not use a mutable
   repository variable for it.
7. Create two GitHub Environments and choose **Selected branches and tags**
   with the exact branch `main` for each deployment policy. Do not choose
   **Protected branches only** while branch protection is absent: GitHub then
   treats every branch as eligible. Verify that feature-branch manual dispatch
   skips before environment/secrets. Keep the environments separate:
   - `backup-export` contains only `SUPABASE_DB_URL`, the percent-encoded
     Supabase session-pooler URL usable by
     GitHub's IPv4 runner. The official full logical export needs privileged
     access to Auth/Storage data, so treat this as a production credential.
     The percent-encoding requirement comes directly from the official
     `supabase db dump --db-url` reference; encode reserved characters in the
     password before storing the complete URL.
   - `backup-decrypt` contains only `BACKUP_AGE_IDENTITY`, the private age
     identity used by authenticated read-back and restore jobs.
     Do not create repository-level copies of either secret. Environment
     selected-`main` restriction is mandatory even when branch review is enabled.
     If Environment approval is the independent review gate, enable prevent
     self-review and disallow administrator bypass; otherwise the sole admin can
     approve or bypass their own secret-bearing run.
8. Manually run `Supabase Encrypted Backup`; both jobs must pass.
9. Manually run `Backup Restore Drill`; all three PASS lines must appear.
10. Download the ciphertext into independent owner custody and perform a second
    offline decrypt/read-back before declaring the backup operational.

Until every step above has evidence, the status remains
`NOT ENABLED / NOT VERIFIED`.

## age identity rotation and custody

- Maintain at least two independently controlled recoverable copies of the
  active age identity; one owner-controlled password manager entry alone is not
  independent custody.
- A recipient change affects new ciphertext only. Never delete or overwrite the
  old identity while any 90-day GitHub artifact or independently retained copy
  encrypted to that recipient still exists.
- Before switching the repository recipient, prove offline decryption with both
  the old and proposed identities under dual custody. Then enable the new
  recipient, produce a new backup, pass authenticated read-back and the isolated
  restore drill, and inventory every retained old-recipient artifact/copy.
- Retire the old identity only after that inventory is empty by expiry or
  reviewed re-encryption, and record owners, evidence run IDs, copy locations,
  expiry and retirement confirmation without recording key material.

## Trust boundary and honest limits

- age protects confidentiality and authenticity of artifacts at rest. It does
  not make an untrusted GitHub workflow safe. A malicious workflow merged into
  `main` can read any secret granted to its job. Required review/rulesets and
  restricted workflow ownership are therefore prerequisites, not optional
  hardening.
- age authenticates ciphertext integrity to the identity holder, not sender
  identity. The reviewed successful GitHub run is the origin/provenance layer;
  encrypted manifest run/attempt/SHA fields are checked against the selected
  immutable artifact. Independent offline custody must also record that run ID.
- The export job receives the production DB URL and public recipient, but not
  the private age identity. Read-back and restore receive the private identity,
  but never receive the production DB URL.
- The two secrets live only in separate selected-`main` GitHub Environments;
  each secret-consuming job also has a fail-closed `github.ref` condition.
  These defenses complement, but do not replace, independent workflow review.
- Plaintext SQL exists transiently under `RUNNER_TEMP` with mode `0700/0600`.
  `if: always()` cleanup removes it. Forced runner termination may leave it
  until GitHub destroys the ephemeral VM; ordinary deletion is not forensic
  media erasure.
- A 90-day GitHub artifact is not an independent disaster domain from GitHub
  credentials. Keep a separately controlled encrypted copy and recovery key.
- Database dumps include Storage metadata, not Storage object bytes. Ishonch
  Guard currently claims no persisted user screenshots; that assumption must
  be rechecked whenever Storage use changes.
- Logical backups provide discrete restore points, not PITR. Remaining on
  Supabase Free does not meet the proposed launch recovery guarantee.
- The restore workflow rejects a latest successful backup older than 36 hours,
  but that weekly check is not an independent freshness alert. RPO claims stay
  blocked until the separate monitor in the enablement list is operating.
- The drill proves SQL portability into the pinned Supabase-local target. It is
  not a hosted-project recovery, RTO measurement, or production restore.

## Manual non-production restore

1. Verify the downloaded ciphertext SHA-256 for transport corruption.
2. Decrypt with the independently held age identity:

   ```bash
   age --decrypt -i ishonch-backup-identity.txt \
     -o backup.tar supabase-backup.tar.age
   ```

3. Validate the tar member allowlist and manifest hashes before extraction.
4. Restore roles, schema, the reviewed managed-schema hook, data and the
   migration-history schema/data pair into a newly created non-production
   Supabase target using the same single-transaction order as the drill. Never
   target production without a separately approved recovery window.
5. Compare the encrypted expected migration inventory and count inventory
   privately, then run schema lint, pgTAP, RLS/application smokes and the
   recovery evidence checklist in `RECOVERY_AND_KEY_ROTATION.md`.
