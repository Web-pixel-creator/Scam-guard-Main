# AI_INDEX.md

> Entry point for any AI agent working on this project. Read this file first.
> Do not infer current status from a dated audit, an arbitrary local worktree or
> an unmerged branch.

## What this project is

**Ishonch Guard** is a free RU/UZ/EN anti-scam assistant for Uzbekistan. Users
can check or forward a phone number, Telegram username, link, APK, QR,
screenshot, voice description or suspicious text and receive a risk level plus
plain-language safety steps. Reports affect public reputation only after
moderation.

## Current status

- Stage: **production-deployed safety MVP / controlled-pilot candidate**, not a
  proven enterprise product.
- GitHub `main` and deployed source: PR #141 merge
  `b36c453a08b3afd05c6e623d938e15dfc5b6084c`. Active Railway deployment:
  `311997d0-2c1a-4428-88a0-d8be1308f679`, image
  `sha256:8250a9a2edc1b7b0b451fc9fb274cb1e9c986b753cbc2f4a7db501f1a2b3651c`.
  The 2026-08-28 read-back returned `/healthz=200`.
- PR #141 passed all seven GitHub CI/Security checks. Post-cutover no-AI
  production and full security smokes passed and fresh error/warn scans were
  `0/0`.
- Runtime: Nitro `node-server` on Railway. Current Telegram production delivery
  uses durable Postgres-fenced polling; webhook remains a supported
  compatibility/fail-closed boundary.
- AI: optional provider-neutral explanation and media paths. The deterministic
  risk verdict still works without AI; Inline does not invoke paid AI.
- Formal release acceptance remains open. Never convert internal regression
  totals into claims of real-world accuracy or enterprise readiness.
- Historical window #1 (`58557765`) supports operational `GO`, but formal
  closure remains `OPEN / exception pending`: the required polling-dialogue
  smoke was skipped and the optional AI-probe evidence is incomplete. Window #2
  and window #3 were superseded. There is currently **no active formal canary**:
  PR #141 and the later production secret cutovers changed the fixed baseline.
  Start a new window only after the remaining deploy-eligible bundle is merged
  or explicitly deferred.
- Backup workflow files are merged but `NOT ENABLED / NOT VERIFIED`: zero runs,
  restore drills and artifacts were found, and required backup credentials are
  absent. A sole-owner ruleset with zero approvals is not a credential gate;
  independent reviewed ownership or a protected-environment manual approval is
  required first. Credential changes restart any active canary.
- Three-slot hash-pepper rotation is live: active writes use `v3`, previous
  `v2` and legacy reads remain available. The Telegram token/webhook pair was
  rotated across Railway and GitHub; the old token returns `401`, and no secret
  value is present in documentation.
- PR #137 is `DRAFT/HOLD`, not deployed. Rebased candidate `c437a30` passed
  15,364/15,364 locally and GitHub CI 7/7. PR #140 candidate `b076450` is also
  `DRAFT/HOLD`; its local gates and GitHub CI 7/7 passed, but it remains a
  dormant backup/restore candidate. Both await the owner release decision and
  an explicit new canary start.
- Railway-IaC Draft PR #142 (`8c440ba`) is `NOT APPLIED / HOLD`. Its corrected
  read-only plan is `0 destroy`; it depends on this documentation reconciliation
  and requires a separate owner-approved interactive apply/read-back before merge.
- Full Desktop/Android/iOS, accessibility and legal/privacy acceptance remains
  open; the formal Inline client matrix remains 1/51.
- Last documentation reconciliation: 2026-08-28.

## Documentation authority

When documents disagree, use this order:

1. `ai_docs/CURRENT_STATE.md` — canonical verified operational baseline.
2. `ai_docs/OPEN_TASKS.md` — current open gates and implementation order.
3. Exact source and migrations at the deployed commit.
4. Product and architecture documents for stable context.
5. Dated audits, plans, QA reports and release records as historical evidence
   only.

`main` is the public repository baseline, but repository tip and deployed
runtime source are separate facts. Before Railway Watch Paths are independently
verified, treat every merge as potentially deployment-triggering. After a
verified docs exclusion, a documentation-only merge may advance `main` without
changing the Railway deployment; in that state, record the newer docs tip and
the older verified runtime commit separately. A local checkout may also
intentionally be on an older evidence branch. Verify the public ref before
claiming that GitHub is stale, and never use an open PR as deployed state.

See `ai_docs/DOCUMENTATION_POLICY.md` for the full freshness and archival rules.

## Docs map

| File                                                   | Use it for                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `AGENTS.md`                                            | Project safety constraints and mandatory reading order.                        |
| `ai_docs/CURRENT_STATE.md`                             | Current deployed baseline, verified evidence and explicit limitations.         |
| `ai_docs/OPEN_TASKS.md`                                | Current release gates, risks and next work.                                    |
| `ai_docs/DOCUMENTATION_POLICY.md`                      | Source-of-truth, archival and stale-document rules.                            |
| `ai_docs/PROJECT_OVERVIEW.md`                          | Product vision, users, market hypotheses and competitors; not release status.  |
| `ai_docs/SCAM_COVERAGE.md`                             | Scam categories, known limits and coverage notes.                              |
| `ai_docs/ARCHITECTURE.md`                              | Runtime, data flow, risk engine, AI and Telegram delivery.                     |
| `ai_docs/FILE_MAP.md`                                  | Folder and key-file map.                                                       |
| `ai_docs/FUNCTIONS_MAP.md`                             | Important functions and modules.                                               |
| `ai_docs/ROADMAP.md`                                   | Product direction snapshot; current execution comes from `OPEN_TASKS.md`.      |
| `ai_docs/DATABASE.md`                                  | Tables, RLS, RPCs, retention and privacy.                                      |
| `ai_docs/API.md`                                       | Existing server functions/transport surfaces and future B2B API boundary.      |
| `ai_docs/MODERATION_GUIDELINES.md`                     | Report/reputation moderation and appeals.                                      |
| `ai_docs/DEPLOYMENT.md`                                | Railway, Docker, webhook/polling and environment procedures.                   |
| `ai_docs/RAILWAY_IAC_MIGRATION_PLAN.md`                | Open manual plan for the deprecated `railway.toml` migration; not implemented. |
| `ai_docs/ON_CALL_RUNBOOK.md`                           | Monitor alert triage and recovery.                                             |
| `ai_docs/RECOVERY_AND_KEY_ROTATION.md`                 | Backup/restore, rollback and secret rotation.                                  |
| `ai_docs/BACKUP_AUTOMATION.md`                         | Dormant backup workflow design, activation blockers and proof requirements.    |
| `ai_docs/GITHUB_REPOSITORY_PROTECTION_PLAN.md`         | Open repository/ruleset/Actions hardening plan before DB secrets.              |
| `ai_docs/PRODUCTION_APPLICATION_RELEASE_2026-08-08.md` | Historical immutable PR #121 release evidence.                                 |
| `ai_docs/PRODUCTION_APPLICATION_RELEASE_2026-08-20.md` | Immutable PR #128 runtime release evidence.                                    |
| `ai_docs/PRODUCTION_APPLICATION_RELEASE_2026-08-25.md` | Immutable PR #129 application release evidence.                                |
| `ai_docs/CANARY_72H.md`                                | Canary contract, current checkpoint and formal closure boundary.               |
| `ai_docs/TELEGRAM_INTENT_CONTRACT.md`                  | Bot intent/action ids, side effects and dialogue contracts.                    |
| `ai_docs/CODING_RULES.md`                              | Code, i18n, privacy and security rules.                                        |
| `ai_docs/DECISIONS.md`                                 | Architecture and product decisions.                                            |
| `ai_docs/CHANGELOG_AI.md`                              | Documentation/memory history, not current status by itself.                    |

## How to work here

1. Confirm the requested repository/worktree and read `CURRENT_STATE.md`.
2. Read only the one or two task-specific documents and relevant source files.
3. Preserve dirty worktrees and unrelated user changes. Never reset, clean or
   delete evidence branches merely because they are old.
4. When code changes, update the relevant maps/contracts and `CHANGELOG_AI.md`.
5. Record exact commit/test/deployment numbers only in a dated evidence record
   or a clearly dated snapshot; keep the README linked to the canonical status.
6. Separate three claims: implemented, verified locally and verified in
   production. One does not imply the next.
7. Keep documentation concise and never paste secrets, private payloads or raw
   production evidence into it.
