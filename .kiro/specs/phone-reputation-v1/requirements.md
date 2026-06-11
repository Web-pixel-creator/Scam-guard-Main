# Requirements: Phone Reputation v1

## Overview

Phone Reputation v1 makes phone-number checks more useful when Ishonch Guard has moderated evidence about a number. It is not a caller-ID service and must not claim a number owner, SIM age, hidden carrier data, Telegram SCAM labels, or unmoderated community reputation.

## Requirements

### R1. Confirmed Reports Only

1. WHEN a phone entity has `moderation_status = confirmed` and `report_count > 0`, THE system SHALL expose a phone reputation summary.
2. WHEN a phone entity is `new`, `reviewing`, `rejected`, `duplicate`, missing, or has zero reports, THE system SHALL NOT expose a public reputation summary.
3. THE summary SHALL use the existing hashed `entities` record and SHALL NOT require storing raw phone numbers.

### R2. Honest Source And Confidence

1. THE summary SHALL label the source as Ishonch Guard moderated reports.
2. THE summary SHALL show a conservative confidence label derived from confirmed report count.
3. THE summary SHALL state that it does not identify the owner and is not carrier data.

### R3. Risk Integration

1. WHEN a confirmed phone entity has `risk_level = high_risk`, THE risk pipeline SHALL keep using `known_reported`.
2. WHEN a confirmed phone entity has a lower risk level, THE summary MAY be shown, but it SHALL NOT by itself claim high risk.
3. Existing official-contact and phone-passport behavior SHALL remain unchanged.

### R4. Telegram Formatting

1. Telegram result cards SHALL prefer the phone-specific reputation line over the generic known-reports line.
2. The formatter SHALL not render raw submitted phone numbers.
3. The result SHALL remain MarkdownV2-safe and under the Telegram 4096-character limit.

### R5. Tests

1. Tests SHALL cover moderation gating.
2. Tests SHALL cover confidence thresholds.
3. Tests SHALL cover `runCheck` enrichment for confirmed phone entities.
4. Tests SHALL cover Telegram wording and no hidden-data/owner claims.
