# Requirements Document

## Introduction

Telegram retries updates when delivery or processing is uncertain. The original
claim-only v1 left a claimed-before-dispatch crash window. D-072 implements its
local successor: one fenced `getUpdates` leader, metadata-only update lifecycle,
completion-gated offset and fenced session/outbound effects. Production cutover
evidence remains required before the finding is marked live-fixed.

## Requirements

### Requirement 1: Cross-Instance Idempotency

**User Story:** As an operator, I want ordinary Telegram retry deliveries to share one claim across production workers, so repeated deliveries do not normally create duplicate replies, reports, or state transitions.

#### Acceptance Criteria

1. WHEN a valid webhook update has a new `update_id`, THE system SHALL create a shared idempotency claim before dispatching handlers.
2. Under the current v1 behavior, WHEN a valid webhook update repeats an already claimed `update_id`, THE system SHALL return HTTP 200 and skip handler dispatch; this is safe only for a completed update and remains the known crash-loss gap for an incomplete claim.
3. THE system SHALL keep the existing in-memory cache as a fast path for repeated retries hitting the same process.
4. THE shared claim key SHALL be the Telegram `update_id` only.

### Requirement 2: Privacy Boundary

**User Story:** As a user, I want retry protection without extra personal data storage, so that infrastructure hardening does not increase privacy risk.

#### Acceptance Criteria

1. THE shared dedup table SHALL NOT store chat ids, Telegram user ids, usernames, message text, URLs, phone numbers, OCR text, screenshots, report descriptions, or AI output.
2. THE current v1 table SHALL store only `update_id`, `first_seen_at`, and `expires_at`; any successor lifecycle metadata remains subject to Requirement 5 and the same no-content boundary.
3. THE table SHALL enable RLS and grant access only to `service_role`.
4. THE production security smoke SHALL verify anon cannot read the table.

### Requirement 3: Availability Behavior

**User Story:** As a user messaging the bot, I want a transient dedup-store failure to be retried safely, so that one update is not processed independently by several instances.

#### Acceptance Criteria

1. IF the shared dedup insert succeeds, THE current v1 webhook SHALL dispatch the update.
2. IF the shared dedup insert fails due to a unique violation, THE current v1 webhook SHALL acknowledge the duplicate and skip dispatch. This behavior is not sufficient for an incomplete claim and SHALL be replaced by Requirement 5 before horizontal processing.
3. IF the shared dedup store is unavailable or misconfigured, THE webhook SHALL log a stage-only error, return HTTP 503 with `Retry-After`, and SHALL NOT dispatch the update.
4. THE webhook SHALL never log bot tokens, webhook secrets, message text, phone numbers, links, usernames, OCR text, or report descriptions from this path.

### Requirement 4: Retention And Operations

**User Story:** As an operator, I want dedup claims cleaned up automatically by the existing retention maintenance path, so that the table stays small and auditable.

#### Acceptance Criteria

1. THE dedup table SHALL set `expires_at` to approximately two days after first claim.
2. `private.prune_app_retention()` SHALL delete dedup rows whose `expires_at` is in the past.
3. The retention function result SHALL include `telegram_webhook_updates_deleted`.
4. The project documentation SHALL describe the table, retention window, and fail-closed retry behavior.

### Requirement 5: Durable Processing Lifecycle (Open P1)

**User Story:** As a user, I want an update claimed just before a process crash to remain recoverable, so the bot does not silently lose my message while reporting HTTP 200.

#### Acceptance Criteria

1. THE shared lifecycle SHALL distinguish at least `processing` and `completed`, with bounded lease/fence/attempt timestamps or an equivalent single-owner mechanism.
2. A duplicate `update_id` SHALL return HTTP 200 without dispatch only after completion is known. Active or expired incomplete work SHALL remain retryable or be safely reacquired from a new Telegram delivery.
3. THE webhook SHALL NOT acknowledge incomplete work merely because its `update_id` exists. Without separately approved payload persistence, completion must occur before acknowledgement or processing must move to an explicitly approved single-leader delivery model.
4. Per-user ordering SHALL be established before session load across every active worker, or horizontal webhook processing SHALL remain disabled.
5. Polling SHALL request at most one update, SHALL NOT advance offset before
   durable completion, and SHALL skip handler dispatch when a redelivery is
   already `completed`.
6. Session reads/writes and outbound Telegram effects SHALL reject a stale
   processing fence; polling work SHALL also reject a stale leader fence.
7. Cutover SHALL verify an active polling leader and SHALL NOT drop pending
   Telegram updates.
5. Crash-before-dispatch, crash-during-handler, restart, stale lease/fence, two-instance out-of-order and normal recovery probes SHALL pass before scaling beyond one application instance.
6. No raw Telegram payload or user content SHALL be persisted without a separate retention, encryption and access-control decision.
7. The delivery guarantee and any bounded duplicate outward-message risk SHALL be documented honestly; a claim row alone SHALL NOT be described as exactly-once processing.
