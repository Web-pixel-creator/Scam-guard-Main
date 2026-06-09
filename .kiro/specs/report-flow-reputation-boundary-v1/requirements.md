# Requirements

## Introduction

The Telegram `/report` flow must accept useful incident reports even when the
user does not know a phone number, URL, Telegram username, or payment target.
Those reports help moderation and research, but they must not create public
reputation for an unknown entity.

## Requirements

### Requirement 1

**User Story:** As a user under stress, I want to report what happened even when
I do not have the scammer's number or link, so that the incident is not lost.

#### Acceptance Criteria

1. WHEN the user selects "no number/link" or types an explicit no-target phrase
   THEN the bot SHALL continue the report flow.
2. WHEN the report is submitted THEN the system SHALL store the redacted
   incident description.
3. WHEN the report has no concrete target THEN the system SHALL mark it as
   incident-only at the application boundary.

### Requirement 2

**User Story:** As a falsely accused person or account owner, I want
description-only reports to be excluded from public reputation, so that vague
complaints cannot create a public label against me.

#### Acceptance Criteria

1. WHEN `submitReportCore` receives `incidentOnly=true` THEN it SHALL NOT insert
   into `entities`.
2. WHEN `submitReportCore` receives `incidentOnly=true` THEN it SHALL NOT update
   an existing `entities` row.
3. WHEN `submitReportCore` receives a normal target report THEN it SHALL keep the
   existing entity upsert behavior.

### Requirement 3

**User Story:** As an admin, I want moderation to preserve the same boundary, so
that confirming an incident-only report does not create reputation later.

#### Acceptance Criteria

1. WHEN `moderateReport` confirms an incident-only report THEN it SHALL update
   the report status and audit log.
2. WHEN `moderateReport` confirms an incident-only report THEN it SHALL skip
   entity insert/update.
3. WHEN `moderateReport` confirms a target report THEN it SHALL keep the
   existing entity sync behavior.

### Requirement 4

**User Story:** As a future maintainer, I want regression tests around this
boundary, so that Reputation v1 cannot accidentally turn incident reports into
public accusations.

#### Acceptance Criteria

1. Unit tests SHALL cover incident-only submit behavior.
2. Scenario tests SHALL cover Telegram no-target report payloads.
3. Admin tests SHALL cover incident-only moderation behavior.
