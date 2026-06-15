# Implementation Plan

## Tasks

- [x] 1. Create the SOS Ready Phrase Fix v1 spec.
- [x] 2. Add a panic follow-up profile mapper for current SOS scenarios.
- [x] 3. Make contact/help button labels scenario-specific.
- [x] 4. Split contact guidance into safe callback, Telegram recovery, personal-safety help and romance-support branches.
- [x] 5. Rewrite trusted-person guidance so non-bank scenarios do not mention bank callback.
- [x] 6. Rewrite ready phrases for APK, Telegram takeover, blackmail/minor safety and romance scams.
- [x] 7. Expand follow-up routing for "куда обратиться", police/support and UZCERT wording.
- [x] 8. Add targeted tests for routing, keyboards and scenario-specific text.
- [x] 9. Run targeted tests, full tests, typecheck, lint/build and production smoke before deploy.

## Notes

- This is a copy/routing fix for existing SOS scenarios.
- New SOS scenario IDs for voice-clone, fake job, delivery/top-up, crypto/TON/card and government grants remain a separate roadmap item.
