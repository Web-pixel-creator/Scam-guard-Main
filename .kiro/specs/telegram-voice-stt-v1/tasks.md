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
