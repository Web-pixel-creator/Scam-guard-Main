# Production application release — 2026-08-25

> Immutable release evidence for PR #129. For the current operational status,
> use `CURRENT_STATE.md` and `OPEN_TASKS.md`.

## Independent audit correction (2026-08-26)

The release identity and gate evidence below remain immutable. Subsequent state:

- window #2 was superseded after 18/18 successful scheduled observations by
  the owner-approved PR #133/#135 acceleration; it did not reach a formal
  canary verdict;
- historical PR #128 evidence supports operational `GO`, but formal status is
  `OPEN / exception pending` because the required polling dialogue was skipped
  and optional AI-probe attribution evidence is incomplete;
- GitHub docs tip is now `4380085d`, while deployed runtime is `a964153f` /
  deployment `464f3bb8`; this record's `9019776` / `59077b99` identifiers are
  historical PR #129 release facts.

## Identity

- Pull request: [#129](https://github.com/Web-pixel-creator/Scam-guard-Main/pull/129),
  `feat: semantic and human-simulation hardening (risk rules, telegram routing, QA corpora)`.
- PR head: `85d78983566830793f8b20c58fa042e0ce83f616`.
- GitHub `main` merge: `901977645d3a8eb7a6498ac6aba90748daaa648e`, merged at
  `2026-08-25T15:01:26Z`.
- Source tree: `b68beea635e3d2a37e0fe15049c00eb20725813e`.
- Railway deployment: `59077b99-b155-4f6d-88db-e6769aa4a394`, reported
  `SUCCESS` at `2026-08-25T15:07:00Z`.
- Railway image digest:
  `sha256:cc242ed84ce1acdbd1fdab4c4791f79b363d53d0ded2bd28a0fcb67a531a4744`.

The release changes no dependencies, no Supabase migration, no database data
and no environment variable. Railway watch patterns
(`["**", "!/*.md", "!/ai_docs/**"]`) shipped in the same `railway.toml` and are
confirmed active in the deployed manifest.

## Bounded change

71 files changed against the PR #128 base (`58557765`): 11,002 insertions and
400 deletions across `src/lib` only, plus five new offline test files. Four
commits:

1. `feat(risk)` — deterministic rule and scam-pattern expansion (authority-
   coerced dangerous tasks, paid penalty-points reset, fake neighbor/camera
   video archives, ROAD24/100% cashback fine APK, known-contact gift links,
   extra delivery payment, OneID credential phishing, mistaken phone top-up)
   with clause-local false-positive controls, `access_token` secret class and
   brand/image/sensitive-text updates.
2. `feat(telegram)` — RU/UZ/EN routing, completed-incident aftercare,
   multi-line/forwarded inline context, follow-up scripts, secret-preflight
   protection, accidental outgoing-transfer helper sync (panic-guard
   defense-in-depth).
3. `test(qa)` — adversarial human scenario corpora, expanded people-simulation
   suite (1,308 language surfaces: 153 authored phrases plus deterministic
   mutations) and novel emerging-scam probes; all offline with zero external
   side effects.
4. `ci` — 240s budget for the 3,805-case inline corpus render and gitleaksignore
   allowlist entries for intentional fake secret-class fixtures; Railway watch
   patterns with a CI config guard.

Deterministic verdicts are preserved: optional AI never changes a risk level,
and Inline remains rules-only, stateless and non-persistent.

## Verification and deployment

- PR CI run
  [`32862494115`](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/runs/32862494115)
  passed 179 Vitest files and 15,327/15,327 tests, TypeScript, lint, production
  build, coverage thresholds and clean database migration/schema/pgTAP checks.
- PR Security Gates run
  [`32862494172`](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/runs/32862494172)
  passed CodeQL (both jobs), Gitleaks, container scan and SBOM.
- Local offline gates matched: TypeScript 0 errors, ESLint 0 errors with the
  eight established Fast Refresh warnings, Prettier and `git diff --check`
  clean.
- Railway Auto Deploy waited for the merge checks and reported the exact
  deployment above as `SUCCESS`.
- The no-live-message/no-database-mutation baseline portions of the post-deploy
  production smoke passed: home and `/healthz` `200`, webhook `401` without secret
  and expected polling-mode `503` with secret, delivery `mode=polling`,
  `pending=0`, `last_error=none`, polling leader `200`. A separate optional AI
  provider request returned `429 quota_exhausted`; it is not green no-AI
  baseline evidence, and the required approval, run id, request count and
  budget-owner record is incomplete. The deterministic scoring core is
  unaffected.

## Canary boundary

Deployment of PR #129 opened fixed-RC observation window #2 at
`2026-08-25T15:07:00Z`. It later ended as `superseded` after 18/18 successful
scheduled observations when PR #133/#135 deliberately restarted the baseline;
it has no formal GO/NO-GO verdict. Historical PR #128 has operational `GO` but
formal `OPEN / exception pending` (see `CANARY_72H.md`). Docs-only merges do not
restart the current clock while watch patterns remain active; any code, schema,
secret or workflow change does.
