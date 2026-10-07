# Security/privacy candidate evidence — 2026-10-07

Local candidate evidence, not a deployment or real-user acceptance claim.

## Identity and scope

- Worktree: `C:\Scam-guard\security-privacy-boundaries-20260904`.
- Branch: `agent/security-privacy-boundaries-20260904`.
- Base and freshly read-back public `main`:
  `7e8ac7feda46df76a2e1fc02db1c1759a1442021` (PR #144).
- No dependency/lockfile change is part of this candidate.
- The September 4 paused diff was preserved. Production, hosted Supabase,
  Railway settings, secrets and other dirty worktrees were not modified.

## Implemented candidate boundaries

- Direct image/Voice and report screenshot external transfers require explicit,
  prompt/chat/media/report-flow-bound consent with a ten-minute TTL. Atomic
  metadata-only DB claims authorize at most one transfer; consumed/cancelled
  grants cannot authorize a replay. Requests reject redirects and use one
  attempt without fallback, with a final leader/update fence check.
- Web OCR stages locally and discloses external transfer before explicit send.
  Cancellation is local; HTTP-request consent is not durable Web idempotency.
  Repeated approved HTTP requests may resend an image.
- Report text credentials are diverted before target hashing/draft storage.
- Protected runtime admin policy rejects missing/false/invalid AAL2 flags.
- Public IP headers are ignored until edge trust is explicitly verified.
- Appeals return the same public success shape for new/already-open submissions;
  timing/spam follow-ups remain open. Webhook secrets use fixed-length digest
  comparison before body parsing.

## Checks actually run

| Gate                                                     | Result                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| Vitest, network denied by global setup                   | 191 files, 15,509/15,509 passed, zero pending/failing              |
| `tsc --noEmit`                                           | PASS                                                               |
| Full ESLint                                              | 0 errors, 8 existing Fast Refresh warnings                         |
| Vite production build                                    | PASS; existing large-client-chunk warning                          |
| Fresh local Supabase, CLI 2.104.0, PostgreSQL 17         | All 34 migrations applied                                          |
| `supabase db lint --local --level error --fail-on error` | PASS                                                               |
| `supabase test db --local`                               | 5 files, 154/154; consent suite 62 assertions                      |
| Atomic claim proof                                       | PASS twice; 1 winner among 2 overlapping claims, later replay miss |
| Fixture cleanup read-back                                | Zero consent fixture rows; sentinel only after cleanup             |
| Actionlint 1.7.12, candidate CI workflow                 | PASS                                                               |
| Responsive browser checks                                | No overflow at 320/375/390/768/1024/1280/1440/1920                 |

The isolated DB project is `scam-guard-consent-proof-20261007`, under ignored
`output/playwright/consent-db`, with a separate port `54332`. It uses no
linked/remote CLI command or production credential. Existing Docker project
containers/data were not reset or deleted.

The persisted script is `scripts/local-media-consent-concurrency-proof.ts`.
Native Windows `psql` is absent, so the proof ran with Bun 1.3.14 and `psql` in
a disposable Debian PostgreSQL 17 runner sharing the isolated DB container
network. A copied glibc Bun binary could not run in the Alpine DB image;
switching the runner resolved that environment issue. The script was unchanged.
Both contenders had independent backend PIDs and reached an advisory barrier.
The loser was observed in `pg_blocking_pids` behind the uncommitted winner
before the winner committed.

Exact accepted sentinel:

```text
Local media-consent concurrency proof: PASS (2 concurrent claims + 1 replay, 1 winner, 0 media calls)
```

Artifacts and JSON test report are local-only in `output/playwright/`. UI build
used fake loopback Supabase public configuration, not production values.
Homepage consent/cancel was checked at all eight widths; cancel caused zero
server-function dispatches. The first review tested `/admin` only as an
unauthenticated redirect to `/login`. A subsequent real local Auth/TOTP review
now covers authenticated admin top/queue/appeals/detail at all eight widths
and four protected read functions with AAL2/AAL1/non-admin/unauthenticated
controls. See `LOCAL_ADMIN_REVIEW_2026-10-07.md` for the isolated stack, unchanged
CSP, cleanup, failed harness attempts and the remaining 320px label-fit issue.
Production authentication, moderation mutations, and real Desktop/Android/iOS
Telegram rendering are **NOT VERIFIED** by that local review.

## Remaining ordered gates

The first hosted run `37589352839` failed only its container gate on seven
fixed High/Critical Perl advisories: inherited `perl-base` was
`5.36.0-7+deb12u3`, fixed floor `5.36.0-7+deb12u4`. The Dockerfile now upgrades
that package from the Debian mirror and asserts the fixed version floor before
removing apt indexes. No Trivy exclusion or threshold was weakened. The updated
container subsequently passed the fresh hosted scan on application head
`c67fca77e2ace2e9c54a0dcde5b01b26cdf0e772`, Security run `37590797252`.
The original failure remains part of the history, not an unresolved final gate.

The Docker builder now pins Bun `1.3.14`, matching CI instead of floating `:1`
(which resolved to `1.4.2` locally). `.dockerignore` excludes local `output/`
and `.playwright-cli/` evidence so it cannot enter the build context. The
existing toolchain contract test protects these rules and the Perl fixed floor.

The final local image built successfully and read-back returned Node `v22.23.3`,
`perl-base 5.36.0-7+deb12u4` and runtime UID `1000`. Docker's two key-name warnings
refer to build arguments for Supabase **publishable** keys, not service-role
secrets. No real credential was supplied to this local build.

Two unrestricted parallel local reruns were not green: three and then two tests
failed; the diagnostic rerun identified the existing 5-second timeout on the
massive semantic/Inline tests. The four-file focused run passed 334/334. The
complete suite then passed **191 files, 15,509/15,509** with `--maxWorkers=2`
in 70.70 seconds. No test timeout, assertion or CI policy was changed. Retain
these failed-run artifacts rather than presenting only the successful retry;
hosted CI then repeated the normal repository command (no worker override)
on `c67fca7` successfully: 191 files, 15,509 tests, run `37590797245`.
All seven hosted checks passed, including clean DB, 154 pgTAP assertions,
the real concurrency sentinel, coverage, CodeQL, Gitleaks and container/SBOM.
Coverage read-back was 87.13% statements and 82.32% branches. Documentation
changes after that application head require their own exact-head CI result;
the successful run above is not silently reassigned to a newer commit.

1. PR #149 is published as Draft/HOLD and hosted gates passed on `c67fca7`.
   Keep later exact-head CI and review decisions separate from that evidence.
2. Prove Railway edge overwrites/strips spoofed `X-Real-IP`; keep the trust flag
   off until verified. Read-only inventory found no staging service. A temporary
   isolated probe needs owner approval; ordinary `/healthz`, edge access logs
   and the public routing diagnostic do not expose the application-received
   header. Local authenticated admin review is recorded with its open UI issue.
3. Obtain a separate owner release decision. Freeze changes, disable delivery
   without dropping pending updates and disable raw providers, drain old image
   and leases, apply/read back migration, verify the consent-aware app while
   disabled, prove old-image absence, then re-enable provider/polling access.
4. Open a new exact-baseline canary and complete critical real-client acceptance.
5. Continue P2 work in `OPEN_TASKS.md`, backup trust/restore gates, remaining
   persona shards and the controlled pilot. Internal tests do not close them.
