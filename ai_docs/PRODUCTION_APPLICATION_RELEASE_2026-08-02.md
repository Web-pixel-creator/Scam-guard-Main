# Production application release evidence — 2026-08-02

> **Immutable historical release evidence.** A newer application release was
> recorded on 2026-08-08 in `PRODUCTION_APPLICATION_RELEASE_2026-08-08.md`.
> Use `CURRENT_STATE.md` for the current deployed baseline.

Sanitized record of the separately approved application release that followed
the completed Supabase maintenance window. This document contains no
credentials, private email addresses, TOTP material, Telegram payloads, raw
reports, or user identifiers.

## Outcome

**SUCCESS.** PR #119 was merged at `2026-08-02T06:41:39Z` as
`9e901b1673832e4e78d61500280f061ba39e245c`. All seven reported GitHub
CI/security checks had passed before merge. The owner explicitly approved both
the merge and a production deployment of the resulting `main` revision.

After this application deployment, documentation-only PR #120 was merged as
`b226bdd`. It also passed all seven reported GitHub CI/security checks. The
current repository tip is therefore `b226bdd`, while the deployed application
source remains `9e901b1`; the intervening diff contains documentation only.

Railway did not start a deployment after the PR #119 merge, and the later PR
#120 documentation merge also did not deploy. Read-only inspection confirmed
why: the GitHub repository is connected to the service, but the production
environment is not connected to a source branch; the Dashboard offers `Connect
Environment to Branch`. Therefore production merges do not currently
auto-deploy.

After the explicit deployment approval, one manual source redeploy was started
with Railway's official CLI. No branch binding or Railway setting was changed.

## Immutable release identity

| Item               | Verified value                                                            |
| ------------------ | ------------------------------------------------------------------------- |
| GitHub PR          | `#119`                                                                    |
| Repository tip     | `b226bdd` (documentation-only PR #120; not deployed application source)   |
| Source commit      | `9e901b1673832e4e78d61500280f061ba39e245c`                                |
| Railway deployment | `12c9b9c2-d7de-4fb5-9817-9ae47c3b8cb7`                                    |
| Created            | `2026-08-02T06:45:27.495Z`                                                |
| Reason/status      | `deploy` / `SUCCESS`                                                      |
| Image digest       | `sha256:44b69a4a996393d39220702b07214fb622017aa83698051139d10ab2bdd8b41a` |
| Runtime            | one running instance                                                      |

## Application and security postflight

The following public GET routes returned HTTP `200`:

- `/healthz` with body `ok`;
- `/`;
- `/login`;
- `/admin`;
- `/admin-mfa`;
- `/report`;
- `/appeal`;
- `/privacy`;
- `/emergency`.

An already authenticated administrator session showed `MFA confirmed`, loaded
the protected admin view, and reported the established aggregate check count
of `235`. No private report content or account address was retained as release
evidence.

The polling-aware checks also passed:

- a webhook request without the secret returned `401`;
- the authenticated webhook boundary returned the expected `503` while the
  service was in polling mode;
- Telegram `getMe` succeeded;
- delivery mode was `polling`, pending updates were `0`, and Telegram reported
  no last error;
- the authenticated polling-leader health endpoint returned `200`.

No synthetic Telegram update or message was sent. No Supabase schema or data
mutation was made during this application release. Production remains at `33`
migrations with head `20260729131000`.

Current GitHub CI at repository tip `b226bdd` passed 165 files and
12,855/12,855 tests. The earlier 12,853 local candidate count is a historical
local run, not the current `main` CI total.

## Observation and logs

The final postflight completed more than ten minutes after deployment creation.
Railway still reported `SUCCESS`, `/healthz` still returned `200 ok`, exactly
one instance was running, and a full-interval deployment-log filter returned
zero warning and zero error lines.

## AI provider disclosure

The intended release check was to avoid AI-provider usage. A local PowerShell
environment override did not remove the inherited provider key from the
Railway-run monitor, so the monitor made exactly one provider health request.
It returned HTTP `200` for model `gemini-3.5-flash` and may be billable. The
request contained no user content and was not repeated by that manual release
check. This does not mean provider probing stopped: the separately configured
30-minute Production Monitor continued to attempt its own provider health call.
The five-day audit found 60 scheduled runs in total, plus this manual release
request. Consequently this release interval must **not** be described as
zero-API or zero-AI-call verification.

## Remaining operational boundary

Production currently uses explicit manual deployments because no branch is
connected to the production environment. Connecting `main` would make future
eligible changes capable of deploying automatically and is a separate runtime
configuration decision requiring owner approval. Until that decision is made,
documentation and release procedures must not promise automatic deployment.

A later read-only Railway recheck found `us-west2` in the current service
manifest and a Dashboard warning that this invalid region blocks deployments.
The deployment recorded above remains running and healthy, but a subsequent
deploy must not be attempted until an owner separately approves a valid region
replacement and rollback verification. No region or branch-binding setting was
changed during the recheck.

The fixed-RC 72-hour canary, final real-client Direct/Inline RU/UZ/EN matrix,
complete accessibility review, legal/privacy approval, Railway billing-alert
evidence, and separately approved rollback/return drill remain open.
