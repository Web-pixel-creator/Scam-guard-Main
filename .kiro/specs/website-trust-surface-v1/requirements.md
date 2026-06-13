# Requirements Document

## Introduction

Website Trust Surface v1 makes the public website more useful and trustworthy before large analytics features. It exposes the existing verified-contact directory as a public, searchable page and improves homepage trust counters without adding personal-data storage or unsupported reputation claims.

## Requirements

### Requirement 1: Public Official Contact Directory

**User Story:** As a user who receives a suspicious call or message, I want to quickly find official bank, payment-system, telecom and government contacts so I can call back safely.

#### Acceptance Criteria

1. WHEN the user opens the official contacts page THEN the system SHALL show verified contacts grouped by organization type.
2. WHEN a contact is callable THEN the system SHALL provide a `tel:` action.
3. WHEN a contact has a source THEN the system SHALL show the source as an external reference without claiming that an incoming call is safe.
4. WHEN the contact list renders THEN the system SHALL use only entries from `VERIFIED_CONTACTS`.

### Requirement 2: Search And Filters

**User Story:** As a stressed user, I want to search by organization, number or contact description so I can find the right contact quickly.

#### Acceptance Criteria

1. WHEN the user enters a search query THEN the system SHALL filter by organization name, display value, description and source.
2. WHEN the user selects an organization type filter THEN the system SHALL show only matching contacts.
3. WHEN no contacts match THEN the system SHALL show a calm empty state with a link to the check flow.

### Requirement 3: Honest Safety Framing

**User Story:** As a user, I need clear callback guidance so I do not trust spoofed caller ID.

#### Acceptance Criteria

1. WHEN the directory is shown THEN the system SHALL state that caller ID can be spoofed.
2. WHEN an official number is listed THEN the system SHALL frame it as a safe callback destination, not as proof that the incoming call was safe.
3. WHEN a user is unsure THEN the system SHALL offer the `/check` flow or emergency guide as next actions.

### Requirement 4: Homepage Trust Surface

**User Story:** As a first-time visitor, I want to see that the service is active and backed by verified official contacts.

#### Acceptance Criteria

1. WHEN the homepage stats strip renders THEN it SHALL include the verified official contact count.
2. WHEN confirmed reputation counts are shown THEN labels SHALL avoid direct accusations against named people.
3. WHEN the homepage renders THEN it SHALL link to the official contact directory from a visible trust block.

### Requirement 5: Privacy And Security

**User Story:** As a privacy-conscious user, I want this public surface to avoid exposing private reports or sensitive identifiers.

#### Acceptance Criteria

1. WHEN rendering the directory THEN the system SHALL not query private report rows.
2. WHEN rendering trust counters THEN the system SHALL use only aggregate public stats and static verified-contact counts.
3. WHEN rendering source links THEN external links SHALL use `rel="noreferrer"` and open in a new tab.
