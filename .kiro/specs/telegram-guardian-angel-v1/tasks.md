# Implementation Plan

## Tasks

- [x] 1. Create requirements/design/tasks for Guardian Angel v1.
- [x] 2. Add `GuardianAngelSnapshot` as privacy-safe session metadata.
- [x] 3. Implement `guardian-angel.ts` templates, callbacks, keyboard and follow-up classifier.
- [x] 4. Send a short companion message after high-risk Telegram checks.
- [x] 5. Route `guardian:*` callbacks through the existing callback handler.
- [x] 6. Route short natural follow-ups to Guardian Angel before generic last-check follow-ups.
- [x] 7. Clear stale Guardian Angel context on non-high-risk/new unreadable-image checks.
- [x] 8. Add unit and handler regression tests.
- [x] 9. Update AI docs, roadmap and function map.
- [x] 10. Run full verification, commit and push.

## Notes

- V1 intentionally does not implement a two-hour reminder because that requires scheduler/cron and opt-out design.
- V1 reuses Family Shield for trusted-contact notifications and does not create a new table.
