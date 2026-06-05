# Implementation Plan

- [x] 1. Create `src/lib/risk/image-intelligence.ts` with structured evidence types, sanitizer, fallback classifier, explanation builder, and check-input builder.
- [x] 2. Add `analyzeImageCore` to `src/lib/risk/check-core.ts` using strict JSON vision prompt and existing AI circuit breaker.
- [x] 3. Update Telegram `handleImage` to use structured image analysis before `runCheck`.
- [x] 4. Add unit tests for menu QR, delivery SMS, QR login/payment, redaction, and invalid JSON fallback.
- [x] 5. Update webhook integration tests for the new photo path and no-image-storage guarantee.
- [x] 6. Run full tests, typecheck, lint, build, security review, deploy.
