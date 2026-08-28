# Current State

Last reconciled: 2026-08-28 (post-rotation read-back).

This is the short operational source of truth. Dated audits, plans, release
records and old checklist totals are historical evidence unless this file
repeats them. Never infer adoption, accuracy or enterprise readiness from
internal test volume.

## One-minute status

- Stage: **production-deployed safety MVP / controlled-pilot candidate**.
- GitHub `main` and deployed application source: PR #141 merge
  `b36c453a08b3afd05c6e623d938e15dfc5b6084c`. The PR added the three-slot
  hash-pepper reader and passed all seven GitHub CI/Security checks.
- Active Railway deployment: `311997d0-2c1a-4428-88a0-d8be1308f679`, status
  `SUCCESS`, image
  `sha256:8250a9a2edc1b7b0b451fc9fb274cb1e9c986b753cbc2f4a7db501f1a2b3651c`.
  `/healthz` returned `200 ok` in the 2026-08-28 read-back.
- There is **no active formal 72-hour canary window**. Window #3 was superseded
  first by PR #141 and then by the owner-approved production secret cutovers.
  A new window must start only after the remaining deploy-eligible release
  bundle is either merged or explicitly deferred, so baselines are not mixed.
- Production secret rotation is operationally complete for the three-slot hash
  pepper and Telegram token/webhook pair. New protected writes use active `v3`,
  previous `v2` remains readable and the required legacy slot is retained. The
  replacement Telegram token resolves to `@scamguard_bot`, the superseded token
  returns provider `401`, Railway/GitHub consumers agree, and manual Production
  Monitor run `33148010977` passed with AI checking disabled. No secret value is
  recorded in the repository.
- Backup workflow files are merged, but operational backup status is
  **NOT ENABLED / NOT VERIFIED**: the audit found zero backup runs, zero restore
  drill runs, zero backup artifacts and no required backup credentials.
  Do not describe the repository schedule as a working daily backup. Activation
  is blocked on the security/export/restore review in `BACKUP_AUTOMATION.md`.
- Railway watch patterns are active in the deployed manifest
  (`**`, `!/*.md`, `!/ai_docs/**`): docs-only merges stay CI-verified and create
  only a `SKIPPED` placeholder, without a build, image or runtime replacement.
- `railway.toml` remains the effective manifest but is deprecated with a hard
  `2026-12-01` cutoff. Draft PR #142 (`8c440ba`) prepares
  `.railway/railway.ts` but is **NOT APPLIED / HOLD**. Its first post-rotation plan correctly stopped on two
  proposed hash-pepper variable deletions; after adding both previous-slot
  `preserve()` entries the plan is `0 add`, two field groups updated and
  `0 destroy`. The Dashboard custom path is `null`; do not invent a clear-field
  step. Follow `RAILWAY_IAC_MIGRATION_PLAN.md` and require a fresh plan before
  any owner-approved apply.
- GitHub is a public personal repository. Secret scanning/push protection and
  SHA-pinned Actions are active, but `main` is unprotected and rulesets are
  empty. Do not add a production database credential or backup decryption
  identity until the ASCII/BOM and Actions policy are fixed and one real
  credential gate in `GITHUB_REPOSITORY_PROTECTION_PLAN.md` is proven. A
  sole-owner ruleset with zero approvals is not sufficient: use a second
  independent trusted reviewer with CODEOWNERS + ≥1 dismiss-stale approval, or a
  protected environment with manual approval. The latter leaves scheduled runs
  waiting and is not unattended daily backup evidence.
- Supabase production: 33 migrations, head `20260729131000`; AAL2 RLS and
  Family notification-claim retention migrations are applied.
- Automated gate: PR #141 passed TypeScript, lint, tests, production build,
  coverage, migrations/schema/pgTAP, CodeQL, Gitleaks and container/SBOM checks.
  Post-cutover no-AI production and full security smokes also passed; fresh
  deployment error/warn log scans returned `0/0`.
- Formal Desktop/Android/iOS, accessibility, Voice and legal/privacy acceptance
  remains open. This is not a claim of real-world detection accuracy.
- PR #137 is `DRAFT/HOLD`, not deployed. Rebasing onto current `main` produced
  candidate `c437a30`; it completed the second TDD round for
  generic "sent + wrong recipient/card/account" OTP/SMS boundaries and a full
  local re-gate: 15,364/15,364, focused 152/152,
  TypeScript/lint/build/prettier clean; GitHub CI passed 7/7. PR #140 is also
  `DRAFT/HOLD`: rebased candidate `b076450` passed local gates and GitHub CI
  7/7, but remains operationally dormant and must not be confused with an enabled backup.
  Owner merge approval and an explicit new canary start remain required.

## Verified production baseline

The active source is PR #141 merge `b36c453a08b3afd05c6e623d938e15dfc5b6084c`.
The final controlled secret redeploy is Railway deployment
`311997d0-2c1a-4428-88a0-d8be1308f679` with the image digest recorded above.
It retains Dockerfile build, `/healthz`, one replica and the `ON_FAILURE` / five
retry policy from `railway.toml`.

The application behavior still includes the PR #129 semantic / human-simulation hardening batch: deterministic
risk-rule and scam-pattern expansion with clause-local false-positive controls,
RU/UZ/EN Telegram routing and aftercare hardening, inline context and secret
protection improvements, the accidental outgoing-transfer helper sync, and the
expanded offline human-language simulation corpora. It changes no dependencies
and no Supabase migration. Railway watch patterns (`**`, `!/*.md`,
`!/ai_docs/**`) shipped with the same merge and are confirmed active in the
deployed manifest.

Exact release evidence is in
`PRODUCTION_APPLICATION_RELEASE_2026-08-25.md`. The superseded PR #128 record
remains in `PRODUCTION_APPLICATION_RELEASE_2026-08-20.md`.

The 2026-08-28 post-cutover production smoke returned:

- `/` and `/healthz`: `200`;
- webhook without secret: `401`;
- authenticated webhook in polling mode: expected `503`;
- delivery mode: polling, pending updates `0`, last error absent;
- polling leader: `200`;
- AI provider check: disabled by policy, with no provider request.

The full production security smoke passed after the cutover. A bounded
synthetic web-P1 proof also confirmed that new report, appeal target/contact
and check hashes use `v3`; all synthetic rows and audit evidence were removed.
The pre-existing production rows remain on legacy or `v2` hashes and are
readable through the retained compatibility slots.

The recurring baseline never sends a Telegram user message. AI reachability is
a separate false-by-default manual operation.

## Docs-only no-deploy proof (2026-08-25 to 2026-08-26)

Six documentation-only merges produced Railway entries marked `SKIPPED`:
`fa9d5b40`, `1d5c40b0`, `e74549a0`, `c52d23b3`, `54f676f1` and `a46d9565`.
The first four preserved deployment `59077b99` / runtime `9019776`; the last two
preserved deployment `464f3bb8` / runtime `a964153f`. Together they advanced
GitHub `main` to docs tip `4380085d` without replacing the runtime active at
each merge. In the same audit period there were three non-SKIPPED deployment
entries (`59077b99`, superseded `d1d79846`, and current `464f3bb8`), not four
production releases.

## Canary boundary

Window #3 for PR #135 opened at `2026-08-26T03:54:30Z` but is now historical:
PR #141 changed runtime code, and the subsequent hash-pepper and Telegram
cutovers changed production secret state. Under the written restart rules each
event invalidated the old fixed baseline. Do not count any PR #135 observation
toward the next window. The next formal window has not started; establish it
only after the owner resolves PR #137, PR #140 and the Railway-IaC candidate.

The superseded PR #128 source `58557765` reached an **operational GO** on
`2026-08-25`: 188/188 eligible scheduled runs through
`2026-08-25T14:36:28Z`, zero non-success eligible runs, unchanged deployment
and restart-rule review, final production/security/web-P1 smokes passed, and
the polling-dialogue smoke recorded as skipped (needs a real Telegram message;
owner approval was not granted). The written entry/closure checklist required
that dialogue smoke, and the optional AI probe that returned `429` lacks the
required approval/run-id/budget record. Formal status therefore remains
`OPEN / exception pending`; it must not be called formally closed. Full evidence
is in `CANARY_72H.md`.

The earlier PR #126 source `8a76a5e` accumulated 226 successful scheduled
monitor executions between `2026-08-13T12:52:46Z` and
`2026-08-20T05:53:48Z` and remains historical evidence. The `1576e21`
checkpoint and its isolated missing-secret timeout are also historical.

## Deployed safety and privacy baseline

- Production Telegram delivery uses durable Postgres-fenced polling. Webhook is
  a supported compatibility and fail-closed boundary.
- Direct primary delivery distinguishes definitive retryable, definitive
  permanent and ambiguous Telegram outcomes. Context commits only after a
  successful or ambiguous primary result; secondary Guardian/trusted-contact
  effects stop on uncertainty. Exactly-once delivery is not claimed because
  Telegram supplies no idempotency key and there is no durable outbound outbox.
- Inline is stateless, non-persistent and rules-only: it does not invoke AI or
  external URL-reputation providers while the user types.
- Typed, Inline, Voice and public-post secret sinks redact or contain OTP, PIN,
  CVV, password, recovery phrase and private-key material before AI,
  persistence or user-visible echo.
- AI explanation is optional. Deterministic scoring and safety actions continue
  without a provider; unsafe provider output is rejected before display or
  persistence.
- Shared production rate limits use privacy-safe HMAC buckets and fail closed
  on missing configuration, hashing/RPC error or malformed storage response.
- Two independently controlled admin owners use TOTP. Railway requires
  `REQUIRE_ADMIN_MFA_AAL2=true`; missing or invalid production configuration
  fails closed.
- Migration `20260729131000_admin_mfa_aal2_rls.sql` is applied. All seven
  protected admin policies require `private.is_admin_aal2()`, including both
  UPDATE `WITH CHECK` clauses. Public confirmed-row policies and service-role
  behavior remain unchanged.
- Migration `20260729105030_family_notification_claim_retention.sql` is applied
  and the existing daily retention job invokes the updated function.
- Three-slot hash-pepper versioning is deployed. New writes use `v3`; reads
  retain previous `v2` and legacy compatibility. `HASH_PEPPER_SECRET` must not
  be removed without a separate count-only retirement and rollback proof.
- Dynamic Brotli/gzip negotiation and failure/cancellation handling are
  deployed. Nitro static precompression still has an open general `q`-weight
  limitation.

The immutable database apply and AAL1-deny/AAL2-allow evidence is in
`PRODUCTION_MIGRATION_APPLY_2026-08-01.md`.

## Product evidence boundary

The formal Telegram client pack remains 1/51 Desktop/Android/iOS rows. Recent
bounded Telegram Web Direct/Inline acceptance found and led to PR #128, but it
does not replace the three-client matrix.

Production counters are retention-limited database snapshots, not all-time
users or demand evidence. In particular, `checks` are retained for 90 days,
Telegram sessions for 30 days and Inline intentionally creates neither a check
row nor a session. Traction, return rate and prevented-loss claims therefore
remain unproven until privacy-safe product events and a real pilot exist.

## Recovery boundary

- Supabase Free remains an intentional pilot choice and has no managed daily
  backup or PITR guarantee. Manual encrypted EFS/CMS archives, independent
  OneDrive/Google Drive custody and one hosted restore drill provide useful
  recovery evidence but do not guarantee a current RPO.
- A daily encrypted production export with failure alert, offsite read-back and
  periodic clean restore remains required unless a paid managed-backup plan
  replaces it.
- The merged GitHub workflows do not satisfy this requirement yet: they have no
  successful run or artifact, and their raw `pg_dump`/plain-PostgreSQL restore
  design requires Supabase-specific export/restore and repository-security
  review before production credentials are introduced.
- The retained staging project must not be deleted without separate explicit
  approval.
- Supabase CLI `2.104.0` has a documented Windows credential-store issue. A
  pinned upgrade to `2.110.0` or newer must be rehearsed against staging before
  production-linked use.
- The bidirectional Railway rollback/return and second-owner MFA factor-reset
  rehearsals remain separate approved operations.

Detailed recovery and rotation evidence is in
`RECOVERY_AND_KEY_ROTATION.md` and dated restore/migration records.

## Current ordered work

1. Keep PR #137 and PR #140 `DRAFT/HOLD` until the owner makes one explicit
   bundle decision. PR #137 candidate `c437a30` has local and GitHub gates; PR
   #140 is a dormant backup/restore candidate, not operational evidence.
2. Review Draft/HOLD PR #142 without applying it to production.
   The destructive preflight is fixed locally and the current plan is
   `0 destroy`; decide whether to include it in the same controlled release or
   defer it.
3. Merge/deploy at most once after that decision, rerun no-AI production and
   security smokes, then open a fresh canary with one exact RC/deployment.
4. Keep backup status `NOT ENABLED / NOT VERIFIED` until the hardened path is
   merged, independent reviewed ownership or a protected-environment manual
   gate is proven, and the minimum credentials are introduced in a separately
   recorded activation window.
5. Resolve the formal status of window #1: execute the separately approved
   polling-dialogue smoke or record an explicit time-bounded exception, and
   document the prior AI-probe approval/run-id/budget evidence.
6. Migrate deprecated `railway.toml` manually through pull/plan/apply before
   `2026-12-01`; no blind auto-migration. The Dashboard custom path is `null`.
   In the separate restart window require a fresh `0 destroy` plan, interactive
   apply/read-back, then merge the reviewed legacy-file deletion.
7. Fix workflow BOM/mojibake and stable ASCII required-check names, then add an
   Actions allowlist/SHA policy, `CODEOWNERS` as a non-required audit signal and
   a `main` ruleset before any production database credential or backup
   decryption identity reaches GitHub Actions. Required approvals remain `0` and
   code-owner review remains disabled until a second independent reviewer exists
   to avoid sole-owner deadlock; that interim mode does not authorize backup
   credentials. Enable ≥1 dismiss-stale CODEOWNER approval after adding the
   reviewer, or use a protected-environment manual approval whose scheduled runs
   wait.
8. Record Railway payment-method expiry, spend alerts and response owner.
9. Upgrade the pinned Supabase CLI through staging-only verification.
10. Run a risk-based real-client gate on Desktop, Android and iOS for critical
    Direct/Inline RU/UZ/EN scenarios per `CLIENT_ACCEPTANCE_PLAN_2026-08.md`,
    then complete the remaining matrix.
11. Add privacy-safe funnel events, run 5-8 moderated usability sessions and
    only then a controlled 20-30-person pilot.
12. Keep multi-instance polling handoff, durable outbound outbox, Voice human
    review, accessibility and independent legal/privacy review as explicit
    separate gates.

Do not add another large product surface before pilot evidence identifies a
real user problem. `OPEN_TASKS.md` owns the detailed queue.
