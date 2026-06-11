# Implementation Plan

## Tasks

- [x] 1. Create spec documents for Telegram Response UX Compression v1.
- [x] 2. Add compact emergency card data for all panic scenarios and languages.
- [x] 3. Split detailed emergency rendering into `buildDetailedPanicScenarioText`.
- [x] 4. Make `panicctx:full` use the detailed renderer.
- [x] 5. Remove repeated generic `share_advice` from the default emergency follow-up keyboard while keeping the callback handler.
- [x] 6. Update scenario 1 menu wording to "Я уже отправил SMS-код" and equivalents.
- [x] 7. Update and add tests for compact cards, full checklists, and keyboard shape.
- [x] 8. Run targeted tests, full tests, typecheck, lint/build, then deploy.

## Notes

- Callback data remains stable.
- This feature compresses presentation only; it does not change risk scoring, storage, or moderation.
