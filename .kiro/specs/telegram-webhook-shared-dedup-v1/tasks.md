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
  - Fail open to local dedup if storage is unavailable.

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
  - Document webhook fail-open behavior.
  - Update roadmap/open tasks from "dedup pending" to "dedup shared; rate-limit still pending".
