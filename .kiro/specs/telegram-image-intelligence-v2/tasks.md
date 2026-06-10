# Implementation Plan

- [x] 1. Create `src/lib/risk/image-intelligence.ts` with structured evidence types, sanitizer, fallback classifier, explanation builder, and check-input builder.
- [x] 2. Add `analyzeImageCore` to `src/lib/risk/check-core.ts` using strict JSON vision prompt and existing AI circuit breaker.
- [x] 3. Update Telegram `handleImage` to use structured image analysis before `runCheck`.
- [x] 4. Add unit tests for menu QR, delivery SMS, QR login/payment, redaction, and invalid JSON fallback.
- [x] 5. Update webhook integration tests for the new photo path and no-image-storage guarantee.
- [x] 6. Harden unreadable-image fallback from live QA.
  - [x] Reject low-information model output such as "could not read the image" as unusable evidence.
  - [x] Store only safe `image_unreadable` context for OCR/QR failures; never store raw image bytes, file paths or extracted text in the snapshot.
  - [x] Send a shorter repeat fallback for repeated standalone unreadable images and keep album duplicate suppression.
- [x] 7. Run full tests, typecheck, lint, build, security review, deploy.
