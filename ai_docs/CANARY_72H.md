# 72-hour Release Canary

This gate begins only after the release-candidate commit, every required
production migration and the exact Railway deployment are fixed. A code, schema
or production-secret change restarts the 72-hour clock.

## Current RC observation status (2026-08-28)

- Formal status: **NO ACTIVE WINDOW**. Do not count current scheduled monitor
  runs toward a release canary yet.
- Current production source: PR #141 merge
  `b36c453a08b3afd05c6e623d938e15dfc5b6084c`.
- Active Railway deployment: `311997d0-2c1a-4428-88a0-d8be1308f679`; image
  `sha256:8250a9a2edc1b7b0b451fc9fb274cb1e9c986b753cbc2f4a7db501f1a2b3651c`.
- The 2026-08-28 read-back returned `/healthz=200`; no-AI production and full
  security smokes passed, fresh error/warn scans returned `0/0`, and manual
  Production Monitor run `33148010977` passed with the provider check disabled.
- PR #137 and PR #140 remain deploy-eligible `DRAFT/HOLD` candidates and the
  Railway-IaC migration candidate remains unapplied. Starting a 72-hour window
  before the owner merges or explicitly defers that bundle would create a
  knowingly short-lived baseline.
- The backup workflow files are merged but operational status remains
  `NOT ENABLED / NOT VERIFIED`: no successful backup/read-back/restore evidence
  or protected backup credentials have been recorded.

## Superseded window #3 (2026-08-26, PR #135)

- RC: PR #135 merge `a964153f2dc376015e3e3fbf93068049e97f1ee3` (tree
  `36d9d748e26fc3b41268c55af9f35ef1b82c2cad`).
- Railway deployment: `464f3bb8-45c8-4df9-9752-f8a9564a757f`; image
  `sha256:92297f360af6e096a166bfd47ec6005bbc6f448c84aa0b47acc70c9aac1a7920`.
- Window opened `2026-08-26T03:54:30Z` after the owner-approved acceleration.
  PR #141 changed runtime source on 2026-08-27, then the owner-approved
  hash-pepper and Telegram credential cutovers changed production secret state.
  Each is a written restart trigger. Window #3 is therefore superseded and has
  no formal GO/NO-GO verdict; none of its observations carry into the next
  window.

## Superseded window #2 (2026-08-25, PR #129)

- RC: PR #129 merge `901977645d3a8eb7a6498ac6aba90748daaa648e` (tree
  `b68beea635e3d2a37e0fe15049c00eb20725813e`).
- Railway deployment: `59077b99-b155-4f6d-88db-e6769aa4a394`; image
  `sha256:cc242ed84ce1acdbd1fdab4c4791f79b363d53d0ded2bd28a0fcb67a531a4744`.
- PR #129 CI and Security Gates passed with 179 Vitest files and
  15,327/15,327 tests. The post-deploy production smoke passed: home and
  `/healthz` 200, webhook 401/503 boundaries, delivery `mode=polling`,
  `pending=0`, `last_error=none`, polling leader 200, optional AI provider
  probe `429 quota_exhausted` (degraded; deterministic scoring unaffected).
- Window opened `2026-08-25T15:07:00Z` and ran clean until the deliberate
  restart: 18/18 scheduled observations passed between
  `2026-08-25T15:34:30Z` and `2026-08-26T03:31:01Z` with zero non-success
  runs (one on exact `9019776`, the rest on docs tips with the runtime
  unchanged). It was superseded on `2026-08-26` by the owner-approved
  acceleration above, not by any failure.

## Historical window #1 — operational GO; formal OPEN / exception pending

- RC: `58557765ad28d58bfc279ffda35a298b817ded7f` (tree
  `94efdb4a753d296c93a183b754313b5949eb41bf`).
- Railway deployment: `11e41786-8633-4ee7-bd67-4b71fb768a6c`; image
  `sha256:d3a4183dd5a98d8844fafcbe053c777616501c45f2ee879d4522a3bd6fa1f4fc`.
- PR #128 CI and Security Gates passed with 174 Vitest files and
  13,486/13,486 tests. Deployment, `/healthz`, the no-AI smoke, webhook
  boundaries, polling leader, pending `0` and absence of a Telegram last error
  were green without a Telegram message or provider request.
- The first two eligible scheduled observations, runs `32340016736` and
  `32344631404`, passed.

### Operational checkpoint (2026-08-25): GO; formal closure not claimed

- Scheduled observation window `2026-08-20T06:32:24Z` →
  `2026-08-25T14:36:28Z`: 188/188 eligible scheduled runs passed; zero
  non-success eligible runs in the window. The final run was `32860557803`.
- Restart-rule review: `main` HEAD unchanged (`58557765`), the active Railway
  deployment is still `11e41786-8633-4ee7-bd67-4b71fb768a6c`, and no new
  migrations, workflow or runtime-config changes were merged since the RC
  deploy. The logged `getUpdates` provider events (last
  `2026-08-25T03:11:08Z`) recovered and produced no lost-response signal.
- Final bounded checks (2026-08-25, no user content sent): the production
  smoke passed (home and `/healthz` 200; webhook 401 without secret and the
  expected polling-mode 503 with secret; delivery `mode=polling`,
  `pending=0`, `last_error=none`; polling leader 200). The optional AI
  provider health probe returned `429 quota_exhausted` (degraded; the
  deterministic scoring core is unaffected). Its separate approval, run id,
  provider-request count and budget owner were not recorded as required by
  this contract. The security smoke passed
  (anon deny-by-default on tables and RPC, service-role paths, admin
  allowlist boundaries). The web P1 smoke passed with a synthetic report and
  appeal accepted, moderated, audited and cleaned up (marker
  `QA-P1-WEB-20260825144913`). That web-P1 smoke performed bounded
  create/moderate/cleanup writes and therefore was not a read-only check.
- Polling-dialogue smoke: skipped — it requires a real Telegram message and no
  explicit owner approval was granted for this window; it stays an open P1
  acceptance item, not a canary failure.
- Verdict: evidence supports operational **GO** for RC `58557765` / deployment
  `11e41786`, but formal `CANARY_72H` closure remains `OPEN / exception
pending`. The hour-72 polling-dialogue requirement was skipped and no
  owner/expiry-bound exception is recorded; AI-probe attribution evidence is
  also incomplete. Device, voice, accessibility and legal/privacy acceptance
  remain open as separate P1 items. PR #129 subsequently superseded this RC.

### Historical PR #126 runtime observation

- RC `8a76a5ec6994fd208cccde731bab2d5c70b6d232` ran as Railway deployment
  `895a82f3-6e59-4b91-8ec7-513330e4f7cb`, image
  `sha256:6bc60d2089cc4c61e2c2b7ca6f6af1239cc1d84c5b1dcd4d7f96679f4c1f1f27`.
- From the first recorded eligible run at `2026-08-13T12:52:46Z` through the
  final pre-PR-#128 run at `2026-08-20T05:53:48Z`, 226 scheduled monitor runs
  completed successfully.
- Scheduled run `32041888647` failed during GitHub job setup because codeload
  returned `429` while downloading the pinned `setup-bun` action. Checkout,
  Bun setup and the monitor itself never ran, so this invocation is noneligible
  and is not evidence of a production, security-boundary or lost-update
  failure. Adjacent scheduled observations passed.
- The PR #126 runtime observation exceeded the 144-success threshold without a
  confirmed sustained outage or repeated silent-update/lost-response pattern.
  Its full device, voice, accessibility and legal/privacy acceptance remained
  open, and PR #128 subsequently started a new runtime window.

### Historical PR #125 runtime observation

- RC: `1576e21cebd1ff7665ff2c37bb9c37a8d8f6588c`.
- Railway deployment: `17f20728-fea9-4320-987b-b15bdc67231a`; image
  `sha256:f22841c6114471af6e983aa042f1ab391a974683e45be687f7b64d7d74f92ec6`.
- The wall-clock observation from deployment at `2026-08-09T12:12:05Z`
  through the third checkpoint at `2026-08-12T12:36:30Z` contained 66 eligible
  scheduled monitor runs: 65 passed and one failed after an eight-second
  timeout in the missing-webhook-secret check.
- Run `31352427714` is the only failure. In the same run, home, `/healthz`, the
  authenticated polling-mode webhook boundary, Telegram `getMe`, empty webhook,
  pending `0`, polling leader and no-AI policy checks passed. The adjacent runs
  and all 19 scheduled runs in the final 24 hours passed without a deploy or
  configuration change.
- Historical operational 72-hour checkpoint: `GO`. No sustained outage or repeated
  silent-update/lost-response pattern was confirmed. Formal `CANARY_72H`
  closure remains `OPEN` under the unchanged 144-success and failure/restart
  rules. The full device, voice, accessibility and legal/privacy acceptance
  matrix also remains open.
- Seventeen of seventeen scheduled observations after the third checkpoint
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
- Bounded real-client evidence exists for the PR #124-128 Direct/Inline
  RU/UZ/EN safety scenarios without user identifiers or secret content. It does
  not replace the still-open full Desktop/Android/iOS and voice matrix; formal
  Inline client progress remains 1/51.
- Railway plan/payment method is active, `sleepApplication=false` and one
  replica is expected. Formal evidence for payment-method expiry, account-level
  spend alerts and a named response owner remains open in `OPEN_TASKS.md`.

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

Historical run `31352427714` is not silently waived: it timed out while observing the
missing-secret webhook boundary, so the formal gate remains open until an owner
records whether the unchanged restart rule requires a new counted window. The
healthy checks within that run and immediate recovery support the narrower
operational `GO` for that earlier RC; they do not rewrite this contract after
the fact.

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

### Historical window #1 baseline evidence for `58557765`

- PR #128 merge-commit CI and Security Gates: passed, 174 files / 13,486 tests.
- Railway deployment: `SUCCESS`; exact commit, tree and image digest match this
  file.
- Post-deploy `/healthz` and no-AI/no-live-message smoke: passed.
- First scheduled observations: runs `32340016736` and `32344631404`, both
  successful. Eligible scheduled baseline provider requests were `0`; a
  separate optional provider probe later returned `429`, but its required
  approval/run-id/request-count/budget record is incomplete.
- Final status: operational `GO`; formal closure `OPEN / exception pending`
  (see "Operational checkpoint (2026-08-25)" above).

### Historical observation evidence for `8a76a5e`

- Successful eligible scheduled observations: `226`.
- Noneligible GitHub setup failure: run `32041888647`; codeload `429` while
  downloading `setup-bun`, monitor not executed.
- No sustained outage or repeated silent-update/lost-response pattern was
  confirmed before PR #128 restarted the observation window.

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
