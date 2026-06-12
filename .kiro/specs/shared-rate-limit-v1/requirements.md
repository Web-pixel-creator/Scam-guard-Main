# Requirements Document

## Introduction

The original rate limiter was per Node process. That is acceptable for a single
worker, but it weakens protection during Railway restarts, future multi-instance
deploys, and hostile traffic. Shared Rate Limits v1 moves public check/report
and Telegram throttling to a short-lived Supabase bucket while preserving local
fallback behavior and the project's privacy boundaries.

## Requirements

### Requirement 1: Cross-Instance Throttling

**User Story:** As an operator, I want public check/report and Telegram limits
to be shared across production workers, so that abuse cannot bypass limits by
hitting a different Node instance.

#### Acceptance Criteria

1. WHEN `runCheck` is called for web, Telegram chat, or inline mode, THE system
   SHALL claim a shared `check` rate-limit bucket before scoring.
2. WHEN OCR or structured image analysis is called, THE system SHALL use the
   same shared `check` bucket family.
3. WHEN `submitReportCore` is called, THE system SHALL claim a shared `report`
   bucket before any insert/upsert work.
4. WHEN public Telegram post fetching is attempted, THE system SHALL claim a
   separate `telegram_public_post` bucket before network fetch.

### Requirement 2: Privacy Boundary

**User Story:** As a user, I want anti-abuse infrastructure without extra raw
identifier storage, so that rate limiting does not weaken privacy.

#### Acceptance Criteria

1. THE database SHALL NOT store raw IPs, Telegram user ids, phone numbers, URLs,
   message text, OCR text, screenshots, report descriptions, bot tokens or
   webhook secrets in rate-limit rows.
2. THE application SHALL persist only an HMAC-SHA256 hash of
   `rate-limit:<scope>:<raw key>`.
3. THE rate-limit table SHALL enable RLS and grant access only to `service_role`.
4. THE production security smoke SHALL verify anon cannot read the table or run
   the rate-limit RPC.

### Requirement 3: Availability And Local Fallback

**User Story:** As a user in an emergency, I want the bot to keep responding
even if the shared store is temporarily unavailable.

#### Acceptance Criteria

1. IF Supabase env or `HASH_PEPPER_SECRET` is absent, THE system SHALL use the
   existing in-memory limiter.
2. IF the shared RPC fails or returns an invalid shape, THE system SHALL log a
   sanitized error and fall back to in-memory limiting.
3. THE fallback SHALL preserve the same `{ ok, remaining, retryAfterSec }`
   contract as the shared path.
4. THE fallback SHALL NOT log raw user evidence or secrets.

### Requirement 4: Operations And Retention

**User Story:** As an operator, I want rate-limit buckets to remain small and
auditable.

#### Acceptance Criteria

1. THE shared table SHALL store `scope`, `key_hash`, `bucket_start`,
   `window_seconds`, `count`, timestamps and `expires_at`.
2. THE shared RPC SHALL atomically increment the bucket and return
   `allowed`, `remaining`, `retry_after_sec` and `current_count`.
3. `private.prune_app_retention()` SHALL delete expired rate-limit buckets.
4. Docs and maps SHALL describe the shared limiter and its fallback.
