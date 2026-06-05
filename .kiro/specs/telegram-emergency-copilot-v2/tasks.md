# Implementation Plan: Telegram Emergency Copilot v2

## Tasks

- [x] 1. Extend Telegram session data with optional `lastPanicId` and `lastPanicAt` fields
- [x] 2. Add emergency context helpers in `emergency.ts`
- [x] 3. Persist panic context when a `panic:N` or live-call callback is selected
- [x] 4. Add `panicctx:*` callback handling for contacts, trusted-person help, script, and full checklist
- [x] 5. Route short emergency follow-up messages before the generic risk pipeline
- [x] 6. Rewrite trusted-person/live-call text to be elder-friendly and action-oriented
- [x] 7. Add unit tests for follow-up classification and formatting
- [x] 8. Add webhook integration tests for APK/card/live-call follow-ups
- [x] 9. Verify lint, typecheck, tests, build, deploy

## Notes

- This feature intentionally does not change the built-in Telegram command menu because Telegram controls its visual style.
- The "wow" improvement comes from contextual guidance and fewer dead-end replies, not from decorative text alone.
