# Requirements Document

## Introduction

Telegram Link & Account Intelligence v2 improves how Ishonch Guard responds to Telegram usernames, public `t.me` links, private invite links, and Telegram promo messages. The goal is to make the bot useful without inventing unavailable facts: it may use Telegram Bot API public metadata, local risk signals, and Ishonch Guard moderated reports, but it must not claim hidden scam labels, account age, spam history, or Telegram report counts unless the data is actually available.

## Requirements

### Requirement 1: Telegram Target Classification

**User Story:** As a user, I want the bot to understand what kind of Telegram target I sent, so that it can give a specific answer instead of generic "not enough data".

#### Acceptance Criteria

1. WHEN input contains a public `@username`, THE system SHALL classify it as a public username and attempt a public metadata lookup.
2. WHEN input contains `https://t.me/<username>` or `https://telegram.me/<username>`, THE system SHALL classify it as a public username link.
3. WHEN input contains `https://t.me/+...` or `joinchat`, THE system SHALL classify it as a private invite and SHALL NOT call `getChat`.
4. WHEN input contains `https://t.me/c/...` or another internal/private path, THE system SHALL classify it as internal/private and SHALL NOT invent chat metadata.
5. WHEN input is not Telegram-related, THE system SHALL leave the normal risk pipeline unchanged.

### Requirement 2: Honest Public Metadata Brief

**User Story:** As a nervous user checking an account, I want to know what the bot could and could not verify, so that I do not overtrust the result.

#### Acceptance Criteria

1. WHEN Telegram public metadata is found, THE bot SHALL mention visible public type/title/access hints and SHALL state that this is not a safety guarantee.
2. WHEN a username is unavailable or not found, THE bot SHALL state that this is not proof of a scam.
3. THE bot SHALL explicitly avoid claiming account age, hidden scam labels, hidden reports, or spam history.
4. THE brief SHALL remain short enough to survive Telegram result-message truncation.
5. THE brief SHALL be localized for ru, uz, and en.

### Requirement 3: Risk Signals and Next Steps

**User Story:** As a user checking a suspicious Telegram promotion, I want the bot to explain the visible signals and next safe action, so that I know what to do next.

#### Acceptance Criteria

1. WHEN risk reasons include private invite, betting/prediction promo, official impersonation, OTP, card, APK, or known reports, THE brief SHALL include up to three compact visible signals.
2. WHEN a private invite is combined with betting/prediction promo language, THE bot SHALL warn against paying for access, predictions, or "guaranteed wins".
3. WHEN an official-looking username cannot be verified, THE bot SHALL ask for message text or a screenshot and recommend checking through the official channel.
4. WHEN credential, OTP, card, or APK signals are present, THE bot SHALL prioritize immediate safety steps.
5. THE signal text SHALL not repeat the full generic result-card content.

### Requirement 4: No False Authority

**User Story:** As a user, I want the bot to be trustworthy, so that it never pretends to have Telegram-internal powers.

#### Acceptance Criteria

1. THE bot SHALL NOT say that an account is new unless a reliable stored first-seen signal exists.
2. THE bot SHALL NOT say that Telegram has marked an account as scam unless the bot can directly observe that status through an allowed API or trusted source.
3. THE bot SHALL NOT say that an account spammed users unless this is backed by moderated Ishonch Guard reports or another explicit source.
4. THE bot SHALL distinguish "not found/unavailable" from "dangerous".
5. THE bot SHALL use cautious wording for all unverified public usernames.

### Requirement 5: Persistence And Reputation

**User Story:** As a product owner, I want account reputation to be source-backed and privacy-safe, so that the bot can become more useful without inventing hidden Telegram facts.

#### Acceptance Criteria

1. THE DB-backed phase SHALL store only hashed identifiers, normalized target type, masked display hint, first_seen_at, last_seen_at, moderated report counters, and source metadata.
2. Reputation labels SHALL include source type and confidence level.
3. User-submitted unverified reports SHALL NOT affect public risk or user-facing scam labels.
4. Moderated reports SHALL be synced into Telegram reputation only after admin confirmation.
5. The reputation table SHALL be covered by RLS and service-role-only writes.

### Requirement 6: Test Coverage

**User Story:** As a maintainer, I want regression tests for Telegram link behavior, so that UX fixes do not silently regress.

#### Acceptance Criteria

1. Unit tests SHALL cover public username, public link, private invite, internal/private link, not-found, unavailable, and found metadata cases.
2. Integration tests SHALL verify that Telegram result messages render metadata limitations instead of generic unknown-only answers.
3. Property or core tests SHALL verify that surrounding message context around private invite links contributes to risk scoring.
4. Tests SHALL verify that private invite lookup does not call `getChat`.
5. Tests SHALL verify that no output claims account age, hidden scam labels, or spam history without source data.
