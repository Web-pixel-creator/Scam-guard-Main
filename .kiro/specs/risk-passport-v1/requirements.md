# Requirements

## Introduction

Risk Passport v1 makes shallow phone and Telegram username checks useful
without inventing facts. When the bot cannot honestly decide whether a bare
number or username is dangerous, it should not show a generic "not enough data"
card. It should show a compact passport: what is visible, what is unavailable,
what Ishonch Guard knows from moderated records, and what evidence the user
should send next.

## Requirements

### Requirement 1: Unified Passport Response

**User Story:** As a user checking only a phone number or Telegram username, I
want a clear passport of visible facts, so that I understand what the bot can
and cannot know from this artifact alone.

#### Acceptance Criteria

1. WHEN a check target is a bare Telegram username, Telegram link, phone number
   or short code and the result has insufficient direct scam evidence THEN the
   bot SHALL render a Risk Passport instead of a generic "not enough data"
   response.
2. THE passport SHALL include target type, normalized display value and a short
   confidence label.
3. THE passport SHALL include the best visible facts available for that target
   type.
4. THE passport SHALL include a concise "what I cannot see" section for facts
   that are not exposed by Telegram Bot API or phone parsing.

### Requirement 2: Honest Telegram Boundary

**User Story:** As the project owner, I want Telegram account checks to stay
legally and technically honest, so that Ishonch Guard does not copy unsafe
third-party claims.

#### Acceptance Criteria

1. THE passport SHALL NOT claim Telegram account age, hidden SCAM labels,
   Telegram complaint count, spam history, country/DC or owner identity unless
   that fact comes from a documented first-party source available to the bot.
2. THE passport SHALL say that these hidden Telegram facts are not available to
   Ishonch Guard through Bot API.
3. THE passport MAY show public `getChat` metadata only when it was actually
   returned by Telegram.
4. THE passport SHALL clearly separate "sender not confirmed" from "scammer".

### Requirement 3: Phone Passport Signals

**User Story:** As a user receiving calls, I want the bot to explain what is
known from the number itself, so that I can react safely without false blame.

#### Acceptance Criteria

1. THE phone passport SHALL show country/calling-code when available.
2. THE phone passport SHALL show Uzbekistan operator/prefix hints when
   available.
3. THE phone passport SHALL show exact official-directory match status.
4. THE phone passport SHALL show official-number lookalike warnings when
   present, without claiming fraud from similarity alone.
5. THE phone passport SHALL say that owner identity and call intent cannot be
   proven from a number alone.

### Requirement 4: Moderated Reputation Boundary

**User Story:** As a victim or wrongly reported person, I want reputation claims
to be based only on moderated Ishonch Guard records, so that unverified reports
do not publicly accuse people.

#### Acceptance Criteria

1. THE passport SHALL show Ishonch Guard confirmed-report count only for
   moderated records.
2. THE passport SHALL NOT surface pending, rejected or raw user reports.
3. WHEN confirmed reports exist THEN the wording SHALL say "confirmed reports
   in Ishonch Guard" instead of "Telegram says" or "carrier says".
4. WHEN no confirmed reports exist THEN the wording SHALL say this is not proof
   of safety.

### Requirement 5: Next Useful Evidence

**User Story:** As a stressed user, I want the bot to tell me exactly what to
send next, so that I do not get stuck after a shallow result.

#### Acceptance Criteria

1. THE passport SHALL include one short next-step prompt.
2. THE passport SHALL include context buttons for common requests: code, card,
   transfer, APK/app, link/QR, live call and new check.
3. WHEN the user taps a context button THEN the bot SHALL answer with concrete
   safety guidance for that context, not rerun the same inconclusive check.
4. THE "new check" button label SHALL clearly mean checking a different/new
   artifact, not retrying the same target.

### Requirement 6: Mobile Readability

**User Story:** As a mobile Telegram user, I want the passport to be readable
in one screen, so that it feels helpful rather than bureaucratic.

#### Acceptance Criteria

1. THE Telegram passport SHALL target 900 characters or less for the common
   no-report username/phone case.
2. THE passport SHALL use short section anchors and no long walls of text.
3. THE passport SHALL keep the first line useful within five seconds of reading.
4. THE passport SHALL be localized for RU, UZ and EN.

### Requirement 7: Web and Embed Consistency

**User Story:** As a website or iframe user, I want the same honest summary,
so that the Telegram and web surfaces do not contradict each other.

#### Acceptance Criteria

1. THE core passport builder SHALL be pure and reusable outside Telegram.
2. THE web and embed surfaces MAY render a shorter version, but SHALL preserve
   the same evidence boundaries.
3. THE implementation SHALL not store raw phone numbers, usernames, OCR text or
   screenshots while building the passport.
