# Backup Automation — production33-only candidate

2026-10-20 local repair supersedes the October18 preparation below:
see BACKUP_RELEASE_REPAIR_2026-10-20.md. Unicode COPY accounting is fixed and
dependency security updates are a separate prerequisite patch. No production
snapshot, hosted run, recipient, credential or cron was enabled.

> Local R1 preparation2026-10-18. Hosted backup NOT ENABLED / NOT VERIFIED.
> Exact scope/evidence: BACKUP_RELEASE_CANDIDATE_2026-10-18.md.

## Scope and hold

Only the frozen production-33 profile is supported:33 migrations,18 counted
relations and one trusted retention schedule. Its name is not a fresh live DB
check. Exact history must be read back after authorization; drift fails closed.
No application/design change or new migration is included. Candidate38 remains
with the later application release. Both workflows are manual-only, main-only
and require the explicit production-33 input before entering an Environment.
The public recipient remains UNCONFIGURED_REVIEWED_RECIPIENT_REQUIRED.
A future cron trigger needs a reviewed explicit scheduled-profile policy.

## Toolchain and export

Checksum-verified CLI2.104.0 installs both supabase and supabase-go. Reviewed
Postgres17.11.0.003, Auth2.194.0, Storage1.67.15 and Realtime2.102.1 images are
pinned by immutable index/config identities. Private CLI caches select those
tags; preloading alone is insufficient. Telemetry is explicitly disabled.

Five CLI dumps capture roles (with comments), schema, COPY data and migration
history schema/data. Managed migration bookkeeping and vector tables are
excluded from data. Quiet read-only history, managed-schema and schedule checks
bracket export. All dump output goes to private logs, never CI URL diagnostics.
The reviewed Auth trigger hook is bundled separately. The encrypted v4 manifest
binds exact profile fingerprint, file hashes and run/attempt/SHA provenance.
Expected counts come from the same COPY snapshot, not a separate live query.

Export receives only the DB URL and public age recipient; read-back/drill only
the private identity, never the production URL. age gives ciphertext integrity,
not sender authentication: anyone can encrypt to a public recipient. Origin
trust comes from the reviewed immutable successful workflow run. An unkeyed
outer checksum is not an authenticity signature. No row totals or keys in logs.

## Isolated restore

A selected main backup must pass provenance and36h freshness checks. Before
identity exposure, tools/images and four run-tagged IPv4/IPv6 INPUT/DOCKER-USER
rules must pass. Missing chains abort; do not remove guards for a hosted runner.
Startup must bind localhost; target joins exactly one internal network before
SQL ingress. Restore has no production target URL or outbound integration key.

Roles replay idempotently. Empty-target ACL preparation, schema, Auth hooks,
data, history and trusted schedules restore in one ON_ERROR_STOP transaction.
Cron launcher remains off. Exact history/count/RLS/common RPC/grant/trigger
checks must pass. Always-cleanup verifies owned plaintext/container/volume/
network/rule absence; residue fails the job. Deletion is not forensic erasure;
forced runner termination still relies on ephemeral VM disposal.

## Enablement gates — not performed by local package preparation

1. Enforce the existing independent workflow-review or protected-Environment
   manual-approval contract. CODEOWNERS alone is not enforcement or independence.
2. Restrict backup-export and backup-decrypt Environments to exact main. If manual
   approval is the trust gate, prevent self-review/admin bypass and account for
   waiting approvals in freshness. Verify actual plan support; no repo-level
   duplicate secrets outside these jobs.
3. Generate a dedicated identity on a trusted offline-capable workstation. Review
   its exact public recipient in source; keep two independently controlled
   recoverable key copies and prove second-custodian synthetic decryption.
   Never place private identities in Git, chat, issues, logs or screenshots.
4. Prove actual hosted firewall/cleanup and upload/download with synthetic data.
   Keep an independently controlled encrypted copy outside GitHub.
5. Separately authorize fresh live baseline/export, authenticated read-back and
   isolated restore with parity/security/cleanup evidence. This does not authorize
   a production restore, engine upgrade, schema rollout or deployment.
6. Agree RPO/retention/alert owner and implement independent freshness alerting
   for missed runs/delayed approvals. Only then review schedule/profile activation.

Artifacts request90-day retention. Keep old identities until every retained
ciphertext needing them expires or is verifiably re-encrypted. Database backups
include Storage metadata, not object bytes; inventory those and non-DB settings
separately. This is not PITR or measured RTO. A local DinD proof does not establish
hosted runner support, and local components do not prove a fresh production copy.

## Local evidence and limits

R1:29/29 Python,23/23 focused Vitest,56/56 Linux components. The exact33 profile
fingerprint is unchanged from the October15 synthetic full restore. That result
is supporting history, not a new full rehearsal of this candidate. Full final
locked-base/hosted/production-recovery gates remain OPEN.

References: [Supabase backup scope](https://supabase.com/docs/guides/platform/backups),
[official CLI restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
