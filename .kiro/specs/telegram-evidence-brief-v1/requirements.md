# Requirements Document

## Introduction

Telegram Evidence Brief v1 improves the short explanation shown for Telegram usernames, public links, private invite links, and Telegram/Web3 promotional posts. The bot already detects many Telegram patterns, but the user-visible text can still feel generic because Telegram API limitations appear before the useful scenario explanation. This feature keeps the same conservative safety model while making the answer more specific, actionable, and honest.

## Requirements

### Requirement 1: Scenario-first Telegram Brief

**User Story:** As a user checking a Telegram channel, invite, or promo post, I want the first visible lines to explain the scenario, so that I immediately understand what is suspicious or safe.

#### Acceptance Criteria

1. WHEN Telegram-related reasons match casino/free-spins, betting/VIP, NFT/Stars giveaway, captcha/voting, task reward, wallet urgency, TON referral, account takeover, official impersonation, OTP, card, APK, or private invite patterns, THE system SHALL render a scenario-specific brief before generic API limitations.
2. WHEN no Telegram-specific risk pattern is present, THE system SHALL fall back to the existing honest metadata brief.
3. THE scenario brief SHALL use cautious language such as "похоже", "видимые признаки", or equivalent localized wording.
4. THE scenario brief SHALL not change `level`, `score`, `reasons`, `knownReports`, `verifiedContact`, or stored check data.
5. THE scenario brief SHALL remain short enough to survive result-card truncation.

### Requirement 2: Honest Telegram Limits

**User Story:** As a user, I want to know what the bot cannot verify, so that I do not overtrust the result.

#### Acceptance Criteria

1. THE system SHALL NOT claim Telegram account age, hidden SCAM labels, Telegram report counts, spam history, or mass-DM behavior unless such data is explicitly available from a trusted source.
2. WHEN a username is not found or unavailable, THE system SHALL say this is not proof of scam.
3. WHEN a private invite or internal link is checked, THE system SHALL say the bot cannot see closed-chat content.
4. WHEN moderated Ishonch Guard reputation exists, THE system MAY mention it with source-backed wording.
5. All limitation wording SHALL be localized for ru, uz, and en.

### Requirement 3: Safe Next Step by Telegram Pattern

**User Story:** As a nervous user, I want one safe next step that fits the situation, so that I can act without reading a wall of generic advice.

#### Acceptance Criteria

1. Betting/VIP/casino patterns SHALL advise not paying for access, predictions, deposits, or bonuses.
2. NFT/Stars/giveaway/captcha/voting patterns SHALL advise not passing prize gates that ask for login, wallet, codes, or payments.
3. Wallet/DeFi urgency patterns SHALL advise not connecting a wallet, signing a transaction, or entering a seed phrase.
4. Telegram account takeover patterns SHALL advise not opening "cancel/delete/account" links and not entering Telegram codes or passwords.
5. Unknown Telegram username/profile checks SHALL ask for the actual message, screenshot, or preview and list what matters: code, money, card, APK, QR, wallet, or link.

### Requirement 4: Message Quality

**User Story:** As a product owner, I want Telegram answers to feel helpful rather than robotic, so that users trust the bot and keep using it.

#### Acceptance Criteria

1. The brief SHALL avoid repeated generic lines when a more specific Telegram scenario is available.
2. The brief SHALL be ordered as: scenario summary, visible reasons, safe next step, then API limitation if needed.
3. The brief SHALL include at most three visible signals.
4. The brief SHALL avoid definitive accusations against people, channels, or accounts unless source-backed.
5. The brief SHALL preserve MarkdownV2 safety through the existing formatter.

### Requirement 5: Regression Coverage

**User Story:** As a maintainer, I want tests around the improved Telegram brief, so that future UX changes do not reintroduce generic or overconfident answers.

#### Acceptance Criteria

1. Unit tests SHALL cover private invite betting/VIP, casino/free-spins, NFT/Stars giveaway, wallet urgency, account takeover, and unknown username cases.
2. Tests SHALL verify that scenario-specific text appears before generic API limitation text when reasons are present.
3. Tests SHALL verify that unknown usernames do not imply scam proof.
4. Tests SHALL verify that deterministic risk fields are unchanged by enrichment.
5. Tests SHALL verify that no brief claims hidden SCAM labels, account age, Telegram report counts, or spam history without source data.
