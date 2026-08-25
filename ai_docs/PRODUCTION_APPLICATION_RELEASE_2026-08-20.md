# Production application release — 2026-08-20

> Immutable release evidence for PR #128. For the current operational status,
> use `CURRENT_STATE.md` and `OPEN_TASKS.md`.

## Identity

- Pull request: [#128](https://github.com/Web-pixel-creator/Scam-guard-Main/pull/128),
  `Fix Inline installment routing and task scam fallback`.
- PR head: `f5f213f238fe75e03f8469e1c448479c638532e7`.
- GitHub `main` merge: `58557765ad28d58bfc279ffda35a298b817ded7f`.
- Source tree: `94efdb4a753d296c93a183b754313b5949eb41bf`.
- Railway deployment: `11e41786-8633-4ee7-bd67-4b71fb768a6c`.
- Railway image digest:
  `sha256:d3a4183dd5a98d8844fafcbe053c777616501c45f2ee879d4522a3bd6fa1f4fc`.
- GitHub deployment record: `5996867878`, state `success` at
  `2026-08-20T06:14:35Z`.

The merge commit and PR head have the same source tree. This release did not
change dependencies, Supabase migrations, database data or environment
variables.

## Bounded change

The release changed five Telegram source/test files with ten additions and two
deletions:

- an English `installment` phrase no longer substring-matches the app-install
  detector;
- the adjacent English Klarna denial keeps the unauthorized-BNPL route in
  Inline;
- the common Russian task-scam phrase `обещают зарплату ... внести налог`
  reaches deterministic task-scam guidance;
- benign salaried-work and self-authorized-installment controls remain outside
  those risk routes.

No new product surface or production side effect was introduced.

## Verification and deployment

- PR and merge-commit CI/Security Gates passed.
- Merge CI run
  [`32338550264`](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/runs/32338550264)
  passed 174 Vitest files and 13,486/13,486 tests, TypeScript, lint, production
  build, coverage and clean database migration/schema/pgTAP checks.
- Merge Security Gates run
  [`32338550207`](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/runs/32338550207)
  passed CodeQL, full-history secret scanning and container/SBOM checks.
- Railway Auto Deploy waited for the merge checks and reported the exact
  deployment above as successful.
- Post-deploy public health and the existing no-AI smoke passed. The smoke did
  not send a Telegram message, call AI/TTS or mutate Supabase.

## Canary boundary

Deployment of PR #128 started a new fixed-RC observation window. The first two
scheduled Production Monitor runs for the exact merge passed:

- [`32340016736`](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/runs/32340016736)
  at `2026-08-20T06:32:24Z`;
- [`32344631404`](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/runs/32344631404)
  at `2026-08-20T07:34:22Z`.

The latest recorded run returned home and `/healthz` `200`, missing-secret
webhook `401`, authenticated webhook `503` in polling mode, working `getMe`,
polling leader `200`, pending updates `0`, no Telegram last error and AI
disabled by policy with no provider request.

This early evidence is healthy but is not a 72-hour verdict. The PR #128 canary
remains `OPEN`, and it does not close the separate Desktop/Android/iOS,
accessibility, Voice or legal/privacy acceptance gates.
