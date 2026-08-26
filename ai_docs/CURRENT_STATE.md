# Current State

Last reconciled: 2026-08-26 (independent audit evidence cutoff).

This is the short operational source of truth. Dated audits, plans, release
records and old checklist totals are historical evidence unless this file
repeats them. Never infer adoption, accuracy or enterprise readiness from
internal test volume.

## One-minute status

- Stage: **production-deployed safety MVP / controlled-pilot candidate**.
- GitHub documentation tip: PR #138 merge
  `4380085d29885c16147127a96cffb0a1b440d941`. Railway Watch Paths skipped the
  docs-only merge; it is not the deployed application source.
- Deployed application source: PR #135 merge
  `a964153f2dc376015e3e3fbf93068049e97f1ee3`, tree
  `36d9d748e26fc3b41268c55af9f35ef1b82c2cad`.
- Railway deployment: `464f3bb8-45c8-4df9-9752-f8a9564a757f`, status
  `SUCCESS`, image
  `sha256:92297f360af6e096a166bfd47ec6005bbc6f448c84aa0b47acc70c9aac1a7920`.
- Current canary window #3: opened `2026-08-26T03:54:30Z`, formal status
  `OPEN`. Closure requires **both** at least 72 elapsed hours and at least 144
  eligible scheduled successes under an unchanged baseline, so
  `2026-08-29T03:54:30Z` is only the earliest possible decision time. The application
  runtime is unchanged from PR #129; the deploy carries the backup automation
  workflows and the CI action batch. Window #2 (PR #129) ran 18/18 clean and
  was superseded by the owner-approved acceleration.
- Backup workflow files are merged, but operational backup status is
  **NOT ENABLED / NOT VERIFIED**: the audit found zero backup runs, zero restore
  drill runs, zero backup artifacts and no required backup credentials.
  Do not describe the repository schedule as a working daily backup. Activation
  is blocked on the security/export/restore review in `BACKUP_AUTOMATION.md`.
- Railway watch patterns are active in the deployed manifest
  (`**`, `!/*.md`, `!/ai_docs/**`): docs-only merges stay CI-verified and create
  only a `SKIPPED` placeholder, without a build, image or runtime replacement.
- `railway.toml` remains the effective manifest but is deprecated with a hard
  `2026-12-01` cutoff. Migration to `.railway/railway.ts` is not implemented;
  automatic migration is incomplete for watch/build/restart settings. Follow
  `RAILWAY_IAC_MIGRATION_PLAN.md` in a separate restart window. Its non-atomic
  ownership handoff must clear Dashboard Config File `/railway.toml`, immediately
  review a human-readable plan, and restore that field on any unexpected
  deletion.
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
- Automated gate: 179 Vitest files, 15,327/15,327 tests, TypeScript, lint,
  production build, coverage, migrations/schema/pgTAP and Security Gates
  passed on the merge commits.
- Formal Desktop/Android/iOS, accessibility, Voice and legal/privacy acceptance
  remains open. This is not a claim of real-world detection accuracy.
- PR #137 is `DRAFT/HOLD`, not deployed. Final candidate
  `e4db013559be8816319980eb5d4cad7eac09dff6` completed the second TDD round for
  generic "sent + wrong recipient/card/account" OTP/SMS boundaries and a full
  local re-gate: 15,357/15,357, focused 152/152, novel 321/321,
  TypeScript/lint/build/prettier clean, plus manual EN/UZ polarity probes at
  `panic=1`; GitHub CI passed 7/7. Owner merge approval and an explicit canary
  restart remain required.

## Verified production baseline

The application changes originate in PR #129, merged at
`2026-08-25T15:01:26Z`. PR #133 and PR #135 later changed workflow/CI files and
produced the current Railway deployment
`464f3bb8-45c8-4df9-9752-f8a9564a757f` for merge `a964153f`. The application
runtime code is unchanged from PR #129. Keep this runtime identity separate
from the newer GitHub documentation tip `4380085d`.

The release is the semantic / human-simulation hardening batch: deterministic
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

The post-deploy production smoke for this source returned:

- `/` and `/healthz`: `200`;
- webhook without secret: `401`;
- authenticated webhook in polling mode: expected `503`;
- delivery mode: polling, pending updates `0`, last error absent;
- polling leader: `200`;
- optional AI provider health probe: `429 quota_exhausted` (degraded; the
  deterministic scoring core is unaffected).

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

PR #135 started fixed-RC observation window #3 at `2026-08-26T03:54:30Z`.
Formal status is `OPEN` until both the 72-hour wall-clock threshold and the
144-success threshold are satisfied and all restart rules are re-checked.
Adding or rotating any backup credential or decryption identity changes
production/repository secret state and restarts the current window under the
written contract.

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
- Hash-pepper versioning is deployed. New writes use `v2`; legacy reads still
  require `HASH_PEPPER_SECRET`, which must not be removed without a separate
  retirement proof.
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

1. Keep PR #137 `DRAFT/HOLD` until the owner makes a separate
   merge/canary-restart decision; the full local gate on candidate `e4db0135` and
   GitHub CI 7/7 are complete, but they are not production evidence.
2. Prepare backup/export/restore hardening on a HOLD branch only; do not merge a
   workflow change or add backup credentials while preserving window #3. Current status
   remains `NOT ENABLED / NOT VERIFIED`.
3. Keep PR #135 production unchanged through canary window #3 and issue a
   separate GO/NO-GO only after **both** 72 hours and 144 eligible successes,
   with all restart/exception evidence complete.
4. After that verdict (or an explicit decision to supersede it), stage-test the
   hardened backup path, prove independent reviewed ownership or a
   protected-environment manual gate, approve the restart and only then
   introduce the minimum backup credentials.
5. Resolve the formal status of window #1: execute the separately approved
   polling-dialogue smoke or record an explicit time-bounded exception, and
   document the prior AI-probe approval/run-id/budget evidence.
6. Migrate deprecated `railway.toml` manually through pull/plan/apply before
   `2026-12-01`; no blind auto-migration. In the separate canary-restart window,
   clear Dashboard Config File `/railway.toml`, immediately inspect the plan and
   restore the field on any unexpected deletion.
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
