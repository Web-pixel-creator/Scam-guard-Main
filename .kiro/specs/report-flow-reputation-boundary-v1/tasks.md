# Implementation Plan

## Completed

- [x] 1. Add shared incident-only report marker and helper.
- [x] 2. Extend `submitReportCore` with `incidentOnly`.
- [x] 3. Store incident-only reports without using description as target value.
- [x] 4. Skip entity upsert/update for incident-only submissions.
- [x] 5. Send `incidentOnly=true` from Telegram no-target report flow.
- [x] 6. Extract and test `moderateReportCore`.
- [x] 7. Skip admin entity sync for incident-only moderation.
- [x] 8. Add regression tests for submit, Telegram scenario and admin moderation.
- [x] 9. Update AI project docs.

## Future Work

- [ ] 10. Replace the schema-compatible marker with an explicit `reports.incident_only`
      column once Supabase migration access is part of the normal deploy flow.
- [ ] 11. Use incident-only report volume for private research analytics without
      exposing it as public reputation.
