# Implementation Plan

- [x] 1. Create shared rate-limit migration
  - Add `rate_limit_buckets` with RLS, service-role grants and TTL index.
  - Add service-role-only `claim_rate_limit()` RPC.
  - Extend `private.prune_app_retention()` for expired buckets.

- [x] 2. Add server helper
  - Implement `checkSharedRateLimit(scope, key, limit, windowMs)`.
  - HMAC raw keys before persistence.
  - Fall back to in-memory limiter when shared storage is unavailable.

- [x] 3. Wire runtime call sites
  - Use shared check limiter in `runCheck`, OCR and image analysis.
  - Use shared report limiter in `submitReportCore`.
  - Use separate public-post scope in Telegram public post fetch.

- [x] 4. Add tests
  - Cover local fallback.
  - Cover privacy of RPC payloads.
  - Cover blocked/retry mapping.
  - Cover RPC failure fallback.
  - Re-run report and public-post regression tests.

- [x] 5. Update docs and security smoke
  - Update database/API/architecture/file/function maps.
  - Update roadmap/open tasks/decisions/changelog.
  - Extend `prod-security-smoke` for `rate_limit_buckets` and
    `claim_rate_limit()`.

- [x] 6. Apply and verify production
  - Push migration to Supabase.
  - Verify RLS/grants/RPC on production.
  - Run production security smoke and monitor after Railway deploy.
