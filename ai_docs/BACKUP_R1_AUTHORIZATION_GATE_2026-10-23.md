# R1 restored-authorization gate — 2026-10-23

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
