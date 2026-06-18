# Telegram Voice STT v1 Tasks

## 1. Spec and routing

- [x] 1.1 Create requirements, design, and task list.
- [x] 1.2 Add typed Telegram `voice` schema.
- [x] 1.3 Add `voice` route action and handler contract.
- [x] 1.4 Update router tests for voice routing and caption precedence.

## 2. STT core

- [x] 2.1 Add `transcribeVoiceCore`.
- [x] 2.2 Support Gemini native audio path.
- [x] 2.3 Support OpenAI-compatible audio transcription path.
- [x] 2.4 Redact and clamp transcript output.
- [x] 2.5 Add STT unit tests.

## 3. Telegram handler

- [x] 3.1 Add localized voice size/fallback messages.
- [x] 3.2 Implement `handleVoice`.
- [x] 3.3 Wire `handleVoice` in handler aggregator.
- [x] 3.4 Add handler tests for success, fallback, size, and rate-limit key.

## 4. Documentation and verification

- [x] 4.1 Update AI docs and deployment notes.
- [x] 4.2 Run tests, lint, build, security scan.
- [x] 4.3 Commit, push, deploy, and run production smoke.

## 5. Cost guard polish

- [x] 5.1 Lower accepted voice duration to 60 seconds.
- [x] 5.2 Add a separate 5/day STT budget per Telegram user.
- [x] 5.3 Cache redacted transcripts for repeated `file_unique_id` values.
- [x] 5.4 Keep STT-core free of user budget decisions so voice does not double-consume the normal check limit.
- [x] 5.5 Add regression tests for budget, cache reuse and long-voice rejection.

## 6. Voice-in UX hardening

- [x] 6.1 Show a fast non-message typing indicator while STT is slow, with repeat actions for long provider calls.
- [x] 6.2 Add a dedicated exhausted-STT-budget message that explains the spam/cost guard and offers typed summary or emergency actions.
- [x] 6.3 Route obvious already-happened voice transcripts to the matching emergency flow before the normal risk card.
- [x] 6.4 Add regression tests for slow-STT waiting state and voice-to-panic routing.
