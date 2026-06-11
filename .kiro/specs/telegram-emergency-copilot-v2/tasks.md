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
- [x] 10. Harden natural follow-up UX after live feedback
  - Add one-tap "what next" follow-up button
  - Broaden free-text matching for bank hotlines, stress, elderly users and trusted-person phrasing
  - Prefer trusted-person help when a message combines "what to say" with family/close-person wording
  - Add regression tests for the exact phrases seen in live Telegram testing
- [x] 11. Polish live-call and trusted-person guidance after production feedback
  - Make the first live-call answer a guided "say this, hang up, then tap" flow
  - Rename follow-up buttons to action-oriented labels
  - Rewrite safe-callback, ready-phrase and trusted-person answers for stressed/elderly users
  - Add regression tests for guided live-call follow-up text
- [x] 12. Add human guidance cues to the first panic scenario cards
  - Keep the urgent action as the first content line
  - Add a short reassurance/explanation cue for scenarios 1-6
  - Add regression tests for APK, card-data and live-call first-card wording

## Notes

- This feature intentionally does not change the built-in Telegram command menu because Telegram controls its visual style.
- The "wow" improvement comes from contextual guidance and fewer dead-end replies, not from decorative text alone.
