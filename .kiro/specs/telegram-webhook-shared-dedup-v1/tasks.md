# Implementation Plan

- [x] 1. Add shared dedup storage
  - Create `telegram_webhook_updates` with `update_id` primary key.
  - Enable RLS and revoke public access.
  - Grant service-role-only access.
  - Add expiry index.

- [x] 2. Wire shared claim helper
  - Add `claimTelegramWebhookUpdate(updateId)`.
  - Return `claimed`, `duplicate`, or `unavailable`.
  - Avoid storing or logging user content.

- [x] 3. Integrate webhook dispatch
  - Keep in-memory dedup as a fast path.
  - Await the shared claim before dispatch.
  - Skip duplicate shared claims with HTTP 200.
  - Return retryable HTTP 503 and do not dispatch if storage is unavailable.

- [x] 4. Extend tests
  - Cover claim helper result mapping.
  - Cover webhook dispatch/skip behavior.
  - Keep existing webhook contract and integration tests hermetic.

- [x] 5. Extend retention and security smoke
  - Delete expired dedup rows in `private.prune_app_retention()`.
  - Return `telegram_webhook_updates_deleted`.
  - Verify anon cannot read dedup rows in production security smoke.

- [x] 6. Update documentation
  - Document table privacy model and retention.
  - Document webhook fail-closed retry behavior.
  - Update roadmap/open tasks from "dedup pending" to shared retry-claim dedup;
    shared rate-limit degraded mode is now fixed locally and tracked separately.

- [x] 7. Close SG-P1-009 locally with a durable update lifecycle
  - Keep `setWebhook.max_connections=1` and fail monitoring on drift as temporary
    containment; do not count it as strict ordering evidence.
  - Selected and privacy-reviewed single-leader `getUpdates(limit=1)` with
    metadata-only processing/completion leases and fenced session/effect RPCs.
  - Offset advances only after completion; completion-before-offset redelivery
    skips dispatch. Clean DB reset/lint and 20 pgTAP assertions pass.
  - Production migration/deploy/cutover evidence remains a release task.
  - Distinguish `processing` from `completed`; add bounded lease/fence/attempt
    metadata without raw Telegram payload storage.
  - Acquire globally ordered update ownership before session load and keep incomplete work
    retryable; do not ACK a claim as though it proved completion.
  - Add crash-before-dispatch, crash-during-handler, restart, stale-fence,
    two-instance out-of-order and normal-recovery tests.
  - Keep production at one application instance until all acceptance evidence
    is captured.
