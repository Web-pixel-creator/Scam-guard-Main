# Shared rate-limit failure runtime smoke — 2026-07-14

## Result

`RES-003` and `SG-P0-005` passed their production-runtime acceptance. The
deployed shared limiter denied every forced control-plane failure without
granting a process-local allowance. The real web-check consumer surfaced
`429` before AI, persistence or any other downstream network sink.

## Exact deployed identity

- implementation PR: `#96`;
- complete failure-matrix PR: `#97`;
- exact main: `00f3b11ddaeabecaed1412238edec23861e35c5d`;
- Railway deployment: `6a8ec5f6-e758-4574-8d15-34eb1206ca43`;
- Docker image: `sha256:b4cc9f1138528cb698ca5d26cec136b8ab1bf5c2d7ec7e111371c358564741b9`;
- runtime: Railway V2, Dockerfile builder, one production replica.

## Isolation boundary

The probe is bundled as `dist/ops/shared-rate-limit-failure-smoke.mjs` and runs
only as a short-lived operator process. It is not imported by the application
server and exposes no HTTP, Telegram or client entry point.

Inside the process it installs synthetic Supabase values and replaces `fetch`
with a strict local interceptor. The interceptor rejects every destination
except the synthetic `claim_rate_limit` path and never opens a socket. The
hash-failure case temporarily replaces configurable WebCrypto only inside that
process and restores it in `finally`. Railway variables, application state and
production services are not changed.

## Forced cases

The deployed bundle passed all six required cases:

1. missing shared configuration;
2. HMAC/WebCrypto exception;
3. RPC error response;
4. malformed successful RPC response;
5. RPC transport exception;
6. real `runCheck` consumer returning `rate_limited`, status `429` and a
   60-second retry window before downstream sinks.

Recorded output:

```text
RATE_LIMIT_FAILURE_SMOKE_FINAL {"passed":true,"productionPolicy":true,"isolated":true,"cases":["missing_config","hash_error","rpc_error","invalid_shape","transport_error","consumer_429_before_sinks"],"externalNetworkCalls":0,"databaseWrites":0,"unexpectedSinkCalls":0}
```

The non-production fallback remains covered by the owning tests: at most 4,096
live TTL/LRU buckets, denial of a new identity at capacity and bounded cleanup.

## Verification chain

- local isolated runtime probe: passed;
- focused limiter/toolchain tests: `22/22`;
- repository tests: `8,592/8,592`;
- coverage: statements `83.89%`, branches `77.67%`, functions `90.02%`, lines
  `85.81%` with all configured floors unchanged;
- TypeScript, lint, production build and `npm audit` passed; lint retained only
  the eight existing Fast Refresh warnings;
- PR #96 and PR #97 passed CodeQL, Gitleaks, container/Trivy, CycloneDX SBOM,
  application CI, schema lint, migrations and pgTAP;
- post-probe production smoke passed: home and health `200`, missing webhook
  secret `401`, valid webhook `503` as expected in polling mode, pending updates
  `0`, polling leader `200` and AI provider `200`;
- count-only production observation returned
  `{"ok":true,"total":0,"live":0,"expired":0}` for
  `rate_limit_buckets`; no row content was read or printed.

## Interpretation and residual risk

Fail-closed behavior intentionally trades availability for quota integrity: a
real shared-control outage can temporarily return `429` to legitimate users.
The probe proves the exact deployed code and consumer ordering without causing
a real Supabase outage. Continued monitoring of `429`/degraded events and
bucket volume is an operational watch, not an open correctness finding. Redis
or another shared store is unnecessary unless later latency or volume evidence
shows the Postgres RPC cannot meet the agreed budget.
