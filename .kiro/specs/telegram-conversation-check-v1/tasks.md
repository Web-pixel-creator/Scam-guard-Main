# Implementation Plan

## Tasks

- [x] 1. Create privacy-first requirements/design/tasks for Conversation Check v1.
- [x] 2. Add `conversation_check` scenario and `ConversationDraftSnapshot`
      session type with raw-evidence exclusion tests.
- [x] 3. Add localized entry/cancel/analyze buttons and copy.
- [x] 4. Implement deterministic `conversation-check.ts` stage/action extractor.
- [x] 5. Implement Telegram collector: start, collect text/forwarded text,
      reject unsupported media, cancel, expire and analyze.
- [x] 6. Render compact RU/UZ/EN conversation result without raw transcript
      persistence.
- [x] 7. Persist only a normal privacy-safe `lastCheck` snapshot after analysis.
- [x] 8. Add handler and router regression tests for normal checks not being
      captured outside explicit conversation mode.
- [x] 9. Update tracker/docs, run focused Telegram/risk tests and commit.

## Notes

- V1 intentionally avoids storing raw conversations in `telegram_sessions`.
- V1 should not route images, voice notes or contacts into the conversation
  draft; those remain single-item checks until separate redacted media grouping
  is designed.
- A future pig-butchering memory layer can reuse the stage/action extractor, but
  it needs a separate consent, retention and deletion design before any
  long-lived profile is stored.
