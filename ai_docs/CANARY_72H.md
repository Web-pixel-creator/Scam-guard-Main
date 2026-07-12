# 72-hour Release Canary

This gate begins only after the release-candidate commit, every required
production migration and the exact Railway deployment are fixed. A code, schema
or production-secret change restarts the 72-hour clock.

## Entry criteria

- CI and Security Gates pass on the RC commit.
- Railway reports the same commit as `SUCCESS`, `/healthz` is 200 and the
  release-container digest is recorded.
- Supabase migration history matches the RC; the admin-role reconciliation
  migration is applied and its count-only preflight/read-back is green.
- `prod:smoke`, `prod:security-smoke`, `prod:web-p1-smoke`, polling dialogue
  dispatch and cleanup pass.
- Real-client Telegram/Inline evidence required for the chosen release scope is
  attached without user identifiers or message content.
- Railway plan/payment method is active, `sleepApplication=false`, one replica
  is expected, and an owner has checked usage/spend alerts in the Dashboard.

## Observation window

The scheduled `Production Monitor` runs every 30 minutes. A complete 72-hour
window therefore requires at least 144 eligible runs for the same RC state.

Required on every run:

- home and `/healthz` 200;
- missing webhook secret 401 and authenticated webhook 503 in polling mode;
- Telegram `getMe` succeeds, webhook URL is empty and pending updates are 0;
- polling leader health is 200;
- AI provider check succeeds;
- no required secret-backed check is skipped.

At hour 0 and hour 72, rerun the bounded app, security and polling-dialogue
smokes. At hours 24 and 48, record deployment status, restart count, error logs,
pending updates and billing/usage state without printing credentials or user
payloads.

## Failure and restart rules

- Any security-boundary, migration, RLS, webhook-secret, polling-leader or lost
  update failure stops the canary and blocks release.
- A provider outage may be classified as degraded only when deterministic
  scoring/fallback remains available, the incident is recorded and the product
  promise is updated. The current fail-hard monitor still makes the run red.
- A GitHub scheduling delay does not fail the product but does not count toward
  144 observations; extend the wall-clock window until enough eligible runs
  exist.
- Any deploy, migration, secret rotation or config change restarts the full
  canary from a new recorded timestamp.

## Closure evidence

Record only:

- RC SHA, Railway deployment id/image digest and Supabase migration head;
- UTC start/end and count of eligible/success/failed monitor runs;
- bounded smoke run ids and cleanup read-back;
- count-only error/restart/backlog observations;
- Railway plan/usage-check timestamp and owner;
- residual manual or legal exceptions with owner and expiry.

Do not attach tokens, chat ids, database URLs, user messages, screenshots or
row-level production exports.
