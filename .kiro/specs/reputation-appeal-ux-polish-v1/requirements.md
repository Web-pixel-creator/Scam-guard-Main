# Requirements Document

## Introduction

Reputation Appeals v1 already provides a privacy-safe database flow for correcting a public Ishonch Guard reputation record. This polish layer makes the feature understandable from the website and Telegram bot without confusing it with `/report`.

## Requirements

### Requirement 1: Clear Appeal vs Report Boundary

**User Story:** As a user, I want to know whether I should file a new report or appeal an existing record, so that I do not send the wrong request.

#### Acceptance Criteria

1. WHEN a user opens `/appeal`, THE Website SHALL explain that appeals are only for correcting an existing Ishonch Guard reputation record.
2. THE Website SHALL explain that new scam incidents should go through `/report` or the report flow, not the appeal form.
3. THE Website SHALL show examples of valid appeal targets: phone number, Telegram username/link, URL, or APK URL.
4. THE Website SHALL warn users not to send SMS codes, PIN, CVV, passwords, seed phrases, or document photos.

### Requirement 2: Telegram Appeal Entrypoint

**User Story:** As a Telegram user, I want a simple way to correct an incorrect reputation label, so that I do not need to search the website manually.

#### Acceptance Criteria

1. WHEN the user sends `/appeal`, THE Bot SHALL explain what an appeal is in calm language.
2. THE Bot SHALL provide a URL button to the public appeal form.
3. THE Bot SHALL provide a secondary action to start `/report` for new scam incidents.
4. THE Bot SHALL keep `/appeal` out of the main quick-action menu to avoid adding more visual clutter.
5. THE Bot SHALL include `/appeal` in `/help`.

### Requirement 3: Safe Configuration

**User Story:** As an operator, I want appeal links to use the correct production URL without leaking secrets, so that bot buttons stay valid across environments.

#### Acceptance Criteria

1. THE server config SHALL expose a public app URL helper.
2. THE helper SHALL read `PUBLIC_APP_URL` when present.
3. THE helper SHALL fall back to the current production URL when missing or malformed.
4. THE helper SHALL never read or expose secrets.

### Requirement 4: Verification

**User Story:** As the maintainer, I want tests to cover the new entrypoint, so that future menu changes do not break the appeal flow.

#### Acceptance Criteria

1. THE command parser SHALL recognize `/appeal`.
2. THE Telegram webhook integration test SHALL verify that `/appeal` sends a URL button.
3. THE existing main menu tests SHALL continue to prove that `/start` stays compact.
4. THE implementation SHALL pass TypeScript, targeted tests, full tests, and production build.
