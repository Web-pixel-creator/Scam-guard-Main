# Requirements Document

## Introduction

Family Shield v1 turns emergency guidance into a real support loop. A Telegram user can invite one trusted contact. After the trusted contact opens the bot through a deep link and accepts, high-risk checks and panic flows can notify that contact with one tap. The bot must never expose raw scam evidence, SMS codes, card data, phone numbers, links, screenshots, or private notes to the trusted contact.

## Requirements

### Requirement 1: Trusted Contact Invite

**User Story:** As a user, I want to link a trusted person before an emergency, so that I can ask for help quickly when I am under pressure.

#### Acceptance Criteria

1. WHEN the user opens `/family` or taps the Family Shield setup button, THE Bot SHALL create a single-use Telegram deep link invite.
2. THE Bot SHALL store only a cryptographic hash of the invite token, never the raw token.
3. THE Bot SHALL explain that Telegram bots cannot message a person until that person opens the bot and accepts the invite.
4. THE Bot SHALL allow only one pending or active trusted contact per Telegram user in v1.
5. WHEN a new invite is created while another pending invite exists, THE Bot SHALL revoke the older pending invite.

### Requirement 2: Invite Acceptance

**User Story:** As a trusted person, I want to accept an invite with one tap, so that I can receive urgent alerts for my relative or friend.

#### Acceptance Criteria

1. WHEN a trusted person opens `/start family_<token>`, THE Bot SHALL validate the hashed token against a pending invite.
2. WHEN the token is valid, THE Bot SHALL mark the relationship as active and store the trusted person's Telegram user id and chat id.
3. WHEN the invite is invalid, revoked, or already used, THE Bot SHALL show a calm error and ask the guardian to create a new invite.
4. THE Bot SHALL reject self-linking when the guardian and trusted user are the same Telegram account.
5. THE Bot SHALL notify the guardian when a trusted contact successfully accepts.

### Requirement 3: One-Tap Emergency Notification

**User Story:** As a user in a high-risk situation, I want to notify my trusted person without writing a message myself, so that I can get help while stressed.

#### Acceptance Criteria

1. WHEN a high-risk check result is shown, THE Bot SHALL include a "Notify trusted contact" action.
2. WHEN a panic or live-call flow asks to involve a close person, THE Bot SHALL attempt a Family Shield notification first.
3. WHEN an active trusted contact exists, THE Bot SHALL send a short alert to the trusted chat.
4. THE trusted alert SHALL include the user's need for help, safe next actions, and a reminder not to ask for SMS codes, PIN, CVV, passwords, card photos, or app installs.
5. THE trusted alert SHALL NOT include raw checked input, links, phone numbers, usernames, OCR text, report text, or screenshots.

### Requirement 4: Safe Degradation

**User Story:** As a user, I want the bot to stay useful even if the database or Telegram send fails, so that I am not left alone in an emergency.

#### Acceptance Criteria

1. IF Family Shield storage is unavailable, THE Bot SHALL show a setup-unavailable message and keep the panic/check flow working.
2. IF a trusted contact is not linked, THE Bot SHALL show the invite setup path instead of failing silently.
3. IF sending the alert fails, THE Bot SHALL tell the user to call a close person manually and provide a copyable safe phrase.
4. THE Bot SHALL rate-limit trusted contact notifications to avoid spam.
5. THE Bot SHALL not throw from callback or command handlers due to Family Shield errors.

### Requirement 5: Privacy and Abuse Resistance

**User Story:** As a user, I want Family Shield to protect me without leaking private details or creating a harassment tool.

#### Acceptance Criteria

1. THE database table SHALL have RLS enabled and no anon/authenticated public access policies.
2. THE app SHALL use the service-role server client only from server-side modules.
3. THE notification SHALL contain only generalized risk context and safe advice.
4. THE Bot SHALL store timestamps for accepted/revoked/notified states for auditability.
5. THE Bot SHALL expose a revocation action so a user can remove the trusted contact.
