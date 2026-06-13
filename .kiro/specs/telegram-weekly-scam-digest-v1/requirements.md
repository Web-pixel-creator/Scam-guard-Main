# Telegram Weekly Scam Digest v1 Requirements

## Overview

Add a compact weekly scam digest to the Telegram bot. The digest should make the project feel alive and locally useful without copying external posts or exposing user reports.

## Requirements

### Requirement 1: Command Entry

**User Story:** As a Telegram user, I want to open a short weekly digest from the bot so that I can understand what schemes are currently common.

#### Acceptance Criteria

1. WHEN the user sends `/digest` THEN the bot SHALL send the weekly digest in the user's current language.
2. WHEN the user opens `/help` THEN the command list SHALL mention `/digest`.
3. WHEN Telegram command menus are registered THEN `/digest` SHALL be included in each supported language payload.

### Requirement 2: Main Menu Entry

**User Story:** As a casual user, I want the digest to be visible from the main menu so that I do not need to remember a command.

#### Acceptance Criteria

1. WHEN the user opens `/start` or `/menu` THEN the quick-action keyboard SHALL include a digest button.
2. WHEN the user taps the digest button THEN the bot SHALL send the same digest as `/digest`.
3. WHEN the digest is shown THEN the keyboard SHALL offer check, report, and emergency next actions.

### Requirement 3: Useful Local Content

**User Story:** As a user in Uzbekistan, I want the digest to describe real local scam funnels so that I can recognize them quickly.

#### Acceptance Criteria

1. The digest SHALL include at least three active scheme themes.
2. The digest SHALL cover casino/frispin/VIP forecast, NFT/Stars/giveaway, TON/wallet, bank/SMS-code, and APK themes across the digest content.
3. The digest SHALL explain each scheme as a funnel: hook, what criminals try to get, and one safe step.
4. The digest SHALL avoid naming a person or channel as a criminal unless that conclusion comes from a verified source.

### Requirement 4: Compact Mobile UX

**User Story:** As a user on a phone, I want the digest to fit into a readable Telegram screen.

#### Acceptance Criteria

1. The digest text SHALL be under 1600 characters per language.
2. The digest SHALL use short section headings and bullets rather than long paragraphs.
3. The digest SHALL put the most important safe action near the top.
4. The digest SHALL avoid repeating the full main menu keyboard.

### Requirement 5: Privacy And Source Safety

**User Story:** As a project owner, I want the digest to be safe to publish so that no user data or third-party content is leaked.

#### Acceptance Criteria

1. The digest SHALL NOT include raw user messages, raw phone numbers, raw screenshots, or private report details.
2. The digest SHALL NOT copy Telegram channel posts verbatim.
3. The digest SHALL be curated from project scam categories, official/local research, and generic pattern descriptions.
4. The digest SHALL be deterministic and available even when AI providers are down.

