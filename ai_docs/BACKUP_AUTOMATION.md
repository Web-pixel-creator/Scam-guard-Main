# Backup Automation (Supabase Free pilot — `production-38`)

Status: **HOLD candidate — NOT ENABLED in production**. The `production-38`
recovery contract and encrypted restore path have been verified locally on
synthetic data, while hosted GitHub Actions export/restore remain
**NOT ENABLED / NOT VERIFIED**. Do not add credentials until the workflow trust
boundary and required-review rules for the whole `.github/workflows/` are
enforced. A zero-approval ruleset and the `CODEOWNERS` file alone do not satisfy
this gate. Before secrets are added, either a second independent trusted
reviewer must be enrolled with required CODEOWNER approval (at least one
approval and stale-approval dismissal), or a protected GitHub Environment with
manual approval must gate every secret-bearing job. A protected Environment also
means scheduled runs wait for approval; that tradeoff must be accepted
explicitly.

Supabase recommends that Free projects regularly export with `supabase db dump`
and keep off-site copies. The current official logical migration format is three
files: roles, schema and data. This candidate follows that format instead of
running raw `pg_dump` against the managed `auth` and `storage` schemas.

Official references:

- <https://supabase.com/docs/guides/platform/backups>
- <https://supabase.com/docs/guides/deployment/ci/backups>
- <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>
- <https://supabase.com/docs/reference/cli/supabase-db-dump>
- <https://github.com/supabase/cli/releases/tag/v2.104.0>
- <https://github.com/FiloSottile/age/releases/tag/v1.3.1>

## Workflow design and `production-38` profile

Only the single explicitly reviewed profile `production-38` (defined in
`supabase/recovery/baselines.json`) is accepted; there is no automatic head
detection:

- **38 migrations** with exact LF-normalized UTF-8 SHA-256 hashes;
- **20 relations** (`13` `public.*` + `4` `private.*` + `3` managed:
  `auth.users`, `storage.buckets`, `storage.objects`);
- **5 restricted tables** with explicit table, column, PostgreSQL 17 `MAINTAIN`,
  and `PUBLIC` ACL checks (`private.telegram_family_notification_claims`,
  `private.telegram_media_provider_consents`, `private.telegram_update_leaders`,
  `private.web_ocr_ticket_claims`, `public.telegram_webhook_updates`);
- **30 RPCs** checked for exact signature, `SECURITY DEFINER`/`INVOKER`,
  `search_path`, and `anon`/`authenticated`/`service_role`/`PUBLIC` `EXECUTE`
  privileges;
- **2 `pg_cron` schedules** (`ishonch_prune_app_retention_daily` and
  `ishonch_prune_web_ocr_ticket_claims_hourly`);
- **8 hash-pinned rollback-isolated `authorization_tests`** (`302` pgTAP
  assertions run automatically by `backup-restore-drill.yml`).

| Workflow                                                              | Trigger (current HOLD state)                                                 | Boundary                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Supabase Encrypted Backup` (`.github/workflows/backup.yml`)          | HOLD: `workflow_dispatch` only (`production-38`); planned daily 03:17 UTC    | pinned Supabase CLI exports roles/schema/data plus migration history and the reviewed managed-schema hook; the privacy-safe v4 bundle is encrypted to a code-pinned `age` recipient, retained for 90 days and separately read back |
| `Backup Restore Drill` (`.github/workflows/backup-restore-drill.yml`) | HOLD: `workflow_dispatch` only (`production-38`); planned Saturday 05:23 UTC | accepts only a successful `main`-branch artifact no older than 36 hours, authenticates it with `age`, restores into a pinned internal-only Supabase-local database and emits PASS/FAIL evidence only                               |
| `Backup Recovery Gates` (`.github/workflows/backup-recovery-ci.yml`)  | PR / push to `main` (credential-free)                                        | runs offline Python unit tests (`supabase/recovery/test_*.py`) and networkless read-only Linux container workflow-gate regressions (`local_workflow_rehearsal.py`); does **not** run database restore or host firewall checks      |

Both cron triggers stay disabled in this HOLD candidate. **Enablement note for
future `schedule:` activation:** simply adding a `schedule:` trigger block is
not sufficient — the current HOLD job guards require
`inputs.recovery_profile == 'production-38'` (which is only populated on
`workflow_dispatch`, so `schedule` events would be skipped). A future reviewed
enablement PR must explicitly update both the job `if:` condition and the
`RECOVERY_PROFILE` default for `github.event_name == 'schedule'` only after all
approval, Environment, recipient, freshness-monitor and first-proof gates are
ready.

The export uses the official five-file CLI split:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" --file roles.sql --role-only --keep-comments
supabase db dump --db-url "$SUPABASE_DB_URL" --file schema.sql --keep-comments
supabase db dump --db-url "$SUPABASE_DB_URL" --file data.sql \
  --data-only --use-copy \
  --exclude "storage.buckets_vectors" --exclude "storage.vector_indexes" \
  --exclude "auth.migrations" --exclude "storage.migrations" \
  --exclude "supabase_functions.migrations"
supabase db dump --db-url "$SUPABASE_DB_URL" --file history_schema.sql \
  --schema supabase_migrations --keep-comments
supabase db dump --db-url "$SUPABASE_DB_URL" --file history_data.sql \
  --schema supabase_migrations --data-only --use-copy
```

The workflow does not delegate CLI installation to `supabase/setup-cli`: that
action downloads an asset without independently verifying its checksum. Instead
it downloads the official Supabase CLI `2.104.0` Linux amd64 tarball directly,
checks the release SHA-256
`5a0d3ed4c44f8dd1520a9f7ed6309aa60ef3bfc6c5483c9b11f70191f9d74cf6`, and installs
both `supabase` and `supabase-go`. The `age` `v1.3.1` Linux amd64 tarball is
likewise checksum-verified against
`bdc69c09cbdd6cf8b1f333d372a1f58247b3a33146406333e30c0f26e8f51377`. `age`
provides authenticated encryption: modifying the ciphertext, encrypted manifest,
or SQL members causes decryption or manifest verification to fail. The unkeyed
outer `.sha256` file is transport-corruption evidence only, not authentication.
Origin trust comes from the immutable artifact attached to the reviewed
successful `main` workflow run.

The `age` recipient is public but integrity-sensitive: redirecting it would
exfiltrate a newly encrypted dump. It is pinned directly in `backup.yml` (never
read from a mutable repository variable). The HOLD placeholder
`UNCONFIGURED_REVIEWED_RECIPIENT_REQUIRED` must be replaced with the exact
offline-derived `age1...` recipient in a reviewed PR before a job can receive
the production URL.

The Supabase CLI uses containerized PostgreSQL and local init images. Before any
secret-bearing step runs, the workflows set `SUPABASE_INTERNAL_IMAGE_REGISTRY`
to `docker.io`, pull the immutable OCI index digests, verify their linux/amd64
image identities via `supabase/recovery/verify_image_identity.py`, and select
those exact tags in private CLI caches via
`supabase/recovery/prepare_cli_versions.py`:

- PostgreSQL: `supabase/postgres:17.11.0.003` (`sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4`)
- Auth: `supabase/gotrue:v2.194.0` (`sha256:2b352c02adf11a2025cd5993c246ef85db73743553c39194d2b1862d1cc4d1fd`)
- Storage: `supabase/storage-api:v1.67.15` (`sha256:545a5a40307a75a398417e0c74644c8e13afde3146a1252b66ab829db0a8191c`)
- Realtime: `supabase/realtime:v2.102.1` (`sha256:2ebc237cc41d2c941683fffb7848aa40a5af662a1fe30fff5d99f58c7164d8d3`)

Supabase CLI `2.104.0` can echo a nested raw URL parse error even when its outer
error masks the password. Every `db dump` stdout/stderr byte is redirected to a
private `RUNNER_TEMP` log; only a bounded failure annotation is public, and
`if: always()` cleanup deletes the diagnostic with the plaintext.

The encrypted v4 manifest (`ishonch-guard-supabase-logical-backup/v4`) contains
only:

- format version, pinned Supabase CLI version, and source PostgreSQL major (`15` or `17`);
- `recovery_profile` (`production-38`) and its content-bound `recovery_profile_sha256`;
- reviewed GitHub repository, run ID, attempt, and commit SHA provenance;
- SHA-256 digests of the 8 bundle files (`roles.sql`, `schema.sql`,
  `managed-schema.sql`, `data.sql`, `history_schema.sql`, `history_data.sql`,
  `expected-migrations.txt`, `expected-counts.txt`).

## Restore isolation and verification scope

The restore drill creates a clean PostgreSQL 17 Supabase-local database,
including managed Auth and Storage schemas. Before decryption, the expected CLI
bridge is pre-created with `host_binding_ipv4=127.0.0.1` and four run-tagged
IPv4/IPv6 `INPUT` + `DOCKER-USER` `DROP` rules are installed and verified. After
initialization, the database container is attached to an internal-only Docker
network (`$DRILL_INTERNAL_NETWORK`) and detached from all other networks before
any decrypted data is copied in. Cleanup (`if: always()`) removes and verifies
the absence of `$DRILL_ROOT`, every `$DRILL_PROJECT_ID` container/volume/network,
the exact `$DRILL_INTERNAL_NETWORK` network, and all four IPv4/IPv6 firewall
rules; any residue fails the drill.

Before restored cron rows can commit, the drill sets and verifies
`cron.launch_active_jobs = off` via local `supabase_admin` so neither
`ishonch_prune_app_retention_daily` nor
`ishonch_prune_web_ocr_ticket_claims_hourly` can mutate the snapshot during
verification.

The restore runs in one transaction (`--single-transaction --set ON_ERROR_STOP=1`)
with idempotent roles, empty-target ACL preparation
(`prepare-isolated-target.sql`), application schema, reviewed Auth triggers
(`managed-schema-hooks.sql`), data (`session_replication_role = replica`),
migration history, and trusted schedules (`schedule-restore-sql`).

### What the standard GitHub Actions drill verifies vs local rehearsal

- **Standard `backup-restore-drill.yml` (hosted drill, once enabled):**
  - exact `38/38` restored migration inventory;
  - exact encrypted-source vs restored **row-count parity** across all **20
    relations** (`13 public` + `4 private` + `auth.users`, `storage.buckets`,
    `storage.objects` — **note:** `storage.objects` holds Storage object
    metadata only, **not** binary file contents stored in Storage buckets);
  - `recovery_contract.py security-sql` (RLS on all 17 application tables,
    table/column/PG17 `MAINTAIN`/`PUBLIC` ACLs on all 5 restricted tables,
    `SECURITY DEFINER`/`INVOKER`, `search_path`, and execute grants on all 30
    RPCs, plus both `pg_cron` schedules);
  - catalog/function/policy/trigger invariants and the direct-write boundary;
  - **302 behavioral assertions across 8 hash-pinned pgTAP suites** via
    `supabase/recovery/restored_authorization.py --profile production-38` (with
    full container/image/internal-network isolation verification and rolled-back
    fixtures).
- **Reproducible in-repo local rehearsal (`supabase/recovery/rehearse_encrypted_restore.py`):**
  Run from a clean checkout with Docker and pinned Supabase CLI `2.104.0` (no
  production URLs, secrets, or Railway access required):

  ```bash
  python3 -B supabase/recovery/rehearse_encrypted_restore.py --profile production-38
  ```

  In addition to the standard workflow checks above (`verify_image_identity.py`,
  `prepare_cli_versions.py`, internal-only network isolation,
  `restored_authorization.py` `302/302`), this synthetic rehearsal verifies:
  - synthetic sentinel data across all **20/20 non-empty relations**;
  - real `age v1.3.1` encryption with a disposable test keypair and deletion of
    source plaintext before restore;
  - **5 fail-closed negative tamper controls** (all asserted as non-zero command
    exits: wrong `age` key, corrupted ciphertext `sha256sum --check`, corrupted
    ciphertext `age --decrypt`, tampered `expected-counts.txt`, tampered
    `recovery_profile_sha256`);
  - **20/20 cell-for-cell canonical SHA-256 content parity** both immediately
    after restore and again after all pgTAP rollbacks;
  - **all 10/10 pgTAP suites (`661/661` assertions)** plus the **7-case P2
    lifecycle collision matrix (`287/287` assertions)** via
    `lifecycle_fixture_rehearsal.py`;
  - **dedicated Linux Docker preflight and owned-only cleanup**: refuses
    `Docker Desktop`, non-empty engines by default, and any pre-existing name
    conflict before mutating state; cleanup removes only resources created by
    the current run and verifies **bidirectional** Docker inventory parity (zero
    added and zero removed containers, volumes, or networks).

## One-time enablement (owner, only after workflow protection)

1. Enforce one of the independent approval gates stated at the top of this
   document. `CODEOWNERS` ownership alone is an audit signal until GitHub
   actually requires an independent CODEOWNER approval with stale approvals
   dismissed.
2. Implement an independent backup-freshness monitor in a different schedule
   failure domain that alerts when no successful backup exists within the agreed
   threshold.
3. Download checksum-verified `age v1.3.1` on a trusted offline-capable
   workstation and generate a dedicated key pair:

   ```bash
   age-keygen -o ishonch-backup-identity.txt
   age-keygen -y ishonch-backup-identity.txt
   ```

4. Store at least two independently controlled recoverable copies of the private
   identity under dual custody. Never put the identity in Git, issues, chat,
   logs, screenshots, or the DB URL.
5. Replace `UNCONFIGURED_REVIEWED_RECIPIENT_REQUIRED` in `backup.yml` with the
   exact public `age1...` recipient through a reviewed PR.
6. Create two GitHub Environments restricted via **Selected branches and tags**
   to exact branch `main`:
   - `backup-export`: contains only `SUPABASE_DB_URL` (percent-encoded Supabase
     session-pooler URL usable by GitHub's IPv4 runner).
   - `backup-decrypt`: contains only `BACKUP_AGE_IDENTITY`.
     Do not create repository-level copies of either secret. If Environment
     approval is the independent review gate, enable prevent self-review and
     disallow administrator bypass.
7. Manually run `Supabase Encrypted Backup` (`production-38`) on `main`; both
   jobs must pass.
8. Manually run `Backup Restore Drill` (`production-38`) on `main`; all PASS
   lines must appear, including `Restored authorization behavior: PASS`.
9. Download the ciphertext into independent owner custody and perform a second
   offline decrypt/read-back before declaring the backup operational.
10. Only after steps 1–9 are evidenced, open a separate reviewed PR to add the
    cron schedules and update the job `if:` / default `RECOVERY_PROFILE` for
    `github.event_name == 'schedule'`.

Until every step above has hosted evidence, hosted backup status remains
`NOT ENABLED / NOT VERIFIED`.

## `age` identity rotation and custody

- Maintain at least two independently controlled recoverable copies of the
  active `age` identity.
- A recipient change affects new ciphertext only. Never delete or overwrite the
  old identity while any 90-day GitHub artifact or independently retained copy
  encrypted to that recipient still exists.
- Before switching the repository recipient, prove offline decryption with both
  the old and proposed identities under dual custody, then verify export,
  read-back, and isolated restore under the new recipient before retiring the
  old identity after expiry or re-encryption.

## Trust boundary and honest limits

- `age` protects confidentiality and authenticity of artifacts at rest; it does
  not make an untrusted GitHub workflow safe. Required review/rulesets and
  restricted workflow ownership are prerequisites.
- `age` authenticates ciphertext integrity to the identity holder, not sender
  identity; origin trust comes from the reviewed successful `main` workflow run
  and encrypted provenance fields.
- The export job receives `SUPABASE_DB_URL` and the public recipient, never
  `BACKUP_AGE_IDENTITY`. Read-back and restore receive `BACKUP_AGE_IDENTITY`,
  never `SUPABASE_DB_URL`.
- Plaintext SQL exists transiently under `RUNNER_TEMP` with mode `0700/0600` and
  is removed by `if: always()` cleanup; ordinary deletion is not forensic media
  erasure.
- A 90-day GitHub artifact is not an independent disaster domain from GitHub
  credentials; keep a separately controlled encrypted copy and recovery key.
- Logical SQL dumps include Storage metadata (`storage.buckets` and
  `storage.objects`), **not** Storage object bytes in buckets. Inventory binary
  bucket files and non-DB settings separately.
- Logical backups provide discrete restore points, not PITR. Local or hosted
  drill success proves SQL portability into the pinned Supabase-local target,
  not a production restore or measured RTO.

## Manual non-production restore

1. Verify the downloaded ciphertext SHA-256 (`sha256sum --check`) for transport
   corruption.
2. Decrypt with the independently held `age` identity:

   ```bash
   age --decrypt -i ishonch-backup-identity.txt \
     -o backup.tar supabase-backup.tar.age
   ```

3. Validate the exact 9-member tar allowlist (regular files only), manifest
   hashes, and `recovery_contract.py verify --profile production-38`.
4. Restore roles, empty-target ACL preparation, schema, `managed-schema.sql`,
   data, `supabase_migrations`, and trusted schedules into a newly created
   non-production Supabase target using the same single-transaction order as the
   drill. Never target production without a separately approved recovery window.
5. Verify migration inventory, 20-relation parity, `profile-security.sql`, and
   pgTAP / recovery checks in `RECOVERY_AND_KEY_ROTATION.md`.
