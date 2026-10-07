# Railway edge probe and fresh availability checkpoint

Observed: **2026-10-07, approximately 22:14-22:18 Asia/Tashkent**.
This is a fresh read-back, not a production deployment or a passing edge gate.

## Authorization and isolated local preparation

The owner authorized a temporary isolated Railway diagnostic service without
production secrets/database, followed by deletion, with possible resource cost.
No approval was given for a plan purchase, workspace transfer, production
redeploy, migration, edge-trust enablement or PR #149 merge.

Prepared `C:\Scam-guard\railway-edge-probe-20261007` outside all application
worktrees. The dependency-free Node server observes only selected proxy headers
and reports ephemeral HMAC fingerprints, valid-IP/marker booleans and non-secret
runtime provenance. It does not print/store raw IPs, reflect arbitrary headers,
read request bodies, access a database or call Telegram/AI/TTS. Source and
Dockerfile are retained locally; nothing was uploaded.

`node --check server.mjs` passed. The local positive control proved that the
server sees a supplied reserved-address marker in `X-Real-IP` without sanitizing
it. This validates the diagnostic, **not Railway edge behavior**. Its own local
process was terminated by the harness.

## Cloud attempt and cleanup boundary

Native Railway CLI 5.44.0 was asked to create project
`ishonch-edge-probe-20261007` in workspace
`1d6fe781-e2e7-4900-b606-8fdd1ebc639e`, the workspace containing Scam-guard.
Creation failed with:

> Your trial has expired. Please select a plan to continue using Railway.

Fresh CLI project inventory confirmed **zero projects with that exact name**.
No project/service/deployment/domain ID was created, no service was uploaded,
and no deletion was needed. No diagnostic compute resource was started.
Intermittent CLI DNS failures were retained as failed attempts, not evidence of
resource creation or application failure.

The browser independently showed `Юра Полукаров's Projects — TRIAL` and
`Trial expired`. A different accessible workspace, `goroshin1's Projects`,
showed `HOBBY`. Its billing/resources were not used: do not silently assume an
approval for a probe in the project workspace authorizes spending in another
workspace. Neither a plan upgrade nor a project transfer was attempted.

## Fresh production observation

- Railway's production service page showed **Service offline** and
  **There is no active deployment for this service**, alongside the expired-trial
  notice. Project/service IDs remain `4a28bf63-8889-44f4-88ec-cd75c6fa1b8a` /
  `12774029-3fc5-4bfc-a373-5faaf35d66a9`.
- A direct GET of the existing production `/healthz` returned **HTTP 404**.
- CLI deployment metadata independently returned `REMOVED` for the prior
  baseline deployment `94d3fef2-c90c-4002-8068-19c331be01b3`, source
  `7e8ac7feda46df76a2e1fc02db1c1759a1442021`. The previous PR #143 deployment
  was also `REMOVED`. These are not healthy active deployments.
- The exact removal time/actor and a complete causal incident history were not
  established. Expired-trial restrictions and the offline state are verified;
  do not invent a code regression or claim a new active image digest.
- Git remote read-back still returned `main=7e8ac7fe` and published Draft
  PR #149 branch `c67fca7`. Local docs commit `3bed177` was not yet published at
  that read-back. The historical September canary result remains historical,
  not current availability evidence.

Only read-only production checks were performed. No deployment, secret,
runtime setting, migration, provider request or Telegram message was changed.

## Next decision and gates

1. Owner restores/activates the plan in the workspace containing production,
   or explicitly chooses another workspace and approves its billing and any
   separate production transfer. The agent does not purchase a subscription.
2. Reconcile and separately authorize production recovery. Verify exact source,
   deployment/image, runtime settings and no-AI health/security/polling checks;
   do not blindly redeploy the current candidate or restart an old canary.
3. Execute the disposable edge probe, verify received-header behavior and
   cleanup. Until then `X-Real-IP` trust is **NOT VERIFIED / OFF**.
4. PR #149 stays **Draft/HOLD**. Its separate migration-first cutover and new
   exact-baseline canary still require owner release approval. The local 320px
   admin label issue remains a separate design review item.

Local screenshots are retained under
`C:\Scam-guard\railway-edge-probe-20261007\evidence\`:
`workspace-trial-expired.jpg`, `production-no-active-deployment.jpg`.
They are local evidence, not committed public logs or a live edge proof.
