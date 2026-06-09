# Tasks: AI Provider Resilience v1

- [x] 1. Add retry helper constants and transient-status classifier in `check-core.ts`.
- [x] 2. Refactor primary and fallback chat completion calls to use the shared retry helper.
- [x] 3. Preserve circuit breaker accounting: one logical failure after exhausted attempts, success after successful retry.
- [x] 4. Add regression tests for 503->200, 401 no retry, and repeated transient failure.
- [x] 5. Run full verification, security/secret scan, commit, deploy, and production smoke-test.
