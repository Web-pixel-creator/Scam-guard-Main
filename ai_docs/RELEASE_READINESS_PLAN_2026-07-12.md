# Release Readiness Plan — 2026-07-12

This is the current source of truth for taking Ishonch Guard from a strong,
deployed MVP to a defensible 10/10 public release. It complements the formula-
driven `FEATURE_USER_STORY_TRACKER.xlsx`; it does not replace evidence recorded
there.

## Current decision

**Public release: NO-GO until the remaining P0/P1 live gates and the 72-hour
canary are complete.** The application itself is deployed and healthy. The
remaining blockers are evidence, operations and external approvals; they must
not be relabelled as complete based only on unit tests or synthetic traffic.

Current tracker summary:

- Features: 72 Implemented, 1 Partial, 0 Planned.
- Release gates: 12 Passed, 16 In Progress, 18 Blocked, 5 Deferred.
- Current security queue: 0 Open, 1 In Progress, 30 Deployed / Awaiting Live
  Verification, 4 Closed.

## Evidence already complete

- PR #84 is merged as `190c82a2a0d7db8f1583c57265afe353e97f3f22` and deployed
  by Railway as `be7d6f8d-f06d-459b-b438-ef8924454c4e`.
- 127 test files and 4,867 tests pass. TypeScript and the production build pass;
  lint has 0 errors and 8 existing Fast Refresh warnings; `npm audit` reports 0
  known vulnerabilities.
- Coverage gates pass: 82.85% statements, 76.99% branches, 89.29% functions and
  84.71% lines.
- CodeQL, full-history Gitleaks, release-container Trivy and Supabase
  migrations/schema lint/pgTAP pass. Trivy reports 0 fixed High/Critical OS or
  library findings.
- A valid CycloneDX 1.6 SBOM with 91 components is retained as a GitHub Actions
  artifact. GitHub actions and tool versions are immutable-pinned.
- The production monitor passes home/health, secret boundaries, Telegram
  `getMe`, polling delivery, empty queue, polling leader and AI provider checks.
- Telegram follow-up DSL covers 13 actions x 3 languages x 6 reviewed variants
  x 8 contexts = 1,872 unique rows. All 78 reviewed reply-to-bot and typo
  phrases have exhaustive handler-side side-effect tests.
- Production polling dispatch passes confidence, trusted-person, recheck,
  disagreement, domain-methodology and passport-safety flows. Synthetic Bot API
  messages and database rows were removed and read back after the run.
- AI degradation covers no key, network failure, 401, 429, 500/502/503, a real
  aborting timeout and deterministic fallback behavior.
- The recovery/key-rotation and fixed-RC 72-hour canary procedures are written.

## Work required for 10/10

### 1. Real Telegram bot and Inline client matrix — P1, release blocking

Run on Telegram Desktop, Android and iOS. Use a private QA chat and sanitized
fixtures only. Capture client version, language, before/after screenshots and
the Bot API/result evidence identifier without user content.

For direct bot dialogue in RU/UZ/EN, verify:

1. confidence challenge;
2. permission to contact a trusted person;
3. domain-methodology question;
4. recheck request;
5. disagreement;
6. passport/document safety question;
7. typo form for every action;
8. reply-to-bot and non-reply context;
9. new artifact after a follow-up;
10. session restart and language preservation.

For Inline in RU/UZ/EN, verify:

1. high-risk, suspicious and low-signal cards;
2. correct card layout and language on all three clients;
3. insert-result output and Markdown/plaintext fallback;
4. 0/1/255/256/257-character boundaries;
5. malformed URL, OTP, password, recovery phrase and QR-secret privacy;
6. timeout, `ok:false`, parse retry and empty-result UX;
7. no `checks` or Telegram-session persistence;
8. no external URL-reputation request while typing.

Exit: `BOT-004`, `INL-001` and `INL-002` have a complete evidence matrix with no
P0/P1 defect. A defect resets only the affected matrix after its fix is deployed.

### 2. Production Supabase authorization and Auth hardening — P1/P2

Using an authorized operator session:

1. rerun the count-only admin preflight;
2. apply the exact pending admin-role reconciliation migration;
3. read back migration history;
4. test grant, allowlist removal, email drift and confirmation-loss revocation;
5. verify existing sessions lose admin access immediately;
6. enable leaked-password protection and record the Auth configuration;
7. rerun schema lint and pgTAP against a clean database.

Exit: `SEC-2026-0712-008` moves from In Progress only after production read-back.
Never print identifiers, emails, secrets or historical matched values.

### 3. Finding-specific live closure — security release evidence

Close the 30 deployed/awaiting rows by acceptance criterion, not in bulk. Group
the work into exact-subject trust, privacy sinks, media admission, provider and
domain identity, Inline output, moderation egress, rate limiting and dialogue
precedence. Run the historical privacy review count-only; purge/remediate under
an approved retention decision. Record zero raw matched values.

Exit: every release-scope P0/P1 security row is Closed or has a signed,
expiry-bound accepted-risk decision. P2/P3 rows keep their own documented gate.

### 4. Polling and resource soak — P0

Run at least 60 minutes on the production-shaped environment with controlled QA
updates and media fixtures. Include one process restart, one leader handoff, one
pre-effect failure and one completion-acknowledgement loss. Measure CPU, RSS,
event-loop lag, queue depth, update latency and retry count.

Exit: no lost update; no duplicate outward effect; bounded memory/backlog;
polling leader recovers; all synthetic records/messages are cleaned. Do not call
the system exactly-once: the proof is bounded idempotent processing under the
tested failure model.

### 5. Backup, restore, rollback and key rotation — P2 operational gate

Perform an isolated Supabase restore from a real backup, validate table/RLS/RPC
invariants and measure RPO/RTO. Roll Railway back to the last known-good image,
run smoke, then return to the RC. Rotate provider, Telegram, Railway and
Supabase credentials one class at a time.

`HASH_PEPPER_SECRET` must not be rotated until versioned dual-read/new-write is
implemented and backfill/retirement is proven. Exit requires redacted drill
timestamps, operator, backup identifier, measurements and rollback evidence.

### 6. Supply-chain provenance — P2

Keep the current SBOM, immutable action pins and blocking scans. Add a signed
release image/attestation bound to the Git commit and verify it before deploy.

Exit: an independent verifier can connect commit, build, image digest, SBOM and
Railway release without trusting a mutable tag.

### 7. Web quality gates — P2

Automate critical browser journeys: check, report, appeal, login/admin denial,
privacy and emergency. Add WCAG-focused accessibility checks, stable visual
snapshots and agreed Core Web Vitals/bundle budgets for desktop and mobile.

Exit: E2E, accessibility, visual and performance budgets block regressions in
CI; no production-only credential is used in PR workflows.

### 8. Legal, privacy and product promises — P2 external gate

Obtain independent approval for RU/UZ/EN privacy copy, retention, user rights,
appeals, minors, partner data and public claims. Decide final appeal retention
and align migration, cleanup job, UI and moderation runbook.

Exit: one dated approved policy matches actual behavior and no page promises
domain ownership, hidden Telegram intelligence or a recheck that did not occur.

### 9. Railway billing and operational limits — operational gate

The service is on Pro, `sleepApplication=false`, one replica, and production is
currently healthy. In Railway Dashboard verify payment method, spend alerts,
hard/soft usage limits and incident contacts; CLI evidence alone cannot prove
those account settings.

Exit: a billing interruption alert reaches the owner before workload shutdown,
with a tested response path.

### 10. Freeze RC and complete the 72-hour canary — final gate

After all required P0/P1 gates pass, freeze one RC commit. Start the documented
canary from zero and collect 144 eligible half-hour observations. Any code,
config, secret, dependency or migration change creates a new RC and restarts the
clock. Billing, health, polling leader/queue, AI provider, errors, latency and
security signals must remain within the approved thresholds.

Exit: 72 uninterrupted hours, final go/no-go review, exact evidence archive and
all release-scope gates reconciled in `FEATURE_USER_STORY_TRACKER.xlsx`.

## Required execution order

1. Real-client direct bot + Inline matrix.
2. Authorized Supabase migration/Auth hardening.
3. Finding-specific live/read-back closure.
4. 60-minute polling/resource soak.
5. Isolated restore, rollback and safe key-rotation drill.
6. Signed provenance, browser quality gates and legal approval in parallel.
7. Verify Railway billing alerts/limits.
8. Freeze the RC, run the full fresh gate suite, then start the 72-hour canary.
9. Reconcile the tracker and make the final go/no-go decision.
