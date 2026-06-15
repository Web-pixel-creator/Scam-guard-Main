# Requirements

## Overview

Direct `/call` gives a stressed user a one-command entry into the already shipped live-call copilot. It must not show the broader `/panic` menu first, because a user on an active suspicious call needs one immediate safe action.

## Requirement 1: Direct Live-Call Entry

**User Story:** As a user receiving a suspicious call right now, I want to type or tap `/call`, so that I immediately see what to say and how to end the call safely.

### Acceptance Criteria

1. WHEN the user sends `/call` THEN the bot SHALL open the live-call copilot directly.
2. WHEN `/call` opens THEN the first message SHALL tell the user to end the call and not share codes, PIN, CVV, passwords or card data.
3. WHEN `/call` opens THEN the first keyboard SHALL include the primary action `livecall:hangup`.
4. WHEN `/call` opens THEN it SHALL NOT expose the safe-callback/bank-number action until the user has tapped the hangup flow.

## Requirement 2: Follow-Up Memory

**User Story:** As a user who just opened `/call`, I want follow-up questions like "what should I say?" to stay in the live-call context.

### Acceptance Criteria

1. WHEN `/call` opens THEN the bot SHALL store only panic context id `6` and a timestamp.
2. WHEN the user asks a short follow-up after `/call` THEN existing Emergency Copilot follow-up routing SHALL answer in live-call context.
3. THE stored context SHALL NOT contain raw phone numbers, URLs, screenshots, OCR text, SMS codes, card data or private notes.

## Requirement 3: Command Visibility

**User Story:** As a user, I want `/call` to be visible in Telegram command menus and `/help`, so that I can find it during stress.

### Acceptance Criteria

1. `/call` SHALL be parsed as a known command by the Telegram router.
2. `/call` SHALL be included in localized `setMyCommands` payloads.
3. `/help` SHALL mention `/call` with a short plain-language description in RU, UZ and EN.
