# Tasks: Telegram Context Router v2

## 1. Extend Last-Check Follow-Up Actions

- [x] Add typed actions: `confidence`, `next_steps`, `contacts`, `explain`.
- [x] Add deterministic RU/UZ/EN patterns for short follow-up questions.
- [x] Include short English confidence follow-ups such as `sure?`.
- [x] Keep payload override conservative.
- [x] Add orphan follow-up handling for short helper phrases when no `lastCheck` snapshot is available.

## 2. Render Contextual Replies

- [x] Add context-specific confidence text.
- [x] Add context-specific next-step text.
- [x] Add official-contact guidance for phone/bank/payment/high-risk contexts.
- [x] Add plain-language explanation for "why so?" / "why this result?" style questions.
- [x] Add unreadable-image follow-up copy that explains the vision/OCR limitation and asks for concrete evidence.

## 3. Integrate Safely

- [x] Preserve callback > command > scenario > meta-intent > check priority.
- [x] Persist only safe `LastCheckSnapshot` metadata.
- [x] Persist `image_unreadable` context after OCR/QR failure so follow-up questions do not enter the risk pipeline.
- [x] Keep `check_another` as a fresh `await_check` flow.

## 4. Regression Tests

- [x] Unit-test action classification and payload override.
- [x] Integration-test QR/menu follow-up.
- [x] Integration-test phone contact follow-up.
- [x] Integration-test high-risk next steps.
- [x] Integration-test callback separation.
- [x] Integration-test orphan follow-up phrases so they do not create fake insufficient-data checks.
- [x] Integration-test unreadable-image follow-ups and repeated unreadable image fallback behavior.

## 5. Verification And Release

- [x] Run targeted tests.
- [x] Run full tests, typecheck, lint, build and audit.
- [x] Run diff-focused security scan.
- [x] Open PR, merge after CI, deploy to Railway and smoke-test production.
