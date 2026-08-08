# Documentation Freshness and Archive Policy

Last reconciled: 2026-08-08.

This policy prevents historical audits, local evidence branches and old release
totals from being mistaken for the current Ishonch Guard baseline.

## Canonical sources

Use the following order when documents conflict:

1. `CURRENT_STATE.md` is the short operational source of truth for the verified
   repository/deployment baseline and known limitations.
2. `OPEN_TASKS.md` is the current queue of unclosed release gates and technical
   work.
3. The exact source/migrations at the commit named in `CURRENT_STATE.md` decide
   implementation facts.
4. `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, contracts and maps describe the
   maintained design.
5. `PROJECT_OVERVIEW.md` and `ROADMAP.md` describe product context and direction,
   not proof that a feature is deployed or accepted.

No review may call the project current merely because a local checkout has a
newer timestamp. Verify the public `main` ref and distinguish merged code from
an open PR.

## Historical documents

A filename containing a date, `AUDIT`, `PREFLIGHT`, `PLAN`, `QA`, `SOAK`,
`RELEASE` or `EVIDENCE` normally records what was known at one point in time.
These files are retained because they provide useful audit and recovery
evidence. They must not be deleted solely because their verdict or checklist is
old.

Historical values include:

- commit, tree, deployment and workflow ids;
- test-file/test-case totals;
- unchecked release rows and `GO`/`NO-GO` decisions;
- production counters and provider-attempt totals;
- feature availability or limitations at that date.

An old value remains valid evidence for its own snapshot. It becomes the
current value only if `CURRENT_STATE.md` repeats or supersedes it explicitly.

## Required banner for potentially confusing snapshots

Plans and audits likely to be read as current should start with a notice similar
to:

> Historical snapshot. Do not use this file as the current project status.
> See `CURRENT_STATE.md` and `OPEN_TASKS.md`.

Release records should instead say that they are immutable evidence and link to
the newer release record when one exists. Do not rewrite their historical
outcome to match the present.

## Freshness rules for maintained documents

- `README.md`, `AI_INDEX.md`, `CURRENT_STATE.md` and `OPEN_TASKS.md` must be
  reviewed together before a documentation release.
- `CURRENT_STATE.md` must include `Last reconciled` and the exact deployed or
  verified commit.
- A test total must include its date and commit/release context. Avoid vague
  statements such as `215+ tests`.
- Distinguish `implemented`, `verified locally`, `merged`, `deployed` and
  `accepted in a real client`.
- Internal test volume must not be presented as real-world precision/recall,
  prevented loss, user adoption or enterprise readiness.
- Media privacy text must distinguish `not persisted by Ishonch Guard` from
  `not sent to a configured OCR/STT/vision provider`.
- AI claims must distinguish deterministic scoring, optional explanation and
  any future shadow/hybrid classifier.

## Local workspace hygiene

The operator workspace may contain multiple worktrees and local historical
reports outside the Git repository. These are not GitHub `main`.

- Never run reset/clean/delete across them to make the folder look tidy.
- Keep active dirty worktrees intact until their provenance is resolved.
- Put local-only audits under an explicitly named archive directory when it is
  safe to move them.
- Prune a remote branch or close a PR only after confirming that its unique
  commits are merged, superseded or intentionally abandoned.
- A clean worktree based on `origin/main` should be used for release review and
  new documentation cleanup.

## Review checklist

Before merging documentation changes:

1. Confirm `origin/main`, production source and the proposed branch ancestry.
2. Check README links and headings.
3. Search maintained docs for superseded test totals, delivery modes and status
   claims.
4. Ensure old evidence is labelled rather than silently rewritten.
5. Run formatting and the repository's normal CI gates.
6. Treat the merge as a production-triggering action when Railway auto deploy
   is enabled, even if the diff contains documentation only.
