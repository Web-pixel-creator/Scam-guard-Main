# Requirements Document

## Introduction

Website Honest Impact Counters v1 makes the public website show useful social-proof numbers without inventing "saved money" claims or exposing private reports. The feature extends public aggregate stats with dangerous-result counts and user-reported loss totals.

## Requirements

### Requirement 1: Aggregate-Only Public Stats

**User Story:** As a visitor, I want to see whether Ishonch Guard is actively used, so that I can trust the service before sending a suspicious message.

#### Acceptance Criteria

1. WHEN the homepage requests public stats THEN the system SHALL return only aggregate numeric fields.
2. WHEN public stats are returned THEN the system SHALL NOT include raw inputs, phone numbers, usernames, URLs, descriptions, screenshots, hashes, city, language, or per-report rows.
3. WHEN Supabase is unavailable or an aggregate field is missing THEN the UI SHALL degrade to zero/unknown counters without breaking the page.

### Requirement 2: Dangerous Result Counters

**User Story:** As a visitor, I want to see how many checks produced warnings, so that I understand the project detects real risk patterns.

#### Acceptance Criteria

1. WHEN stats are calculated THEN suspicious and high-risk checks SHALL be counted separately.
2. WHEN stats are displayed THEN the dangerous counter SHALL equal suspicious + high-risk.
3. WHEN the UI labels these counters THEN it SHALL say "warnings" or "risk alerts", not "confirmed scammers".

### Requirement 3: Honest Loss Wording

**User Story:** As a maintainer, I want public money-related counters to be legally and ethically safe, so that the product does not overclaim impact.

#### Acceptance Criteria

1. WHEN displaying money totals THEN the UI SHALL describe them as user-reported losses from submitted reports.
2. WHEN no reliable loss total exists THEN the UI SHALL show a conservative placeholder rather than a fake saved-money number.
3. WHEN explaining the counter THEN the UI SHALL state that it is not a guarantee of recovered or prevented money.

### Requirement 4: Homepage UX

**User Story:** As a mobile visitor, I want the impact section to be scannable in a few seconds.

#### Acceptance Criteria

1. WHEN rendering on mobile THEN each card SHALL keep a compact headline number, short label and one-line context.
2. WHEN rendering on desktop THEN the impact section SHALL align with existing homepage trust surfaces.
3. WHEN data is loading THEN the UI SHALL show stable placeholders without layout shift.

### Requirement 5: Testability

**User Story:** As a developer, I want tests around impact stats, so that privacy and wording boundaries do not regress.

#### Acceptance Criteria

1. WHEN normalizing RPC rows THEN missing fields SHALL default to zero.
2. WHEN formatting money THEN the output SHALL be compact and locale-aware.
3. WHEN public stat keys are enumerated THEN the list SHALL contain only aggregate-safe keys.
