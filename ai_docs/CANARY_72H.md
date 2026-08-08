# 72-hour Release Canary

This gate begins only after the release-candidate commit, every required
production migration and the exact Railway deployment are fixed. A code, schema
or production-secret change restarts the 72-hour clock.

## Entry criteria

- CI and Security Gates pass on the RC commit.
- Railway reports the same commit as `SUCCESS`, `/healthz` is 200 and the
  release-container digest is recorded.
- The local D-091 monitor/workflow correction has been reviewed and merged,
  and one successful scheduled read-back explicitly reports the provider check
  disabled with no request. Until then this document is a future contract, not
  evidence that the current GitHub schedule is cost-free.
- Supabase migration history matches the RC; the admin-role reconciliation
  migration is applied and its count-only preflight/read-back is green.
- one manual baseline `Production Monitor` run with
  `check_ai_provider=false`, `prod:smoke` without `--check-ai`,
  `prod:security-smoke`, `prod:web-p1-smoke`, polling dialogue dispatch and
  cleanup pass. `prod:smoke` remains no-request even when Railway injects an
  `OPENAI_API_KEY`; only the explicit CLI flag enables its provider probe.
- Real-client Telegram/Inline evidence required for the chosen release scope is
  attached without user identifiers or message content.
- Railway plan/payment method is active, `sleepApplication=false`, one replica
  is expected, and an owner has checked usage/spend alerts in the Dashboard.

## Observation window

The scheduled `Production Monitor` runs every 30 minutes. A complete 72-hour
window therefore requires at least 144 eligible baseline runs for the same RC
state. Only `schedule` event runs with `MONITOR_CHECK_AI=false` are eligible;
manual workflow runs and explicitly budgeted AI-provider probes are recorded
separately and never replace a baseline observation.

Required on every run:

- home and `/healthz` 200;
- missing webhook secret 401 and authenticated webhook 503 in polling mode;
- Telegram `getMe` succeeds, webhook URL is empty and pending updates are 0;
- polling leader health is 200;
- the AI provider check reports `OK ... disabled by policy` and sends no
  provider request;
- no required secret-backed check is skipped.

At hour 0 and hour 72, rerun the manual baseline monitor with
`check_ai_provider=false`, `prod:smoke` without `--check-ai`, the bounded
web/security checks and the approved polling-dialogue smoke. At hours 24 and
48, record deployment status, restart count, error logs, pending updates and
billing/usage state without printing credentials or user payloads.

If the release scope promises provider-backed AI behavior, an owner may run a
separate bounded probe with the manual `Production Monitor` workflow input
`check_ai_provider=true`. That job uses `MONITOR_CHECK_AI=true` and `--ai-only`,
receives provider credentials only in its final consumer step, and makes one
chat-completion request. Missing credentials, HTTP `429`, HTTP `5xx`, any other
non-success status, timeout or network failure makes that manual job red. The
GitHub job status is the alert channel for this isolated probe; it receives no
Telegram credentials and sends no Telegram alert. Record the approval, run id,
provider-call count and budget separately from the 144 baseline observations.
Do not run it merely to make a rules-only release look healthier.

## Failure and restart rules

- Any security-boundary, migration, RLS, webhook-secret, polling-leader or lost
  update failure stops the canary and blocks release.
- A failed explicitly enabled provider probe is always red. It blocks an
  AI-dependent release promise until fixed or until the release scope is
  explicitly changed to the documented deterministic degradation path; it does
  not retroactively invalidate otherwise eligible cost-free baseline runs.
- A GitHub scheduling delay does not fail the product but does not count toward
  144 observations; extend the wall-clock window until enough eligible runs
  exist.
- Any deploy, migration, secret rotation, application config change, monitor
  code/workflow change or eligibility-policy change restarts the full canary
  from a new recorded timestamp. A manual AI probe does not restart the window
  when it changes no production or monitor configuration.

## Closure evidence

Record only:

- RC SHA, Railway deployment id/image digest and Supabase migration head;
- UTC start/end and count of eligible/success/failed monitor runs;
- count and run ids of separately approved manual AI probes, including the
  exact number of provider requests and the budget owner (`0` is valid);
- bounded smoke run ids and cleanup read-back;
- count-only error/restart/backlog observations;
- Railway plan/usage-check timestamp and owner;
- residual manual or legal exceptions with owner and expiry.

Do not attach tokens, chat ids, database URLs, user messages, screenshots or
row-level production exports.
