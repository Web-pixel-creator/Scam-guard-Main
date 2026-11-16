# Backup-only release candidate — 2026-10-18

Historical preparation record. Subsequent review found two blockers.
The October20 repaired local candidate is documented separately in
BACKUP_RELEASE_REPAIR_2026-10-20.md; its dependency patch is NOT base-identical.

> Local preparation only. Not committed, pushed, merged, deployed or enabled.
> See CURRENT_STATE.md and OPEN_TASKS.md for operational limitations.

## Safe composition

Base: `7e8ac7feda46df76a2e1fc02db1c1759a1442021`, confirmed against GitHub main
with a read-only ref lookup on October18. The preview was exported with
`git archive`, not checked out into a shared Git worktree. Git indexes and
branches are unchanged. No production endpoint or DB was accessed.

This is **R1: production-33 backup tooling only**. It contains the recovery
workflow repairs and a frozen33-migration/18-relation/one-schedule profile.
Its profile fingerprint remains
`4f889170aeede11588a0cc22d4109afe64d2010ef286c33cbc7f1a0d6b01182a`.
The name describes the last reviewed schema, not a fresh live DB check.

The application, website/design, migrations, SQL tests, dependency locks and
shared `ci.yml` are byte-identical to the verified base. Neither the September
consent migration nor the four October candidate migrations is included.
`candidate-38` remains in the original application candidate for **R2**, after
its dependency and release review; it is not disguised as a test fixture here.
Design is a separate later track and is neither copied nor reset.

## Included implementation

- Two repaired manual-only export/restore workflows: verified CLI/image pins,
  private CLI version selection, quiet history capture, age v4 read-back,
  exact history/count/profile checks, managed-schema checks, transactional
  restore, trusted disabled schedule reconstruction, firewall and cleanup guards.
- `baselines.json`, shared stdlib contract, image identity/CLI-cache helpers,
  isolated-target preparation and managed-schema live verifier.
- Recovery Python regressions, real Linux component harness and its restricted
  test image, and the existing Vitest backup contract expanded to these checks.
- Dedicated `.github/workflows/backup-recovery-ci.yml`: no secret Environment,
  no production URL, no privileged runtime or host Docker socket mount. Building
  its public tooling image uses network; executing the synthetic harness does not.
- Scoped operator documentation and current-state/map entries only.

The unchanged managed-schema hook and CODEOWNERS are supplied by the base.
The manual privileged full Linux harness stays in the original evidence track;
it is not silently added to hosted CI. The release overlay contains no local
archive, credential, dump, raw log, `node_modules`, output or design asset.

## Deliberate differences from the combined candidate

1. Workflow choices and the shared CLI allow only `production-33`.
2. Every secret-bearing job additionally requires main AND that exact manual
   input before it can enter an Environment. Deferred/blank profiles fail closed.
3. Every backup checkout uses `persist-credentials: false`.
4. Recovery CI is separate; the Node/coverage/concurrency changes in the dirty
   shared CI are not copied.
5. Profile tests validate the exact33 sources available at main. Future-schema
   assertions are replaced by explicit rejection and generic in-memory policy
   generator tests; candidate38 tests remain in their original candidate.

These are real changes to the publication candidate. The historical October15
full DB/firewall result is not presented as a fresh full run of this new tree.

## Local gates on this exact preview

- Python: **29/29** (15 profile tests,6 image identity,5 CLI-cache,3 release-boundary).
- Real networkless Linux Bash/jq/age: **56/56**. All production33 negative
  provenance/archive/tamper/key/freshness/cleanup cases remain. The34 cases for
  deferred candidate38 are intentionally absent; 90→56 is scope, not failures.
- Vitest backup contract: **23/23**, run from this preview with external local
  Vitest4.1.11 tooling and no application setup file. Not a full locked-base suite.
- actionlint1.7.12: three changed/new workflows pass (shellcheck disabled).
- Scoped formatting passes. Package assembly verifies no out-of-scope content.

Not run here: full application suite/build/coverage, fresh real DB restoration,
host firewall behavior or hosted Actions. Before merge, CI must validate the
final exact tree with its own frozen dependencies and required gates. The33
profile is identical to the October15 locally restore-proven profile, but
historical proof is supporting evidence, not a hosted or production guarantee.

## Artifacts and reproducibility

Local preview: `C:\Scam-guard\backup-release-preview-20261018`.
Local package: `C:\Scam-guard\backup-release-package-20261018`:

- `base.tar`: exact verified-main export, SHA-256
  `0b63c2f2578c626cd32051b4fa503089ed02ee51a4f6f4ab8a1a0b69726396ad`;
- `backup-release.patch`: review/apply-check artifact against that base;
- `backup-release-overlay.tar`: only changed/added release files;
- `manifest.json`: exact paths/base/new hashes plus patch/overlay hashes;
- `assemble_release.py`: fails on unlisted changes, unexpected deletions,
  migration/app/design/lock/shared-CI drift; no Git/service writes.

Run Python regressions from the preview with `python -B -m unittest discover
-s supabase/recovery -p 'test_*.py'`. For Linux components use the exact Docker
command in `backup-recovery-ci.yml`; mount this preview, not the dirty candidate.
The base archive is not a backup of production data and the overlay is not a
database restore archive. Do not publish the entire local package directory.

## Remaining gates and sequence

1. Review this exact R1 diff; independently rerun scoped and required repository
   checks on its final revision. Reconfirm main before creating a branch/PR.
   A later main change requires conflict/dependency review, not blind overlay.
2. Before any merge, explicitly confirm deployment handling: Railway watch
   patterns may treat workflow/test changes as deploy-eligible even though the
   application source is identical. **No merge or deployment permission is implied.**
3. Keep workflows manual-only and the public-recipient placeholder unchanged.
   Configure independent review/secret Environments/key custodians only with
   separate authority. Verify hosted firewall and artifact transport synthetically.
4. Separately authorize a fresh live baseline/export and isolated recovery;
   enforce exact history and reject drift. Then consider the application/R2
   migrations and design release separately.
5. Cron activation is a separate reviewed change: scheduled events have no
   manual profile input. It must specify the reviewed profile and prove freshness
   alerting in an independent failure domain. Never weaken the current guards
   to make scheduled jobs start.

R1 is ready for **local review**, not approved for merge or operational backup.
Required owner decisions remain reviewer/custody/storage/freshness policy.
No key was generated, secret read, cloud setting changed or production job run.

The Supabase skill informed the frozen-profile/scope boundary and current
restore documentation check. A DB dump restores Storage metadata, not object
bytes; local logical recovery does not prove a hosted physical engine upgrade.
[Official restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
