# R1 restored-authorization gate — 2026-10-23

## Owner-approved publication — 2026-11-15

The owner explicitly approved commit/push of the reviewed local column-ACL
correction to Draft PR150, followed by exact-new-head CI. No Ready, merge,
deployment, production or design changes are authorized. This section supersedes
the publication-approval boundary in the dated local evidence below; it does
not close independent review, trust/custody/hosted/offsite/freshness gates.

November15 self-review: two Python files plus twelve documentation paths,
Python 51/51 and formatting/diff checks pass. Functional source matches sixteen
saved green-run input snapshots from November14. The intentional pre-fix RED
snapshot is excluded; the failed inherited-membership expectation is retained.
The real matrix 84/84 and full restore with 92 SQL assertions remain November14
evidence, not new hosted recovery proof or a repeated November15 database run.
Publication updates only status/authorization text; tested functional bytes
remain unchanged. Use [PR150 head and Checks](https://github.com/Web-pixel-creator/Scam-guard-Main/pull/150)
for the new commit and its CI; do not reuse prior head37b2be1 results.

Read-only preflight confirms PR150 Draft/no auto-merge, unchanged GitHub main
7e8ac7feda46df76a2e1fc02db1c1759a1442021 and Railway PR deployments disabled
with repository triggers only on main. This is not a production-health check.
Evidence folders: `C:\Scam-guard\backup-r1-column-review-20261115` and
`C:\Scam-guard\backup-r1-column-publication-20261115`.
Backup remains **NOT ENABLED / NOT VERIFIED**; release/enablement HOLD.

## Column-ACL correction — 2026-11-14

Local, uncommitted correction to the October26 independent review finding.
Base: **37b2be17d637091a934366f293e13174eef4d750**. Read-only GitHub confirms
PR150 remains OPEN/DRAFT at that head, not merged. Published CI does not cover
this delta. No commit/push, merge, deployment, production, design or credential
action. Older blocks below remain historical evidence for their own dates.

### Correction and red/green proof

`security_sql` now checks effective SELECT/INSERT/UPDATE/REFERENCES through
`has_any_column_privilege`, in addition to existing table ACL checks. Expected
rights come from the existing restricted-table allowlist. Inherited and PUBLIC
rights cannot bypass it; explicit PUBLIC column entries are also rejected via
`pg_attribute.attacl`, ignoring dropped/system columns. No migration, profile
fingerprint, application behavior, workflow or pinned-version change.
See [PostgreSQL privilege inquiry semantics](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE).

Three new generator tests failed on the unmodified validator, then all51 Python
tests passed after the correction. They pin all36 role/table/column-privilege
checks, PUBLIC ACL detection, allowed service rights and read-only output.

### Fresh synthetic Linux/PG17.11 evidence

- **84/84 real privilege cases:**35 direct +35 two-level inherited +12 PUBLIC
  forbidden grants rejected;2 redundant allowed SELECT grants accepted.
  The original production33 contract is rechecked after every cleanup.
- **Correct full restore PASS:** actual export, age encryption, authenticated
  read-back, single-transaction restore,18 relations, auth/storage sentinels,
  count parity, disabled cron launcher and92 restored SQL assertions.
- Actual workflow rejects archives carrying direct and PUBLIC UPDATE column
  rights, before an authorization PASS summary. A separate probe with an
  inherited membership pre-existing in the isolated target is also rejected.
- **Important qualification:** the initial negative test expected a source
  inherited grant to survive export. That expectation failed: restore passed.
  Follow-up proved the reserved-role membership was not restored, effective
  UPDATE=false, and a real service_role UPDATE returned permission denied.
  This is safe target behavior, not a rejected archive. The separate target-drift
  probe proves the validator rejects inherited rights when actually effective.
  The failed first expectation remains in negative.log/json, not hidden as PASS.
- Linux workflow components56/56; IPv4/IPv6 INPUT and DOCKER-USER positive/deny
  controls pass. Missing IPv6 chain fails closed. Busy-volume cleanup reports
  failure, removes plaintext/firewall state, then cleans without residue.
- actionlint0, Bash syntax PASS, Gitleaks recovery scan0. Full application
  Vitest/tsc/build were not rerun: only two Python files and documentation change.
  Prior application totals are not new evidence for this session.

Docker Desktop was started locally. Loading the pinned images took532s; three
matching cached helper images seeded the owned nested cache. The original
workflow still pulled and verified its immutable digests/config identities;
no identity guard or version was replaced. CLI stays pinned at2.104.0.
No host Docker socket or public port is exposed by the outer runner. Synthetic
source data and keys only; Actions artifact transport remains a local copy,
not proof of hosted upload/download, custody, offsite copies or freshness.

All nested containers/volumes/custom networks/namespaces/tagged firewall rules
and data roots were removed, followed by the exact owned outer container/volume.
Unrelated host resource inventory and dirty repo/consent worktrees matched
before/after. Functional source hashes stayed constant throughout all gates;
documentation reconciliation happens after cleanup.

Evidence: `C:\Scam-guard\backup-r1-column-fix-20261114` (runner/probes, red/green
unit logs, matrix, full, negative and negative-followup, firewall/failures,
per-gate source hashes, final-inner/cleanup/final verification). Matrix and full
rehearsal are local evidence, not newly added hosted database CI jobs. The three
new unit tests join the existing offline recovery CI when this delta is published.

**Disposition:** column-ACL finding corrected and verified locally; release and
enablement remain HOLD / NOT ENABLED / NOT VERIFIED. Next: review local diff,
separately approve commit/push, verify exact-new-head CI and independently review
the revision. Protection/credential approval/custody/hosted recovery/offsite/
freshness and owner-approved production work remain separate open gates.

## Review follow-up — 2026-10-25

Scope stays local and uncommitted at f4f4e0fa. The October23 source snapshot
matched before work began. Only recovery_contract.py, its tests and documentation
were changed during this follow-up; application, design, migrations and secrets
were not touched. GitHub was read only.

**P2 R1 REVIEW 02:** the table ACL generator omitted PG17 MAINTAIN. On a fresh
synthetic production33/PG17.11 fixture the prior generator accepted nine direct
grants (three restricted tables x three roles), plus an inherited anon grant.
The corrected generator rejects all ten and still accepts the unchanged fixture.
The actual export/read-back/restore workflow also rejects an extra anon MAINTAIN
grant on public.telegram_webhook_updates before a restore-success message.
This demonstrates a validator gap, not a production exploit or compromise.

The check uses has_table_privilege to include role inheritance, with a nested
server_version_num >=170000 branch. The existing profile/fingerprint and33
migrations remain unchanged. This date's live proof is PG17.11 only; PG15/16
guards are unit-checked but not newly live-tested. The privilege semantics are
documented in [PostgreSQL17 privileges](https://www.postgresql.org/docs/17/ddl-priv.html)
and [access inquiry functions](https://www.postgresql.org/docs/17/functions-info.html).

Fresh results: Python48/48 (two new red-before/green-after regressions), Linux
components56/56, valid full export/encryption/read-back/transactional restore,
92/92 restored authorization assertions, internal-only/egress-denied controls,
IPv4/IPv6 INPUT and DOCKER-USER probes (positive controls, DROP counters,
loopback and restored connectivity), missing-IPv6-chain rejection and busy-volume
cleanup failure/recovery. Actionlint and23 Bash blocks/1205 lines passed.
The15,394 application tests/build/TypeScript/ESLint remain October23 evidence;
they were not rerun or relabelled as October25 results. Hosted checks on f4f4e0fa
do not validate this unpushed delta.

Failed attempts are preserved separately: the first ACL probe used DROP OWNED
on its synthetic helper role, which the Supabase postgres role denied; cleanup
was replaced by an exact grant revoke/drop of that owned fixture. Initial full
and firewall attempts stopped at positive connectivity controls before backup
or firewall installation: the harness assumed listener readiness after1/2s.
Explicit bounded readiness now precedes the unchanged original probes. The
observed cold listener took2.63s. No workflow firewall rule or security guard
was relaxed; the archived October20 harness was not edited.

The source-cleanup command succeeded, but its outer all-file provenance check
failed because this documentation was edited concurrently. This is retained as
a failed harness check, not silently marked green. Final reconciliation permits
only Markdown differences from those test inputs; code/workflow/SQL hashes must
match, and independent final-inner/outer cleanup checks must confirm no residue.

Evidence: C:\Scam-guard\backup-r1-maintain-review-20261025 (runner.py, probes.py,
before/after and workflow receipts, failed-attempt logs, source hash snapshots,
github-readback.json and cleanup.json). Sources are mounted read-only in the
owned nested daemon; all DB data and encryption identities are disposable.
Read final cleanup.json before treating resource cleanup as verified.

GitHub read-back: Draft/unmerged PR150, same published head,8/8 successful checks,
zero submitted reviews; main7e8ac7fe unprotected, no rulesets, no required backup
Environments, both backup workflows disabled_manually. No settings were changed.
Next: separately approved commit/push, exact-head CI, independent review and
trust/custody/hosted/offsite/freshness gates. No merge, deploy or production action.
Backup remains **NOT ENABLED / NOT VERIFIED**.

## Original correction — 2026-10-23

Local, uncommitted follow-up to Draft PR150 at base commit
`f4f4e0fa2568c9b87776f56e277d95f7fd1f86b2`. No push, merge, deployment,
production read/write, secret access, enablement or design change. Earlier
October21 GitHub CI results do not cover this new delta.

## Finding and correction

The October21 P2 R1 REVIEW 01 finding was reproduced again before the fix:
the actual export/read-back/restore workflow accepted an extra anon EXECUTE
grant and `Admins read checks USING (true)`. Separate pgTAP tests detected
three violations. This is a recovery validator gap, not proof of a production
vulnerability, compromise or forged backup.

The trusted production33 profile now checks21 exact RPC signatures, execution
permissions for anon/authenticated/service_role/PUBLIC, SECURITY DEFINER vs
INVOKER and search_path. Three closed tables have explicit role/privilege
contracts. The existing33 migrations are unchanged; no production grant changes
are proposed. In particular `private.is_admin_aal2()` intentionally permits
authenticated execution while remaining SECURITY INVOKER.

The restore workflow additionally runs the four existing, hash-pinned SQL suites
on the **restored isolated database**, before any restore PASS summary:
23 MFA/RLS +18 admin lifecycle +10 retention +41 Telegram lifecycle =92 assertions.
Each suite rolls back fixtures and temporary grants. An extension installed by
this gate is removed in finally; a pre-existing pgTAP extension is preserved.
The runner rejects nonzero SQL status, failed/skipped/TODO/bailout TAP, wrong
plans, missing/duplicate/reordered assertion numbers and source hash drift.
Only aggregate results reach Actions logs; private SQL diagnostics do not.

The gate accepts no database URL or password. It rechecks an explicitly named
owned drill container, immutable Linux/amd64 image, project label, internal-only
network, no external listener and disabled cron before test writes. Classic
Docker config IDs and containerd index IDs use the existing immutable verifier.
After NAT detachment the port may be absent; a public listener is never accepted.

New profile fingerprint:
`9b633aaaac618051209f1be94d619f7314c18668c72a0b15a93a90022d6bebfd`.
The prior fingerprint `4f889170...` is deliberately incompatible. Export a fresh
artifact under the reviewed new contract; do not weaken fingerprint validation
to accept an old artifact. This change does not claim33 is the current live DB.

## Evidence and limits

Local evidence directory: `C:\Scam-guard\backup-r1-security-fix-20261023`.
`runner.py` scopes resources by exact ID/label; workflow Bash is executed from
this worktree in a separate nested Docker daemon. Only Actions artifact transport
is replaced by local copying. Source data and age identity are disposable
synthetic fixtures. No host Docker socket is mounted into the rehearsal.

Full restore and the integrated92-assertion gate passed. Full application tests
passed15,394/15,394 in180 files with network detached. Final receipts and the
remaining adversarial/firewall/cleanup results are recorded in the local
`RESULT.md`; that report must be read before treating the local work as complete.

Failed development attempts are retained: the first three positive restore
attempts rejected valid Docker representation/port-detachment metadata. The
checks were corrected, not bypassed. An initial app test attempt had no installed
dependencies; the final runner installs the frozen lock in its own container,
then detaches network before tests. These failed attempts are not passing evidence.

This is a critical authorization regression gate, not an exhaustive proof of all
possible schema/function drift. Existing test fixture collisions or an unexpected
extension setup fail closed and require investigation, not automatic skipping.
Logical restore does not back up Storage object bytes or external integrations.
The hosted workflow itself, actual Actions transport, independent trust/approvals,
key custody, offsite retained-ciphertext read-back/freshness and separately
authorized production snapshot/restore remain OPEN. Backup NOT ENABLED / NOT VERIFIED.

## Next sequence

1. Review this local delta and its evidence; authorize commit/push separately.
2. Re-run hosted CI for the exact published head. Keep PR150 Draft/HOLD.
3. Resolve workflow-review/protected-Environment, custody and hosted full-recovery
   gates without mixing in candidate38 migrations or design.
4. Obtain separate production/merge/deployment/credential authority; no automatic
   cron or production action follows from passing local tests.
