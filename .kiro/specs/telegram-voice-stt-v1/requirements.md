# Telegram Voice STT v1 Requirements

## Overview

Telegram users, especially older users, must be able to describe a suspicious call or message by voice. The bot should transcribe short voice notes, redact sensitive content, and run the existing deterministic risk pipeline. Voice handling must be privacy-first and degrade clearly when transcription is unavailable.

## Requirements

### Requirement 1: Voice Note Routing

**User Story:** As a Telegram user, I want to send a voice note describing a suspicious situation, so that I do not have to type while stressed.

#### Acceptance Criteria

1. WHEN a Telegram message contains a `voice.file_id` and no stronger text evidence THEN the router SHALL dispatch it to a voice handler.
2. WHEN a voice message has a caption or hidden URL evidence THEN the router SHALL keep using the text check path first.
3. WHEN a user is inside an active scenario THEN voice input SHALL not silently alter report/check scenario state.

### Requirement 2: Privacy-Safe Transcription

**User Story:** As a user, I want the bot to understand my voice without storing my recording or exposing sensitive codes.

#### Acceptance Criteria

1. WHEN a voice file is processed THEN the file SHALL be downloaded only in memory.
2. WHEN transcription succeeds THEN OTP codes, phone numbers, card numbers, PINs, and passwords SHALL be redacted before the text is passed to persistence.
3. WHEN transcription fails THEN no raw audio, raw transcript, or partial sensitive text SHALL be stored.
4. WHEN provider credentials are missing or unavailable THEN the bot SHALL degrade with a localized, actionable fallback.

### Requirement 3: Risk Pipeline Integration

**User Story:** As a user, I want the voice note to be checked by the same rules as normal text.

#### Acceptance Criteria

1. WHEN transcription returns usable text THEN the bot SHALL call `runCheck` with `channel="telegram"` and rate-limit key `tg:<telegram_user_id>`.
2. WHEN transcription returns text longer than the check limit THEN the text SHALL be clipped to the supported length before checking.
3. WHEN the transcript contains scam phrases such as SMS code, card data, APK, bank caller, Telegram login, wallet, or payment THEN existing reason codes SHALL determine the risk level.
4. WHEN the transcript clearly says the user already sent an SMS/OTP code, installed an APK/app, transferred money, entered card data, lost Telegram access, or is currently on a risky call THEN the bot SHALL route directly to the matching emergency flow instead of waiting for the normal risk-card path.

### Requirement 4: User Experience

**User Story:** As a stressed user, I want the bot to answer calmly and tell me what to do next.

#### Acceptance Criteria

1. WHEN voice transcription fails THEN the bot SHALL explain that it could not reliably understand the voice and ask for one short summary: what was promised and what was requested.
2. WHEN voice transcription fails THEN the bot SHALL offer emergency and check-again actions.
3. WHEN voice transcription succeeds THEN the bot SHALL return the normal compact risk card, not a separate wall of transcript text.
4. WHEN voice transcription takes noticeable time THEN the bot SHALL show a non-message Telegram activity indicator so the chat does not look frozen.

### Requirement 5: Limits and Abuse Resistance

**User Story:** As the project owner, I want voice processing to be safe against cost abuse and oversized files.

#### Acceptance Criteria

1. WHEN a voice file exceeds the configured maximum size or 60 seconds THEN the bot SHALL reject it with a localized message before downloading or calling STT.
2. WHEN a user exceeds the voice STT daily budget THEN the bot SHALL not download the file or call STT and SHALL return the existing friendly rate-limit message.
3. WHEN a user resends the same Telegram `file_unique_id` within the cache window THEN the bot SHALL reuse the cached redacted transcript and SHALL not call STT again.
4. WHEN a user exceeds check rate limits THEN the bot SHALL return the existing friendly rate-limit message.
5. WHEN the STT provider is slow or fails THEN the bot SHALL time out and degrade without retry storms.
6. WHEN the voice STT budget is exhausted THEN the bot SHALL explain that the limit protects against spam/cost abuse and SHALL suggest typing a short summary or using emergency actions.
