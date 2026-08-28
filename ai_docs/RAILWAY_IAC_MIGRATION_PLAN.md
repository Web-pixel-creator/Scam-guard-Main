# Railway IaC Migration Plan

Status: **NOT APPLIED / HOLD**. No Railway configuration has been changed by
this document or by the audited candidate.

`railway.toml` remains the effective deployed manifest, but Railway has marked
that format deprecated with a hard cutoff on `2026-12-01`. Migration to
`.railway/railway.ts` is prepared on an isolated HOLD branch. Native Railway
CLI `5.44.0` is available at `C:\Scam-guard\tools\railway.exe`. Platform
references: <https://docs.railway.com/infrastructure-as-code> and
<https://docs.railway.com/cli/config>.

The 2026-08-28 post-rotation audit caught a real destructive preflight: the
stale candidate would have deleted the new previous hash-pepper secret/version
variables. Both were added as `preserve()` and the repeated readable plan now
reports `0 add`, two resource updates and `0 destroy`. This is proof that the
stop condition worked, not permission to apply.

## Invariants that must survive

- Dockerfile builder and the current Dockerfile path;
- watch patterns `**`, `!/*.md`, `!/ai_docs/**`;
- healthcheck path `/healthz` with timeout `100` seconds;
- restart policy `ON_FAILURE` with maximum `5` retries;
- region `us-west2`, one replica;
- current service/environment binding, domains and all 22 live user variables
  through `preserve()` without copying values into documentation.

## Why automatic migration is insufficient

The automatic import omitted reviewed build/deploy invariants. The first
post-rotation plan also demonstrated that a previously complete `preserve()`
inventory becomes unsafe after a later credential/topology change. Blindly
applying generated or stale output could change production behavior or delete
required compatibility state.

## Approved sequence

1. Use native Railway CLI `>=5.44.0` in an isolated operator environment and
   confirm the exact linked project/environment/service.
2. Start from a disposable worktree and run the live import with
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
   runtime SHA, image digest and `/healthz`.
6. Repeat the Dashboard/live API read-back. The audited state is
   `railwayConfigFile=null` while the resolved repo manifest remains
   `/railway.toml`; there is no Dashboard field to clear. Any non-null drift is
   a stop condition.
7. In the candidate worktree where `railway.toml` is absent locally, repeat
   `railway config plan --verbose`. Require the reviewed six field updates,
   `0 add` and `0 destroy`; any variable/resource deletion is a stop condition.
8. Run interactive `railway config apply` only for that reviewed clean plan. Do
   not use `--json`, `--show-values`, `--decrypt-variables`, `--yes` or
   `--confirm-destructive`. Immediately read back the live manifest and verify
   deployment identity, `/healthz`, replica/region, restart policy and the
   no-AI production smoke.
9. Only after the apply/read-back is clean, merge the already-reviewed
   infrastructure PR that removes `railway.toml`, keeps
   `.railway/railway.ts`, and updates its guard test. Observe the resulting
   deployment through `SUCCESS`.
10. Prove both watch exclusions with one root-Markdown change and one
    `ai_docs/**` change: each must produce `SKIPPED` while deployment/image stay
    unchanged.
11. Record the final deployment, image digest, plan/apply evidence and new
    canary start without secret values.

## Rollback and stop conditions

- Stop before apply if the plan is incomplete, destructive or differs from the
  invariants above.
- Preserve the last known-good `railway.toml` commit and pre-apply live
  read-back as rollback evidence until the new IaC path passes canary.
- Before apply, any unexpected plan means no production change: do not apply and
  keep the effective root `railway.toml` untouched.
- If apply/read-back diverges before merge, do not merge the legacy-file
  deletion; correct or reverse the underlying setting while `main` still has
  the known-good file. If the post-merge deployment diverges, revert the
  migration commit to restore `railway.toml`, verify health, then decide whether
  the underlying IaC-applied settings also require reversal.
- Never use blind `apply`, interactive defaults or a generated migration file
  that leaves required settings as comments.
