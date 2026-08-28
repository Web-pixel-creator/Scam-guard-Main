# Railway infrastructure as code

Status: **APPLIED / RELEASE MERGE HOLD**. The owner approved the interactive
apply from exact bundle head `7f680925` on 2026-08-28. The legacy root
`railway.toml` remains in `main` until the reviewed bundle is merged, so do not
start a canary or call the migration complete yet.

```txt
.railway/railway.ts
```

The manifest preserves the reviewed production builder, watch, health, retry,
replica, region, networking and variable boundaries. The apply preflight was
`0 add / 2 update groups / 0 destroy`; Railway reported both groups applied.
It created only placeholder deployment
`2e2fc65e-212a-452c-bd5b-65583d9431e1`, which was `SKIPPED` without an image.
The active runtime therefore remained source `b36c453` in deployment
`311997d0`, and `/healthz` remained `200 ok`.

The live graph read-back now contains `DOCKERFILE`, the three watch patterns,
`/healthz`, timeout `100`, retry maximum `5`, one `us-west2` replica and all 22
user variables preserved without values. Railway omits its platform-default
`ON_FAILURE` restart type from that graph. The official policy default is
`On Failure`; declaring the same default in Railway IaC v3.11.0 / CLI 5.44.0
produced a non-converging `null -> ON_FAILURE` plan even after a successful
apply. The manifest therefore leaves the default type implicit and pins the
non-default retry maximum to `5`. The active deployment manifest independently
read back `restartPolicyType=ON_FAILURE`.

Official restart-policy reference:
<https://docs.railway.com/deployments/restart-policy>.

The complete migration, rollback and evidence sequence is in
`../ai_docs/RAILWAY_IAC_MIGRATION_PLAN.md`. Railway's `railway.toml` cutoff is
`2026-12-01`.

## Commands after the approved apply

Use Railway CLI `5.44.0` or newer. Re-import live state only in a disposable
worktree before final review; do not overwrite this reviewed candidate without
diffing and restoring every invariant:

```bash
railway config pull --force
```

Preview drift before any further action:

```bash
railway config plan
```

The expected result from this exact head is no changes. Do not repeat apply to
chase a default value that Railway intentionally omits. A future non-empty plan
requires a new review and explicit approval; only then use the interactive
command:

```bash
railway config apply
```

## Notes

- `railway config plan` is read-only, but its output still needs human review.
- The approved preflight was six field updates in two groups and zero
  deletions. After apply, the expected plan is empty. Treat any future
  destructive/resource/variable change as a stop condition.
- Do not use `--yes`, `--confirm-destructive`, `--json`, `--show-values` or
  `--decrypt-variables` for this migration.
- Never paste the pulled variable inventory into source, logs or chat.
  `preserve()` retains live values without exposing them.
- This candidate intentionally deletes `railway.toml`, as Railway's migration
  contract requires one source of truth. Preserve the known-good file through
  Git history and the recorded baseline, not as a second live file.
- The reviewed dashboard-equivalent settings have been applied while `main`
  still has its known-good legacy file. The remaining gate is the separately
  approved bundle merge that removes the legacy file. Start the new canary only
  after that final deployment passes read-back and smoke.
