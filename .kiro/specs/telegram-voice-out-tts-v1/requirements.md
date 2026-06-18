# Requirements

## Introduction

Voice-out/TTS v1 lets stressed or elderly Telegram users hear a short safety
tip from SOS and Guardian Angel flows. It is opt-in, privacy-preserving and
must never speak sensitive user evidence back to the user.

## Requirements

### Requirement 1: Opt-In Voice Guidance

**User Story:** As a stressed user, I want to hear one short safe instruction,
so that I do not need to read a long message while panicking.

#### Acceptance Criteria

1. WHEN a SOS follow-up keyboard is shown THEN it SHALL include an opt-in
   voice guidance button.
2. WHEN a Guardian Angel keyboard is shown THEN it SHALL include an opt-in
   voice guidance button.
3. The bot SHALL NOT send voice automatically after checks or SOS actions.
4. Voice guidance SHALL be available in RU, UZ and EN.
5. WHEN a voice button is shown under a specific SOS follow-up card THEN the
   spoken text SHALL match that follow-up card, not only the generic scenario
   summary.

### Requirement 2: Privacy And Safety Boundary

**User Story:** As the project owner, I want TTS to use only safe scripts, so
that the bot cannot leak or repeat secrets aloud.

#### Acceptance Criteria

1. Voice guidance SHALL be generated from scenario ids or safe Guardian summary
   metadata, not raw user messages, URLs, OCR, screenshots or phone numbers.
2. Before synthesis, text SHALL strip URLs, Telegram usernames and long digit
   runs.
3. Text that appears to contain SMS/OTP/PIN/CVV/password-like secrets SHALL
   fail closed and SHALL NOT be synthesized.
4. Voice-out SHALL NOT persist raw audio, generated audio or raw user evidence.

### Requirement 3: Provider Isolation And Degradation

**User Story:** As an operator, I want audio to work only when safely
configured, so that Gemini/chat endpoints are not misused as speech endpoints.

#### Acceptance Criteria

1. Voice-out SHALL use `OPENAI_TTS_API_KEY` / `OPENAI_TTS_*` when configured.
2. The existing `OPENAI_API_KEY` MAY be reused only when `OPENAI_BASE_URL` is
   not Gemini-like.
3. Gemini/OpenAI-compatible chat endpoints SHALL NOT be treated as speech
   endpoints.
4. Missing config, provider errors, oversized audio or unsafe text SHALL degrade
   to a short text fallback.

### Requirement 4: Abuse Control

**User Story:** As the service owner, I want a separate voice budget, so that
TTS cannot be abused to burn quota.

#### Acceptance Criteria

1. Voice-out SHALL apply a separate per-user daily budget.
2. Rate-limit keys SHALL be hashed by the existing shared limiter in production.
3. The fallback path SHALL keep the recovery keyboard available.
4. Tests SHALL cover callback parsing, provider isolation, sanitization,
   fallback and representative SOS/Guardian scripts.
5. Repeated taps for the same voice text SHALL NOT create duplicate provider
   calls during the short duplicate window.
6. The bot SHOULD send a best-effort Telegram voice/upload chat action before
   synthesis so the user understands that audio generation is in progress.
