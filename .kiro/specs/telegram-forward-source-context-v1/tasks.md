# Tasks: Telegram Forward Source Context v1

- [x] 1. Add pure forward-source context helper
  - [x] 1.1 Define sanitized source context model
  - [x] 1.2 Add localized source brief builder
  - [x] 1.3 Add enrichment helper that preserves verdict fields

- [x] 2. Extend Telegram router
  - [x] 2.1 Parse public forward channel/chat source metadata
  - [x] 2.2 Attach source context to `check` route actions
  - [x] 2.3 Attach source context to `image` route actions without bypassing OCR
  - [x] 2.4 Exclude hidden/private user origins

- [x] 3. Apply enrichment in check/image handlers
  - [x] 3.1 Enrich text check replies after deterministic scoring
  - [x] 3.2 Enrich image/video-thumbnail replies after image evidence explanation
  - [x] 3.3 Keep scored input and DB persistence unchanged

- [x] 4. Add regression tests
  - [x] 4.1 Router tests for forwarded text/image source context
  - [x] 4.2 Pure helper preservation tests
  - [x] 4.3 Webhook test for reply context and non-persistence

- [x] 5. Verify and ship
  - [x] 5.1 Run targeted Telegram tests
  - [x] 5.2 Run full tests, typecheck, lint, build
  - [x] 5.3 Update AI docs and deploy
