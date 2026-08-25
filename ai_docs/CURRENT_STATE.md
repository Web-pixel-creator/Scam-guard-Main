# Current State

Last reconciled: 2026-08-25 (`2026-08-25T15:30:00Z` evidence cutoff).

This is the short operational source of truth. Dated audits, plans, release
records and old checklist totals are historical evidence unless this file
repeats them. Never infer adoption, accuracy or enterprise readiness from
internal test volume.

## One-minute status

- Stage: **production-deployed safety MVP / controlled-pilot candidate**.
- GitHub `main` and deployed application source: PR #129 merge
  `901977645d3a8eb7a6498ac6aba90748daaa648e`, tree
  `b68beea635e3d2a37e0fe15049c00eb20725813e`.
- Railway deployment: `59077b99-b155-4f6d-88db-e6769aa4a394`, status
  `SUCCESS`, image
  `sha256:cc242ed84ce1acdbd1fdab4c4791f79b363d53d0ded2bd28a0fcb67a531a4744`.
- Current PR #129 canary (window #2): opened `2026-08-25T15:07:00Z`, formal
  status `OPEN`. The superseded PR #128 window closed `2026-08-25` with verdict
  `GO` (185/185 eligible runs plus final bounded checks).
- Railway watch patterns are active in the deployed manifest
  (`**`, `!/*.md`, `!/ai_docs/**`): docs-only merges stay CI-verified without a
  new deployment.
- Supabase production: 33 migrations, head `20260729131000`; AAL2 RLS and
  Family notification-claim retention migrations are applied.
- Automated gate: 179 Vitest files, 15,327/15,327 tests, TypeScript, lint,
  production build, coverage, migrations/schema/pgTAP and Security Gates
  passed on the merge commit.
- Formal Desktop/Android/iOS, accessibility, Voice and legal/privacy acceptance
  remains open. This is not a claim of real-world detection accuracy.

## Verified production baseline

PR #129 was merged at `2026-08-25T15:01:26Z`. Railway Auto Deploy waited for
green merge-commit CI and Security Gates and reported deployment
`59077b99-b155-4f6d-88db-e6769aa4a394` successful at `2026-08-25T15:07:00Z`.

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

## Docs-only no-deploy proof (2026-08-25)

The documentation reconciliation (PR #130, docs tip
`203120583c3a5145c7945621ab27c6e58686513a`) merged at `2026-08-25T16:05:00Z`
touching only root Markdown and `ai_docs/**`. Railway created the placeholder
deployment `fa9d5b40-5a56-4f11-9bea-04d39f1b3bc2` while CI ran, applied the
active watch patterns, and marked it `SKIPPED` without building an image. The
active production deployment remained `59077b99-b155-4f6d-88db-e6769aa4a394`
(RC `9019776`) and `/healthz` returned `200 ok`. Docs-only merges therefore do
not create a runtime deployment and do not restart canary window #2.

## Canary boundary

PR #129 started fixed-RC observation window #2 at `2026-08-25T15:07:00Z`.
Formal status is `OPEN` until the written 144-success threshold and
restart rules are re-checked, expected on or after `2026-08-28`.

The superseded PR #128 source `58557765` closed its window on `2026-08-25`
with verdict `GO`: 185/185 eligible scheduled runs through
`2026-08-25T11:52:01Z`, zero non-success eligible runs, unchanged deployment
and restart-rule review, final production/security/web-P1 smokes passed, and
the polling-dialogue smoke recorded as skipped (needs a real Telegram message;
owner approval was not granted). Full closure evidence is in `CANARY_72H.md`.

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

1. Keep PR #129 production unchanged through canary window #2 and issue a
   separate GO/NO-GO verdict on or after `2026-08-28T15:07:00Z` using the
   written 144-success and restart rules.
2. Documentation reconciliation is merged and the docs-only no-deploy proof is
   recorded; close the superseded docs PR #127 with a pointer to PR #130.
3. Automate encrypted daily Supabase export/RPO evidence or select a managed
   backup plan.
4. Record Railway payment-method expiry, spend alerts and response owner.
5. Upgrade the pinned Supabase CLI through staging-only verification.
6. Run a risk-based real-client gate on Desktop, Android and iOS for critical
   Direct/Inline RU/UZ/EN scenarios, then complete the remaining matrix.
7. Add privacy-safe funnel events, run 5-8 moderated usability sessions and
   only then a controlled 20-30-person pilot.
8. Keep multi-instance polling handoff, durable outbound outbox, Voice human
   review, accessibility and independent legal/privacy review as explicit
   separate gates.

Do not add another large product surface before pilot evidence identifies a
real user problem. `OPEN_TASKS.md` owns the detailed queue.
