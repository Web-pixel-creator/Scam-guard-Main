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
- Verified production source: PR #129 merge
  `901977645d3a8eb7a6498ac6aba90748daaa648e` (tree
  `b68beea635e3d2a37e0fe15049c00eb20725813e`). Railway deployment
  `59077b99-b155-4f6d-88db-e6769aa4a394` is healthy with image digest
  `sha256:cc242ed84ce1acdbd1fdab4c4791f79b363d53d0ded2bd28a0fcb67a531a4744`.
- Verified PR #129 gate: 179 Vitest files and 15,327/15,327 tests, plus
  TypeScript, lint, build, coverage, migrations/schema and security gates.
- Runtime: Nitro `node-server` on Railway. Current Telegram production delivery
  uses durable Postgres-fenced polling; webhook remains a supported
  compatibility/fail-closed boundary.
- AI: optional provider-neutral explanation and media paths. The deterministic
  risk verdict still works without AI; Inline does not invoke paid AI.
- Formal release acceptance remains open. Never convert internal regression
  totals into claims of real-world accuracy or enterprise readiness.
- The previous PR #126 runtime passed 226 eligible scheduled observations; one
  separate GitHub setup failure ran no monitor check and is not product-failure
  evidence. PR #128 restarted the observation window. Its first two scheduled
  monitors passed, while formal current-RC canary closure remains `OPEN` under
  the unchanged entry, count and restart rules.
- Full Desktop/Android/iOS, accessibility and legal/privacy acceptance remains
  open; the formal Inline client matrix remains 1/51.
- Last documentation reconciliation: 2026-08-20.

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

| File                                                   | Use it for                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `AGENTS.md`                                            | Project safety constraints and mandatory reading order.                       |
| `ai_docs/CURRENT_STATE.md`                             | Current deployed baseline, verified evidence and explicit limitations.        |
| `ai_docs/OPEN_TASKS.md`                                | Current release gates, risks and next work.                                   |
| `ai_docs/DOCUMENTATION_POLICY.md`                      | Source-of-truth, archival and stale-document rules.                           |
| `ai_docs/PROJECT_OVERVIEW.md`                          | Product vision, users, market hypotheses and competitors; not release status. |
| `ai_docs/SCAM_COVERAGE.md`                             | Scam categories, known limits and coverage notes.                             |
| `ai_docs/ARCHITECTURE.md`                              | Runtime, data flow, risk engine, AI and Telegram delivery.                    |
| `ai_docs/FILE_MAP.md`                                  | Folder and key-file map.                                                      |
| `ai_docs/FUNCTIONS_MAP.md`                             | Important functions and modules.                                              |
| `ai_docs/ROADMAP.md`                                   | Product direction snapshot; current execution comes from `OPEN_TASKS.md`.     |
| `ai_docs/DATABASE.md`                                  | Tables, RLS, RPCs, retention and privacy.                                     |
| `ai_docs/API.md`                                       | Existing server functions/transport surfaces and future B2B API boundary.     |
| `ai_docs/MODERATION_GUIDELINES.md`                     | Report/reputation moderation and appeals.                                     |
| `ai_docs/DEPLOYMENT.md`                                | Railway, Docker, webhook/polling and environment procedures.                  |
| `ai_docs/ON_CALL_RUNBOOK.md`                           | Monitor alert triage and recovery.                                            |
| `ai_docs/RECOVERY_AND_KEY_ROTATION.md`                 | Backup/restore, rollback and secret rotation.                                 |
| `ai_docs/PRODUCTION_APPLICATION_RELEASE_2026-08-08.md` | Historical immutable PR #121 release evidence.                                |
| `ai_docs/PRODUCTION_APPLICATION_RELEASE_2026-08-20.md` | Immutable PR #128 runtime release evidence.                                   |
| `ai_docs/CANARY_72H.md`                                | Canary contract, current checkpoint and formal closure boundary.              |
| `ai_docs/TELEGRAM_INTENT_CONTRACT.md`                  | Bot intent/action ids, side effects and dialogue contracts.                   |
| `ai_docs/CODING_RULES.md`                              | Code, i18n, privacy and security rules.                                       |
| `ai_docs/DECISIONS.md`                                 | Architecture and product decisions.                                           |
| `ai_docs/CHANGELOG_AI.md`                              | Documentation/memory history, not current status by itself.                   |

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
