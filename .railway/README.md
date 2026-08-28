# Railway configuration candidate

Status: **NOT APPLIED / HOLD** until the owner opens one controlled release
window. This directory is an authoring candidate; it does not prove that
Railway is currently managed from this file.

```txt
.railway/railway.ts
```

The candidate preserves the reviewed production builder, watch, health,
restart, replica, region, networking and variable boundaries. The active
runtime is source `b36c453` in deployment `311997d0`; authoring and planning
this file did not deploy or restart it.

The Dashboard custom-path field was read back as `railwayConfigFile=null`.
However, `resolvedFileConfig.configFile=/railway.toml` proves that Railway still
auto-detects the legacy root file from `main`; it remains the active source for
those deployment settings until the reviewed deletion is merged. The
post-rotation readable plan contains six field updates and zero deletions. The
candidate includes all 22 live user variables as `preserve()`, including the
active/previous/legacy hash-pepper slots. Neither fact means that this candidate
has been applied.

The complete migration, rollback and evidence sequence is in
`../ai_docs/RAILWAY_IAC_MIGRATION_PLAN.md`. Railway's `railway.toml` cutoff is
`2026-12-01`.

## Commands for the approved window

Use Railway CLI `5.44.0` or newer. Re-import live state only in a disposable
worktree before final review; do not overwrite this reviewed candidate without
diffing and restoring every invariant:

```bash
railway config pull --force
```

Preview what Railway would change:

```bash
railway config plan
```

Application is forbidden while this candidate is on HOLD. After the canary
boundary, a fresh pull, a clean readable plan, and explicit owner approval, use
the interactive command only:

```bash
railway config apply
```

## Notes

- `railway config plan` is read-only, but its output still needs human review.
- The expected post-rotation preflight is six field updates and zero deletions. Treat any
  changed count or destructive/resource/variable change as a stop condition.
- Do not use `--yes`, `--confirm-destructive`, `--json`, `--show-values` or
  `--decrypt-variables` for this migration.
- Never paste the pulled variable inventory into source, logs or chat.
  `preserve()` retains live values without exposing them.
- This candidate intentionally deletes `railway.toml`, as Railway's migration
  contract requires one source of truth. Preserve the known-good file through
  Git history and the recorded baseline, not as a second live file.
- In the approved window, apply the reviewed dashboard-equivalent settings
  first while `main` still has its known-good legacy file, then immediately
  merge this already-reviewed deletion. Start the new canary only after that
  final deployment passes read-back and smoke.
