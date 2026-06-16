# Requirements

## Introduction

After a high-risk check, Ishonch Guard should feel like a calm companion, not a one-off verdict card. Guardian Angel v1 adds immediate post-verdict guidance: one safe step, confirmation, safe callback, trusted-contact help and a full plan, while preserving the project's privacy boundary.

## Requirements

### Requirement 1: Post-High-Risk Continuation

**User Story:** As a stressed user who received a high-risk result, I want the bot to keep guiding me, so that I know the next safe action without rereading a long checklist.

#### Acceptance Criteria

1. WHEN a Telegram check result is `high_risk` THEN the bot SHALL send a short companion message after the result card.
2. The companion message SHALL lead with one next best action, not a long generic checklist.
3. The companion keyboard SHALL include next step, done/confirmation, safe callback, trusted contact, full plan and new check actions.
4. The companion message SHALL be available in RU, UZ and EN.

### Requirement 2: Privacy-Safe Context

**User Story:** As the project owner, I want post-risk guidance to remember only safe metadata, so that session state never stores sensitive evidence.

#### Acceptance Criteria

1. Guardian Angel context SHALL store only risk level, input type, reason codes and timestamp.
2. It SHALL NOT store raw user text, URLs, phone numbers, card data, OTP/SMS codes, OCR text, images, files or screenshots.
3. Non-high-risk checks and unreadable-image fallbacks SHALL clear stale Guardian Angel context.
4. The existing `telegram_sessions.scenario_data` JSONB storage SHALL be reused; no new database table is required for v1.

### Requirement 3: Follow-Up Routing

**User Story:** As a user who asks "what next?" after a dangerous result, I want the bot to answer in context, so that it does not fall back to "not enough data".

#### Acceptance Criteria

1. Short follow-ups like "что дальше?", "дай номер банка", "готово" and "весь чеклист" SHALL route to Guardian Angel when a recent high-risk context exists.
2. New artifacts such as URLs, phone numbers, Telegram usernames or links SHALL still go through the normal risk pipeline.
3. Recent panic/live-call context SHALL keep priority over Guardian Angel context.
4. Stale Guardian Angel context SHALL be ignored.

### Requirement 4: Safe Help Actions

**User Story:** As a user in panic, I want practical buttons, so that I can move from risk verdict to safe action quickly.

#### Acceptance Criteria

1. "Safe callback" SHALL tell the user not to call incoming/SMS numbers and to use the bank app, card or official website.
2. "Trusted contact" SHALL reuse Family Shield and send only a short redacted alert.
3. "Done" SHALL acknowledge progress and suggest the next safe action.
4. "Full plan" SHALL stay concise and SHALL NOT ask the user to repeat secrets.

### Requirement 5: Regression Coverage

**User Story:** As a maintainer, I want tests for the post-risk flow, so that future result formatting changes do not break the companion behavior.

#### Acceptance Criteria

1. Unit tests SHALL assert the snapshot contains no raw evidence.
2. Unit tests SHALL assert Guardian Angel callback keyboards include the expected action callbacks.
3. Handler tests SHALL assert high-risk checks send a companion message and store safe metadata.
4. Callback tests SHALL assert stored context is used and missing context degrades honestly.
