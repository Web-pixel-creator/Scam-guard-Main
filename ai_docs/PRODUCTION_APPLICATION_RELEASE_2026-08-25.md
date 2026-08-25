# Production application release — 2026-08-25

> Immutable release evidence for PR #129. For the current operational status,
> use `CURRENT_STATE.md` and `OPEN_TASKS.md`.

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
- Post-deploy production smoke passed without sending a Telegram message or
  mutating Supabase: home and `/healthz` `200`, webhook `401` without secret
  and expected polling-mode `503` with secret, delivery `mode=polling`,
  `pending=0`, `last_error=none`, polling leader `200`. The optional AI
  provider health probe returned `429 quota_exhausted` (degraded; the
  deterministic scoring core is unaffected).

## Canary boundary

Deployment of PR #129 opened fixed-RC observation window #2 at
`2026-08-25T15:07:00Z`. Formal status is `OPEN`; the written verdict is due on
or after `2026-08-28T15:07:00Z` under the unchanged 144-success and restart
rules. The superseded PR #128 window closed `2026-08-25` with verdict `GO`
(see `CANARY_72H.md`). Docs-only merges do not restart this clock while the
watch patterns remain active; any code, schema or secret change does.
