# 72-hour Release Canary

This gate begins only after the release-candidate commit, every required
production migration and the exact Railway deployment are fixed. A code, schema
or production-secret change restarts the 72-hour clock.

## Current RC observation status (2026-08-13)

- Current RC: `8a76a5ec6994fd208cccde731bab2d5c70b6d232`.
- Railway deployment: `895a82f3-6e59-4b91-8ec7-513330e4f7cb`; image
  `sha256:6bc60d2089cc4c61e2c2b7ca6f6af1239cc1d84c5b1dcd4d7f96679f4c1f1f27`.
- PR #126 deployed at `2026-08-13T12:30:01Z` and restarted the observation
  clock. CI and Security Gates passed on the merge commit; deployment,
  `/healthz`, no-AI smoke, webhook boundaries, polling leader, pending `0` and
  no Telegram last error are green. The remaining required entry smokes and
  first eligible scheduled observation have not yet been recorded, so formal
  current-RC closure is `OPEN` and no 72-hour verdict is claimed for `8a76a5e`.
- The historical wall-clock observation for the prior `1576e21` RC from
  deployment at `2026-08-09T12:12:05Z`
  through the third checkpoint at `2026-08-12T12:36:30Z` contained 66 eligible
  scheduled monitor runs: 65 passed and one failed after an eight-second
  timeout in the missing-webhook-secret check.
- Run `31352427714` is the only failure. In the same run, home, `/healthz`, the
  authenticated polling-mode webhook boundary, Telegram `getMe`, empty webhook,
  pending `0`, polling leader and no-AI policy checks passed. The adjacent runs
  and all 19 scheduled runs in the final 24 hours passed without a deploy or
  configuration change.
- Historical operational 72-hour checkpoint for `1576e21`: `GO`. No sustained outage or repeated
  silent-update/lost-response pattern was confirmed. Formal `CANARY_72H`
  closure remains `OPEN` under the unchanged 144-success and failure/restart
  rules. The full device, voice, accessibility and legal/privacy acceptance
  matrix also remains open.
- Seventeen of seventeen scheduled observations for `1576e21` after the third checkpoint
  passed through run `31687504428` at `2026-08-13T09:38:19Z`; production and
  `main` still used the same RC. One post-canary optional AI explanation logged
  a quota `429`, and one later Telegram polling request logged a transient
  network exception; a subsequent scheduled monitor was green. These events
  are follow-up evidence, not proof of a repeated update loss.

## Entry criteria

- CI and Security Gates pass on the RC commit.
- Railway reports the same commit as `SUCCESS`, `/healthz` is 200 and the
  release-container digest is recorded.
- The D-091 monitor/workflow correction is merged in PR #121. A manual baseline
  and scheduled read-backs explicitly report the provider check disabled with
  no request.
- Supabase migration history matches the RC; the admin-role reconciliation
  migration is applied and its count-only preflight/read-back is green.
- one manual baseline `Production Monitor` run with
  `check_ai_provider=false`, `prod:smoke` without `--check-ai`,
  `prod:security-smoke`, `prod:web-p1-smoke`, polling dialogue dispatch and
  cleanup pass. `prod:smoke` remains no-request even when Railway injects an
  `OPENAI_API_KEY`; only the explicit CLI flag enables its provider probe.
- Bounded real-client evidence exists for the PR #124-125 Direct/Inline
  RU/UZ/EN safety scenarios without user identifiers or secret content. It does
  not replace the still-open full Desktop/Android/iOS and voice matrix.
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

Run `31352427714` is not silently waived: it timed out while observing the
missing-secret webhook boundary, so the formal gate remains open until an owner
records whether the unchanged restart rule requires a new counted window. The
healthy checks within that run and immediate recovery support the narrower
operational `GO`; they do not rewrite this contract after the fact.

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

### Current baseline evidence for `8a76a5e`

- Merge-commit CI and Security Gates: passed.
- Railway deployment: `SUCCESS`; exact commit and image digest match this file.
- Post-deploy `/` and `/healthz`: `200`.
- No-AI/no-live-message smoke: passed; webhook security boundaries correct,
  mode `polling`, pending updates `0`, last error absent, polling leader healthy,
  provider request disabled by policy.
- Runtime startup logs: two info messages, no warning or error.
- Eligible scheduled observations recorded for this RC at reconciliation time:
  `0`; formal canary status: `OPEN`.

### Historical checkpoint evidence for `1576e21`

- First eligible run in the fixed-RC window: `31313623902`.
- Last eligible run before the 72-hour checkpoint: `31592922999`.
- Failed run requiring formal disposition: `31352427714`.
- Scheduled count: `66`; successful: `65`; failed: `1`.
- Explicitly enabled manual AI probes/provider requests during this window: `0`.
- Final read-back: `/healthz` `200`, polling leader healthy, Telegram pending
  updates `0`, `last_error` absent, active deployment/commit unchanged.
- Runtime logs in the window contained nine transient Telegram polling
  `network_exception` entries and two nearly simultaneous non-OK `502` entries.
  Polling recovered automatically and the final read-back was healthy.
- The operational checkpoint is `GO`; formal closure is intentionally not
  claimed until the unchanged contract is satisfied or an independently
  approved new release policy starts a new observation window.
