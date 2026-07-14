# Production QR Worker Runtime Evidence — 2026-07-14

## Outcome

The production QR runtime packaging gap is fixed and live-verified. `RES-001`
and `RES-002` are Passed. The later real Railway restart/polling-leader QA is
recorded in `TELEGRAM_RESTART_QA_2026-07-14.md`, so `RES-004` is also Passed.

## Root cause and correction

The QR decoder creates an isolated eval worker whose source resolves `jsqr`,
`jpeg-js` and `pngjs` at runtime. A read-only probe of the previous production
image showed that none of those packages existed under the relocated Node
runtime. Source-runtime tests passed because the development dependency tree was
present, while production QR work could silently fail closed to empty evidence.

PR #94 selectively copies only those three decoder packages into the runtime
image and bundles the isolated QR corpus/resource/crash runner. npm/Corepack,
the build toolchain and unrelated development dependencies remain absent.

## Exact build identity

- GitHub PR: `#94`
- Main commit: `f1ddf3490573e667907beed2a027e468298f954d`
- Railway deployment: `09f984bd-1930-4a2b-a04a-4f4ef46e2058`
- Builder/runtime: Dockerfile / Railway V2 / one replica
- Image digest:
  `sha256:abbba9cf1cb45f7ca4e4e6c5a40a6d78d37ef1c5672aab6def2dbba641a038e5`

Application, database and security CI passed: 8,591 tests, TypeScript, lint with
zero errors and eight existing Fast Refresh warnings, production build,
coverage thresholds, CodeQL, Gitleaks, release-container High/Critical Trivy,
CycloneDX SBOM, Supabase migration/schema lint and pgTAP. `npm audit` reported
zero known vulnerabilities.

The deployed runtime returned `200 ok` from `/healthz` and successfully loaded
all three packages with:

```powershell
railway ssh node --require=jsqr --require=jpeg-js --require=pngjs -p 1
```

## Isolation boundary

The runner builds only generated, non-secret fixtures in memory:

- safe URL PNG QR;
- reserved suspicious-lookalike URL PNG QR;
- text PNG QR;
- safe URL JPEG QR;
- non-QR PNG;
- malformed PNG;
- oversized-dimension PNG header;
- high-resolution non-QR PNG.

It calls the production QR decoder worker directly. It makes no Telegram,
Supabase, AI-provider or reputation-provider call, stores no user data and
performs no persistent write.

## Run history

The first direct SSH invocation reached 360.04 seconds and 3,002 cases with zero
failures, RSS 225.30 MiB and event-loop p99 20.92 ms. The Railway SSH WebSocket
then reset without a closing handshake. This is transport interruption, not a
completed soak, so the run was not used as passing evidence.

The required profile was repeated from the beginning in a detached Railway
`tmux` session:

```powershell
node dist/ops/qr-worker-resource-soak.mjs --duration-minutes=10 --progress-seconds=60
```

## Final result

`QR_SOAK_FINAL.passed=true` after 600.03 seconds:

| Metric                             |                     Result |
| ---------------------------------- | -------------------------: |
| Processed cases                    |                      5,055 |
| Corpus failures                    |                          0 |
| Expected decode passes             |                      2,780 |
| Expected empty/fail-closed passes  |                      2,274 |
| PNG decode passes                  |                      2,087 |
| JPEG decode passes                 |                        693 |
| Queue accepted / rejected          |                      4 / 1 |
| Forced worker termination observed |                       true |
| Interrupted job failed closed      |                       true |
| Decode after worker recreation     |                       true |
| Final / maximum RSS                |        165.88 / 234.60 MiB |
| RSS growth                         |                 110.08 MiB |
| Final heap / external              |            6.49 / 1.80 MiB |
| Event-loop mean / p99 / maximum    |   20.12 / 21.04 / 28.26 ms |
| Decode latency p95 / p99 / maximum | 50.09 / 225.53 / 279.47 ms |
| CPU user / system                  |   151,526.80 / 4,630.17 ms |

The detached session was deleted. The full post-load production smoke passed:
home and health `200`, missing-secret webhook `401`, authenticated webhook `503`
as expected in polling mode, empty webhook URL, pending Telegram updates `0`,
polling leader `200` and AI provider `200`.

## Evidence boundary

This proves production package availability, legitimate PNG/JPEG decoding,
fail-closed invalid/oversized input, bounded queue admission, resource behavior,
forced worker interruption and worker recreation in the exact deployed image.
This QR run does not claim that the main Railway application process physically
restarted or that Telegram delivered a real update. That separate boundary was
closed later on 2026-07-14 with one approved real-client update and privacy-safe
lifecycle read-back, as recorded in `TELEGRAM_RESTART_QA_2026-07-14.md`. Neither
test claims exactly-once delivery.
