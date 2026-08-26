# Design: Durable Outbound Delivery Journal (Outbox v1)

Status: **PROPOSAL — needs owner approval before implementation.** Written
2026-08-26. Target debt: the #1 architectural gap in `OPEN_TASKS.md` — every
statement about Telegram delivery is currently "best effort with honest
boundaries" because outbound outcomes live only in process memory and logs.

## Problem

Today `handlers/check.ts` renders a primary result and sends it through
`api.server.ts`. The outcome is classified as definitive-retryable,
definitive-permanent or **ambiguous** (timeout/network error after the request
may or may not have been delivered). Ambiguous results are acknowledged
without replay because Telegram supplies no idempotency key and a blind retry
could double-send. Consequences:

- an ambiguous outcome can mean a user silently never receives their answer;
- the only visibility is grepping logs for `delivery ambiguous`;
- a crash between render and send loses the message with no trace;
- delivery statistics cannot be queried, only narrated.

## Goal and non-goals

Goal: convert in-memory delivery uncertainty into a durable, queryable state
machine, and remove the silent-loss window that a crash-before-send creates.

Non-goals (explicitly out of scope for v1): exactly-once delivery (impossible
without a Telegram idempotency key — the contract stays honest), retrying
ambiguous outcomes automatically, changing Inline (stateless, no journal), and
any new infrastructure (no queues, no Redis — Postgres only).

## Design

### Table `telegram_delivery_journal`

| column                | type            | notes                                                   |
| --------------------- | --------------- | ------------------------------------------------------- |
| `id`                  | bigint identity |                                                         |
| `created_at`          | timestamptz     | retention-managed                                       |
| `chat_id`             | text            | needed to (re)deliver; already stored in sessions       |
| `delivery_slot`       | text            | logical slot, e.g. `primary`, `followup`                |
| `dedup_key`           | text unique     | `update_id:delivery_slot:attempt`                       |
| `payload`             | text            | rendered message text (see retention below)             |
| `parse_mode`          | text            |                                                         |
| `state`               | text            | `pending` → `sent` \| `failed_permanent` \| `ambiguous` |
| `telegram_message_id` | bigint null     | set on definitive success                               |
| `outcome_detail`      | text            | sanitized error class only, never raw provider bodies   |

RLS: service-role only (no anon/authenticated policies), same pattern as other
protected tables. Retention: rows deleted after **7 days** by the existing
daily retention job — the journal is an operational buffer, not an archive.
Payload retention note: the payload is bot-generated advice text (not user
input); 7 days keeps even that bounded.

### Write path (dual-write, crash-safe)

1. Render the primary result (unchanged).
2. `INSERT journal row (state=pending, dedup_key)` — **before** the send call.
3. Send via `api.server.ts` (unchanged classification).
4. `UPDATE` row to `sent` / `failed_permanent` / `ambiguous` with outcome
   detail and `telegram_message_id`.

Crash windows after this change:

- crash between (2) and (3): row stays `pending` with no send performed —
  a recovery sweep may safely retry it (at-least-once, no duplicate possible);
- crash between (3) and (4): row stays `pending` but the send may have
  happened — the sweep must **not** auto-retry these; they transition to
  `ambiguous` for visibility only. Distinguishing the two windows honestly is
  impossible without a Telegram idempotency key, so the sweep only retries
  rows that are younger than the send timeout and marked `pre_send=true`
  (set in step 2, flipped to `post_send=true` immediately before the fetch).

### Recovery sweep

A small guarded worker step inside the existing polling cycle (leader-only):
rows `pending AND pre_send AND age > send_timeout` → retry once with the same
`dedup_key`; rows `pending AND post_send AND age > threshold` → `ambiguous`.
Both transitions are counted (see observability doc).

### What this buys

- the crash-before-send silent-loss window closes (at-least-once for it);
- ambiguous outcomes become queryable counts with alert thresholds instead of
  log greps;
- delivery SLA statements become evidence-backed: "X% of primary results
  reached a terminal outcome within N seconds";
- exactly-once remains unclaimed, stated exactly as today.

## Rollout plan

1. Migration + table + RLS + pgTAP (count-only and policy tests).
2. Dual-write behind a runtime flag (`DELIVERY_JOURNAL=off|shadow|enforce`);
   `shadow` writes rows but does not gate anything (safe soak).
3. Recovery sweep behind the same flag, `enforce` last.
4. Monitor extension: alert on `ambiguous_rate` and `pending_age` thresholds.
5. Retention job extension + docs (`DATABASE.md`, `API.md`, `TELEGRAM_INTENT_CONTRACT.md`).

## Open questions for the owner

- Payload retention: 7 days acceptable, or shorter?
- Alert channel for `ambiguous_rate` breach: GitHub monitor failure (default,
  no Telegram message) or an approved Telegram alert to the owner chat?
