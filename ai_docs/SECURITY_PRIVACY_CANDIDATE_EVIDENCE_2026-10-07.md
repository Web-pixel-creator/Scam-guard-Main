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
server-function dispatches. `/admin` was tested only as an unauthenticated
redirect to `/login`. Authenticated operator layout and real Desktop/Android/iOS
Telegram rendering are **NOT VERIFIED** here.

## Remaining ordered gates

1. Publish only a Draft/HOLD PR and verify hosted CI on its exact head, including
   clean DB, pgTAP, concurrency, coverage, CodeQL, Gitleaks and container/SBOM.
2. Prove Railway edge overwrites/strips spoofed `X-Real-IP`; keep the trust flag
   off until verified. Complete authenticated admin viewport review.
3. Obtain a separate owner release decision. Freeze changes, disable delivery
   without dropping pending updates and disable raw providers, drain old image
   and leases, apply/read back migration, verify the consent-aware app while
   disabled, prove old-image absence, then re-enable provider/polling access.
4. Open a new exact-baseline canary and complete critical real-client acceptance.
5. Continue P2 work in `OPEN_TASKS.md`, backup trust/restore gates, remaining
   persona shards and the controlled pilot. Internal tests do not close them.
