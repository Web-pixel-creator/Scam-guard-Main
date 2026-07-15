# Telegram Inline Polling Burst QA — 2026-07-15

Status: merged, migrated and deployed; bounded no-AI/no-alert monitor and local
one-minute in-memory soak verified; bounded live burst/restart evidence pending.

## Goal

Remove the `getUpdates(limit=1)` throughput bottleneck for stateless Inline
queries without weakening the existing durable update lifecycle, per-user
ordering for stateful bot interactions, privacy boundaries or offset fencing.
The design remains at-least-once and does not claim end-to-end exactly-once
delivery.

## Deployed behavior

- Polling requests up to 20 updates per Bot API call. Explicit limits are
  clamped to Telegram's 1..100 range.
- The complete returned batch is validated before any side effect. Every
  `update_id` must be a safe integer, strictly increasing and not below the
  requested offset.
- Messages, callbacks, hybrid updates and unsupported-shape boundaries never
  reorder relative to one another. Existing per-user serialization remains the
  default in webhook and non-polling execution.
- Strict Inline-only work executes in chunks of at most four. During one slow
  stateful update, read-ahead is limited to the following Inline window and to
  known different users; same-user/unknown-user work waits, and the next
  stateful/unsupported boundary is never crossed. Leases are acquired just in
  time.
- Offset advancement follows the contiguous acknowledgement frontier. A
  failed, busy, unavailable or thrown update stops advancement before that id.
  A later sibling that already completed in the same started chunk is replayed
  through the durable lifecycle and skipped as completed instead of being sent
  twice.
- Polling uses a scoped dispatch option to bypass same-user serialization only
  for strict Inline-only updates. An accidental option on a message, callback or
  hybrid update is ignored.
- `answerInlineQuery` has a 2.5-second request bound and exposes Telegram
  `retry_after` metadata. Entity-parse failures retain the plaintext fallback.
  A transient network/no-code/5xx failure is retried once. A 429 is not retried
  immediately: a bounded 1-60-second delay is propagated to polling, and the
  longest delay from an already-started failed chunk is honored. Exhaustion
  throws a sanitized error so update completion is withheld.
- Successful Inline answers use a short ten-second cache. Rate-limit/error
  articles use zero cache so retry guidance does not freeze in Telegram.

## Stale-leader reclaim

The new forward migration
`supabase/migrations/20260715040836_telegram_polling_stale_leader_reclaim.sql`
replaces `public.begin_telegram_update` with a fenced stale-owner rule:

- leader renewal is bounded to five seconds and guarded by a conservative local
  absolute expiry, so an uncertain old process stops new long polls;
- the currently valid polling leader may reclaim a `processing` row whose
  recorded owner is no longer current only after a 15-second outbound-effect
  drain grace;
- reclaim increments both `processing_fence` and `attempt_count`;
- the former worker remains unable to complete or perform fenced effects;
- a row owned by the current active leader still returns busy;
- webhook and non-leader callers cannot steal a polling lease;
- the function retains `SECURITY DEFINER`, an empty `search_path`, validation
  and service-role-only execution grants.

No raw Telegram payload or user content is added to lifecycle storage.

## Local evidence

- Merged polling/lifecycle/API/Inline reliability focus: 234/234 tests passed.
- Full repository: 8,882/8,882 tests passed.
- TypeScript and production build passed.
- `npm audit`: zero known vulnerabilities.
- The migration contract regression passes 6/6 static expectations.
- PR #106 passed application/coverage CI,
  clean-database migration apply, schema lint, 35 pgTAP assertions, CodeQL,
  Gitleaks and container High/Critical/SBOM gates, then merged as
  `87bf181b4d4df92e438e768f83ab4c02883f1d9f`.
- Full risk behavior remains green at 1,411/1,411; Inline focus remains green
  at 160/160.

The focused tests cover ordered-batch rejection before side effects, limit
clamping, four-wide strict Inline execution, different-user read-ahead around a
slow stateful barrier, same/unknown-user ordering, first-failure frontier
behavior, maximum concurrent retry delay, already-completed sibling replay,
bounded leader-renewal failure, transient answer retry/exhaustion, entity-parse
fallback and stale-leader fencing/grace.

## Production migration and deployment evidence

- Linked Supabase migration history shows
  `20260715040836_telegram_polling_stale_leader_reclaim.sql` on both local and
  remote. A linked dry-run reports no pending migration and remote schema lint
  reports no error.
- Railway deployment `39cf9f6d-294d-410a-9cef-972e41829561` reached `SUCCESS`
  from exact merge revision `87bf181b4d4df92e438e768f83ab4c02883f1d9f`;
  image digest is
  `sha256:f289ebed30a5b96b3012904361b6aaa8a42cded15cd5fc1d75984690c5e84f11`.
- A bounded monitor with AI and alerting disabled passed home/health, secret
  rejection, polling-mode webhook shutdown, Telegram `getMe`, zero pending
  updates and authenticated polling-leader health. It performed no paid model
  call, sent no Telegram message and wrote no Supabase row.
- A one-minute in-memory resource soak completed 600/600 updates with zero
  duplicate effects, zero loss and no residual queue. RSS growth was 0.58 MiB;
  stale-leader rejection, pre-effect failure, acknowledgement loss and
  offset-loss replay were all observed as expected. The soak had no network or
  production side effect.
- Deployment logs contained zero error-level and zero warning-level lines in
  the bounded post-deploy read-back window.

## Evidence limits and release blockers

- Local Docker/Postgres on port 54322 was unavailable. PR #106 supplied the
  missing clean-database migration, schema lint and 35-pgTAP evidence.
- Migration-history/no-pending/schema-lint and deployed identity/health were
  verified, but no synthetic production lifecycle row was created or reclaimed
  during this safe post-deploy pass. The dedicated stale-row drill remains open.
- Linked migration history and schema lint are live production evidence. A
  direct catalog grant query was not available through the authenticated CLI
  path, so the exact `EXECUTE`-grant contract remains backed by the clean-DB CI
  migration/pgTAP gate rather than being mislabeled as a live catalog read.
- Unit/concurrency tests simulate Telegram and lifecycle decisions. They do not
  prove Railway resource use, Bot API latency, leader re-election or a real
  client result list under burst load.
- The retry branch does not prove Telegram accepted an article after an actual
  production outage. Do not manufacture a 429/5xx or network failure in live
  Telegram; deterministic injected tests are the owning evidence.
- At-least-once, fencing and contiguous acknowledgements reduce loss/duplicate
  risk but do not create a transactional exactly-once boundary across Telegram
  and Postgres.

## Required release and live QA

1. [x] Run application CI and Supabase migration/schema/pgTAP jobs against the exact
       release commit. Stop if any migration ownership/grant or lifecycle test
       fails.
2. [x] Confirm remote migration-history identity and linked no-pending dry-run
       state without row payloads or secrets.
3. [ ] Read back the live catalog function owner, `search_path` and execution
       grants when an authenticated SQL channel is available. Clean-database CI
       owns this contract until that independent production read-back exists.
4. [x] Deploy the exact application commit and record Railway deployment/image
       identity. Verify `/healthz`, protected polling-leader health and bounded
       no-AI/no-alert monitor output.
5. [ ] Run a bounded synthetic lifecycle drill outside user traffic to prove the
       current leader can reclaim a stale former-leader row, increments the fence
       and rejects the former lease. Clean only the synthetic row.
6. [ ] From approved QA accounts, issue a small burst of distinct safe Inline
       queries. Use no real codes, cards, document data or private chats. Record
       response count and timing, not raw query content.
7. [ ] Interleave one stateful message/callback between Inline groups. Confirm the
       stateful action stays ordered and that Inline completion never advances the
       offset across a failed or busy earlier update.
8. [ ] Restart/redeploy one instance during a bounded synthetic run. Confirm a new
       leader is elected, pending work drains and no approved QA result is visibly
       duplicated or lost. Do not call this an exactly-once proof.
9. [ ] Read back aggregate lifecycle counts/fences and Telegram pending-update
       count only. Verify no raw payload, secret, query or user identifier entered
       the evidence artifact.
10. [ ] Run the normal production smoke and scheduled monitor after the drill. Keep
        the release blocked if health, leader ownership, queue depth or delivery is
        not green.
11. [ ] Attach the sanitized evidence to the release record. This polling gate does
        not by itself close `INL-001`, `INL-002` or `BOT-004`; the real
        Desktop/Android/iOS client matrix remains separate.
