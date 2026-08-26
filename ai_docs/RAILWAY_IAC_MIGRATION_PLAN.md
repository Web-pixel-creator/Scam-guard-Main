# Railway IaC Migration Plan

Status: **OPEN / PLAN ONLY**. No Railway configuration has been changed by this
document.

`railway.toml` remains the effective deployed manifest, but Railway has marked
that format deprecated with a hard cutoff on `2026-12-01`. Migration to
`.railway/railway.ts` is not implemented. The installed workstation CLI is
`4.30.4`; the migration requires Railway CLI `5.44.0` or newer. Platform
references: <https://docs.railway.com/infrastructure-as-code> and
<https://docs.railway.com/cli/config>.

## Invariants that must survive

- Dockerfile builder and the current Dockerfile path;
- watch patterns `**`, `!/*.md`, `!/ai_docs/**`;
- healthcheck path `/healthz` with timeout `100` seconds;
- restart policy `ON_FAILURE` with maximum `5` retries;
- region `us-west2`, one replica;
- current service/environment binding, domains and all live variables without
  copying their names or values into documentation.

## Why automatic migration is insufficient

The current `railway config migrate` output is incomplete for this service:
watch/build settings are emitted only as comments and the restart policy is
omitted. Blindly applying that output could change production behavior.

## Approved sequence

1. Upgrade Railway CLI to `>=5.44.0` in an isolated operator environment and
   confirm the exact `railway config` command syntax with `--help`.
2. Start from a clean branch and run the live import with
   `railway config pull --force`. Never paste the pulled variable inventory into
   a ticket, chat, log or this document.
3. Build `.railway/railway.ts` manually from the live pull. Use `preserve()` for
   existing secret/environment state and encode every invariant above
   explicitly.
4. Run a preliminary interactive `railway config plan --verbose`. It must
   contain no service, environment, domain, volume or variable deletion and no
   unplanned region, replica, health, restart, builder or watch change.
5. Obtain explicit owner approval for one production-config/canary restart
   window, freeze unrelated merges/deploys and record the active deployment,
   runtime SHA, image digest and `/healthz`. Do not combine this migration with
   application, backup or secret work.
6. In that window, clear the Railway Dashboard **Config File** field currently
   set to `/railway.toml`. This is the critical non-atomic step: the legacy file
   and IaC cannot control the service simultaneously.
7. Immediately run the human-readable `railway config plan --verbose` again.
   If it proposes any unexpected deletion or invariant change, do not apply;
   restore Dashboard Config File to `/railway.toml` immediately and verify the
   previous effective manifest.
8. Run interactive `railway config apply` only for the reviewed clean plan. Do
   not use `--json`, `--show-values`, `--decrypt-variables`, `--yes` or
   `--confirm-destructive`. Immediately read back the live manifest and verify
   deployment identity, `/healthz`, replica/region, restart policy and the
   no-AI production smoke.
9. In the same infrastructure PR, remove legacy `railway.toml`, update its guard
   test for `.railway/railway.ts`, rerun CI and merge only after the live IaC
   apply is clean.
10. Prove both watch exclusions with one root-Markdown change and one
    `ai_docs/**` change: each must produce `SKIPPED` while deployment/image stay
    unchanged.
11. Record the final deployment, image digest, plan/apply evidence and new
    canary start without secret values.

## Rollback and stop conditions

- Stop before apply if the plan is incomplete, destructive or differs from the
  invariants above.
- Preserve the last known-good `railway.toml` commit, Dashboard Config File
  value `/railway.toml` and pre-apply live read-back as rollback evidence until
  the new IaC path passes canary.
- Before apply, any unexpected plan is rolled back by restoring Dashboard Config
  File to `/railway.toml`; verify the old effective manifest before leaving the
  window.
- If post-apply identity/health differs, restore `/railway.toml` as the Dashboard
  Config File and the reviewed previous configuration in the same approved
  window, then verify the immutable runtime according to
  `RECOVERY_AND_KEY_ROTATION.md`.
- Never use blind `apply`, interactive defaults or a generated migration file
  that leaves required settings as comments.
