# Tasks

- [x] 1. Add Voice-out server module
  - [x] Define `voiceout:*` callbacks.
  - [x] Add short RU/UZ/EN SOS and Guardian scripts.
  - [x] Add sanitization, provider isolation and fallback handling.

- [x] 2. Wire Telegram keyboards and callback handling
  - [x] Add opt-in voice buttons to SOS follow-up keyboards.
  - [x] Add opt-in voice button to Guardian Angel keyboard.
  - [x] Bind SOS follow-up voice buttons to the originating follow-up action
        so "what next", "ready phrase", contacts and full-plan cards speak
        their own short text.
  - [x] Handle callbacks through `misc.ts` without changing old
        `panicctx:*`/`guardian:*` contracts.

- [x] 3. Add Bot API audio send helper
  - [x] Add in-memory `sendAudio` multipart helper.
  - [x] Keep no-token/network failures as `{ ok: false }`.

- [x] 4. Add regression coverage
  - [x] Test callback parsing, scripts, Gemini isolation, sanitization and
        fallback.
  - [x] Test action-bound voice callbacks, duplicate-tap idempotency and
        Telegram `upload_voice` waiting action.
  - [x] Update Guardian/SOS keyboard tests.

- [x] 5. Update docs and QA artifact
  - [x] Document `OPENAI_TTS_*` env variables.
  - [x] Mark roadmap/open tasks as shipped.
  - [x] Add Voice-out samples to the generated Telegram QA report.
