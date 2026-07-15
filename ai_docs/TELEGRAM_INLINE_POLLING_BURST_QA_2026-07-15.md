# Telegram Inline Polling Burst QA — 2026-07-15

Status: local candidate verified; CI, migration and production burst evidence
pending.

## Goal

Remove the `getUpdates(limit=1)` throughput bottleneck for stateless Inline
queries without weakening the existing durable update lifecycle, per-user
ordering for stateful bot interactions, privacy boundaries or offset fencing.
The design remains at-least-once and does not claim end-to-end exactly-once
delivery.

## Candidate behavior

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
- Full risk behavior remains green at 1,411/1,411; Inline focus remains green
  at 160/160.

The focused tests cover ordered-batch rejection before side effects, limit
clamping, four-wide strict Inline execution, different-user read-ahead around a
slow stateful barrier, same/unknown-user ordering, first-failure frontier
behavior, maximum concurrent retry delay, already-completed sibling replay,
bounded leader-renewal failure, transient answer retry/exhaustion, entity-parse
fallback and stale-leader fencing/grace.

## Evidence limits and release blockers

- Local Docker/Postgres on port 54322 was unavailable, so the expanded pgTAP
  suite and schema lint were not executed locally. Supabase CI is mandatory.
- The new migration has not been applied to production and no production
  lifecycle row was modified for this local QA.
- The application candidate has not been deployed. Existing production still
  represents the previous release behavior until a verified deploy completes.
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

1. Run application CI and Supabase migration/schema/pgTAP jobs against the exact
   release commit. Stop if any migration ownership/grant or lifecycle test
   fails.
2. Apply the forward migration through the normal authenticated release path;
   read back its identity/grants without exposing row payloads or secrets.
3. Deploy the exact application commit and record Railway deployment/image
   identity. Verify `/healthz`, protected polling-leader health and normal
   production monitor output.
4. Run a bounded synthetic lifecycle drill outside user traffic to prove the
   current leader can reclaim a stale former-leader row, increments the fence
   and rejects the former lease. Clean only the synthetic row.
5. From approved QA accounts, issue a small burst of distinct safe Inline
   queries. Use no real codes, cards, document data or private chats. Record
   response count and timing, not raw query content.
6. Interleave one stateful message/callback between Inline groups. Confirm the
   stateful action stays ordered and that Inline completion never advances the
   offset across a failed or busy earlier update.
7. Restart/redeploy one instance during a bounded synthetic run. Confirm a new
   leader is elected, pending work drains and no approved QA result is visibly
   duplicated or lost. Do not call this an exactly-once proof.
8. Read back aggregate lifecycle counts/fences and Telegram pending-update
   count only. Verify no raw payload, secret, query or user identifier entered
   the evidence artifact.
9. Run the normal production smoke and scheduled monitor after the drill. Keep
   the release blocked if health, leader ownership, queue depth or delivery is
   not green.
10. Attach the sanitized evidence to the release record. This polling gate does
    not by itself close `INL-001`, `INL-002` or `BOT-004`; the real
    Desktop/Android/iOS client matrix remains separate.
