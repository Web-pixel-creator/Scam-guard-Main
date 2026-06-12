# Requirements Document

## Introduction

Telegram retries webhook updates when delivery or processing is uncertain. The existing in-memory dedup cache protects a single Node process, but multi-instance production needs a shared idempotency store so one retry cannot be processed by another worker. Telegram Webhook Shared Dedup v1 adds a short-lived service-role-only Postgres claim table while keeping the bot available if the database is temporarily unavailable.

## Requirements

### Requirement 1: Cross-Instance Idempotency

**User Story:** As an operator, I want Telegram retry updates to be processed once across production workers, so that duplicate replies, duplicate reports, and duplicate state transitions do not occur during retries or rolling deploys.

#### Acceptance Criteria

1. WHEN a valid webhook update has a new `update_id`, THE system SHALL create a shared idempotency claim before dispatching handlers.
2. WHEN a valid webhook update repeats an already claimed `update_id`, THE system SHALL return HTTP 200 and skip handler dispatch.
3. THE system SHALL keep the existing in-memory cache as a fast path for repeated retries hitting the same process.
4. THE shared claim key SHALL be the Telegram `update_id` only.

### Requirement 2: Privacy Boundary

**User Story:** As a user, I want retry protection without extra personal data storage, so that infrastructure hardening does not increase privacy risk.

#### Acceptance Criteria

1. THE shared dedup table SHALL NOT store chat ids, Telegram user ids, usernames, message text, URLs, phone numbers, OCR text, screenshots, report descriptions, or AI output.
2. THE table SHALL store only `update_id`, `first_seen_at`, and `expires_at`.
3. THE table SHALL enable RLS and grant access only to `service_role`.
4. THE production security smoke SHALL verify anon cannot read the table.

### Requirement 3: Availability Behavior

**User Story:** As a user messaging the bot, I want the bot to keep responding during a transient database problem, so that emergency help is not blocked by infrastructure.

#### Acceptance Criteria

1. IF the shared dedup insert succeeds, THE webhook SHALL dispatch the update.
2. IF the shared dedup insert fails due to a unique violation, THE webhook SHALL acknowledge the duplicate and skip dispatch.
3. IF the shared dedup store is unavailable or misconfigured, THE webhook SHALL log a sanitized error and continue with local in-memory dedup.
4. THE webhook SHALL never log bot tokens, webhook secrets, message text, phone numbers, links, usernames, OCR text, or report descriptions from this path.

### Requirement 4: Retention And Operations

**User Story:** As an operator, I want dedup claims cleaned up automatically by the existing retention maintenance path, so that the table stays small and auditable.

#### Acceptance Criteria

1. THE dedup table SHALL set `expires_at` to approximately two days after first claim.
2. `private.prune_app_retention()` SHALL delete dedup rows whose `expires_at` is in the past.
3. The retention function result SHALL include `telegram_webhook_updates_deleted`.
4. The project documentation SHALL describe the table, retention window, and fail-open behavior.
