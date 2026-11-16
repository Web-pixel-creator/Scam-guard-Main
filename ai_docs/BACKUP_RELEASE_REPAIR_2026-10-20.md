# R1 repair and dependency prerequisite — 2026-10-20

Local candidate only. Publication, production and backup enablement HOLD.
No cloud endpoint, secret rotation, Telegram/AI/TTS request or deployment.
Current operational evidence is not inferred from this local report.

## Composition

Fresh main ref:7e8ac7feda46df76a2e1fc02db1c1759a1442021.
The October18 R1 package/review is immutable. New non-Git preview:
`C:\Scam-guard\backup-release-fixed-20261020`.
Separate evidence/patches: `C:\Scam-guard\backup-release-fix-evidence-20261020`.

Two disjoint patch lanes are applied and verified together:

1. Dependency-security: package.json/bun.lock, matching coverage pin in ci.yml,
   toolchain regression and type-only ErrorComponentProps compatibility.
2. Repaired production33 backup: October18 R1 plus physical-LF COPY parser,
   Unicode/escaped/empty/multirow regressions and reconciled operator docs.

No design, CSS, component, migration, SQL-test or application feature changes.
The one route change is type-only; the packager checks its exact shape.
No candidate38 profile. The33-migration/18-relation/one-schedule fingerprint:
`4f889170aeede11588a0cc22d4109afe64d2010ef286c33cbc7f1a0d6b01182a`.

## Repairs

R1-01: Python splitlines treated valid Unicode within COPY text as extra rows.
New regressions failed before the fix. Physical LF splitting preserves values;
missing/duplicate/unknown/truncated inventory guards remain. This fixes an
inherited defect, not a newly introduced R1 regression.

R1-02: baseline audit had18 package/advisory pairs,16 unique advisories.
Vendor ranges verified; four direct packages change, no unrelated direct upgrade.
Coherent TanStack pins: Start1.168.60, Router1.170.41, plugin1.168.42,
server-core1.169.39. Seroval1.6.7, Vitest/coverage4.1.11.
Security overrides: js-yaml4.3.2, postcss8.5.23, brace-expansion5.0.12,
browserslist4.28.7, baseline-browser-mapping2.11.0, nanoid3.3.18,
source-map-js1.2.2. Vite7.3.6 and Supabase2.106.2 remain unchanged.
The resolver changes126 lock entries (including deduplication); inspect exact
inventory rather than assuming only four transitive packages changed.

TanStack/Seroval findings concern runtime transport/deserialization; others
concern dev/build tooling. No exploitation or production compromise assessment.
[TanStack advisory](https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8),
[Seroval advisory](https://github.com/lxsmnsyc/seroval/security/advisories/GHSA-jp82-f5mq-hwhp).

## Verification

Gate receipts and exact manifest are recorded in the evidence directory.

| Gate                                   | Local result                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Unicode TDD                            | Old implementation fails8 subcases; corrected Python suite32/32                                     |
| Frozen Bun1.3.14 / Node22.23.3 install | PASS; only4 direct packages changed                                                                 |
| Known-vulnerability audit              | 18 package/advisory pairs to0;16 primary advisory records retained                                  |
| Vitest4.1.11                           | 15,393/15,393,180 files; repeated with coverage                                                     |
| Coverage S/B/F/L                       | 87.07/82.21/92.38/88.81%; floors80/75/85/80 unchanged                                               |
| TypeScript / ESLint / build            | PASS;8 inherited Fast Refresh warnings                                                              |
| SSR synthetic smoke                    | healthz/home/admin200; missing-secret401; cross-origin serverFn403                                  |
| Real Bash/jq/age components            | 56/56, network disabled                                                                             |
| PostgreSQL17.11                        | 92/92 pgTAP; schema lint clean                                                                      |
| Full production33 recovery             | Ordinary and Unicode export/read-back/restore PASS                                                  |
| Unicode SQL proof                      | U+0085/U+2028/U+2029: SQL1 row/parser1 row; exact text restored                                     |
| Firewall and failures                  | IPv4/IPv6 INPUT/DOCKER-USER, internal-only, tamper rejection, transaction rollback and cleanup PASS |
| Workflow source checks                 | actionlint4 workflows;23 recovery Bash blocks/1199 lines                                            |

The initial TypeScript pass caught the changed unknown error type; repaired
without changing JSX/runtime behavior. One rehearsal command selected Python
without PyYAML; rerunning with the pinned system interpreter succeeded.
These failures remain in receipts; they are not hidden or counted as passes.

Tests run without Docker network; registry install/audit uses public network.
Recovery uses a separate owned nested daemon and synthetic data only.
Hosted artifact transport, real Environment protection/custody, CodeQL/Trivy
pipeline, fresh production export and live device acceptance remain unverified.
No visual matrix is claimed: design is unchanged and remains a separate track.
This is the repair author's verification of the prior independent findings,
not a new independent human approval or credential trust gate.

## Next boundary

Review exact integrated source and separate dependency patch, then obtain
explicit publication/deployment authorization. Hosted checks and custody gates
precede separately authorized production snapshot/restore and cron enablement.
Design remains in its original separate worktree, untouched by this release.
