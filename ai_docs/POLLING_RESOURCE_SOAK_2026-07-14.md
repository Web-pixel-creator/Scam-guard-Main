# Polling/resource soak evidence — 2026-07-14

## Decision

The bounded production-shaped polling/resource run passed. This closes the
60-minute in-container soak sub-gate, but it does not close `RES-004` by itself.
An actual Railway instance restart with polling-leader re-election and one
approved real Telegram update, plus the dedicated QR-worker corpus and
crash/restart checks, remain required.

## Build identity

- Git commit: `868eb18d410f2616030a92b410a36b6bc3784c4e`
- Pull request: `#89`
- Railway deployment: `24b9cb4a-aefe-4807-9d2b-84fc6f931f3b` (`SUCCESS`)
- Railway image digest:
  `sha256:1a31e7b129757c8728ba46541f89bc048c4f71cc3bf15b8b481a08bbc9c8099c`
- Builder/runtime: Dockerfile / Railway V2, one production replica

The runner was executed from the deployed image with:

```powershell
node dist/ops/polling-resource-soak.mjs --duration-minutes=60
```

It used controlled in-memory updates and the real
`runTelegramPollingCycleCore` lifecycle. It did not call Telegram, Supabase,
the AI provider or a reputation provider, and did not persist synthetic rows or
user data.

## Sanitized final metrics

| Metric                                          |                    Result |
| ----------------------------------------------- | ------------------------: |
| Requested / elapsed duration                    |   3,600.00 s / 3,600.04 s |
| Generated / completed / modeled outward effects |  36,000 / 36,000 / 36,000 |
| Lost updates / duplicate effects                |                     0 / 0 |
| Retries / maximum attempts                      |                     3 / 2 |
| Final / maximum queue depth                     |                    0 / 35 |
| Final / maximum RSS                             |    98.00 MiB / 101.41 MiB |
| RSS growth from cold runner                     |                 53.74 MiB |
| Final heap / external memory                    |      29.11 MiB / 8.65 MiB |
| Event-loop mean / p99 / maximum                 |  20.12 / 21.84 / 41.45 ms |
| Update latency p95 / p99 / maximum              | 1.13 / 2.57 / 3,314.39 ms |
| CPU user / system over one hour                 |   25,173.02 / 2,447.02 ms |
| Media admission fixtures                        | 180 accepted / 0 rejected |

`SOAK_FINAL.passed=true` with an empty `failures` list. The run also confirmed:

- stale-leader rejection;
- replay after loss of the process-local offset;
- recovery from a pre-effect failure;
- recovery from completion-acknowledgement loss without a duplicate modeled
  outward effect.

After completion the isolated `tmux` session was deleted and public
`GET /healthz` returned `200 ok`.

## Evidence boundary and remaining work

This is a deterministic failure-model and resource test. It is not evidence of
exactly-once Telegram delivery, a physical container restart, a real Bot API
update, or execution of the QR decoder. At the time of this run the QR corpus
and worker-recovery checks were still open; they passed later on 2026-07-14 and
are recorded separately in `QR_WORKER_RESOURCE_SOAK_2026-07-14.md`.

The following remains open for `RES-004`:

1. restart the Railway instance in an approved window and capture polling-leader
   re-election, empty pending queue and one approved QA update with no duplicate
   reply;
2. retain only sanitized counts and timings in release evidence.
