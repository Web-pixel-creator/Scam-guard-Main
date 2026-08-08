# Production application release - 2026-08-08

This is the sanitized immutable record for the PR #121 application release.
It contains no credentials, Telegram user/chat identifiers, production row
payloads or secret values.

## Scope and immutable identifiers

- PR #121, `Harden Direct delivery lifecycle and cost-safe monitoring`, merged
  into `main` at
  `c5fa51de8f570fd2258722b1194bd7430319d242` on
  `2026-08-08T05:38:34Z`.
- The release tree is
  `79c8a35adfc9dcf492ca2951ec5c75ae2274574c`; it is exactly the tree verified
  on PR head `bfbc777b6bf51596b69304f0f1e79de4d5fce53e`.
- Railway production deployment
  `4d00a730-d8e2-462f-b820-e3cecbfb0994` reached `SUCCESS`.
- Railway image digest:
  `sha256:a133607af78d17f9efa46404512fc161faadc29c4e24f1260de3e00a2be3668f`.
- Supabase production remained at 33 migrations with head
  `20260729131000`; this release applied no database migration and performed no
  Supabase cloud mutation.

## Release gate

- Fresh local verification on the exact release tree passed 167 Vitest files
  and 12,890/12,890 tests, TypeScript, production build and ESLint with zero
  errors and the eight established Fast Refresh warnings.
- PR #121 passed all seven reported GitHub CI/security checks. The post-merge
  `main` CI run `31242142841` and Security Gates run `31242142834` also passed
  on exact merge SHA `c5fa51d`.
- The candidate's previously recorded clean-database gate applied all 33
  migrations, passed schema lint and pgTAP 92/92; its coverage, container,
  Trivy, Bun audit and redacted Gitleaks evidence remained unchanged because
  the merge tree exactly matched the verified PR tree.

## Deployment

The GitHub merge did not create a Railway deployment because production had no
branch binding and auto deploy was disabled. The running release stayed healthy.
The exact merge commit was checked out in a clean detached worktree and uploaded
with Railway CLI as `Deploy main c5fa51d after PR #121`. Railway built the repo
Dockerfile, passed `/healthz`, switched traffic only after the new deployment
was healthy and then removed the prior deployment.

After the release, the separately approved permanent source settings were
corrected in Railway:

- production branch: `main`;
- auto deploy: enabled;
- Wait for CI: enabled.

Saving those settings did not create an additional deployment. The first future
`main` change is still required as end-to-end evidence that the GitHub App has
the updated permissions needed by Wait for CI. Do not create a production-only
test commit merely to prove the binding during the fixed-RC observation window.

## Post-deploy evidence

- `/healthz`, `/`, `/admin` and `/login` returned HTTP 200.
- The production smoke passed home/health, missing-secret `401`, authenticated
  webhook `503` in polling mode, Telegram delivery state, pending updates `0`
  and polling-leader health `200`.
- The smoke was run without `--check-ai`; it explicitly reported the AI
  provider disabled by policy and sent no provider request.
- No live Telegram synthetic update or user message was sent. Telegram checks
  were bounded read-only Bot API health calls.
- Manual baseline Production Monitor run `31242484006` passed on `c5fa51d` with
  `check_ai_provider=false`; the separate AI-provider job was skipped.
- The new Railway deployment log contained only normal container start/listen
  messages. The bounded postflight error/warning query returned no entries.

## Canary boundary

The exact application RC, deployment and no-AI monitor policy are fixed. As of
`2026-08-08T14:23:57Z`, eleven scheduled Production Monitor runs on `c5fa51d`
had completed successfully with zero failures. The first was run `31244357114`
at `2026-08-08T06:37:56Z`; the latest snapshot was run `31261844650`.
The sampled scheduled log explicitly reported `MONITOR_CHECK_AI=false`,
`disabled by policy` and `no request sent`.

These are valid fixed-RC operational observations, but the final 72-hour gate is
not closed. Closure still requires at least 144 eligible scheduled successes,
the hour-24/hour-48/hour-72 observations and every remaining release-scope
client, accessibility and legal/privacy acceptance item. GitHub schedule delays
extend the window until 144 eligible runs exist.

## Residual boundaries

- Telegram does not expose an idempotency key. Strict exactly-once delivery is
  not claimed without a durable outbound journal/outbox.
- Durable result reuse across restart/instances and the separate OCR fallback
  two-phase correction remain follow-up work.
- Multi-instance polling handoff and definitive provider-failure recovery still
  require production-shaped evidence.
- The Railway payment method/expiry owner and spend alerts are not proven by
  CLI plan metadata and remain an operational task.
