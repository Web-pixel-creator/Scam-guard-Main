# Requirements

## Introduction

Website Public Scheme Trends v1 adds a public, non-personal trends surface for
Uzbekistan scam education. It should make the website feel alive and useful
without exposing raw reports, phone numbers, usernames, URLs, screenshots, OCR
text or unsupported accusations.

## Requirements

### Requirement 1

**User Story:** As a visitor, I want to see which scam tactics Ishonch Guard is currently tracking, so I can recognize a threat quickly.

#### Acceptance Criteria

1. WHEN the user opens the trends page THEN the system SHALL show a compact list of current scam tactics.
2. EACH tactic SHALL include a hook, likely target, safe next step and confidence/source label.
3. EACH tactic SHALL avoid naming people, channels or phone numbers as scammers.

### Requirement 2

**User Story:** As a cautious user, I want the page to explain what evidence the product can actually verify.

#### Acceptance Criteria

1. EACH tactic SHALL link to one or more existing deterministic reason-code families.
2. The page SHALL state that trends are aggregated from product coverage, moderated signals and research-feed categories.
3. The page SHALL NOT claim real-time prevalence unless backed by an aggregate source.

### Requirement 3

**User Story:** As a mobile visitor, I want the page to be fast to scan and easy to act on.

#### Acceptance Criteria

1. The first viewport SHALL show the page purpose, update label and primary action.
2. Trend cards SHALL be readable on 390px mobile width without horizontal overflow.
3. The page SHALL include actions to check a message, open the official-number directory and report a new pattern.

### Requirement 4

**User Story:** As an operator, I want the data model to be safe to maintain.

#### Acceptance Criteria

1. Trend data SHALL live in a structured helper module, not inline in the route.
2. Helper tests SHALL verify unique IDs, stats, filtering and no private-evidence fields.
3. The implementation SHALL not add database tables or client-side access to private reports.

### Requirement 5

**User Story:** As an AI agent, I want documentation to stay aligned with the implementation.

#### Acceptance Criteria

1. The implementation SHALL update roadmap/open-task/docs maps where relevant.
2. The spec task list SHALL reflect local verification, browser verification and production deployment.
