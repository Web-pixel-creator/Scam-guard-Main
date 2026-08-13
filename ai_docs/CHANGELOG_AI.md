# Changelog (AI memory)

Newest first. This tracks documentation/memory files, not every code commit.

## 2026-08-13 - PR #126 merged and deployed

- Merged PR #126 as `8a76a5ec6994fd208cccde731bab2d5c70b6d232`
  after all PR-head and merge-commit CI/security gates passed.
- Railway deployment `895a82f3-6e59-4b91-8ec7-513330e4f7cb` reached `SUCCESS`
  with image digest
  `sha256:6bc60d2089cc4c61e2c2b7ca6f6af1239cc1d84c5b1dcd4d7f96679f4c1f1f27`.
- Post-deploy home and `/healthz` returned 200. The no-AI/no-live-message smoke
  passed webhook boundaries, Telegram polling status with pending `0` and no
  last error, and polling-leader health. Runtime startup logs contained no
  warning or error. PR #126 restarts the formal canary observation clock.

## 2026-08-13 - Post-canary Telegram/privacy candidate reconciled locally

- Built an isolated candidate on exact deployed `1576e21`; the protected dirty
  worktree and production remained untouched.
- Added guarded Direct/Inline RU/UZ/EN completed-action, task-scam, BNPL,
  coercive-secrecy, normalization and report-callback TTL coverage.
- Closed typed, Inline and Voice secret paths for mixed-script labels, multiple
  secrets, formatted/value-first alphanumeric codes, private keys and bounded
  recovery lists. Inline secret results and Voice secret previews are static;
  raw Voice secrets are not cached or shared in-flight.
- Focused reconciliation passed 3,683/3,683 tests; independent security suites
  passed 1,783/1,783 with no P0/P1 blocker. The full gate passed 174 files /
  13,482 tests, TypeScript, production build and ESLint with zero errors plus
  the eight established Fast Refresh warnings; changed code passed Prettier
  and `git diff --check`. Coverage passed at 86.25% statements, 81.06%
  branches, 91.56% functions and 88.10% lines. No network/API, commit, push or
  deployment occurred.

## 2026-08-08 - P0 action-state and bounded obfuscation hardening verified locally

- Reproduced the reported Direct gaps on current `main`: colloquial Russian
  completed-code admissions, Uzbek `aytvordim` / `otkazvordim`, a prevention
  misroute after six digits were already disclosed, and spaced-letter / `0`
  leet bypasses.
- Added aftercare routing for explicit completed actions while keeping quoted,
  third-party, physical-access-code and negated wording outside panic. The
  otherwise ambiguous “I told them everything” form is accepted only against a
  recent code-guidance context.
- Extended the shared classifier-only normalizer with an allow-list of spaced
  security terms and bounded `0`-leet repairs. Phone numbers, ordinary model
  names, initials and code-safety warnings have negative controls; original
  user text is still never replaced in replies or persistence.
- Local gates passed: focused 812/812, Telegram+risk 12,407/12,407 and full
  repository 12,927/12,927; TypeScript and production build passed; ESLint had
  zero errors and the existing eight Fast Refresh warnings. No Telegram, AI,
  Railway or Supabase request was made. Dependency audit was not rerun locally
  because this checkout uses `bun.lock` and Bun is unavailable on the host;
  dependencies were unchanged.
- Work remains unmerged and undeployed on
  `agent/p0-action-state-language-hardening-20260808` pending review.

## 2026-08-08 - Public documentation made current and auditable

- Replaced the stale README snapshot that still described 215+ tests and a
  webhook-only Telegram runtime. The public entry point now names the exact PR
  #121 release, 12,890-test gate, polling production mode and remaining
  acceptance boundaries without claiming enterprise readiness.
- Reconciled `AI_INDEX.md` and `AGENTS.md` so reviewers read `CURRENT_STATE.md`
  and `OPEN_TASKS.md` before dated plans or arbitrary local worktrees.
- Added `DOCUMENTATION_POLICY.md` with source-of-truth precedence, historical
  evidence rules, local-worktree hygiene and an explicit warning that a docs
  merge can still trigger Railway auto deploy.
- Marked the June execution plan, July readiness plan, August 2 release record,
  product overview and roadmap with their correct current-versus-historical
  scope. No source code, deployment, database or runtime setting changed.

## 2026-08-08 - PR #121 merged and released with cost-safe monitoring

- Merged PR #121 as
  `c5fa51de8f570fd2258722b1194bd7430319d242`; its tree exactly matches the
  fully verified PR head tree. Post-merge CI run `31242142841` and Security
  Gates run `31242142834` passed.
- Railway did not receive the merge webhook because production had no branch
  binding and Auto Deploy was disabled. The exact clean merge tree was deployed
  once through Railway CLI as deployment
  `4d00a730-d8e2-462f-b820-e3cecbfb0994`, image
  `sha256:a133607af78d17f9efa46404512fc161faadc29c4e24f1260de3e00a2be3668f`.
- Public health/routes, polling boundaries, pending updates and fresh logs were
  green. No live Telegram synthetic update or user message was sent, and the
  smoke explicitly disabled AI by policy without a provider request.
- Bound Railway production to `main`, enabled Auto Deploy and enabled Wait for
  CI. Saving the settings caused no new deployment. A future real `main` change,
  not a manufactured canary-time commit, remains the end-to-end permission
  proof.
- Manual no-AI monitor run `31242484006` passed with its AI job skipped. Eleven
  of eleven eligible scheduled fixed-RC observations passed through
  `2026-08-08T14:23:57Z`; sampled logs report `disabled by policy` and
  `no request sent`.
- Formal canary closure is still open: require at least 144 eligible runs,
  hour-24/hour-48/hour-72 records and the remaining real-client,
  accessibility and legal/privacy acceptance. See
  `PRODUCTION_APPLICATION_RELEASE_2026-08-08.md` and `CANARY_72H.md`.

## 2026-08-02 - Local release-gate candidate fully verified

- Verified the combined Direct-delivery, cost-safe-monitor and documentation
  candidate from clean branch `agent/release-gate-hardening-20260802`, based on
  `origin/main` commit `b226bdd`. The candidate is still uncommitted,
  unmerged and undeployed.
- Full Vitest passed 167 files / 12,890 tests. Coverage passed the repository
  floors at 85.82% statements, 80.52% branches, 91.33% functions and 87.75%
  lines. TypeScript, production build, actionlint and full ESLint passed with
  zero errors and the existing eight Fast Refresh warnings.
- Corrected a flaky brand-matcher property oracle exposed by the final repeat:
  an official domain must not implicate its owning brand, but an unrelated
  brand name in a subdomain may still be detected. Added the deterministic
  `iiv.humocard.uz` cross-brand boundary; runtime matcher behavior was unchanged.
- A clean disposable local Supabase applied all 33 migrations; schema lint
  reported no errors and all four pgTAP files passed 92/92. The local stack was
  stopped after verification without `--no-backup`; no local Supabase container
  remains running, while its disposable test volume is retained.
- The release container built successfully and returned `200 ok` from
  `/healthz`. Bun audit found no dependency vulnerabilities, Trivy found zero
  fixable High/Critical OS or library vulnerabilities, and the current patch
  passed a redacted Gitleaks scan. Full-history Gitleaks remains a CI gate
  because the Linux scanner container cannot follow a Windows worktree gitdir.
- No Telegram, AI-provider, Railway or Supabase-cloud request was made. The
  only network traffic was free dependency/container/vulnerability metadata.

## 2026-08-02 - Direct primary-result delivery hardened locally

- Made `sendMessage` return a sanitized discriminated result that separates a
  definitive no-effect rejection from an ambiguous post-fetch outcome and
  carries only bounded numeric retry metadata.
- Before sending a primary result, Direct now performs a context-neutral
  sequenced/fenced session claim. It does not write `lastCheck` or scenario
  context; the delivered/possibly delivered context is committed only after
  the send. The existing equal-`update_id` SQL guard accepts that second phase.
- For a definitive retryable primary-card failure, Direct releases the durable
  update for retry without a rollback. Webhook delivery returns `503` with
  bounded `Retry-After`; polling keeps the contiguous frontier at the failed
  update and honors the same delay.
- Ambiguous transport outcomes are acknowledged without replay because
  Telegram may already have accepted the primary card; follow-on Guardian or
  trusted-contact effects are suppressed. Definitive permanent rejections are
  drained without creating unseen context. A post-send context-write failure is
  operator-visible but does not replay the primary card or emit a misleading
  user warning.
- Focused Direct/session tests pass 475/475, the broader delivery/lifecycle set
  passes 247/247, and the real local lifecycle pgTAP contract passes 41/41.
  This change is not merged or deployed and does not create an exactly-once
  guarantee; the existing at-least-once crash boundary remains.

## 2026-08-02 - Recurring monitor made cost-safe locally

- Added an explicit `MONITOR_CHECK_AI` gate. Its default/false path returns an
  OK policy result without invoking the provider request dependency; an enabled
  probe fails hard for missing credentials, every non-2xx response, timeout or
  network failure.
- Made the broader `prod:smoke` no-AI by default even when `railway run`
  injects an API key. Only an explicit `--check-ai` flag enables one fail-hard
  provider request, preventing the inherited-key incident from recurring.
- Removed `OPENAI_*` secrets from the half-hour scheduled baseline and enabled
  fail/alert-on-warning for remaining checks. A false-by-default boolean manual
  input starts an independent `--ai-only` job whose provider secrets exist only
  in the final consumer step; it receives no Telegram credentials.
- Separated manual/scheduled concurrency so a manual provider probe cannot
  cancel a scheduled canary observation. Updated the 72-hour canary contract:
  only cost-free scheduled baseline runs count toward 144 observations, manual
  probes are budgeted evidence, and monitor/workflow changes restart the window.
- This change is local and tested, not merged or deployed. Historical accounting
  remains 60 scheduled provider attempts plus one manual release request.

## 2026-08-02 - Five-day release evidence reconciled

- Distinguished current repository tip `b226bdd` (merged documentation-only PR
  #120) from deployed application source `9e901b1` (PR #119). Current `main` CI
  passed 165 files / 12,855 tests and all seven reported gates for PR #120.
- Corrected the maintenance chronology: freeze and apply occurred on 2026-08-01
  in Asia/Tashkent; post-resume observation crossed midnight into 2026-08-02.
- Preserved the fresh pre-apply backup boundary: local decrypt/hash and OneDrive
  names/displayed sizes passed, but there is no cloud byte-hash readback or
  clean-database restore proof for that exact archive. Count-only `2 / 2 / 2`
  admin/role/verified-TOTP evidence is not independent action-time proof of both
  human owners' presence or factor recoverability.
- Disclosed recurring monitor effects. The audit interval contained 60 scheduled
  runs (59 successful workflow runs and one failed run); the configured path
  attempted a provider health call per run, with provider results explicitly
  present in all 56 inspected logs. The freeze-period run also sent one
  sanitized operator Telegram alert. The maintenance procedure itself sent no
  QA/user message and initiated no AI request.
- Recorded the current Railway operational boundary: production still has no
  branch binding and deploys manually, while `us-west2` is now reported as an
  invalid region that blocks the next deployment. The running deployment remains
  healthy; no Railway setting was changed during the audit.

## 2026-08-02 - Approved application release completed

- Merged PR #119 as `9e901b1` after all seven reported GitHub CI/security
  checks passed, then used one explicitly approved manual Railway source
  redeploy because the merge did not start a deployment.
- Railway deployment `12c9b9c2-d7de-4fb5-9817-9ae47c3b8cb7` reached `SUCCESS`
  with image digest
  `sha256:44b69a4a996393d39220702b07214fb622017aa83698051139d10ab2bdd8b41a`.
  Nine public routes, AAL2 admin access, polling boundaries, Telegram queue
  state and more than ten minutes of health/log observation passed. No
  synthetic Telegram update or message was sent and Supabase remained at 33
  migrations with head `20260729131000`.
- Recorded one unintended AI-provider health request caused by an inherited
  Railway key that the local PowerShell override did not remove. It returned
  `200` for `gemini-3.5-flash`, may be billable, contained no user content and
  was not repeated by that manual release check. The separately scheduled
  monitor continued recurring provider probes; the interval is not described as
  zero-API verification.
- Read-only Railway inspection confirmed the repository is connected but
  production has no source-branch binding. The Dashboard offers
  `Connect Environment to Branch`, so merges do not currently auto-deploy. No
  Railway setting was changed; connecting `main` remains a separate decision.
- Added the sanitized evidence record
  `PRODUCTION_APPLICATION_RELEASE_2026-08-02.md` and reconciled current-state,
  deployment, recovery, API/function and historical migration documentation.

## 2026-08-02 - Production database maintenance completed

- Applied only `20260729105030` and `20260729131000` to Supabase production
  after an approved Railway write freeze, stable read-only snapshots, a fresh
  encrypted logical export, an exact-two dry-run and separate final approval.
- Production migration history is now `33` versions with head
  `20260729131000`; the postflight confirmed the Family-claim retention change,
  all seven role-plus-AAL2 policies, unchanged aggregate data, closed private
  schema privileges and no conflicting lock or long transaction. The
  destructive retention function was not invoked as a test.
- Restored the exact pre-window Railway commit/image by rollback as deployment
  `5b2663c8-faed-40ab-8b1d-cc2462641c0f`. Health, AAL2 admin reads, polling
  leader recovery and more than ten minutes of monitoring passed. The procedure
  sent no Telegram QA/user message, initiated no AI request, and made no Git
  commit/push or new app release. The independently scheduled monitor did make
  a provider health request and sent one sanitized operator alert during the
  intentional freeze.
- Superseded the prepared `railway scale` freeze recipe. Validation showed that
  scaling could create a new deployment from newer source, so those commands
  must not be reconstructed or reused. Future freeze/resume work requires
  fresh Railway behavior verification, immutable identifiers, backup and
  action-time approval.
- Recorded the full sanitized evidence in
  `PRODUCTION_MIGRATION_APPLY_2026-08-01.md` and converted the dated maintenance
  runbook into a completed historical record.

## 2026-08-01 - Maintenance window safely rescheduled

- The proposed `2026-08-01 01:30–03:00` Asia/Tashkent window expired without a
  Railway freeze, database apply, deployment, Telegram QA or paid AI call. At
  the next operator request, local time was already `10:20`; the hard-stop rule
  correctly kept production unchanged.
- Rescheduled the prepared no-go runbook to the next post-retention interval:
  `2026-08-02 01:30–03:00` Asia/Tashkent, after the expected `20:17 UTC` cron.
  This is a proposed window, not authorization; both human owners, fresh
  read-only state, a new encrypted backup and separate action-time approvals
  remain mandatory.

## 2026-07-31 - Production database maintenance-window preparation

- Prepared a no-go operator runbook for the proposed `2026-08-01 01:30–03:00`
  Asia/Tashkent database window. Preparation does not authorize a Railway
  pause, Supabase apply, application deployment, Telegram QA, or paid AI call.
- Selected Railway's documented zero-replica scaling as the bounded application
  write freeze. The sequence preserves the existing deployment image, drains
  Telegram leases for at least 125 seconds, and requires two identical
  read-only database snapshots before a fresh encrypted export.
- Added explicit two-human MFA presence, cron, backup/readback, exact-two
  dry-run, relation-lock, final-approval, postflight, resume, timeout and abort
  gates. Production remains unchanged and **NO-GO**.
- Corrected the write-freeze control after live read-only Railway inspection:
  the Dashboard replica field has `min=1`, so it cannot implement zero replicas.
  Pinned and hash-verified the official standalone Railway CLI `4.65.0`, proved
  its read-only status output against the immutable production baseline, and
  recorded exact explicit-id `eu-west=0` / `eu-west=1` commands. Neither command
  was run; production stayed unchanged.

## 2026-07-31 - Independent Google Drive recovery-key evidence

- Recorded both password-protected recovery PFX files in a private Google Drive
  folder independent from the workstation and OneDrive backup account. No
  sharing change or password upload was performed.
- Rechecked both local PFX sizes and SHA-256 values and confirmed that both
  reject an empty password. The downloaded Google Drive copy of the EFS PFX
  matched its local `2566`-byte SHA-256 exactly.
- Closed the recovery-key GO gate after the manually downloaded portable PFX
  matched its local `3438`-byte SHA-256 exactly and the operator explicitly
  confirmed recoverable password custody outside both backup clouds, the
  workstation repository, and chat.
- Production remains NO-GO. No database migration, Railway deployment,
  Telegram operation, paid AI call, or production runtime change was made.

## 2026-07-29 - Production migration preflight evidence refresh

- Updated the production migration runbook to the approved PR `#116` merge
  `d053e35` and tree `b30d10d8`; merge and post-merge CI/security gates passed,
  while Railway remains on the verified rollback deployment.
- Recorded a fresh EFS/CMS-encrypted production logical export covering
  `public`, `private`, `auth`, and `storage`, including count-only Auth/MFA and
  admin baselines. In-memory decrypt/hash, signed-in OneDrive upload, download
  readback, and ciphertext SHA-256 comparison passed for archive and metadata.
- Recorded the disposable PostgreSQL 17.6 restore drill: every count invariant
  matched, both target migrations applied only to the disposable database,
  pgTAP passed 86/86, and schema lint had zero error/fatal findings.
- Recorded the production read-only baseline and exact-two-pending CLI dry-run.
  The isolated worktree's ignored production link metadata was removed after
  collection. No production migration, migration repair, Railway deployment,
  Telegram Bot API operation, or paid AI call was performed.
- Kept the production verdict at NO-GO until a maintenance window, named
  migration/rollback operators, both reachable MFA owners, an independent
  recovery-key copy, and write-freeze or explicit loss-window acceptance are
  confirmed.

## 2026-07-29 - Local security-regression hardening and evidence correction

- Kept production unchanged at `bff76eb`; source/application changes below
  remain local on `agent/security-regression-hardening-20260729`, while the
  isolated staging-only database evidence is recorded separately. The local
  application gate passes 165 files / 12,853 tests, TypeScript, production
  build with non-secret placeholders, `npm audit` with zero findings and lint
  with zero errors plus eight established warnings. A fresh local Supabase
  database applied all 33 migrations from scratch, schema lint reported no
  errors and all four pgTAP files passed 86/86. The disposable cluster was
  stopped without backup and left no local Supabase container or project volume.
  Deployment remains open.
- Added migration `20260729131000_admin_mfa_aal2_rls.sql`: protected
  direct authenticated reads/updates require an admin AAL2 JWT. The revised
  staging MFA smoke uses the same real user client for AAL1 denial and AAL2
  success instead of a service-role read. Isolated staging exposed a nested
  private-helper permission defect and invalid nested write CTEs before release;
  both were fixed without granting `private` schema usage. Final hosted pgTAP
  passes 23/23, including AAL2 non-admin denial, and catalog postflight passes.
  The revised hosted same-client smoke then proved protected direct read denial
  at AAL1 and exactly one visible fixture at AAL2, followed by exact factor,
  Auth user, allowlist, role and fixture cleanup.
- Production/Railway now requires an explicit `REQUIRE_ADMIN_MFA_AAL2` value;
  missing, empty or invalid configuration fails closed. Explicit `false`
  remains a bounded rollout/recovery state, while dev/test may omit the flag.
- Hardened dynamic HTTP compression with strict quality parsing, `406` when all
  encodings including identity are forbidden, and an abort-aware pipeline for
  upstream error, downstream cancellation and request abort. Focused checks
  pass 27/27. Nitro's earlier static asset handler still has an open general
  `q`-weight limitation.
- Fixed three exact Telegram semantic tails: bank/card code theft delivered in
  Telegram, Uzbek bank/code confirmation followed by next steps, and the common
  Russian `безапасный счет` typo. Targeted 468/468, Telegram 10,872/10,872 and
  adversarial 2,161/2,161 pass locally without network/API use.
- Added migration
  `20260729105030_family_notification_claim_retention.sql` so the existing daily
  maintenance function deletes expired metadata-only Family claims even when
  no later claim occurs. Its focused contract passes 15/15 and isolated-staging
  pgTAP passes 10/10.
- Applied both migrations through the isolated staging SQL Editor with explicit
  transactions and lock/statement timeouts. All twelve final catalog checks
  passed and rollback left zero synthetic fixture rows. SQL Editor intentionally
  left both migration-history rows absent. The fixed guarded CLI repair later
  recorded exactly `20260729105030` and `20260729131000`; a second migration
  list fully matched local history and guarded `db push --dry-run` reported the
  remote database up to date, so no ordinary push ran. The restored staging
  project lacks `cron.job`, so schedule parity is recorded as a gap rather than
  claimed.
- Restricted the local `.env` ACL to the owner, `SYSTEM` and Administrators and
  added a fixed-recipe Supabase wrapper that hard-blocks the production link and
  requires all staging refs plus explicit manual confirmation to agree. The
  one-time repair pinned the two applied versions and their SHA-256, required a
  second acknowledgement and rejected duplicate/symlinked files or a binary
  override. After closeout, repair and ordinary push recipes were retired; only
  status/list/dry-run remain, and the child CLI receives no application
  service-role, Telegram, AI or Vite environment variables.
- Corrected the evidence model: the 2026-07-28 hosted run is functional restore
  evidence, not a measured RPO/RTO; prerecorded asset/transport checks do not
  close human Voice-out or real RU/UZ Voice-in acceptance.

## 2026-07-28 - Hosted functional restore drill and production HTTP-compression baseline

- Restored the portable v2 archive into isolated Free/nano Supabase staging
  with outbound integrations disabled.
- Verified catalog/RLS, exact migration history, schema lint, pgTAP 53/53,
  service-role workflows, synthetic TOTP upgrade and complete cleanup back to
  the ten restored count invariants. The original final database read used
  service role; it did not prove direct AAL1/AAL2 PostgREST policy behavior.
  The schema phase also lacked complete stderr/per-phase timing, so this was not
  RPO/RTO closure.
- Fast-forwarded and deployed the verified documentation/staging-smoke baseline
  as `f3cfb42`; Railway deployment
  `18b5f7f4-731f-495b-b3e6-d3114c320d83` passed health and the safe no-AI,
  no-message production smoke.
- Added and deployed streaming Brotli/gzip for eligible dynamic GET responses
  plus Nitro-generated Brotli and gzip variants for public assets as `5c08a23`;
  Railway deployment `00cd6dcb-19bd-4fd5-b063-e96bcd216b32` succeeded.
- Production normal-path measurement reduced homepage HTML from 62,216 decoded bytes to
  14,160 bytes with Brotli and the main CSS from 258,542 to 40,302 bytes.
  Gzip fallback, explicit identity, quality weights, CSP preservation and an
  exact CSS round trip passed. This did not test upstream stream failure,
  downstream cancellation, full refusal/`406` or general Nitro static
  `q`-weight negotiation; the 2026-07-29 entry supersedes that broader reading.
- The release passes 161 test files and 12,796/12,796 tests, TypeScript,
  production build, lint with the established eight warnings and `npm audit`
  with zero vulnerabilities. Safe production smoke returned `200` for public
  routes and `401` for a webhook request without its secret; it sent no Telegram
  messages or AI requests.

## 2026-07-26 - Current-state and recovery reconciliation

- Added `CURRENT_STATE.md` as the short operational source of truth for the
  deployed `6a13419` baseline and remaining release gates.
- Reconciled the two-owner Admin MFA UI/enrollment/server-function rollout and
  production hash-pepper `v2` overlap in `OPEN_TASKS.md`. The later 2026-07-29
  audit found and locally fixed the separate direct PostgREST/RLS AAL2 gap.
- Recorded that the existing AES-256 EFS archive is locally verified but still
  tied to the current Windows profile, then exported its password-protected PFX.
- Added a separate Document Encryption recovery certificate, CMS-encrypted the
  database archive and metadata, and verified both through in-memory
  decrypt-and-hash round trips.
- Detected that the local OneDrive folder was not connected to the authenticated
  cloud account, uploaded the five encrypted recovery items through signed-in
  OneDrive web, and confirmed all five names and sizes by cloud readback.
- Verified every original SQL entry against the manifest, completed a
  disposable local schema/data restore with count-only invariants, schema lint,
  pgTAP 53/53 and the 12,780/12,780 application gate.
- Detected the cross-schema cycle in the legacy split dumps, generated and
  independently restored a transaction-ready v2 package with unified
  `schema.sql` and `data.sql`, CMS-encrypted it, and confirmed the two v2 files
  plus `README-RECOVERY-V2.txt` by signed-in OneDrive web readback.
- A second PFX location, hosted isolated-service restore/RPO/RTO and Railway
  rollback evidence remain open.
- Marked old commits, test totals and tracker counts in dated audit/release
  plans as historical to prevent future reviewers from treating them as the
  current project state.

## 2026-07-24 - Local UI/UX clarity pass

- Simplified the Russian homepage checker to one auto-detecting input instead
  of non-functional type tabs; screenshot OCR remains a separate real action.
- Marked the prefilled verdict as a demo, added an above-the-fold emergency
  path and replaced absolute privacy promises with the actual masking and
  non-publication boundary.
- Removed the duplicated large impact-counter section while preserving the
  compact live proof strip and all educational, directory, trends, privacy,
  report and emergency content.
- Made the admin route task-first: compact authenticated session header,
  queue before the operator guide, report search, default hiding of explicit
  QA/smoke records, clamped long cards and confirmation before moderation or
  appeal decisions.
- Fixed FAQ relationships, the accessibility launcher contrast and admin
  terminology. The pass is local-only and has not been deployed.

## 2026-07-23 - Approved homepage and admin redesign integrated for Railway

- Integrated the approved warm-white editorial direction into the real
  TanStack/Supabase application instead of publishing the standalone mockup.
- Added a production-connected three-line homepage hero and shared responsive
  header, spacing, radii, typography, striped background and floating-points
  CTA system.
- Moved the full approved Russian composition into
  `ApprovedRussianHomepage`, while keeping UZ/EN on the established translated
  production surface.
- Preserved the complete homepage content and existing check/OCR/report,
  official-directory, trends, privacy, emergency and community flows.
- Restyled the authenticated admin dashboard while preserving real auth, role
  checks, report moderation, appeals and entity disclosures; the local review
  adds no authorization bypass.
- Removed positional hover movement from admin report cards and made FAQ/entity
  disclosures animate through bounded height, opacity and transform states.
- Verified both approved surfaces without horizontal overflow at 320, 375,
  390, 768, 1024, 1280, 1440 and 1920 pixels; the authenticated React admin
  route continues to redirect anonymous sessions to `/login`.
- Recorded the new UI files and the presentation-only security boundary in the
  file, function and decision maps.

## 2026-07-16 - Direct and Inline multilingual context hardening locally green

- Preserved concrete RU/UZ/EN scenario topics and action-first guidance across
  Direct chat, Inline preview and inserted results for bank/police impersonation,
  SIM swap, remote access, tax, parcel, loan, charity, romance/extortion, fake
  support, QR login, investment/channel and related human cases.
- Added classifier-only Unicode/invisible/confusable normalization, full
  multiline precedence, per-message Direct language selection without session
  mutation, bounded Reply context and non-echoing OTP/PIN/CVV/password/recovery
  guidance.
- Closed the elderly-QA handoff: Uzbek Cyrillic family distress and completed
  Telegram takeover now reach specific victim recovery; short already-paid,
  already-installed, uninstall and confidence replies use a chat-scoped
  enum-only 20-minute context instead of a cold check. Explicit questions such
  as «это номер банка? +998…» now check the embedded phone as a phone passport.
- Added a 1,080-case adversarial human corpus exercised through Direct and
  Inline (2,161 focused assertions) and retained the 1,175-case Inline context
  robustness oracle. No external network, paid model or Telegram session write
  is permitted by these suites.
- Local verification passes the focused 2,161/2,161 oracle, Telegram
  10,743/10,743, full project 12,593/12,593, TypeScript, lint with zero errors,
  production build and `npm audit` with zero known vulnerabilities.
- Production, commit, push and deployment were intentionally not touched; the
  dirty branch still requires provenance review and owner approval before any
  publication step.

## 2026-07-16 - Elderly-realism QA corpus and Uzbek Cyrillic coverage

- Added `src/lib/telegram/__qa__/`: a 100-case observational corpus of
  realistic elderly RU/UZ messages (typos, Uzbek Cyrillic, Latin with Russian
  loanwords, code-switching, STT-style transcripts, fragments, multi-turn,
  Inline) driven through the real dispatch/inline pipeline with faked
  Telegram/Supabase. Reports land in `output/elderly-qa/`.
- Added `src/lib/risk/uz-cyrillic-translit.ts`: `evaluateText` now also
  evaluates an Uzbek Cyrillic→Latin matching variant so Cyrillic-script Uzbek
  reaches the existing Latin rule patterns. Closed Latin morphology gaps:
  so'rashyapti ask forms, kartangizni possessives, to'lashim kerak, orqa.
- Gratitude with blessings and who-are-you/is-it-free openers now get warm
  identity/acknowledgement replies instead of the generic verdict card
  (`check-followup.ts`).
- The victim-intent gaps originally recorded here were closed later on
  2026-07-16 and are now strict elderly-QA regressions.

## 2026-07-15 - Third Desktop Inline visible follow-up remediation deployed

- Archived seven additional owner-supplied Telegram Desktop screenshots as
  ignored local pre-fix evidence under
  `private/telegram-inline-qa/2026-07-15/desktop/user-batch-03/`.
- Confirmed the remaining defect: edited Inline queries already received a new
  query-scoped result id, but the visible preview often kept the same
  intent-level title and description, so Telegram appeared not to answer the
  second line.
- Added explicit RU/UZ/EN visible answers for trust questions, scam
  confirmation, chat/SMS bank numbers, fake/substituted links, “why” questions
  and next actions while preserving the concrete first-line safety intent.
- Fixed the Russian substring collision where `дал` inside `дальше` could turn
  “what should I do next?” into a false “code/card already sent” route. A
  concrete multiline situation now outranks broad meta/help wording, while
  single-line greeting and methodology behavior remains unchanged.
- Added dedicated blackmail-aftercare handling for compromising-photo wording:
  do not pay or send more material, save evidence, tell a trusted person,
  block/report and use an official police contact for direct threats.
- Added 36 exact visible follow-up contracts plus screenshot-specific and
  mismatch regressions. The 1,152 generated context rows still assert the
  exact expected title rather than accepting any follow-up title. All new
  tests prohibit network, paid AI/reputation calls and database mutations.
- Local verification on lockfile-pinned dependencies passes 10,172/10,172
  tests, TypeScript, lint with zero errors and the production build.
- `npm audit` reports zero known vulnerabilities. Coverage passes at 84.87%
  statements, 79.06% branches, 90.91% functions and 86.92% lines.
- PR #110 passed application, coverage, Supabase migration/schema/pgTAP,
  CodeQL, Gitleaks and container/SBOM checks, then merged as
  `581e71536e729253b73012baf5086241caf68e13`. Railway deployment
  `f5915159-ccaa-46bc-9e42-be8c521010be` reached `SUCCESS` with image
  `sha256:b094e4592d2492bece73f64a21eeb802792b7ec32996370800b2fa0efbe84ddb`.
- A bounded read-only production monitor passed home/health `200`, missing
  webhook secret `401`, expected polling-mode webhook `503`, Telegram `getMe`,
  pending updates `0` and polling-leader health `200`. AI and alerts were
  disabled, so it sent no Telegram message and made no paid model call.
- The seven screenshots are still pre-fix observations. Replay of the same
  cases on Telegram Desktop and the Android/iOS matrices remain required.
  `INL-001`/`INL-002` stay outside Passed and `BOT-004` stays In Progress.

## 2026-07-15 - Second Desktop Inline context remediation deployed

- PR #108 passed application lint/type/test/build, coverage, Supabase migration,
  schema/pgTAP, CodeQL, Gitleaks and container/SBOM checks, then merged as
  `da4c0a259a228d864432a77ccb1b3291468c52cf`.
- Railway deployment `a1c6eab5-a8da-4341-a7ff-387212cd3784` reached `SUCCESS`
  from that exact merge revision. The active image digest is
  `sha256:9cc2da03c7e57eb29f53fadb332596a48e154ff9be372620349943eeae1155e9`.
- A bounded read-only production monitor passed home/health `200`, missing
  webhook secret `401`, the expected polling-mode webhook `503`, Telegram
  `getMe`, an empty pending queue and protected polling-leader health `200`.
  AI and monitor alerts were explicitly disabled, so no paid model call or
  Telegram notification occurred.
- Deployment and runtime health are now proven. The owner-supplied screenshots
  remain pre-fix observations, so Desktop post-fix replay and the full Android/
  iOS matrix remain required before `INL-001` or `INL-002` can pass;
  `BOT-004` remains In Progress pending its broader real-client dialogue gate.

## 2026-07-15 - Second Desktop Inline context remediation is locally green

- Archived 30 additional owner-supplied Telegram Desktop screenshots as ignored
  local pre-fix evidence under
  `private/telegram-inline-qa/2026-07-15/desktop/user-batch-02/`.
- Fixed unchanged/missing second Inline results with query-scoped result ids;
  concrete multiline danger now outranks generic context and suspicious
  previews no longer waste their 120-character budget on repeated risk filler.
- Expanded RU/UZ/EN handling for authority/legal pressure, SIM replacement,
  TON/wallet investment promises, earning/channel, code/sent-code, bank,
  voting/link, reply and next-step flows. User safety questions are no longer
  counted as attacker urgency, and neutral `Wallet Earn` interface copy no
  longer becomes an investment promise.
- Added a 1,175-case offline context suite: 1,152 generated dialogue mutations
  plus safe controls, privacy redaction and result-id contracts. It forbids
  external fetch, AI/reputation use and database mutations.
- Local verification passes 10,131/10,131 tests, TypeScript, lint with zero
  errors, the production build and `npm audit` with zero known vulnerabilities.
  Coverage passes at 84.76% statements, 78.91% branches, 90.89% functions and
  86.82% lines.
- This branch is not yet production/live-client evidence. Desktop post-deploy
  replay and the complete Android/iOS matrix remain open, so `INL-001`,
  `INL-002` and `BOT-004` are not marked Passed.

## 2026-07-15 - Desktop Inline defects and polling burst reliability were deployed

- Archived 41 user-supplied Telegram Desktop screenshots as ignored local
  pre-fix evidence under
  `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/`. They reproduce
  job-fee copy falling through to a generic transfer answer, repetitive
  preview/insertion copy, ambiguous phone guidance, bare eight-digit strings
  being treated as North American phones, lost multiline link context,
  rate-limit refresh confusion, incomplete passport guidance and intermittent
  missing/unchanged Inline results.
- Added job-specific direct-bot and Inline guidance, improved RU/UZ/EN natural
  routing, completed passport/link responses and made preview copy distinct
  from the fuller inserted result. Bare 6-8 digit strings now get a privacy-safe
  “code or incomplete number” card; 9-digit Uzbek local and explicit full
  international phones remain on the phone path. Phone displays, secret
  permutations and Unicode-bounded text remain masked before presentation.
- Reworked mixed-clause detection so a safe clause cannot suppress a later
  code, passport, transfer, APK or similar action across RU/UZ/EN punctuation,
  contrast/sequence wording or an independently actionable conjunction. Object
  lists and genuinely negated safety instructions remain neutral.
- Guarded stateless Inline previews now receive a 60/minute policy only when
  Telegram channel, no persistence, no AI, no URL reputation and the
  server-owned Inline key all match. Rate/error articles are not cached, while
  successful answers use a short cache. `answerInlineQuery` uses a bounded
  timeout, retries one transient network/no-code/5xx failure and reports
  transient exhaustion to the durable update lifecycle instead of falsely
  completing it. A 429 is not retried immediately: bounded `retry_after` is
  propagated to polling, and concurrent failures honor the longest delay.
- The polling candidate requests batches of 20, validates the entire ordered id
  batch before side effects and keeps stateful causal order. Strict Inline work
  runs at most four-wide; during one slow stateful update, only following Inline
  work for known different users may read ahead. The acknowledgement frontier
  never crosses the first failed/busy update. Leader renewal now has a bounded
  deadline/local expiry. A forward-only Supabase migration allows stale-owner
  reclaim only after a 15-second outbound-effect drain grace while preserving
  processing fences and webhook isolation.
- Local verification passes the complete 8,882/8,882 application tests,
  TypeScript, the production build and `npm audit` with zero known npm
  vulnerabilities. Focused evidence includes the Inline/risk suites plus
  234/234 merged polling/lifecycle/API/Inline reliability tests.
- PR #106 passed application/coverage CI, migration apply on a clean database,
  schema lint, 35 pgTAP assertions, CodeQL, Gitleaks and container
  High/Critical/SBOM gates, then merged as
  `87bf181b4d4df92e438e768f83ab4c02883f1d9f`.
- Remote Supabase migration history records
  `20260712142514_reconcile_admin_role_lifecycle.sql` and
  `20260715040836_telegram_polling_stale_leader_reclaim.sql`. Local/remote
  history matches, a linked dry-run reports no pending migration, and linked
  production schema lint reports no errors. Direct live catalog grant/trigger
  read-back remains open. The count-only admin
  preflight found one current/eligible admin role and zero stale or missing
  roles without emitting an identifier.
- Railway deployment `39cf9f6d-294d-410a-9cef-972e41829561` reached `SUCCESS`
  from the exact merge revision, image
  `sha256:f289ebed30a5b96b3012904361b6aaa8a42cded15cd5fc1d75984690c5e84f11`.
  Home/health, expected webhook-secret behavior, polling delivery with zero
  pending updates and protected leader health passed. AI and alerting were
  disabled, so the monitor made no paid model call and sent no Telegram message.
  A one-minute in-memory soak also passed 600/600 with zero duplicates or loss.
- This deployment closes the migration/deployment/health preconditions for
  client retest, not the real-client gate. The 41 screenshots remain pre-fix evidence; Desktop post-fix replay and
  Android/iOS RU/UZ/EN visual/insertion QA are open. `INL-001`/`INL-002` must
  not move to Passed; `BOT-004` remains In Progress. See
  `TELEGRAM_INLINE_CLIENT_AUDIT_2026-07-15.md` and
  `TELEGRAM_INLINE_POLLING_BURST_QA_2026-07-15.md`.

## 2026-07-14 - Real Desktop Inline action order was corrected and deployed

- Real Telegram Desktop preview and insertion evidence for `INLINE-HIGH-RU`
  confirmed that classification, explanation, redaction and insertion worked,
  but the immediate safe action was omitted from the preview and appeared below
  the evidence paragraph after insertion.
- High-risk Inline previews and inserted cards now begin with the top
  reason-bound RU/UZ/EN protective action. The generic fallbacks were also
  rewritten to avoid unnatural phrases such as sending a physical card.
- RU/UZ/EN regressions assert the complete action-first order, align the action
  with the same ranked reason used by the explanation, traverse all 55 reason
  codes through both suspicious and high-risk paths, keep the full first action
  inside the 120-character preview and preserve the order after a plaintext
  entity-parse retry.
- PR #104 passed application, coverage, database, CodeQL, Gitleaks and
  container/SBOM gates and merged as main `95a7a82`. Railway deployment
  `aee41826-f392-4567-a5a9-2a34a70d205c` reached `SUCCESS`, image
  `sha256:78965ddef506eac5288169786dc50e9157fb6de1b7bd6a1d2d952e9444cb201a`.
  Home, health, authenticated polling leader, disabled-webhook policy and
  Telegram delivery state passed with zero pending updates. The AI key was
  deliberately removed from the smoke subprocess, so this verification made
  no paid provider call.
- The post-deploy Telegram Desktop retest passed. Its preview begins with the
  complete reason-specific SMS/PIN action, and the inserted card places that
  action directly after the title while keeping the reason, limitation,
  attribution and launch button visible. Sanitized local evidence is stored as
  `03-high-ru-preview-postfix.png` and `04-high-ru-inserted-postfix.png`. This
  closes 1/17 Desktop cases and 1/51 total client rows; the wider client matrix
  remains open.

## 2026-07-14 - Inline Unicode boundary and real-client evidence were hardened

- Fixed the 256-character query gate to count Unicode code points rather than
  JavaScript UTF-16 code units; added 1/255/256/257 plus 256/257-emoji regressions.
- Added `qa:telegram-inline-client-matrix`, a zero-network fixture generator for
  17 cases per client / 51 Desktop-Android-iOS rows.
- Split real-client proof from automated-only 257-character, timeout,
  `{ok:false}`, parse-retry and external-sink evidence so QA does not damage
  production to manufacture unobservable failures.

## 2026-07-14 - The 1,000-dialogue perimeter was adapted to Inline locally

- Added a reproducible Inline corpus with 3,805 source cases / 2,140 unique
  queries: all 2,500 user turns from the 1,000 synthetic dialogues, 930
  stateless contextual follow-ups, 363 mixed-clause cases and 12 synthetic
  credential-boundary fixtures. Distribution is RU 1,270, UZ 1,269 and EN
  1,266.
- Ran every case through the real `handleInlineQuery` and deterministic
  `runCheck`. Telegram and Supabase were mocked, global `fetch` remained unused,
  database mutations were zero and every check used `skipAi=true`,
  `skipUrlReputation=true`, `persist=false`.
- Added concise localized Inline replies for greetings, thanks and bot identity,
  including reviewed corpus typos and natural variants. Exact small-talk
  matching remains anchored, so a later OTP/PIN/CVV request cannot be swallowed.
- Strengthened the corpus oracle: failure cards cannot count as successful risk
  answers, safe controls cannot become warnings, expected acknowledgement and
  identity routes are asserted, and visible secrets are checked after
  MarkdownV2 de-escaping.
- Fixed shared forward/reverse code redaction for punctuation, brackets and
  value-first CVV/PIN/OTP forms. A proposed generic four-word reverse-passphrase
  regex was removed after independent review proved it could erase
  `asks_for_pin`; dedicated regressions now preserve password-request scoring.
- Deterministic text rules now inspect the complete in-memory prose with
  embedded URLs replaced by a neutral `[link]` marker; only redacted text may
  cross AI, persistence and presentation boundaries. This preserves RU/UZ/EN
  password-request signals without reintroducing URL-token false positives.
- Local verification passed 137 files / 8,647 tests. This is offline corpus
  evidence, not 3,805 Telegram messages, model training, Bot API delivery or
  Desktop/Android/iOS rendering/insertion proof. `BOT-004` remains In Progress;
  `INL-001` and `INL-002` remain blocked on the real-client matrix. See
  `TELEGRAM_INLINE_OFFLINE_QA_2026-07-14.md`.
- PR #100 passed application CI, coverage, migrations/schema/pgTAP, CodeQL,
  Gitleaks and container/SBOM gates and merged as main `87c5ff5`. Railway
  deployment `78dc6e9b-2464-4e3c-a6ed-c7b0f71cc432` reached `SUCCESS`;
  `/healthz` and the protected polling-leader endpoint returned `200`. The
  production check did not replay the mass corpus and did not call AI.

## 2026-07-14 - Real Telegram restart/re-election gate closed

- Railway deployment `c2b98732-bc38-4fbf-aafa-920282eea161` started a new
  application instance from main `128e27d2` while retaining the already
  verified runtime image `sha256:b4cc9f11`. Health and polling-leader checks
  returned `200`, and Telegram reported polling mode with an empty webhook URL
  and zero pending updates.
- The user sent the approved benign greeting `привет` from a real Telegram
  client. The client screenshot showed one reply. Two metadata-only lifecycle
  read-backs approximately 30 seconds apart both found exactly one completed
  row, attempt count one, no retry, no processing row and no failure stage.
- The post-update production smoke passed. `RES-004` is now Passed. This is a
  bounded no-duplicate observation, not an exactly-once claim; production
  remains at-least-once with durable idempotent handling. See
  `TELEGRAM_RESTART_QA_2026-07-14.md`.

## 2026-07-14 - Production shared rate-limit failure gate closed

- PR #96 added a short-lived failure probe to the minimal production image.
  It replaces network transport only inside the probe process, exposes no app
  endpoint and cannot reach Telegram, Supabase, AI or another external sink.
- A first Railway run passed missing-config, RPC error, invalid-shape,
  transport-error and real-consumer `429` cases with zero external calls or
  writes. PR #97 added the remaining HMAC/WebCrypto exception required by the
  live acceptance matrix.
- Both PRs passed application, coverage, database and security CI. The final
  exact main `00f3b11ddaeabecaed1412238edec23861e35c5d` deployed as Railway
  `6a8ec5f6-e758-4574-8d15-34eb1206ca43`, image
  `sha256:b4cc9f1138528cb698ca5d26cec136b8ab1bf5c2d7ec7e111371c358564741b9`.
- The final six-case in-container probe passed with zero external network
  calls, database writes or unexpected sinks. Post-probe production smoke was
  green, and a read-only count returned zero total/live/expired
  `rate_limit_buckets`.
- `RES-003` is Passed and `SG-P0-005` is Closed. Ongoing bucket-volume and
  degraded-429 monitoring remains an operational watch. See
  `SHARED_RATE_LIMIT_FAILURE_SMOKE_2026-07-14.md`.

## 2026-07-14 - Production QR worker runtime gap fixed and verified

- A read-only probe of the deployed Railway image showed that its runtime did
  not contain `jsqr`, `jpeg-js` or `pngjs`. The eval worker in
  `qr-decoder.ts` resolves those packages at runtime, so production PNG/JPEG QR
  work could fail closed to empty evidence even though source-runtime tests
  passed.
- PR #94 changed the Docker runtime to copy only those three decoder packages.
  It still excludes the package manager, build toolchain and the rest of
  development dependencies.
- Added a self-contained QR worker corpus/resource/crash runner for the
  production image. It covers PNG/JPEG QR payloads, non-QR and malformed input,
  oversize rejection, four-job queue admission plus overflow rejection, forced
  in-flight worker termination and successful decode after worker recreation.
- Application, database and security CI passed with 8,591 tests, TypeScript,
  lint with 0 errors/8 existing warnings, build, coverage, CodeQL, Gitleaks,
  Trivy, CycloneDX, schema lint and pgTAP. The exact main merge
  `f1ddf3490573e667907beed2a027e468298f954d` deployed as Railway
  `09f984bd-1930-4a2b-a04a-4f4ef46e2058`, Docker image
  `sha256:abbba9cf1cb45f7ca4e4e6c5a40a6d78d37ef1c5672aab6def2dbba641a038e5`.
  A live require probe loaded all three packages.
- The detached 10-minute Railway profile passed 5,055 cases with zero failures:
  PNG 2,087, JPEG 693, queue accepted/rejected 4/1, forced in-flight
  interruption failed closed and the recreated worker decoded successfully.
  Final/max RSS was 165.88/234.60 MiB, RSS growth 110.08 MiB, event-loop
  p99/max 21.04/28.26 ms and decode-latency p95/p99/max
  50.09/225.53/279.47 ms. The runner made no external call or persistent write;
  production smoke after load passed.
- `RES-001` and `RES-002` are now Passed. `RES-004` remains In Progress only
  for an approved physical Railway restart/leader re-election with one QA
  update. See `QR_WORKER_RESOURCE_SOAK_2026-07-14.md`.

## 2026-07-14 - Railway polling/resource soak completed

- PR #89 added a production-image-bundled polling/resource runner around the
  real polling-cycle core. Application, database and security CI passed with
  8,587 tests, TypeScript, lint with 0 errors/8 existing warnings, build,
  coverage floors, CodeQL, Gitleaks, Trivy, CycloneDX, schema lint and pgTAP.
- Clean main `868eb18d410f2616030a92b410a36b6bc3784c4e` deployed successfully as
  Railway deployment `24b9cb4a-aefe-4807-9d2b-84fc6f931f3b`, image digest
  `sha256:1a31e7b129757c8728ba46541f89bc048c4f71cc3bf15b8b481a08bbc9c8099c`.
  Production smoke and `/healthz` passed before the run.
- The uninterrupted 60-minute Railway run passed: 36,000 generated/completed
  updates, zero lost updates, zero duplicate modeled effects, final/max queue
  0/35, final/max RSS 98.00/101.41 MiB, event-loop p99 21.84 ms, update-latency
  p99 2.57 ms and three bounded retries. Stale-leader rejection, process-offset
  loss replay, pre-effect failure and completion-acknowledgement loss all passed.
- The runner was isolated and in-memory: no Telegram, Supabase, AI-provider or
  reputation-provider call and no synthetic persistence. Its `tmux` session was
  removed and production remained `200 ok` afterward.
- This closes only the bounded polling/resource soak sub-gate. The separate QR
  worker corpus/crash/recovery sub-gate passed later on 2026-07-14. `RES-004`
  remains In Progress pending a physical Railway restart/leader re-election
  with one approved QA update. See `POLLING_RESOURCE_SOAK_2026-07-14.md`.

## 2026-07-13 - Human-style Telegram dialogue perimeter verified locally

- Fixed the observed Telegram question `а ты можешь проанализировать ссылку?`:
  it now asks for the complete link instead of starting an empty risk check and
  returning an inconclusive result card.
- Added explicit RU/UZ/EN capability replies for links, phone numbers, images,
  Telegram accounts, message text and QR codes, plus concise greetings and a
  bounded off-topic redirect. Concrete links/domains, usernames, phone numbers
  and forwarded content still bypass meta routing and remain real checks.
- Preserved recent-result provenance for questions such as `Почему домен
подозрительный?`; a new concrete domain remains a fresh check, while a short
  methodology question explains only the saved visible evidence and its
  limitations without pretending that a second check ran.
- Added deterministic offline layers: 1,008 RU/UZ/EN context cases across 14
  topics/three conversational positions; exactly 1,000 unique two-or-three-turn
  synthetic dialogues (2,500 user turns: 620 risk checks, 930 follow-ups and
  950 meta/ordinary turns); 540 balanced everyday two-turn dialogues (1,080
  user turns, 102 unique follow-ups); and 363 mixed-clause adversarial messages
  covering comma, colon, dash, semicolon and `но`/`lekin`/`but`. The dialogue
  snapshots and replies are generated by the real local production functions.
- Closed adversarial routing gaps around mixed safety/unsafe clauses, neutral
  Wi-Fi/postal-code/source-code prefixes, QR requests versus descriptive or
  negated QR text, card/code/password substring false positives and wrapper-only
  acknowledgements. Removed a misleading Telegram-takeover label from generic
  SMS-code results and kept high-risk follow-up advice organization-neutral.
- Revalidated the physical-access-code exception after the final review found
  that `код домофона` / `eshik kodi` / `door code` could exempt a later banking
  code request from the whole message. The exception is now clause-local across
  comma, dash, semicolon and RU/UZ/EN contrast forms; postal-code, dress-code and
  source-code prefixes also cannot hide a later request. Twenty-eight focused
  regressions prove the dangerous tail remains suspicious while genuine door or
  entrance-code messages stay neutral. The affected helpers existed only in the
  uncommitted working tree, so the deployed production revision was not exposed.
- Added `victim.personal_data_already_shared` so an already-sent passport or ID
  receives concrete aftercare instead of prevention copy. Completed harm,
  family impersonation and ended-call wording now route separately from active
  requests. Seventeen benign end-to-end controls cover bills, groceries, rent,
  repayments, door codes and official document uploads; 33 paired direct-danger
  controls still detect SMS/OTP, CVV/PIN, transfer, APK, screen and QR requests.
- Fixed adjacent user-facing defects found during full revalidation: CVV/card
  digits now receive card-specific advice; `государственный` no longer matches
  the word `суд`, while `SUDga`/real court threats remain detectable; and an
  OTP/SMS-only result no longer invents a “safe account” observation or repeats
  the same code fact twice.
- Independent conversational/risk review passes 2,438/2,438. The full Vitest
  setup denies unmocked network access globally; corpus tests also keep local
  hard guards. These are routing/copy regressions, not model training, not live
  chats and not a replacement for real-client acceptance testing.
- PR #86 passed application/database/security CI and deployed the dialogue
  perimeter. The first bounded production polling-dispatch run then exposed an
  ambiguous high-risk confidence sentence: it did not clearly distinguish an
  organization's official callback number from a known person's previously
  saved number. PR #87 corrected that RU/UZ/EN copy and added a regression.
- The exact production revision is
  `5ceb9eaa2ed447e0072a7cee4b25e16eae673b03` / Railway deployment
  `8c76285e-51c0-4539-b305-d2d1d3301227`. The final bounded dispatch harness
  passed confidence, trusted-person, recheck, disagreement,
  domain-methodology and passport flows and deleted its Bot API replies and
  synthetic database rows. General production smoke, monitor and RLS/security
  smoke also passed. A stale domain-methodology harness assertion was updated
  to the retained-provenance contract without weakening its evidence,
  limitation or no-overclaim checks.
- Final verification: 134 files / 8,584 tests, TypeScript, changed-file
  Prettier, lint with 0 errors and 8 existing warnings, production build,
  `npm audit` with 0 known vulnerabilities, CodeQL, Gitleaks, container/SBOM,
  migrations, schema lint and pgTAP. The bulk dialogue corpora remained local
  and made no AI-provider, Telegram or database calls; only the bounded
  production smokes used configured services. BOT-004 remains In Progress
  until real Telegram Desktop/Android/iOS RU/UZ/EN acceptance is captured.

## 2026-07-12 - Release-gate expansion verified locally

- PR #84 is now merged and deployed exactly at `190c82a2` / Railway
  `be7d6f8d`. All app/database/security jobs, production smokes and monitor
  `29205158630` passed. The canonical tracker now records 12 Passed, 16 In
  Progress, 18 Blocked and 5 Deferred gates, and a dated release-readiness plan
  defines every remaining live/external step without claiming it complete.
- Corrected the first remote gate run without weakening policy: coverage now
  uses the committed Bun lock instead of an ignored npm lock, CycloneDX is
  uploaded before the blocking scan, and the runtime image removes unused
  npm/Corepack/Yarn packages. A local release-image build remained non-root and
  Trivy reported zero fixed High/Critical OS or library findings.
- Expanded the canonical RU/UZ/EN post-check dialogue DSL from 1,248 to 1,872
  context rows. Every one of 13 actions now includes a reviewed natural reply
  to the bot and common typo per language through exact normalized lookup;
  handler tests forbid cold checks, session writes and trusted-contact effects.
- Added slow-provider abort and exhausted 500/502/503 retry cases to the existing
  no-key/network/401/429/fallback matrix. Rules-based verdicts and safe replies
  remain deterministic under every covered degradation path.
- Added a 1,000-update polling lifecycle simulation with process offset loss,
  leader changes, pre-effect failure and completion acknowledgement loss. Every
  update completed with exactly one modeled outward effect.
- Added immutable CI action pins, repository coverage floors, CodeQL, Gitleaks,
  release-container Trivy High/Critical scanning and a CycloneDX SBOM workflow.
  Local measured coverage is statements 82.84%, branches 76.98%, functions
  89.29% and lines 84.71%; the new remote security jobs still require a real
  green GitHub run before their gate can be marked Passed.
- Published privacy-safe backup/restore, rollback, key-rotation and 72-hour
  canary contracts. The privacy page now states the actual RU/UZ/EN retention,
  raw screenshot disposal and moderated `/appeal` path. Supabase Auth settings,
  real restore/rotation drills, legal review, signed provenance and the 72-hour
  observation remain external evidence gates.
- Verification: 127 files / 4,866 tests, TypeScript, lint with 0 errors and 8
  existing warnings, production build and `npm audit` with 0 known
  vulnerabilities.

## 2026-07-12 - Polling-aware smokes and passport-question precedence

- Made the one-shot app and synthetic Inline smokes explicit about Telegram's
  configured delivery mode. In polling mode, an authenticated webhook `503`,
  an empty webhook URL and a healthy polling leader are the expected state;
  webhook injection is no longer reported as handler-delivery evidence.
- Added a shared delivery policy with regression coverage so the smoke scripts
  cannot silently return to webhook-only assumptions.
- Routed generic document-safety questions such as “Почему мошенники просят
  фото паспорта?” before broad scam concern and stale-result follow-up logic.
  The production dispatch harness now proves the reply is document-specific,
  creates no new check and cleans up its synthetic Safe context.
- Verification: 4227/4227 tests, TypeScript, lint with 0 errors, production
  build and `npm audit` with 0 known vulnerabilities. Deployment and exact-SHA
  production evidence are intentionally recorded after merge.

## 2026-07-12 - Repository security revalidation fixes verified locally

- Revalidated clean `main` revision `4bd9403` across 388 ranked files and 109
  full-file receipts. Fifteen findings survived validation: 1 High, 9 Medium
  and 5 Low; no Critical finding was confirmed.
- Bound verified-contact badge/passport/Safe to an exact standalone subject,
  separated lossless DNS allowlist identity from similarity skeletons and kept
  every independently OCR-observed or pixel-decoded image destination in
  deterministic scoring. Provider-only URL guesses cannot become evidence.
- Added one sink credential sanitizer for reports, appeals, checks/QR, Inline,
  public posts and moderation alerts; report screenshots now claim media
  admission before Bot API file access.
- Added exact admin-role reconciliation for allowlist/email/confirmation
  transitions, meta-intent admission before analytics, step-scoped production
  monitor secrets with SHA-pinned actions and passport/document follow-up
  precedence.
- Added a count-only admin entitlement preflight and verified it against the
  production environment through Railway with ordered pagination, uniqueness
  checks and a stable double-read: Auth users 1, current admins 1, eligible
  admins 1, stale roles 0 and missing roles 0; no identifier or email was logged.
- Independent integration verification passes: 4222/4222 tests, TypeScript,
  production build, npm audit (0), 28-migration local reset, pgTAP 38/38 and
  schema lint. Fixed-state redaction/QR probes pass and the old vulnerable
  contact/provider/domain/Inline/public-post/moderation/passport/media-order
  assertions no longer hold.
- This entry is local-only evidence. Production deployment, migration apply,
  targeted smokes, historical privacy review and the broad real-client RU/UZ/EN
  bot/Inline matrix remain open before the findings can be marked Closed.

## 2026-07-12 - Canonical Telegram contract deployed and verified

- Deployed clean `main` commit `4050172` to Railway as deployment
  `37a91c7a` after the plan was renewed; `/healthz` returned 200.
- The polling-aware production monitor passed home, health, webhook boundaries,
  Telegram `getMe`, pending-update, singleton-leader and AI-provider checks.
- The bounded polling dispatch smoke passed confidence, trusted-person, recheck,
  disagreement and domain-methodology follow-ups. Bot API replies and synthetic
  database rows were cleaned up with read-back.
- BOT-001 now has production evidence. BOT-004 remains in progress until a
  broader real-client RU/UZ/EN transcript matrix is captured; Inline visual QA
  remains a separate real-client gate.

## 2026-07-11 - Canonical Telegram intent/action contract and dialogue DSL

- Derived meta, victim and post-check intent unions from exported typed lists,
  then combined them with panic and fresh-risk-input ids in one namespaced
  contract registry.
- Encoded reply-only, direct-risk and Inline side-effect boundaries, including
  no check rows or trusted-contact effects for helper replies and stateless
  Inline checks.
- Added a 1,248-row generated RU/UZ/EN dialogue corpus covering all 13
  post-check actions across recent risk states, unreadable-image, orphan, stale
  and new-artifact contexts.
- Reconciled the legacy live phrase matrix to its actual 238 rows and mapped
  every row to the canonical contract.
- Verification: all Telegram tests pass (65 files / 3,431 tests), the full
  project suite passes (122 files / 4,135 tests), TypeScript, production build,
  Prettier and ESLint pass, and `npm audit` reports zero vulnerabilities. The
  local Bun audit was unavailable because no Bun executable is installed; no
  dependency or lockfile changed in this work.

## 2026-07-11 - Scheduled monitor follows the polling cutover

- Set the scheduled GitHub production monitor to
  `TELEGRAM_UPDATE_DELIVERY_MODE=polling`. Without that explicit setting, the
  monitor defaulted to webhook mode, treated the intentionally disabled
  webhook 503 as a failure, and expected a webhook URL even though production
  was healthy in polling mode.
- Added a workflow regression assertion so a future edit cannot silently return
  the scheduled monitor to the wrong delivery mode.

## 2026-07-11 - Polling-compatible production Telegram response QA

- Added `prod:telegram-polling-dispatch-smoke` for production after webhook
  cutover. It first requires authenticated polling-health 200, then executes
  synthetic text updates through the real router/handlers without acquiring or
  disturbing the singleton polling leader.
- Added a fail-closed Bot API transport guard: the QA process permits only
  `sendMessage`/`sendChatAction` to `TELEGRAM_QA_CHAT_ID`, rejects another chat,
  credential or Bot API method, records reply text/message ids without secrets,
  and deletes its bot replies afterward.
- The smoke verifies all five post-check action families with exact Russian
  follow-ups: confidence, trusted-person, recheck, disagreement and the long
  suspicious-domain methodology question. It proves they reuse the saved
  result and do not create a new `checks` row. Recheck requires resubmission
  without pretending analysis ran; disagreement stays non-accusatory;
  methodology names evidence/limitations without hidden-verification claims.
- Verification: guard/follow-up tests pass (331/331); the full suite passes
  (120 files / 2881 tests), TypeScript and production build pass, dependency
  audit reports zero vulnerabilities, and ESLint has zero errors plus the same
  eight Fast Refresh warnings. The production run passed against the active
  polling leader. The suspicious URL produced `suspicious` with two
  deterministic reasons; all Bot API replies, synthetic checks and sessions
  were cleaned up with DB read-back.
- Normalized CRLF/LF in the embed-origin migration contract test after the full
  Windows regression exposed an otherwise false missing-`GRANT` failure.
- This is not a fake Inline success: real Inline delivery still requires a real
  Telegram-client `inline_query_id` and remains a separate visual QA gate.

## 2026-07-11 - Durable single-leader Telegram update lifecycle

- Reproduced SG-P1-009: the webhook claimed `update_id`, returned 200 after an
  8-second timeout or handler exception, and then treated every retry as a
  completed duplicate. A crash/ambiguous session write could silently lose the
  user update.
- Added metadata-only processing/completion leases and a fenced singleton
  polling leader. No Telegram payload or user content is persisted. Session
  reads/writes and outbound Bot API effects fail closed when the update or
  leader fence is stale.
- Added single-leader `getUpdates(limit=1)` processing. Offset advances only
  after durable completion; completion-before-offset restarts skip redispatch.
  Webhook mode now returns 503 on handler failure/timeout, and authenticated
  webhook delivery stays retryable after polling cutover.
- Added fail-closed cutover (`telegram:switch-to-polling`), authenticated leader
  health and polling-aware production monitoring. Pending Telegram updates are
  never dropped during cutover.
- Deleted the obsolete claim-only dedup helper. Added pgTAP lifecycle coverage,
  strict RPC adapters, crash-point tests, stale-effect tests and migration
  contract tests.
- Verification: clean local `supabase db reset`, 20/20 pgTAP tests, Supabase DB
  lint with no schema errors, 119 files / 2877 Vitest tests, TypeScript,
  production build and dependency audit all pass. ESLint has zero errors and
  the same eight non-fatal Fast Refresh warnings. Production migrations,
  polling cutover, restart/re-election probe and production monitoring were
  subsequently completed successfully.

## 2026-07-11 - Revalidated Inline and post-check evidence truth

- Reproduced false method claims: `weird_domain` said it was compared with
  brand variants, OneID text said it used domain comparison, and post-check
  snapshots could omit an official-directory match or moderated reports.
- Added one ranked result-reason collector shared by Inline and post-check.
  Weird-domain and OneID copy now names the actual deterministic signal and its
  limitation in RU/UZ/EN.
- Added a shared concrete-artifact detector for bare/IDN domains, URLs,
  Telegram identifiers, actual codes/card/phone values and dangerous files.
  Bare domains now run a new check, while code-safety questions remain helpers.
- Added natural trusted-person/recheck/source variants, including apostrophe-free
  Uzbek, and expanded the enforced live matrix to 239 rows. A newer check now
  wins over older panic context; high-risk next steps use reason-bound advice.
- Inline entity-parse retry now sends real plain text without visible Markdown
  escape slashes, and validated `TELEGRAM_BOT_USERNAME` replaces hard-coded bot
  mentions/buttons safely.
- Regenerated `TELEGRAM_BOT_QA_REPORT.md` with RU/UZ/EN post-check action
  renderings. Telegram API/storage exception logs in touched bot paths now use
  bounded stage codes instead of raw exception/database messages.
- Final local revalidation after both workstreams passes the complete repository
  suite twice (116 files, 2863 tests), the Telegram suite (59 files, 2159 tests),
  five independent runs of the earlier critical 12-file set (634 tests each)
  and the final expanded 14-file focus (713 tests).
  TypeScript, Prettier, both npm dependency audits and the production build pass.
  The old full-repository lint baseline was also removed by formatting its six
  affected files and replacing the mass Inline test's `any` fake with an explicit
  builder type: `npm run lint` now exits successfully with zero errors and eight
  non-fatal Fast Refresh warnings.

## 2026-07-11 - Ordered and observable Telegram session persistence

- Reproduced two session-integrity gaps: handlers commonly ignored
  `{ok:false}` from `saveSession`, and a slow older webhook update could upsert
  over state written by a newer update.
- Added per-user in-process dispatch serialization that retains the queue until
  active work actually settles, plus an async execution context carrying only
  `update_id`, loaded language and a session-storage failure bit.
- Added migration `20260711010000_telegram_session_update_sequence.sql` with
  `last_update_id` and service-role-only `save_telegram_session_sequenced`.
  Atomic patches accept the same/newer update and reject an older update as a
  stale no-op across application instances.
- Storage/RPC failures log only a bounded stage and trigger a plain RU/UZ/EN
  warning that the step was not saved. Webhook session reads now fail closed
  with the same warning instead of routing against a fabricated empty session.
  First-contact RU/UZ/EN language is included in the first partial write.
  Check and unreadable-image results save context before publishing, suppress
  failed/stale saves, and restore the old snapshot on explicit Bot API delivery
  failure before any guardian/trusted-contact follow-on action.
- Independent review then found that monotonic writes are not a durable
  cross-instance queue and that the old 30-second `Promise.race` released work
  without cancelling it. The unsafe timeout was removed. `BOT-005` and
  `SG-P1-009` remain in progress pending a privacy-reviewed durable processing
  lifecycle and crash/restart proof; the earlier local "fixed" conclusion is
  superseded by D-070.
- The sequencing migration has static contract/regression coverage but has not
  been executed against a real local or hosted Postgres instance in this work;
  SQL execution, deployment and crash/restart evidence therefore remain open.
- Added a bounded webhook-delivery containment policy: `setWebhook` now sends
  `max_connections=1`, its Bot API body is regression-tested, and the production
  monitor fails when `getWebhookInfo` reports concurrency drift. This does not
  close `SG-P1-009`; Telegram documents a connection limit, not strict ordering
  or crash recovery, and production still needs re-registration/live proof.

## 2026-07-11 - Complete post-check action routing and provenance

- Reproduced cold-check routing for the user's real phrases: extended
  confidence, methodology, contacting someone trusted, recheck and disagreement
  requests had no complete action taxonomy.
- Added deterministic RU/UZ/EN actions for `methodology`, `trusted_person`,
  `recheck` and `disagreement`, plus broader confidence wording. All actions run
  before `runCheck` only when no new scam payload/artifact is present.
- Trusted-person free text gives manual callback guidance and never triggers a
  Family Shield notification. Recheck copy says raw evidence is not retained
  and requires resubmission instead of pretending that a second check ran.
- `LastCheckSnapshot` now stores a bounded enum-only provenance set: methods,
  source classes and limitations for the three strongest reason codes. Direct
  methodology replies reuse the exhaustive Inline reason policy and make no
  hidden-owner, sender-identity or Telegram-internal claims.
- Added 15 RU/UZ/EN live phrase rows plus handler/no-payload/privacy regressions.
  Focus passes 306/306, Telegram passes 2079/2079, and the first repository run
  passes 2782/2782. `BOT-002`, `BOT-003` and `SG-P1-008` are fixed locally;
  deployment and real multi-turn client transcripts remain open.

## 2026-07-11 - Exhaustive Inline reason explanations

- Replaced the 15-entry optional Inline hint map with exhaustive
  `INLINE_REASON_POLICY: Record<ReasonCode, InlineReasonPolicy>` coverage for
  all 55 deterministic reasons.
- Every reason now selects an explicit priority, evidence method and honest
  limitation in RU/UZ/EN. Domain explanations state that spelling/structure
  were compared and do not claim owner verification; Telegram explanations
  disclaim hidden age/report/spam data; directory, local-report and external
  feed evidence keep their source scopes separate.
- Stronger evidence is chosen by policy rather than detector array order, with
  a deterministic tie-break. All Inline article descriptions now pass through
  the existing 120-character compactor while inserted messages keep the full
  method/limitation text.
- Verification: exhaustive `55 × 3` real-adapter rendering, methodology and
  priority regressions pass 130/130; the Telegram suite passes 2046/2046 and
  the first repository run passes 2749/2749. `SG-P1-007` is fixed locally;
  Telegram Desktop/Android/iOS visual and insertion proof remains open.

## 2026-07-11 - Required production monitor checks fail hard

- Reproduced the scheduled-monitor gap: missing Telegram secrets produced
  skipped warnings while `MONITOR_FAIL_ON_WARN=false`, so the workflow could
  finish green without checking Bot API or webhook-secret behavior.
- Added a pure monitor policy that promotes a required missing secret to a
  failed check and makes any failed check exit non-zero independently of the
  warning policy or alert delivery.
- The scheduled GitHub workflow now explicitly sets
  `MONITOR_REQUIRE_SECRET_CHECKS=true`; optional local runs keep warning-only
  behavior unless the operator opts into required checks.
- Verification: three focused policy/workflow regressions and the first full
  repository run pass 2741/2741 with TypeScript and scoped lint. `PLAT-002` and
  `SG-P1-006` are fixed locally; a real GitHub Actions run and a controlled
  missing-secret/restore drill remain release evidence.

## 2026-07-10 - Fail-closed Telegram reputation moderation sync

- Reproduced five partial-failure paths: confirmed/unverified count errors,
  missing exact count, aggregate upsert error and the admin caller returning
  `{ ok: true }` after the failed write.
- `syncTelegramReputationAfterModeration` now validates both PostgREST errors
  and finite non-negative exact counts, checks the upsert result and propagates
  typed `TelegramReputationSyncError` with a bounded stage code.
- The admin moderation promise now rejects on Telegram aggregate divergence.
  Existing report/entity mutations may already have committed, so the error is
  explicit/retryable rather than a false transaction claim.
- Failure telemetry logs only `count_query`, `confirmed_count`,
  `unverified_count` or `upsert`; database messages and target hashes are not
  logged.
- Verification: original five failures pass, moderation/report/appeal/webhook
  ownership tests pass 158/158, and the repository suite passes 2738/2738 with
  TypeScript/scoped lint. `TRUST-008` and `SG-P1-005` are fixed locally;
  deployment and forced-failure observability smoke remain open.

## 2026-07-10 - Unicode/IDNA brand normalization policy

- Reproduced three deterministic verdict defects: registered Cyrillic
  `анорбанк` plus OTP lost `brand_impersonation` and fell to suspicious;
  `капиталбанк.com`/hybrid IDNs evaded the protected-brand match; and the valid
  DNS-absolute `kapitalbank.uz.` was falsely labeled impersonation.
- Text alias matching now uses Unicode letter/number/mark token boundaries
  instead of ASCII `\b`, including a negative longer-token regression.
- Domain matching now decodes browser Punycode, removes exactly one terminal
  DNS root dot, normalizes NFKC and compares checked labels with registry aliases
  through both visual-confusable and bounded Cyrillic/transliteration keys.
- Added an exhaustive registry corpus for every Cyrillic alias and official
  domain, three mixed-script IDNs, Punycode, trailing-dot and live `runCheck`
  verdict paths.
- Verification: original eight failures pass, risk normalization/core focus
  passes 165/165, and the repository suite passes 2733/2733 with TypeScript and
  scoped lint. `TRUST-007` and `SG-P1-004` are fixed locally; deployment and
  provider/client smoke remain open.

## 2026-07-10 - Exhaustive Telegram protective-action policy

- Reproduced action-first failures for `known_reported`,
  `external_phishing_url` and `external_malware_url`: each could produce a
  deterministic `high_risk` result while Telegram's urgent section asked the
  user to send more context.
- Replaced category membership as the source of truth with exhaustive
  `REASON_PROTECTIVE_ACTION: Record<ReasonCode, ProtectiveActionId | null>`.
  All 55 current codes now require an explicit protective action or intentional
  non-actionable classification at compile time.
- Added direct stop-and-independent-verification copy for confirmed reports,
  phishing/malware feed hits now use link/APK avoidance, and personal-data
  requests receive a document/data warning in RU/UZ/EN.
- Fixed the formatter property generator to derive its runtime reason universe
  from exhaustive `REASON_LABELS`; the previous hand-maintained list silently
  omitted seven newer codes.
- Verification: original eight failures pass, every high-risk single/pair
  ReasonCode combination has non-empty advice, Telegram formatting/follow-up/
  Inline focus passes 227/227, and the repository suite passes 2675/2675 with
  TypeScript/scoped lint. `SG-P1-003` is fixed locally; deploy and RU/UZ/EN
  real-client smoke remain open.

## 2026-07-10 - Typed Risk Passport evidence and clause-local AI safety

- Reproduced an AI provenance flaw where a model-authored `Telegram passport:`
  marker could select the Telegram presenter or promote forged "official/safe"
  lines into canonical evidence sections.
- Risk Passport selection now depends on the deterministic input type only.
  Structured Telegram text is parsed exclusively from a separate typed
  `TelegramPassportEvidence { provenance, text }` object; the model-authored
  `explanation` can never be authorized by an adjacent provenance flag.
- Reproduced mixed-clause safety bypasses such as `Do not share your OTP;
transfer money...` and `Never send your PIN, instead install this APK.`.
  Safety negation is now scoped to sentence/action clauses split at semicolons
  and contrast/sequence boundaries in English, Russian and Uzbek.
- Verification: six mixed-clause adversarial regressions and legitimate
  multi-clause warnings pass, the 31-test provenance/safety focus passed five
  consecutive runs, owning web/embed/Inline/check/image tests passed 198/198,
  and the full repository passed 2667/2667 with TypeScript and scoped lint.
  `TRUST-006`, `SG-P1-001` and `SG-P1-002` are fixed locally; deployment and
  adversarial live smoke remain open.

## 2026-07-10 - Deterministic Telegram rate-limit property precondition

- Repeated full-suite verification exposed seed `-288597371`: the property test
  generated `please check this message`, expected `handleCheck` to call the risk
  core, but the real bot correctly routed that natural phrase as an orphan
  helper intent without creating a check.
- Replaced the invalid pipeline-reachability assumption with generated concrete
  `https://<label>.example/check` targets. The property still proves that text,
  contact, image and voice paths pass only `tg:<from.id>` as the rate-limit key.
- Verification: the property passed five independent 100-run executions and the
  full 2655-test repository suite passed twice consecutively. No production
  handler behavior changed.

## 2026-07-10 - Audited Bun/npm toolchain and loopback-only Vite development

- Confirmed the default Vite config exposed the dev server on IPv6 `::` and the
  npm graph contained seven advisories, including a high-severity Windows Vite
  path bypass. Auditing the Docker-canonical Bun graph additionally found
  vulnerable Babel and js-yaml resolutions.
- Pinned Vite 7.3.6 and overrides for esbuild 0.28.1, Babel 7.29.7, js-yaml
  4.2.0 and the affected brace-expansion branch; regenerated `bun.lock`.
- Changed the committed Vite development default to `127.0.0.1`; an external
  bind now requires an explicit CLI `--host`. A real listener check confirmed
  only `127.0.0.1:8080`.
- Verification: `npm audit` 7->0, `bun audit` 2->0, Bun frozen lock and Bun
  production build passed; toolchain security regressions 3/3 and repository
  tests 2655/2655 passed with TypeScript and scoped lint. Full-repository lint
  retains 116 unrelated baseline errors.
- Docker image build was attempted but Docker Desktop's Linux engine was not
  running; no deployment was performed. `PLAT-001` is locally passed and
  `SG-P0-007` is `Fixed Local / Awaiting Deploy`.

## 2026-07-10 - Fail-closed production shared limiter and bounded fallback

- Reproduced both rate-limit failure modes: a shared RPC error granted the first
  request from a process-local bucket, and the local map retained more than 6100
  live attacker-controlled keys with repeated full-map cleanup.
- Production/Railway now blocks on missing shared configuration, HMAC exception,
  RPC error/exception or invalid response shape. Only non-production local/test
  runtimes may use an in-memory allowance.
- Replaced the unbounded map with validated sliding-window buckets capped at
  4096 TTL/LRU-refreshed keys. New identities fail closed at capacity; a bounded
  full expiry pass can run at most once per second, preventing per-request O(n)
  cleanup during cardinality pressure.
- Verification: original five failure regressions now pass, focused limiter
  policy/cap suite 13/13, owning check/report/appeal/public-post/voice consumers
  534/534 and full repository 2652/2652 passed; TypeScript, scoped changed-file
  lint and production build passed. Full-repository lint retains the same 116
  unrelated baseline errors. Railway forced-failure sink smoke remains open.
- Updated `RES-003` and `SG-P0-005` to `Fixed Local / Awaiting Deploy`.

## 2026-07-10 - Worker-isolated bounded PNG/JPEG QR decoding

- Reproduced the availability finding with a valid 4000x3000 uniform PNG that
  compressed to about 50 KiB but held the Node event loop for about 4.2 seconds
  through a full `jsQR` scan plus overlapping 2x2/3x3/4x4 tile scans.
- Moved base64 parsing, PNG/JPEG expansion, resize and `jsQR` work into one lazy
  per-process worker; the Telegram handler now awaits the asynchronous result.
- Lowered the decode boundary to 4 MiB/4 MP and QR work to 1.5 MP, at most five
  attempts and a 350 ms internal budget. Admission is bounded to four total
  active/queued jobs, each active job has a 900 ms deadline, and the worker has
  explicit V8 memory limits. All failure/saturation paths return empty evidence.
- Verification: real PNG/JPEG QR and bounded-queue regressions plus Telegram
  webhook focus 104/104, full repository 2645/2645, TypeScript, scoped changed-
  file lint and production build passed. A local four-job 3.6 MP burst took
  about 91 ms with roughly 11 ms maximum observed event-loop lag; this is not a
  production p99 or soak result. Full-repository lint still has the same 116
  unrelated baseline errors.
- Updated `RES-001`/`RES-002` and `SG-P0-003` to local-fixed states;
  `RES-004` remains in progress until Railway corpus, CPU/RAM, 60-minute soak and
  worker crash/restart evidence exists.

## 2026-07-10 - Fail-closed persistent display and Telegram-scheme redaction

- Reproduced seven privacy failures: malformed URL target values could survive
  in report/appeal displays, while `tg://` and `telegram://` identifiers could
  survive report/appeal narratives and a Telegram report session draft.
- `maskForDisplay` now returns `[link]` when URL/APK parsing fails instead of
  returning raw input. Valid HTTP(S) URLs still produce a host/path indicator.
- `redactText` now removes complete Telegram custom-scheme identifiers before
  persistence, session storage or moderation presentation, including mixed-case
  login, invite and user/hash variants.
- Verification: original reproducer 7/7, focused boundary suite 71/71, owning
  risk/report/appeal/Telegram suite 528/528 and full repository suite 2643/2643
  passed; TypeScript, scoped changed-file lint and production build also passed.
  Full-repository lint still fails on 116 pre-existing errors in unrelated files
  and remains baseline cleanup work. Deployment and live smoke remain open.
- Updated `TRUST-005` and `SG-P0-006` to
  `Fixed Local / Awaiting Deploy` in the release tracker.

## 2026-07-10 - Origin-only external URL reputation boundary

- Reproduced a path-embedded bearer value in the Google Safe Browsing request
  body even though userinfo, query and fragment were already removed.
- `normalizeUrlForReputationProvider` now emits only HTTP(S) scheme/origin;
  userinfo, path, query and fragment never cross the provider boundary.
- Decoupled local URL-rule input from provider normalization so `.apk` and other
  path signals continue to be evaluated locally on the full cleaned URL.
- Verification: provider/privacy focus 52/52, full risk suite 479/479 and full
  repository suite 2633/2633 passed; TypeScript, scoped lint and production build
  also passed. Deployment and provider-compatibility smoke remain open.
- Updated `TRUST-004` and `SG-P0-004` to `Fixed Local / Awaiting Deploy`.

## 2026-07-10 - Official Telegram contact freshness gate

- Reproduced that `@naboruz`, last checked on 2026-06-03, still returned a
  verified-contact match after its evidence was stale.
- Added a 30-day freshness policy for mutable Telegram handles and an active-only
  contact view used by exact lookup, public directory search/counts and actions.
- All eight currently expired Telegram seed handles now fail closed: no badge,
  link, public count or verdict effect until primary-source re-verification.
- Verification: registry/directory/check focus 47/47 and full repository suite
  2631/2631 passed; TypeScript, scoped lint and production build also passed.
  The broader non-Telegram provenance lifecycle remains open under `TRUST-002`.
- Updated `SG-P0-002` to `Fixed Local / Awaiting Deploy`; `TRUST-002` remains
  `In Progress` rather than being overstated as complete.

## 2026-07-10 - Verified-contact false-Safe trust hardening

- Reproduced a false-Safe result when official short code `1344` appeared beside
  bank impersonation and urgency signals that were absent from the old manual
  dangerous-code denylist.
- Added exhaustive `REASON_TRUST_IMPACT` compile-time classification for all 55
  ReasonCodes: 52 risk, two informational and one protective.
- Verified-contact protection and the legacy `verified_official` reason can now
  return Safe only when no risk-classified sibling reason exists.
- Verification: focused trust regressions 27/27, full risk suite 475/475 and
  full repository suite 2629/2629 passed; TypeScript, scoped lint and production
  build also passed. Production deployment and real-client conflict evidence
  remain open.
- Updated the release tracker: `TRUST-001`, `TRUST-003` and `SG-P0-001` are
  `Fixed Local / Awaiting Deploy`.

## 2026-07-10 - Telegram Inline P0 privacy and delivery hardening

- Reproduced a raw OTP disclosure in human-intent preflight cards using
  `мне пишет какой то незнакомый человек 123456`; the value could be inserted
  into another chat without passing `runCheck` masking.
- Added an Inline presentation boundary that re-masks all displays and fails
  malformed URL displays closed to `[link]`.
- First-contact Inline routing now passes Telegram's RU/UZ/EN language hint to
  `loadSession`; saved language remains authoritative.
- Inline typing skips external URL-reputation providers and enforces the Bot
  API 256-character query boundary.
- `answerInlineQuery` now preserves non-sensitive Bot API failure metadata;
  the handler logs only a generic failure/code and retries entity-parse errors
  once without `parse_mode`.
- Rebuilt `FEATURE_USER_STORY_TRACKER.xlsx` with formula-driven status counts,
  explicit Release Gates and Current Security Queue sheets, and repaired legacy
  priority-column drift.
- Verification: focused Inline/router/API tests 221/221, full Telegram suite
  2026/2026, and full repository suite 2627/2627 passed; TypeScript and the
  production build also passed. Production deployment and real-client evidence
  remain open.

## 2026-07-09 - Telegram image fallback and residual phrase QA

- Live Telegram image QA confirmed that fake Telegram deletion/freeze screenshots
  can still fall into the unreadable-image fallback when the vision provider
  returns no usable text.
- Added missing structured-image prompt hints for `telegram_account_takeover`
  and `fake_device_security_popup`, with explicit rules for Telegram
  account-deletion/verification/freeze screenshots and fake Apple/iOS/Android
  security popups.
- Added a dedicated unreadable-image fallback option for Telegram account
  takeover screenshots so users get `Settings > Devices` / 2FA guidance instead
  of a generic dead end.
- Current regression before deploy: `src/lib/telegram` 1886/1886 and
  `src/lib/risk` 473/473 passed.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx` row `P1-2026-07-09-004`.

## 2026-07-09 - Family Shield duplicate-alert cooldown

- Followed up on the real trusted-contact chat screenshot where two redacted
  Family Shield alerts arrived a few minutes apart.
- Changed the proactive high-risk auto-notify path to use a 30-minute cooldown
  while keeping manual `notifyTrustedContact` alerts on the short default
  cooldown.
- Verification: focused Family Shield/follow-up tests passed (255/255), and
  full `src/lib/telegram` passed (1879/1879).
- Deployed `5c01b8c` via Railway deployment
  `5b7cf352-45be-4c01-bba1-fb388239ff47` with status `SUCCESS`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: row `P2-2026-07-02-004`, owner
  note and `ERR-2026-07-09-009`.

## 2026-07-09 - Residual Telegram text/context QA rerun

- Re-ran production Telegram smokes against Railway production after the Family
  Shield proactive alert and context-stitching fixes.
- Passed: `prod:telegram-context-smoke`, `prod:telegram-user-story-smoke`,
  `prod:telegram-live-qa-smoke`, `prod:telegram-false-positive-smoke`,
  `prod:telegram-inline-smoke` and `prod:telegram-voice-out-smoke`.
- Focused regression tests passed: `victim-intent` 128/128, `inline` 114/114
  and `webhook.integration` 97/97.
- The user-reported context cases are confirmed covered: low-signal link
  preface -> URL check -> why follow-up, and channel-admin preface -> SMS-code
  direct guidance.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx` row `T-049`. `T-048` remains open
  for manual real photo/screenshot spot-checks once vision provider quota is
  available.

## 2026-07-09 - Family Shield proactive alert

- Implemented opt-in proactive trusted-person notification for private
  high-risk Telegram checks by reusing the existing `notifyTrustedContact`
  Family Shield path.
- Kept the alert redacted: the auto path passes only guardian id, language and a
  safe display name; no checked text, links, numbers, screenshots, codes, card
  data or raw evidence are sent to the trusted contact.
- Added a trusted-contact acknowledgement callback (`family:trusted_ack`) beside
  the existing opt-out button.
- Verification: focused Family Shield/follow-up/webhook/i18n tests passed
  (1020/1020), and the full `src/lib/telegram` suite passed (1878/1878).
- Post-deploy verification: Railway deployment
  `3d187870-ce65-461b-b8b3-60c9a2ceafca` is `SUCCESS`; production Telegram
  context/live/inline/user-story smokes passed, and synthetic `prod:family-smoke`
  passed create invite -> accept -> safe notify failure -> revoke -> `open_rows=0`.
  Manual real two-account live smoke also passed: the trusted contact received
  the proactive alert at 17:42 and the manual `Позвать близкого` alert at 17:46,
  both redacted and with acknowledgement/opt-out controls.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx` row `P2-2026-07-02-004`.

## 2026-07-09 - P1 Telegram context-stitching QA

- Fixed the direct-chat channel-admin preface so it routes to
  Telegram-message context guidance instead of a cold risk check.
- Added `prod:telegram-context-smoke` for low-signal link preface -> URL check
  -> why follow-up, plus channel-admin preface -> SMS-code direct guidance.
- Deployed `0cf0ee2` via Railway deployment
  `9c12ac76-1bca-4a8c-b13e-78a966411feb`; production context, live, inline
  and user-story smokes passed.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx` rows `P1-2026-07-09-003`,
  `QA-2026-07-09-007` and `ERR-2026-07-09-007`.

## 2026-07-09 - QA-001 P1 web/Telegram production flow rerun

- Added `prod:web-p1-smoke` for the P1 web/admin path: homepage, report and
  appeal pages, rules-only high-risk web check, synthetic report/appeal
  submission, admin reject/keep-reputation moderation, audit log and cleanup.
- Re-ran production Telegram smokes for user-story, private/group scope,
  live QR/Guardian, inline mode and base prod health.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: QA-001 is re-verified on
  2026-07-09 and `QA-2026-07-09-006` records the exact commands/results.
- Next queue is UX/logistics residual QA: direct/inline context stitching,
  short UZ voice spot-checks after STT reset, image provider spot-checks, then
  Family Shield proactive delivery.

## 2026-07-08 - TG-017 News-derived UZ live phrase expansion

- Expanded the Telegram live victim-phrase regression lock to 202 cases and the
  inline mass smoke to 105 phrases, using recent Uzbekistan scam-news examples
  and user live QA screenshots.
- Added coverage for foreign-number bank/operator calls (`+98`, `+988`, `+996`),
  Telegram deletion/Premium/voting takeovers, APK court-summons files, fake
  voice/GIF/PPTX files, Apple ID/iOS popups, utility-payment links, MIB/gov calls,
  Open Budget/DMED/game-bonus prompts, money-mule/ATM requests and "acquaintance
  asks to borrow money" wording.
- Added the short live/inline phrase `мне предлагают бот для заработка 500 тысяч
сум в день` after live Telegram QA exposed a cold fallback.
- Added the live/inline phrase `в телеграм пришел файл повестка.pdf.apk` after
  QA showed that `pdf.apk` was being treated as a domain-like artifact before
  the file-received intent could answer calmly.
- Polished live inline QA for `мне прислали ссылку проголосовать за лучшую
мамочку`: the preview now uses the voting/channel warning instead of the
  generic link-request card.
- Polished the next live inline QA slice: Apple/iOS "install protection from
  viruses" phrases now keep the Apple/iOS warning instead of the generic
  file-virus card, and the phone-borrowing preview no longer contains the
  English word `unlocked` in Russian UI.
- Tightened victim-intent priority so Apple ID popups are not swallowed by the
  generic Telegram-account rule, and acquaintance money requests do not steal
  romance/dating scam routing.
- Verification: focused victim-intent/follow-up/inline tests and the full
  `src/lib/telegram` Vitest suite passed.

## 2026-07-06 - TG-016 Inline transfer-card preview priority

- Live Telegram Web inline QA found that `@scamguard_bot мне сказали сделать
перевод на карту` still showed the card-data preview instead of the transfer
  preview. The normal chat route was already correct; this was isolated to the
  inline human-intent classifier.
- Kept delivery, prize-fee, relative-distress, job and travel/migration previews
  above generic transfer, and added a card guard so payment/transfer wording is
  not swallowed just because the destination is a card.
- Verification: focused inline tests and the full `src/lib/telegram` suite
  passed.

## 2026-07-06 - TG-016 Telegram live victim phrase matrix expansion

- Expanded the real Telegram victim-phrase regression matrix from 79 to 164
  cases, based on live inline/chat screenshots and the user-observed cold
  fallbacks for phrases like "мне пишет незнакомый человек", "он хочет смс код",
  "как мне связаться с банком", "меня пытаются обмануть", "мне сказали сделать
  перевод на карту" and Uzbek/English equivalents.
- Hardened victim-intent routing so implicit user frames such as "просят",
  "спрашивают", "нужно" and "they asked..." are treated as a request from the
  user's situation, not as a raw scam payload. Code, card, transfer, APK/remote
  access, file/link, support impersonation, romance/contact, unknown-contact and
  personal-data branches now catch more natural phrasing.
- Fixed follow-up priority regressions where concrete new risk phrases could be
  swallowed by generic "contact the bank" follow-up logic, and where "звонить"
  accidentally matched live-call panic routing.
- Verification: `telegram-live-phrase-matrix.ts`, focused follow-up/victim
  tests and the full `src/lib/telegram` Vitest suite passed.

## 2026-07-05 - TG-015 Telegram inline human phrase corpus

- Researched common scam-request phrasing from bank/security guidance and
  consumer anti-fraud sources, then added
  `ai_docs/TELEGRAM_INLINE_PHRASE_CORPUS.md` as the seed corpus for low-signal
  inline queries.
- Expanded Telegram inline preview classification from the single bare-link
  fallback into a human-intent layer: link, code, confirmation, card, transfer,
  app/APK, bank call, personal data, delivery payment, prize fee,
  OneID/government, SIM swap, relative distress, job-fee, investment/crypto,
  romance-money and conversational safety requests.
- Important product boundary: these classes only improve `unknown`/`suspicious`
  inline previews and next-step copy. They do not raise the risk score without
  the actual artifact/message, keeping inline mode honest.
- Added regression coverage for representative Russian user phrases across all
  16 classes.
- Follow-up from live Telegram screenshots: added three more low-signal human
  intents for `мне пишет незнакомый человек`, `одноклассник, но я не уверен что
это он`, and `приглашают в канал для заработка`.
- Follow-up from another live Telegram pass: added previews for `я только что
передал код из СМС`, `как мне связаться с банком`, `меня пытаются обмануть`
  and `голосование/канал + ссылка`; softened link/code preview copy so it gives
  a calmer safe next step instead of a technical label.
- Follow-up conversational fallback slice: added previews for `что мне делать
дальше?`, `можно ли ему отвечать?`, `это безопасно или мошенники?` and generic
  channel/chat invitations. These still do not invent a risk verdict; they pause
  the user and ask for facts.
- Live inline follow-up: multiline context such as `мне пишет незнакомый человек`
  plus `он хочет смс код` now prioritizes the concrete code request over the
  generic unknown-contact card. Inline rate-limit copy now includes retry
  seconds.

## 2026-07-05 - TG-015 Telegram inline preview UX polish

- Reviewed live Telegram inline screenshots for phone, free text and Telegram
  username/link checks. The scoring was honest, but the preview copy looked
  unhelpful in the Telegram result list: `Паспорт номера`,
  `Недостаточно данных` and `Telegram-паспорт` were too abstract and were
  truncated before the useful next step.
- Updated inline result titles/descriptions without changing scoring,
  persistence or moderator delivery:
  - low-signal phone checks now lead with `Номер: жалоб не найдено` /
    `Номер: есть жалобы` and explicitly say that missing reports are not a
    safety guarantee;
  - low-signal Telegram username checks now lead with "Telegram: нужен
    контекст" and ask for the request text, post link or screenshot;
  - low-signal free-text checks now ask for the full message instead of
    presenting a cold insufficient-data result.
- Added regression coverage for the user-observed `Мне пишет мошенник` inline
  case and updated the real-client inline QA checklist.
- Added a separate bare-link-request preview for phrases such as
  `у меня просят перейти по ссылке`: inline now asks for the actual URL and
  warns not to open it until checked, instead of falling back to a generic
  insufficient-context result.

## 2026-07-05 - TG-014 UZ Voice QA matrix expansion

- Added a committed Uzbek Voice-in QA matrix covering emergency routes, negated
  acknowledgements and normal-check fallthroughs while the bot UI may remain in
  Russian.
- Expanded the STT replay corpus with Uzbek phrases for OTP, Telegram code,
  APK/SMS permission, AnyDesk screen access, money transfer, card/PIN data,
  Telegram login QR/lost access, active operator call, future "I will not send
  code/card data" refusals, gift-link and delivery-payment requests.
- Fixed a route-priority regression found by the matrix:
  `Men ilovani o'rnatdim va SMSga ruxsat berdim` now routes to APK/remote-access
  SOS (`panic:2`) instead of sent-code SOS (`panic:1`).
- Added normal-check replay assertions so suspicious-but-not-already-happened
  UZ voice transcripts must reach `runCheck` instead of emergency routing.

## 2026-07-05 - TG-014 Voice-in Uzbek STT language drift

- Reviewed a live Telegram voice note where the user said
  `Men SMS kod yubormadim`, but STT returned
  `Men SMS-kort, jo, hvorfor med dem.` and the bot fell through to the generic
  "not enough data" card.
- Root cause: Telegram UI language is not the same as spoken voice language.
  Many users keep the bot UI in Russian while sending Uzbek voice notes, so
  hard STT language hints from `ctx.session.lang` can degrade recognition.
- Updated Voice-in transcription prompts for both Gemini and
  OpenAI-compatible STT to keep detection multilingual across Russian, Uzbek
  (Latin/Cyrillic) and English, with Uzbek-Latin anti-scam vocabulary such as
  `SMS-kod`, `kod yubordim` and `kod yubormadim`.
- Added a defensive normalizer for the captured live provider artifact
  `SMS-kort / hvorfor med dem` so it maps back to the intended negated Uzbek
  code phrase instead of producing a generic risk card.
- Verification passed: focused voice transcription tests, focused Telegram
  voice handler tests, full `src/lib/risk` and full `src/lib/telegram` suites.

## 2026-07-05 - TG-014 Negated Voice-in acknowledgement UX

- Reviewed the post-deploy live Telegram reply for
  `Men esa SMS-kod yubormadim.`. The false SOS was gone, but the bot still
  fell through to the generic "not enough data" risk card.
- Added a dedicated negated already-done Voice-in acknowledgement before
  `runCheck`: short "I did not send / enter / scan / transfer" transcripts now
  get calm safety guidance and emergency fallback buttons without creating a
  generic check result.
- Added sanitized live replay fixture
  `uz-live-not-sent-code-telegram-002`; the replay corpus now distinguishes
  `negated_ack` from ordinary `normal_check`.

## 2026-07-05 - TG-014 Live UZ negated Voice-in false SOS fix

- Reviewed live Telegram production replies for two fresh user-sent voice notes.
  Positive UZ sent-code voice routed correctly, but negated
  `Men SMS-kod yubormadim.` ("I did not send the SMS code") falsely opened
  the already-sent-code SOS flow.
- Added punctuation-aware UZ negated Voice-in matching, split-form negation
  variants such as `yubor madim`, and SMS-code positive-verb guards so
  `yubor...` no longer matches `yubormadim`.
- Added sanitized live replay fixture
  `uz-live-not-sent-code-telegram-001` with no raw audio, Telegram file id or
  provider payload. Verification passed: focused voice handler test, scoped
  eslint and full Telegram suite.
- Deployed commit `a5120cb` to Railway; production smoke and production
  security smoke passed with the public production URL/header checks.

## 2026-07-04 - TG-014 Live RU/UZ Voice-in/STT replay fix

- Reviewed live Telegram voice-note replies from user-provided RU/UZ samples.
  RU "I already sent SMS code" routed correctly to SOS, while UZ
  "Men SMS kodni yubordim/yubardim" was transcribed well but fell through to
  "not enough data".
- Added tolerant UZ Voice-in routing for provider variants such as
  `yubardim` and object-first wording (`SMS kodni yubardim`), plus sanitized
  live replay rows for UZ sent-code and RU negated-code transcripts.
- Verification passed: focused voice handler + STT fixture collector tests,
  full Telegram suite and scoped eslint. Remaining UX note: RU negated
  "I did not send SMS code" does not open SOS, but the ordinary risk card can
  still feel too cautionary; track as conversational polish.
- Deployed commit `d9fe6f2` to Railway; production smoke and production
  security smoke passed with the public production URL/header checks.

## 2026-07-04 - TG-014 Voice-in/STT provider transcript capture

- Captured the first real-provider sanitized Voice-in/STT replay rows from
  local ignored audio fixtures through the production STT provider:
  English live-call pressure routes to SOS `panic:6`, while English negated
  "I did not send the SMS code" remains on the normal check path.
- Added `--timeout-ms` to `scripts/transcribe-voice-stt-fixtures.ts` after the
  first Russian Windows TTS attempt hit the 15s collector timeout/noisy-empty
  transcript path; poor local TTS captures were not committed to the replay
  corpus.
- Verification passed: focused voice handler + STT fixture collector tests and
  scoped eslint.

## 2026-07-04 - TG-015 Voice-out production smoke and release QA

- Revalidated prerecorded SOS Voice-out assets after the post-deploy backlog:
  all 45 RU/UZ/EN `.ogg` files for panic scenarios 1-15 passed
  `npm run tts:validate-assets`.
- Focused Telegram regressions passed:
  `voice-out.server.test.ts`, `emergency-followup.test.ts` and
  `webhook.integration.test.ts` (`3 files / 135 tests`).
- With explicit action-time approval, production Telegram Voice-out smoke
  passed against Railway: Telegram accepted `panic-6` RU/UZ/EN OGG audio,
  the production webhook accepted a `voiceout:panic:6` callback, and cleanup
  completed. The app-generated audio may remain in the QA chat as evidence.

## 2026-07-04 - TG-014 Voice-in/STT Uzbek Cyrillic corpus

- Extended Voice-in/STT already-happened emergency routing for Uzbek Cyrillic
  transcripts after the live QA backlog called out UZ Cyrillic as a gap.
- Added normalization for common Uzbek Cyrillic letters (`ў/қ/ғ/ҳ`) and replay
  fixtures for SMS-code sent, money transferred, live-call pressure and a
  negated "did not send code" phrase.
- Verification passed: focused voice handler test and full Telegram suite.

## 2026-07-02 - Conversation memory reconciliation

- Reconciled the stale pig-butchering / romance-grooming note in
  `OPEN_TASKS.md`. Explicit `/conversation` mode already stores only derived
  stage/action/reason metadata and catches romance/trust-building followed by
  investment/crypto/payment pressure without persisting raw chat text.
- Clarified the product boundary: passive always-on profiling across ordinary
  messages remains intentionally unshipped until a separate privacy/product
  decision. The supported shipped path is user-triggered conversation analysis.
- Verification passed: focused conversation-check and webhook integration tests
  plus scoped TS eslint.

## 2026-07-02 - TG-006 Risk Passport tracker reconciliation

- Reconciled the stale `TG-006` Partial tracker row after ROAD-011/013/014/015
  and the inline QA follow-ups. `TG-006` is now `Implemented`.
- Evidence now points to the focused Risk Passport / formatter / public
  metadata / inline regression slice covering low-signal phone and Telegram
  username passports, Bot API limitation copy, moderated phone reputation
  source/scope and no owner/hidden-label/account-age claims.
- `FEATURE_USER_STORY_TRACKER.xlsx` now shows `Implemented=64`,
  `Partial=0`, `Planned=0`; remaining work is external live evidence capture:
  real Telegram-client inline screenshots and real STT provider examples.

## 2026-07-02 - ROAD-017 Telegram inline client QA checklist

- Added `ai_docs/TELEGRAM_INLINE_QA.md` for real Telegram-client inline visual
  QA. The checklist covers empty, high-risk, low-signal phone, low-signal
  Telegram username, long-query, EN and UZ cases.
- Documented that no third chat is required; use an existing non-moderator
  place where test messages are safe. Inline preview/insert must not notify the
  moderator chat.
- Added `private/telegram-inline-qa/` to `.gitignore` so raw local screenshots
  stay out of commits unless explicitly sanitized and reviewed.

## 2026-07-02 - ROAD-016 Production Telegram inline smoke

- Added `scripts/prod-telegram-inline-smoke.ts` and
  `npm run prod:telegram-inline-smoke` for production webhook validation of
  Telegram inline-mode queries.
- The smoke sends synthetic inline updates for high-risk text, low-signal phone
  and low-signal Telegram username previews, then verifies webhook `200`,
  no `checks` persistence and no chat-scoped session persistence.
- Ran through Railway production env against the deployed app; passed and
  cleaned its synthetic webhook/session rows. This validates production webhook
  behavior, not visual Telegram-client rendering.

## 2026-07-02 - TG-014 Voice-in/STT collector validation hardening

- Hardened `scripts/transcribe-voice-stt-fixtures.ts` so manifest parsing,
  audio extension mapping, expected-fragment checks and local audio path
  resolution are testable before any provider call.
- Local `audioPath` values are now scoped to the manifest directory to avoid
  accidentally reading and sending unrelated local files to the STT provider.
- Verification passed: new fixture collector helper tests, focused voice handler
  tests, full Telegram suite, full risk suite, scoped TS eslint, script `--help`
  and `tsc --noEmit`.

## 2026-07-02 - ROAD-015 Inline QA regression matrix

- Expanded Telegram inline-mode regression coverage for low-signal Telegram
  username checks and phone reputation source/scope rendering.
- The inline QA matrix now covers: non-persistent rules-only execution,
  high-risk action-first cards, low-signal phone Risk Passport, low-signal
  Telegram Risk Passport, and phone reputation source/confidence/scope copy.
- Verification passed: focused inline handler tests, full Telegram suite, full
  risk suite, scoped TS eslint and `tsc --noEmit`.

## 2026-07-02 - ROAD-014 Phone Reputation v2 wording/source confidence

- Added shared RU/UZ/EN Phone Reputation presentation helpers for confirmed
  moderated report evidence, conservative confidence labels, no-report wording
  and public-scope limits.
- Low-signal Phone Passport, inline Risk Passport and high-risk Telegram result
  cards now explicitly say the source is Ishonch Guard moderator-confirmed
  reports, not unverified complaints, owner data, carrier data or hidden
  external labels.
- Verification passed: focused phone reputation / risk passport / inline /
  formatter tests, full Telegram suite, full risk suite, scoped TS eslint and
  `tsc --noEmit`.

## 2026-07-02 - ROAD-013 Inline Risk Passport QA slice

- Telegram inline-mode checks now reuse the shared Risk Passport presenter for
  low-signal phone/Telegram results. Inline `@scamguard_bot <phone>` answers no
  longer lead with a generic "not enough data" card when the honest response is
  a number/profile passport with limitations and the next context question.
- High-risk and suspicious inline results remain action-first and continue to
  use the short verdict/safe-step card.
- Verification passed: focused inline handler tests, risk-passport and
  phone-reputation regressions, full Telegram suite, scoped TS eslint and
  `tsc --noEmit`.

## 2026-07-02 - TG-014 Voice-in/STT fixture workflow

- Extracted Voice-in/STT transcript replay rows into
  `src/lib/telegram/voice-stt-provider-fixtures.ts` so RU/UZ/EN provider-like
  transcripts and negated phrases have one reviewable corpus.
- Added `scripts/transcribe-voice-stt-fixtures.ts` and
  `npm run stt:transcribe-fixtures` for local real-provider capture from
  ignored audio manifests. The script uses `transcribeVoiceCore`, emits only
  sanitized transcripts, and never commits raw audio.
- Documented the workflow in `ai_docs/VOICE_STT_FIXTURES.md` and ignored
  `private/voice-stt-fixtures/` plus local transcript captures.
- Verification passed: focused voice test, full Telegram suite, voice/rules
  risk regressions, scoped eslint, `tsc --noEmit`, and script `--help`.

## 2026-07-02 - TG-014 Voice-in/STT EN provider-like corpus

- Extended direct Voice-in/STT emergency routing for English provider-like
  transcripts: already-sent SMS code, card back digits, AnyDesk/screen access,
  money transfer, Telegram login QR and live-call phrases now open the matching
  SOS scenario instead of falling through to a generic risk card.
- Added English negated already-happened guards so "I did not send the SMS
  code", "I didn't scan the Telegram QR" and similar phrases continue through
  the normal check pipeline.
- Verification passed: full Telegram suite, voice/rules risk regressions,
  scoped eslint and `tsc --noEmit`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-014` now records the
  RU/UZ/EN provider-like STT corpus, `QA-2026-07-02-012` was added, and the
  next queue item remains real provider audio/transcript fixture collection
  before Phone Reputation v2 / Inline QA.

## 2026-07-02 - TG-014 Voice-in/STT corpus tuning

- Added a first production-like STT transcript corpus for already-happened
  emergencies without storing raw audio fixtures: RU/UZ card security-code,
  remote-access and Telegram login-QR phrases now route directly to the
  matching SOS scenario.
- Added negated-phrase protection so transcripts such as "I did not send the
  code" or "I did not scan the Telegram QR" continue through the normal check
  pipeline instead of opening an already-happened emergency flow.
- Verification passed: focused voice handler tests, full Telegram suite,
  voice/rules risk regressions, scoped eslint and `tsc --noEmit`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-014` records the
  2026-07-02 STT corpus slice, `QA-2026-07-02-011` was added, and the next
  queue item is real provider audio/transcript fixture expansion before Phone
  Reputation v2 / Inline QA.

## 2026-07-02 - TG-015 Voice-out prerecorded SOS revalidation

- Revalidated committed static SOS audio: `npm run tts:validate-assets`
  confirmed 45 RU/UZ/EN OGG assets for panic scenarios 1-15, total 1,683,698
  bytes, with durations from 7.73s to 14.05s.
- Re-ran Voice-out routing regressions: prerecorded panic audio is still sent
  before TTS budget/provider calls, and OGG remains preferred over WAV fallback.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-015` now records the
  2026-07-02 revalidation, `QA-2026-07-02-010` was added, and Status Summary
  now points to Voice-in/STT real-audio corpus and confidence tuning.
- Marked the Voice-out pre-record architecture pass complete in
  `OPEN_TASKS.md`; human listen-through remains a release QA checklist item,
  not an architecture blocker.

## 2026-07-02 - UX-001 emergency profile-map refactor

- Added `PANIC_SCENARIO_IDS` and `PANIC_SCENARIO_PROFILES` in
  `src/lib/telegram/emergency.ts` so each SOS case has one source of truth for
  profile, menu page, contact-button role and family-first keyboard behavior.
- Rebuilt `/panic` menu pagination, panic-id parsing, contact-button labels and
  follow-up keyboard ordering from the shared profile map. Existing SOS copy is
  intentionally unchanged.
- Updated emergency well-formedness and i18n completeness tests to iterate over
  `PANIC_SCENARIO_IDS` instead of duplicating `1..15`.
- Verification passed: targeted emergency/i18n/voice-out tests
  (5 files / 767 tests), full Telegram suite (49 files / 1333 tests), `tsc`
  and scoped eslint.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `UX-001 / T-047` is now
  Implemented/Passed, `QA-2026-07-02-009` was added, and the next queue item is
  the next narrow UX/logistics polish slice.

## 2026-07-02 - SEC-002 CSP/security headers final reconciliation

- Added `src/server.security-headers.test.ts`, covering baseline response
  security headers, main-site `frame-ancestors 'none'`, per-request script
  nonce insertion and `/embed/check` framing behavior without
  `X-Frame-Options`.
- Extended `prod-security-smoke` with optional public URL checks for
  `/healthz` and `/embed/check` security headers while keeping the existing
  Supabase/RLS-only behavior when no URL is supplied.
- Ran production security smoke with
  `https://scam-guard-main-production.up.railway.app`; public header checks and
  Supabase/RLS checks passed.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `SEC-002 / T-046` is now
  Implemented/Passed, `QA-2026-07-02-008` was added, and the next queue item is
  UX/logistics fixes.

## 2026-07-02 - QA-001 P1 web/Telegram user-story QA flows

- Ran production web QA against
  `https://scam-guard-main-production.up.railway.app`: homepage high-risk
  result, `/report` success and `/appeal` success passed with synthetic marker
  `QA-P1-WEB-20260702071934`.
- Ran production admin moderation smoke for the same marker; report rejection,
  appeal keep-reputation decision, audit entries and cleanup passed.
- Ran production Telegram user-story, live QR/Guardian and private/group scope
  smokes. User-facing Telegram smoke messages were sent only to an existing
  private non-moderation QA chat, not the moderator chat.
- Updated `prod-security-smoke` so `PGRST205` from anon reads is treated as a
  valid denied/hidden response for service-role-only tables; service-role count
  still verifies `embed_origin_events` exists.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `QA-001 / T-045` is now
  Implemented/Passed, `QA-2026-07-02-007` was added, and the next queue item is
  `T-046 / SEC-002 CSP/security headers final reconciliation`.

## 2026-07-02 - ROAD-012 embed origin analytics/logging

- Added service-role-only `public.embed_origin_events` telemetry for
  `/embed/check`, with RLS enabled, public client roles revoked and 180-day
  retention through `private.prune_app_retention()`.
- Added `src/lib/embed-origin-analytics.server.ts` to normalize embed telemetry
  context to `partner`, `referrer_origin` and `referrer_host` only. It never
  stores raw input, redacted input, input hashes, full referrer URLs, paths,
  query strings, fragments, phone numbers or Telegram ids.
- Updated the iframe check widget to send a small embed context from
  `document.referrer`; the server validates and strips it before inserting
  aggregate check/meta-intent result shape.
- Added unit, server-function and static migration regressions for privacy-safe
  telemetry boundaries.
- Supabase local DB advisors/lint were attempted but blocked because the local
  database was not running on `127.0.0.1:54322`.
- Next queue item: P1 user-story QA for web and Telegram flows.

## 2026-07-02 - ROAD-011 web/embed Risk Passport compact reuse

- Added `src/lib/risk/risk-passport.ts`, a shared pure Risk Passport presenter
  for shallow phone and Telegram checks. It produces compact sections for
  visible metadata, directory status, Ishonch reputation, honest limitations,
  meaning and next step without changing scoring or persistence.
- Updated the website result card to show the shared passport structure for
  low-signal phone/Telegram checks instead of duplicating generic explanation
  text; high-risk and suspicious results remain action-first.
- Updated `/embed/check` to render a height-conscious passport summary and hide
  generic reasons/advice duplication for passport cards, keeping partner
  iframes compact.
- Added pure presenter tests and an SSR component regression for the embed
  passport branch, including privacy checks that raw phone digits are not
  rendered.
- Next queue item: `T-044 / ROAD-012 Embed origin analytics/logging`.

## 2026-07-02 - ROAD-010 private moderation chat research alerts

- Extended `src/lib/telegram/moderation-notifier.server.ts` with a
  high-signal research alert path built only from public scheme-trend metadata.
- Added `buildHighSignalResearchModerationNotice()` and
  `notifyHighSignalResearchModeration()` for operator-only research review;
  the alert includes category, severity/source and reason-code ids, not raw
  posts, user reports, OCR, screenshots, full URLs, phone numbers or user ids.
- Kept the existing moderation chat contract: `TELEGRAM_MODERATION_CHAT_ID` is
  optional, alerts use the same admin link button, and
  `npm run moderation:smoke -- --research` can explicitly verify the research
  workflow.
- Added tests for research-item selection, redaction and Telegram send
  payloads.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `ROAD-010` is now Implemented,
  `T-042` is Passed, `QA-2026-07-02-004` was added, and the next queue item is
  `T-043 / ROAD-011 Web/embed Risk Passport compact reuse`.

## 2026-07-02 - ROAD-009 Weekly Scam Digest data model

- Refactored Telegram `/digest` from a single static text blob into
  `WEEKLY_SCAM_DIGEST_ENTRIES` records with `source`, `status`, `updatedAt`,
  `publishMode: "manual"`, tags and localized funnel copy.
- Added a freshness gate: stale or partial published record sets fall back to
  evergreen safety guidance instead of presenting old weekly trends as current.
- Kept the public Telegram output deterministic and compact, with the same
  check/report/emergency next actions and no user reports, raw links, phone
  numbers, screenshots or source labels exposed.
- Added tests for manual-publish metadata, draft filtering, stale fallback,
  minimum topic count and public-text privacy guards.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `ROAD-009` is now Implemented,
  `T-041` is Passed, `QA-2026-07-02-003` was added, and the next queue item is
  `T-042 / ROAD-010 Private moderation chat remaining workflow`.

## 2026-07-02 - ROAD-008 privacy-safe scam map/index

- Added `src/lib/trust/scam-map-index.ts`, a pure public-index helper that
  aggregates existing non-personal scheme trends by category, severity, status
  and source without reading private reports or raw evidence.
- Added a privacy-safe map/index panel to `/scam-trends`: the page now shows a
  national tactics index, category buckets and a locked regional layer with
  explicit publication thresholds.
- Locked the public regional boundary for future dynamic data: at least 5
  moderated records, 3 distinct scheme types and 2 source types are required
  before a region bucket can publish.
- Added tests for category aggregation, regional suppression, threshold logic
  and absence of private-evidence shaped fields in the public map payload.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `ROAD-008` is now Implemented,
  `T-040` is Passed, `QA-2026-07-02-002` was added, and the next queue item is
  `T-041 / ROAD-009 Weekly Scam Digest data model`.

## 2026-07-02 - ROAD-007 scam-call trainer mini-quiz

- Added a Telegram `/trainer` flow and main-menu Trainer button with a
  five-situation defensive mini-quiz for scam-call practice.
- Kept the feature callback-only: score is carried in `trainer:*` callback data,
  and the trainer does not create `checks` rows or store user answers.
- Added RU/UZ/EN command-menu registration, localized help text and webhook
  coverage for `/trainer`, the main-menu callback and answer progression.
- Added defensive-content guards so the trainer teaches safe reactions without
  publishing attacker-ready scripts, exact OTP examples or remote-access tool
  playbooks.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `ROAD-007` is now Implemented,
  `T-039` is Passed, `QA-2026-07-02-001` was added, and the next queue item is
  `T-040 / ROAD-008 privacy-safe scam map/index`.

## 2026-07-01 - ROAD-006 family codeword

- Added a Family Shield "Code word" callback and RU/UZ/EN guide that teaches
  families to agree on a private phrase offline for suspicious voice/video
  requests.
- Kept the privacy boundary explicit: the bot does not ask users to send the
  actual codeword and does not store a plaintext or recoverable family secret.
- Updated trusted-contact alerts so helpers verify suspicious voice/video
  pressure by calling a saved number and asking a family codeword or private
  question.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `ROAD-006` is now Implemented,
  `T-038` is Passed, `QA-2026-07-01-023` was added, and the next queue item is
  `T-039 / ROAD-007 scam-call trainer and mini-quiz`.

## 2026-07-01 - ROAD-005 explain like grandmother

- Added a result-card "Simple words" callback next to "Why?" so users can ask
  for a calmer elder-friendly explanation without changing the deterministic
  verdict.
- Added RU/UZ/EN free-text routing for phrases such as "объясни как бабушке",
  "простыми словами", "oddiy qilib" and "simple words". These follow-ups reuse
  the last check context instead of creating a new `checks` row.
- Simple explanations avoid score/threshold/weight wording, keep weak
  topic-only evidence hidden for unknown phone/profile checks, and end with one
  safe next step.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `ROAD-005` is now Implemented,
  `T-037` is Passed, `QA-2026-07-01-022` was added, and the next queue item is
  `T-038 / ROAD-006 family codeword`.

## 2026-07-01 - ROAD-004 conversation check v1

- Implemented explicit Telegram `/conversation` mode plus a main-menu entry for
  checking 2-8 forwarded/pasted chat messages as one short conversation.
- Added a privacy-safe `conversation_check` session state: it stores message
  count, aggregate length, stages, requested actions, pressure flags and reason
  counts only. It does not persist raw chat text, URLs, phone numbers,
  usernames, OTP/PIN/CVV values, cards, passwords, seed phrases, OCR or files.
- Added deterministic stage/action extraction and compact RU/UZ/EN rendering
  that explains how the scam pressure evolves, what action is requested, the
  strongest visible signals and one safe next step.
- Added regression tests for raw-evidence exclusion, `/conversation` collection
  and analysis, and the boundary that ordinary URL checks outside explicit
  conversation mode still go through the normal check pipeline.

## 2026-07-01 - ROAD-004 conversation check design

- Added `.kiro/specs/telegram-conversation-check-v1` with requirements,
  design and implementation tasks for a privacy-first grouped conversation
  check.
- Locked the key boundary before implementation: conversation mode must be
  explicit, unfinished drafts must expire, and `telegram_sessions` may keep
  only derived stage/action/reason metadata, not raw transcripts, URLs, phone
  numbers, usernames, OCR, codes, cards, passwords, seed phrases or files.
- Left implementation open as the next ROAD-004 slice: add the collector,
  deterministic stage/action extraction, compact RU/UZ/EN rendering and
  regression tests that normal single-item checks are not captured.

## 2026-07-01 - ROAD-003 speed/cost pass reconciled

- Reconciled and verified the Telegram speed/cost pass already present in the
  worktree: visible delayed "checking" status for slow text checks, short
  per-user text check cache and in-flight de-duplication, Telegram public
  metadata soft timeout/cache, low-signal passport AI skip, QR fast path for
  pixel-decoded login/payment/wallet payloads, URL reputation cache/in-flight
  de-duplication, voice STT cache/in-flight/budget and Voice-out duplicate/TTS
  budget guards.
- Closed `ROAD-003 / T-035` in `FEATURE_USER_STORY_TRACKER.xlsx` after focused
  latency/cost verification passed.

## 2026-07-01 - SEC-003 adversarial AI-output cooldown

- Added a per-rate-limit-key cooldown for repeated unsafe AI-authored
  explanations. After repeated firewall blocks in a short window, `runCheck`
  keeps deterministic scoring, advice and persistence working but temporarily
  skips further AI explanation calls for that key.
- Extended the AI-output safety API so callers can see whether sanitization
  blocked a provider response and record that event without exposing unsafe
  text to users or `checks.ai_explanation`.
- Added regression coverage for the bucket/cooldown behavior and an
  end-to-end `runCheck` case proving the third repeated adversarial provider
  output is handled rules-only without another AI call.

## 2026-07-01 - CORE-009 retention/audit verification

- Added static migration regression coverage for the Supabase retention and
  admin audit contract: `private.prune_app_retention()` stays private and
  service-role-only, preserves `admin_actions` and `reputation_appeals`, and
  keeps the documented cleanup windows for checks, reports, Telegram sessions,
  webhook dedup rows, rate-limit buckets, Telegram reputation observations and
  Family Shield rows.
- Verified the scheduled cleanup migration uses `cron.schedule` /
  `cron.unschedule` rather than direct `cron.job` writes.
- Re-ran the linked Supabase checks: remote migration history matches local and
  `supabase db lint --linked --schema public,private --fail-on error` reported
  no schema errors.

## 2026-07-01 - CORE-005 URL reputation hardening

- Hardened the existing Google Safe Browsing / URLhaus / PhishTank additive URL
  reputation layer with normalized provider payloads: credentials, query
  strings and fragments are stripped before external calls.
- Mixed text/payment checks now extract URL tokens from the raw input for
  reputation lookup while still refusing to send full message text, OTPs,
  amounts or URL query secrets to providers.
- Added a short in-memory URL reputation cache and in-flight de-duplication so
  repeated checks do not multiply provider calls; provider failures are not
  cached as clean results.
- Verification added for sanitization, cache reuse, concurrent de-duplication
  and payment-message URL extraction.

## 2026-07-01 - Tracker reconciled for ADM-003 / CORE-004

- Verified that Phone Reputation v1 is already implemented: confirmed targeted
  reports update masked `entities`, incident-only reports do not create public
  reputation, phone checks read reputation only from confirmed moderated rows,
  and Telegram output shows source/confidence limits without owner or hidden
  carrier/spam-label claims.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `ADM-003` and `CORE-004` are now
  `Implemented`, `T-021` and `T-024` are closed, Status Summary counts are
  `Implemented=47`, `Partial=4`, `Planned=7`, and the next queue item is
  `T-025 / CORE-005`.
- Verification passed: focused admin/reputation/phone/formatter suites
  `6 files / 77 tests`; workbook formula-error scan found no errors.

## 2026-07-01 - UZ scam-pattern audit slice

- Added deterministic single-message coverage for OneID/government-service
  phishing, SIM-swap/number-transfer pretexts, money mule recruitment,
  advance-fee prize/inheritance/migration/Hajj prompts and romance-to-investment
  pivots.
- Hardened weak soft-ask coverage for CVV/card security code, bank PIN/password,
  direct transfer-to-card requests and PINFL/ID/passport data requests.
- Added positives and negatives for the new patterns, including false-positive
  guards for "three favorite digits", Wi-Fi passwords, office-only SIM notices
  and tax-news text.
- Updated `SCAM_COVERAGE.md` to mark the deterministic slice as covered/partial
  and to keep cumulative pig-butchering dialog risk as a separate architecture
  task.

## 2026-07-01 - Telegram smoke chat separated from moderation chat

- Production Telegram user-flow smoke scripts now require
  `TELEGRAM_QA_CHAT_ID` instead of sending ordinary bot replies to
  `TELEGRAM_MODERATION_CHAT_ID`.
- Added a fail-closed guard so `TELEGRAM_QA_CHAT_ID` cannot be missing or equal
  to the moderation chat id.
- Updated deployment/runbook docs to keep moderator alerts separate from QA
  risk cards, language replies and Voice-out audio.

## 2026-07-01 - TG-025 modern SOS copy closed

- Split the compact first cards, full checklist copy and trusted-person
  follow-ups for sextortion/photo-video blackmail, publication threats and
  minor-safety pressure so they no longer share generic blackmail wording.
- Minor-safety copy now leads with showing the chat to a trusted adult, keeps
  non-blaming language, and tells the user to ask another adult if the first
  one does not help.
- Regenerated `TELEGRAM_BOT_QA_REPORT.md` after SOS copy changes and re-ran
  visual QA.
- Verification passed: scoped eslint; emergency/panic/voice-out suite
  `4 files / 135 tests`; emergency property/i18n/follow-up suite
  `5 files / 632 tests`; bot QA matrix `18 tests`; `qa:telegram-report`,
  `qa:telegram-visual`, and `npm run build` passed.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-025` is now `Implemented`,
  `T-013` is closed, Status Summary counts are `Implemented=45`,
  `Partial=6`, `Planned=7`, and the next queue item is `T-021 / ADM-003`.

## 2026-07-01 - TG-013 video thumbnail UX closed

- Telegram video thumbnails now carry a `video_thumbnail` media marker through
  the router into the image-check result path.
- Result cards for video-thumbnail analysis now explicitly say the bot checked
  only the video preview frame, not the full clip, and asks for speech,
  description, or button/link evidence separately when needed.
- Re-verified that full video files are not fetched: only the Telegram-provided
  thumbnail enters the in-memory image/QR/OCR pipeline.
- Verification passed: scoped eslint; router/webhook/bot QA matrix
  `3 files / 172 tests`; formatter/image-intelligence suites
  `2 files / 70 tests`; `npm run build` passed.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-013` is now `Implemented`,
  `T-009` is closed, Status Summary counts are `Implemented=44`,
  `Partial=7`, `Planned=7`, and the next queue item is `T-013 / TG-025`.

## 2026-07-01 - ADM-001 production auth policy QA closed

- Extended `prod:security-smoke` with admin auth-policy checks: anon cannot read
  `admin_allowlist` or `user_roles`, service-role can read the allowlist, and
  every `admin` role must belong to a confirmed allowlisted email.
- Production verification passed with `admins=1`, `confirmed_allowlisted=1`,
  `outside_allowlist=0`, and `unconfirmed_allowlisted=0`.
- Verification passed: scoped eslint; focused admin/auth/security suites
  `3 files / 18 tests`; `railway run npm run prod:security-smoke` passed.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `T-019` is closed,
  `QA-2026-07-01-015` was added, and Status Summary now says the P1 test queue
  is closed.

## 2026-07-01 - TG-028 AI provider resilience QA closed

- Added adversarial AI-output safety coverage for repeated prompt-injection
  leaks, multilingual secret/payment/wallet/APK action requests, and safe-warning
  decoys that mention the same dangerous terms only as things to refuse.
- Re-verified AI degradation/fallback behavior: rules-only scoring still holds
  when AI is missing, failing, quota-limited, retried, or served by fallback.
- Verification passed: scoped eslint; focused AI safety/degradation suites
  `3 files / 29 tests`; `railway run npm run prod:smoke --
https://scam-guard-main-production.up.railway.app` passed with AI provider
  healthy.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `T-015` is closed,
  `QA-2026-07-01-014` was added, and Status Summary now points to `ADM-001`.

## 2026-07-01 - CORE-001 false-positive QA closed

- Added `prod:telegram-false-positive-smoke` for repeatable production Telegram
  webhook checks of benign delivery status, ordinary sports news, and Telegram
  product-news messages.
- Re-verified the local deterministic false-positive boundaries: broad
  delivery, betting/casino, Telegram/Web3 promo, image-intelligence, result
  formatting, and webhook integration coverage.
- Verification passed: scoped eslint; focused CORE-001 suites
  `5 files / 272 tests`; production Telegram false-positive smoke passed with
  all 3 benign cases `unknown` and no forbidden reason codes; `npm run build`
  passed.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `T-022` is closed,
  `QA-2026-07-01-013` was added, and Status Summary now points to
  `TG-028/ADM-001`.

## 2026-07-01 - CORE-006 verified contact override QA closed

- Re-verified the existing `check-core` regression that confirmed high-risk
  entity reputation keeps `known_reported` and final `high_risk` even when the
  input also matches a verified official contact.
- Re-verified the dangerous-request override path for official short-code-like
  messages.
- Verification passed: scoped eslint; focused risk suites
  `4 files / 153 tests`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `T-026` is closed,
  `QA-2026-07-01-012` was added, and Status Summary now points to the
  remaining P1 test queue starting with `CORE-001`.

## 2026-07-01 - CORE-008 shared rate-limit gates verified

- Added an explicit shared-rate-limit regression for the `telegram_public_post`
  scope so public Telegram post fetch buckets use hashed keys through
  `claim_rate_limit`.
- Re-verified the existing CORE-008 guards: web check/OCR ignores spoofable
  forwarded IP headers by default, Telegram image checks claim the image budget
  before `getFile`/download, report and appeal submissions use shared buckets,
  and Voice-out provider calls are budget-gated.
- Verification passed: scoped eslint; focused CORE-008 suites
  `7 files / 131 tests`; `railway run npm run prod:security-smoke` passed,
  including `claim_rate_limit` and appeal-scope RPC checks.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `CORE-008` is now `Implemented`,
  `T-028` is closed, `QA-2026-07-01-011` was added, and Status Summary now
  points to the remaining P1 test queue starting with `CORE-006`.

## 2026-07-01 - CORE-007 report/appeal privacy boundary closed

- Tightened appeal contact normalization so URL contact hashes are computed from
  normalized origin/path, without query or fragment tokens.
- Added privacy regressions for report moderation alerts and appeal persistence:
  raw URLs, Telegram handles/invites, email/card/code data, and tokenized
  contact URLs must not persist or leak into alerts.
- Verification passed: scoped eslint; report/appeal privacy suites
  `2 files / 13 tests`; risk redaction suites `3 files / 42 tests`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `CORE-007` is now `Implemented`,
  `T-027` is closed, `QA-2026-07-01-010` was added, and Status Summary now
  points to `CORE-008` shared rate-limit regression watch.

## 2026-07-01 - CORE-003 short-code prefix regression closed

- Added a `runCheck`-level regression for `+9981340`: it must not resolve to a
  verified official contact, must not be marked as matched in the official
  directory, must not get `valid_uz_phone`, and must remain `unknown` with score
  `0`.
- Existing helper coverage already confirmed `+9981340`, `+998102`, and
  `+9981257` do not match official short codes.
- Verification passed: scoped eslint plus verified contacts, phone intelligence,
  and check-core property suites `3 files / 45 tests`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `CORE-003` is now `Implemented`,
  `T-023` is passed, `QA-2026-07-01-009` was added, and Status Summary now
  points to `CORE-007` then `CORE-008`.

## 2026-07-01 - Post-deploy P1 web/Telegram live QA passed

- Deployed `5af552e` as Railway deployment
  `ad41dc8b-f8b6-4ca2-afb6-0016aebb24b0`.
- Production smoke passed: home, healthz, webhook auth, Telegram webhook
  pending count, and AI provider checks were healthy.
- Telegram P1 production smokes passed: user-story flows, private/group session
  scoping, live QR photo, and high-risk Guardian Angel.
- Browser QA passed on production homepage high-risk result, `/report` success,
  `/appeal` success, and admin moderation cleanup for marker
  `QA-P1-WEB-20260701112907`; console warnings/errors stayed at `0`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: added `QA-2026-07-01-008` and
  moved Status Summary to UX/logistics fixes or the next product backlog.

## 2026-07-01 - TG-015 Voice-out provider-limit fallback UX

- Rate-limit fallback now removes provider-only Voice-out buttons
  (`voiceout:guardian` and contextual `voiceout:panic:<id>:<action>`) so users
  do not keep tapping into the same daily provider limit.
- Static SOS Voice-out buttons (`voiceout:panic:<id>`) and normal action
  buttons stay visible because prerecorded SOS audio bypasses provider budget.
- Added a regression covering the fallback keyboard and preserving non-voice
  callbacks after the first test caught an over-broad filter.
- Verification passed: scoped eslint, voice-out suite `1 file / 14 tests`, and
  `npm run build`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-015` is now `Implemented`,
  `T-011` is passed, `QA-2026-07-01-007` was added, and Status Summary now
  points to remaining P1/P2 web/Telegram live QA.

## 2026-07-01 - TG-015 Voice-out deploy and full playback smoke

- Refreshed `bun.lock` after adding Voice-out scripts; first Railway deploy
  failed at `bun install --frozen-lockfile`, then deployment
  `962b98c9-b600-4c51-8e6d-98e14ebb15fd` succeeded.
- Full production Voice-out smoke passed against
  `https://scam-guard-main-production.up.railway.app`: Telegram accepted
  panic-6 RU/UZ/EN OGG files and the deployed webhook accepted
  `voiceout:panic:6`.
- General `prod:smoke` also passed: home/healthz/webhook auth checks,
  Telegram webhook info, and AI provider check were healthy.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `QA-2026-07-01-006`, `TG-015`,
  `T-011`, and Status Summary now point to the remaining P2 provider-limit UX
  decision or the next web/Telegram live QA pass.

## 2026-07-01 - TG-015 Voice-out Telegram OGG smoke harness

- Added `prod:telegram-voice-out-smoke`, a production-oriented smoke that sends
  committed panic OGG files through Telegram Bot API `sendAudio` and can trigger
  the app webhook voice-out callback after deployment.
- Added `--skip-webhook` mode for pre-deploy validation: it verifies Telegram
  accepts the local OGG assets without depending on the deployed app bundle.
- Verification passed: scoped eslint for the new script, `npm run
tts:validate-assets`, and `railway run npx vite-node
scripts/prod-telegram-voice-out-smoke.ts --skip-webhook`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: fixed TG-015/T-011 column drift,
  added `QA-2026-07-01-005`, and kept full app webhook playback as post-deploy
  follow-up.

## 2026-07-01 - TG-015 Voice-out SOS OGG assets

- Added production-preferred `.ogg`/Opus Voice-out files for all main SOS
  panic scenarios: `panic-1..15` in `ru`, `uz`, and `en` (`45` assets total).
- Added `tts:validate-assets`, which checks required OGG files, Ogg/Opus
  headers, duration bounds, size limits, and safe short SOS scripts.
- Voice-out unit coverage now locks that prerecorded OGG is selected before WAV,
  TTS budget checks, or provider calls.
- Verification passed: scoped eslint, voice-out suite `1 file / 13 tests`,
  `npm run tts:validate-assets`, and `npm run build`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-015`, `T-011`,
  `QA-2026-07-01-004`, and Status Summary now point to live Telegram playback
  smoke plus the provider-limit button UX decision.

## 2026-07-01 - TG-009 profile screenshot intelligence final-card QA

- Profile screenshot explanations are now treated as Telegram-profile context
  in the final formatter, so the user-facing card keeps visible native fields,
  the fakeable-screenshot caveat, and quick "what did they ask for" buttons.
- Added a formatter regression for Telegram profile screenshots and added a
  synthetic profile screenshot fixture to the Telegram QA report/visual board.
- Verification passed: scoped eslint, focused formatter/image-intelligence
  suites `2 files / 70 tests`, `qa:telegram-report`, `qa:telegram-visual`, and
  `npm run build`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-009`, `T-007`,
  `QA-2026-07-01-003`, and Status Summary now point to Voice-out audio review
  or live username/profile screenshot smoke after deploy.

## 2026-07-01 - TG-007/TG-008 username passport coach visible in final card

- Fixed Telegram passport formatting so the Native Passport Coach block survives
  the final user-facing `formatCheckResult` card instead of being truncated.
- `telegram-bot-qa-report` now builds its username passport fixture through
  `buildTelegramPublicMetadataBrief`, keeping the report aligned with the real
  Telegram metadata builder.
- Regenerated `TELEGRAM_BOT_QA_REPORT.md` and the Telegram visual QA board.
- Verification passed: scoped eslint, focused Telegram suites `5 files / 83
tests`, `qa:telegram-report`, and `qa:telegram-visual`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-007`, `TG-008`, `T-005`,
  `T-006`, `QA-2026-07-01-002`, and Status Summary now point to the next
  UX/logistics slice: Profile Screenshot Intelligence or Voice-out audio
  review/compression.

## 2026-07-01 - ROAD-002 / TG-019 report duplicate-signal polish

- Web `/report` success copy is warmer and explicitly says public labeling is
  manual; similar reports help raise review priority without revealing whether
  this submission was a duplicate.
- Admin `listReports` now attaches operator-only `target_signal_count` and
  `target_last_report_at` from active report rows. Queue priority and admin
  cards use that raw signal count while public `target_report_count` remains
  confirmed-only.
- Verification passed: scoped eslint for touched files, focused
  admin/report tests `3 files / 28 tests`, `git diff --check`, and
  `npm run build`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `TG-019`, `ROAD-002`, `T-012`,
  `T-034`, `QA-2026-07-01-001`, and Status Summary now point to continuing
  UX/logistics fixes; production/live report smoke remains a post-deploy check.

## 2026-06-30 - P1 production Telegram user-story smoke passed

- Added `prod:telegram-user-story-smoke`, a guarded production smoke for the
  remaining Telegram P1 user-story flows.
- The smoke verifies `/start`, RU/UZ/EN language callback persistence, a
  synthetic UZ phone passport, benign delivery false-positive handling, and
  RU/UZ/EN acknowledgement + confirmation follow-ups that must not create
  `checks` rows.
- Cleanup removes synthetic `checks`, `telegram_sessions` and
  `telegram_webhook_updates` rows; secrets, chat ids and synthetic user ids are
  not printed.
- Verification passed: scoped eslint for the new script, focused Telegram/risk
  suite `5 files / 198 tests`, `railway run npm run
prod:telegram-user-story-smoke`, and general `railway run npm run prod:smoke`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `QA-2026-06-30-012`, `T-001` -
  `T-004`, `TG-001`, `TG-002`, `TG-005`, `TG-006`, and Status Summary now point
  to UX/logistics fixes next. Voice-out real RU/UZ/EN `.ogg` SOS assets and
  compression remain a separate follow-up.

## 2026-06-30 - P1 production Telegram QR + Guardian smoke passed

- Added `prod:telegram-live-qa-smoke`, a guarded production smoke that uses
  synthetic Telegram users and `TELEGRAM_MODERATION_CHAT_ID` without printing
  secrets, chat ids or user ids.
- The smoke verifies a high-risk verification-code/CVV text creates safe
  `lastCheck` + Guardian Angel session metadata, then verifies a real Telegram
  `sendPhoto` QR image goes through file_id download and pixel QR decode as
  `asks_to_scan_qr`.
- Cleanup removed synthetic `checks`, `telegram_sessions`,
  `telegram_webhook_updates` rows and the uploaded QA Telegram photo.
- Verification passed: scoped eslint for the new script, focused Telegram suite
  `4 files / 127 tests`, `railway run npm run prod:telegram-live-qa-smoke`, and
  general `railway run npm run prod:smoke`.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `QA-2026-06-30-011`, `T-008 /
TG-010`, `TG-022`, `T-003 / TG-005`, and Status Summary now reflect that
  image/QR + high-risk Guardian are no longer the next blocker. Remaining P1 is
  Telegram start/check/passport/conversational live RU/UZ/EN and false-positive
  user-story QA, then UX/logistics fixes; Voice-out human audio review/compression
  remains separate.

## 2026-06-30 - P1 Telegram private/group scope production QA passed

- Added `prod:telegram-scope-smoke`, a guarded production smoke that sends
  synthetic Telegram webhook callbacks, verifies private `/report` session
  `chatScope`, verifies a supergroup callback resets instead of reusing private
  state, and cleans synthetic `telegram_sessions` / `telegram_webhook_updates`
  rows.
- Production initially lagged the current session-scoping code, so
  `prod:telegram-scope-smoke` correctly failed on missing `chatScope`; redeployed
  current app to Railway deployment `53f77ca3...`.
- After deployment, `railway run npm run prod:telegram-scope-smoke -- https://scam-guard-main-production.up.railway.app`
  passed, and the general `prod:smoke` passed on the same production URL.
- Added explicit `vite-node` dev dependency and scoped the `brace-expansion`
  override so existing `prod:*` npm scripts run directly without the stale local
  shim / ESLint minimatch failure.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `T-014 / TG-027` now records the
  production pass; Status Summary now points to remaining P1 Telegram live QA
  (image/QR, high-risk Guardian Angel, conversational follow-ups) before
  UX/logistics fixes.

## 2026-06-30 - P1 production web user-story QA passed

- Production browser QA passed for the homepage high-risk result, `/report`
  success path and `/appeal` success path against
  `https://scam-guard-main-production.up.railway.app`.
- Added `prod:admin-moderation-smoke`, a guarded production smoke that finds the
  synthetic report/appeal by marker or hashed target, runs the same admin
  moderation core functions, verifies audit actions, and cleans synthetic rows.
- QA marker `QA-P1-WEB-20260630111649` was cleaned from reports, appeals,
  entities, admin actions and checks after verification.
- Updated `FEATURE_USER_STORY_TRACKER.xlsx`: `QA-2026-06-30-010` records the
  run, and WEB-002 / WEB-003 / WEB-007 now point to production-pass status.
- Next recommended P1 remains Telegram/private-group user-story QA or
  UX/logistics fixes; Voice-out human audio review/compression is a separate
  follow-up.

## 2026-06-30 - Voice-out pre-record architecture first slice

- Main SOS `voiceout:panic:{id}` callbacks now look for static audio before
  live TTS. Default path: `public/audio/voice-out/panic-{id}-{lang}.ogg`,
  overrideable with `VOICE_OUT_PRERECORDED_DIR`.
- Static Voice-out audio bypasses Gemini/OpenAI calls and does not spend the
  daily TTS budget; missing static audio falls back to the existing provider
  chain and text fallback.
- Emergency follow-up screens no longer repeat the "Озвучить главный шаг"
  button, reducing the broad voice-button surface that QA flagged.
- Generated static Gemini WAV assets for all 15 SOS panic scripts in RU, UZ and
  EN. Remaining work is human audio review, optional `.ogg` compression when a
  converter is available, and a separate decision on static Guardian Angel
  audio.

## 2026-06-30 - Telegram conversational follow-ups after QA feedback

- Added post-check/post-SOS handling for short acknowledgements like
  "Хорошо сделаю" so the bot answers warmly instead of running a fake
  insufficient-data check.
- Added handling for ambiguous confirmation requests such as
  "Попросил подтверждение": the bot now warns about SMS codes, push
  confirmations, QR login and card operations without changing the previous
  verdict.
- Voice transcript previews now trim on a word boundary with an ellipsis while
  the risk check continues to use the full transcript.
- Guardian Angel intro copy now uses human-facing companion wording instead of
  explaining internal auto-prompt mechanics.
- Recorded the remaining Voice-out pre-record architecture pass as an open
  task after QA found live TTS buttons too broad and too provider-dependent.

## 2026-06-29 - Proxy IP header trust is fail-closed and documented

- Documented `TRUST_PROXY_IP_HEADERS` as an explicit opt-in for public
  rate-limit identity behind a trusted edge proxy only.
- Confirmed focused tests prove spoofable forwarding headers are ignored by
  default and used only when the opt-in is set.
- Added a `prod:security-smoke` env guard: if proxy IP header trust is enabled,
  the smoke requires `TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true`.
- Railway production security smoke confirmed `TRUST_PROXY_IP_HEADERS` is
  unset/false and the full RLS/RPC smoke still passes.

## 2026-06-29 - Public impact loss counters require confirmed reports

- Public check and risk-alert counters remain aggregate raw service activity.
- Public report/loss impact counters now count only
  `reports.status='confirmed'` rows in both the `get_check_stats()` RPC and the
  server-side fallback queries.
- Updated homepage copy so loss totals are presented as moderator-confirmed
  report impact, not unreviewed user-submitted amounts.

## 2026-06-29 - Embed widget framing requires an origin allowlist

- `/embed/check` no longer ships with broad `frame-ancestors https:`.
- The embed CSP now defaults to `'self'` plus localhost development origins and
  adds production partner origins only from `EMBED_ALLOWED_FRAME_ANCESTORS`.
- Added regression coverage for rejecting unsafe allowlist entries and for
  building CSP from explicit HTTPS partner origins.

## 2026-06-29 - Same-day duplicate reports keep durable evidence

- Same-day report dedupe now stores a redacted `reports.status='duplicate'`
  row instead of relying only on a best-effort moderation notification.
- Duplicate report rows do not refresh public `entities`, do not change
  `entities.report_count`, and cannot be moderated as new reports.
- Added regression coverage proving duplicate evidence is persisted while public
  entity state remains unchanged, plus an admin `duplicate` report filter.

## 2026-06-29 - Webhook dedup outages retry before dispatch

- Telegram webhook processing now returns HTTP 503 before dispatch when the
  shared `telegram_webhook_updates` dedup claim is unavailable.
- The in-memory duplicate marker is written only after a successful shared claim
  so a Telegram retry after a temporary storage outage is not lost locally.
- Added regression coverage proving unavailable shared dedup does not dispatch
  and a later successful retry can process the same `update_id`.

## 2026-06-29 - Public stats use a short server cache

- Added a 30-second in-process cache and in-flight de-duplication around
  `getPublicStats` so repeated public requests do not each run the service-role
  stats RPC and aggregate count/select queries.
- Kept the existing aggregate-only public stats shape and fallback amount bound.
- Added regression coverage proving two immediate public stats requests share
  one set of service-role aggregate queries.

## 2026-06-29 - Empty homepage quick reports stay incident-only

- Added a shared quick-report payload helper so the homepage form sends
  `incidentOnly: true` with the incident-only sentinel when the optional target
  field is empty.
- Added a server-side placeholder guard so dash-only legacy targets are treated
  as situation-only reports and cannot create public entity candidates or daily
  entity dedupe keys.
- Added regression coverage for both the UI payload builder and the server path.

## 2026-06-29 - Public entity report counts require moderation

- `submitReportCore` now creates or refreshes entity moderation candidates
  without incrementing public `entities.report_count`.
- `moderateReportCore` recalculates `report_count` from confirmed reports when
  a moderator confirms or rejects a report, so public reputation counts reflect
  moderated evidence only.
- Added a Supabase migration to backfill existing `entities.report_count` values
  from `reports.status='confirmed'`, plus regression coverage for an
  unmoderated follow-up report on an already confirmed entity.

## 2026-06-29 - Telegram image downloads are rate-limited before file fetch

- Added an early Telegram image-download budget before `getFile` and
  `downloadFileAsDataUrl`, using the shared privacy-safe rate limiter with a
  separate `telegram-image:<tg:userId>` key.
- The final `analyzeImageCore`/`runCheck` limits remain in place as defense in
  depth, but repeated screenshots are now rejected before Telegram media
  metadata/download cost is incurred.
- Added webhook regression coverage that first reproduced an 11th repeated
  image reaching `getFile`, then passed with only 10 file fetch/download/OCR
  calls and a friendly rate-limit reply.

## 2026-06-29 - Telegram image safe verdicts require supporting evidence

- Split benign image context from final safe-verdict eligibility. Telegram image
  checks now use `isEvidenceBackedBenignImageContext` for `safeIfNoReasons`.
- A model-only benign category such as `delivery_sms`, with no readable text,
  QR signal or risk hints, now remains `unknown` instead of forcing `safe`.
- Added unit and webhook regression coverage proving the model-only path no
  longer reproduces while normal delivery/menu screenshots still stay out of
  high-risk false positives.

## 2026-06-29 - Web OCR image data URLs are server-validated

- Added a shared image data URL validator for web OCR and image-intelligence
  core paths. Only `image/png`, `image/jpeg` and `image/webp` base64 data URLs
  within the screenshot byte limit are accepted.
- The public `ocrExtract` server function rejects non-image, malformed,
  non-base64 and oversized payloads before calling `ocrExtractCore`.
- `ocrExtractCore` and `analyzeImageCore` now re-check the data URL before
  building AI `image_url` messages, so direct core callers cannot forward
  invalid media payloads to the AI provider.

## 2026-06-29 - Telegram report drafts stop storing raw identifiers

- Hardened the Telegram `/report` draft path so `telegram_sessions.scenario_data`
  stores a prepared target `{ type, hash, display, incidentOnly }` instead of
  raw usernames, phone numbers or URLs.
- Free-form draft fields that may contain user evidence (`description`,
  `scamType`, `city`) are redacted before session persistence, including retry
  drafts after a failed final submit.
- Added regression coverage for raw handle/email/link/code leakage in report
  drafts, prepared Telegram target submission, and webhook callback retry
  fixtures.

## 2026-06-29 - Telegram session state is chat-scoped

- Hardened `telegram_sessions.scenario_data` with a `chatScope` boundary so
  `/report`, `/check`, `/call`, panic and follow-up context created in one
  Telegram chat cannot be reused by the same user from another private/group
  chat.
- The router now resets active or contextual legacy session rows when they lack
  a matching chat scope, then handles the current update as fresh input.
- Added router, webhook and full Telegram regression coverage for scoped
  scenarios, unscoped legacy resets and normal same-chat continuation.

## 2026-06-29 - Admin allowlist gated on email confirmation

- Added a Supabase migration so `admin_allowlist` no longer grants `admin` on
  signup before `auth.users.email_confirmed_at` is set.
- Added a confirmation update trigger that promotes allowlisted users only
  after Supabase marks the mailbox verified, plus cleanup for previously
  auto-granted unverified allowlisted admin rows.
- Added focused migration regression coverage and updated deployment/database
  docs with the email-confirmation requirement.

## 2026-06-22 - Telegram Native Passport Coach shipped

- Username passports now teach users how to read Telegram's native profile card:
  phone country, registration month, "not official" labels and recent
  name/photo changes are framed as user-visible Telegram-client signals, not Bot
  API data.
- Added conservative visible username hints for random/generated usernames,
  brand/support lookalikes and promo wording around investments, betting,
  bonuses, crypto or gifts.
- Kept the hard boundary: no claims about hidden Telegram SCAM labels, account
  age, Telegram complaint history or who the account messaged.

## 2026-06-22 - Unified execution plan refreshed after PR #66/#67

- Updated `EXECUTION_PLAN_2026-06-21.md` after PR #66 and PR #67 were merged
  into `main`.
- Added Telegram Native Passport Coach, username risk heuristics, and Profile
  Screenshot Intelligence as explicit P8.1/P8.2/P8.5 follow-ups.
- Reordered the nearest plan around deploy, dashboard operator UX v2, honest
  username/profile passport work, voice-in v2, QR precision, speed/cost and
  security hardening.

## 2026-06-22 - Risk Passport phone next step polish

- Phone risk passports now include the next safe step inside the passport card
  instead of repeating a separate generic context prompt below it.
- Reused the shared `prompt_more_context_phone` i18n string so RU/UZ/EN copy
  stays consistent.
- Added regression coverage so phone passports ask for context exactly once
  while preserving the honest "number alone does not prove scam" boundary.

## 2026-06-21 - P7 report flow moderation signals

- Warmed the final `/report` confirmation: users now see that they helped warn
  others, while public labels still require manual moderation.
- Humanized private moderation Telegram alerts: duplicate reports are framed as
  an additional signal instead of database/internal wording.
- Enriched admin report cards with the target report count from the reputation
  entity row, so repeated complaints are visible before a public moderation
  decision.
- No schema migration: duplicate public rows are still suppressed; duplicate
  alerts remain moderation-only and masked.

## 2026-06-19 - Report flow copy and moderation alert UX polished

- Rewrote `/report` prompts to feel less like a cold form and more like a safe
  moderated incident submission.
- Clarified the final `/report` confirmation: only a safe short moderation
  notice is sent, and public visibility requires manual review.
- Reformatted private moderation Telegram alerts into a structured Russian
  operator card with privacy reminders and a localized admin button.
- Simplified duplicate-report alert wording so moderators see a human cue:
  "already reported today; look closer" instead of database-oriented copy.
- Clarified that moderation chat alerts are operator-only, intentionally mask
  targets, and require opening the protected admin panel for full review.
- Updated login copy/errors to match the production admin allowlist model.

## 2026-06-19 - Hidden Telegram chat id command shipped

- Added hidden `/chatid` Telegram command for private moderation group setup.
- The command is intentionally not registered in the public Telegram command
  menu, so regular users do not see operator tooling.
- Updated deployment/on-call docs to use `/chatid` instead of third-party bots
  for `TELEGRAM_MODERATION_CHAT_ID`.

## 2026-06-19 - Moderation alert smoke test shipped

- Added `scripts/moderation-alert-smoke.ts` and `npm run moderation:smoke` to
  verify the optional private moderation chat from Railway env.
- The smoke test sends a clearly marked non-user alert and never prints bot
  tokens, chat ids or user evidence.
- Updated deployment and on-call docs with the setup/test path for
  `TELEGRAM_MODERATION_CHAT_ID`.

## 2026-06-19 - Private moderation alerts first slice shipped

- New report and reputation appeal submissions can now notify an explicit
  private Telegram moderator chat via `TELEGRAM_MODERATION_CHAT_ID`.
- The moderation alert is opt-in and contains only redacted targets, high-level
  fields and an admin link; raw report text, screenshots, OCR, codes, card
  data, full phone numbers and full URLs are not sent to the chat.
- High-signal research-feed moderation alerts remain a follow-up task.

## 2026-06-19 - Decoded QR fast path shipped

- Telegram photo checks now skip slower visual AI when pixel decoding already
  proves an actionable QR payload: Telegram login, 2FA/authenticator, payment
  or wallet/deep-link QR.
- Plain URL QR codes, restaurant/menu QR and suspicious HTTP URLs still use the
  normal image-context path to avoid overcalling risk without visual context.
- Added regression coverage for decoded-only QR evidence so the fast path stays
  narrow.

## 2026-06-19 - Telegram metadata latency guard shipped

- Public Telegram username/post passport enrichment now uses a 1.2s soft
  metadata lookup budget before falling back to an honest "public data
  unavailable" passport instead of waiting for the full Bot API timeout.
- Added a bounded short in-memory metadata cache for repeat username/post
  checks, reducing repeated Telegram API calls without persisting usernames or
  raw user input.
- Latency pass remains open for OCR/STT/image-analysis timing-log tuning.

## 2026-06-19 - Voice-in confidence fallback and RU/UZ fixtures shipped

- Low-signal voice transcripts now stop before the normal risk pipeline and ask
  the user to correct or type the text, avoiding misleading risk cards from
  weak STT output.
- Added RU/UZ mixed-speech voice fixtures so "kod yubordim",
  "pul o'tkazdim" and "qo'ng'iroq qilishyapti" route directly to the matching
  emergency flows.
- Updated Voice-in v2 specs and regression coverage.

## 2026-06-18 - Voice-in transcript correction shipped

- Telegram voice transcript previews now include a localized "Correct text"
  button so users can fix misheard STT output instead of resending audio.
- The correction callback stores `await_check` state and asks for one corrected
  text message; the next message runs through the normal text risk pipeline
  without another voice download, STT call or voice-budget spend.
- Added regression coverage for the correction button, callback routing and
  no-extra-STT path. Voice-in v2 remains open for confidence-aware fallback and
  RU/UZ mixed-speech fixtures.

## 2026-06-18 - QR clarity pass shipped

- Telegram image explanations now distinguish real pixel-decoded QR payloads
  from URLs merely visible near a QR, and from QR codes that are visible but
  not reliably readable.
- Benign menu/loyalty/informational QR replies now say what was actually seen
  and which requests would make the next page risky: login, payment, SMS code,
  card data or APK.
- QR-login/payment explanations still hide Telegram login tokens and 2FA
  secrets while preserving high-risk guidance.

## 2026-06-18 - Voice-out duplicate-click feedback shipped

- Voice-out callbacks now own their `answerCallbackQuery` response: the first
  tap shows a short "preparing voice" status, while repeated taps for the same
  text return a duplicate hint instead of silently doing nothing.
- The duplicate guard still blocks repeated TTS provider calls for the same
  user/chat/text window, reducing accidental API spend when users tap the
  voice button several times while waiting.

## 2026-06-18 - Voice-in/STT UX first slice shipped

- `handleVoice` now starts a fast non-message Telegram typing indicator while
  STT is running, and repeats it for long provider calls so users do not think
  the bot froze during 5-10 second voice transcription.
- Voice STT daily-budget exhaustion now uses a dedicated message explaining
  that the limit protects against spam/cost abuse, then asks for a typed
  summary or emergency action instead of a generic rate-limit line.
- Obvious already-happened voice transcripts such as "I sent the SMS code",
  "installed an APK", "transferred money", "entered card data", "lost Telegram"
  or "I am on a call" route directly to the matching `/panic` scenario before
  the normal risk-card path.
- Added regression coverage for slow-STT waiting state and voice-to-panic
  routing, and updated the Voice STT spec plus `OPEN_TASKS.md`.

## 2026-06-18 - Contextual Voice-out hardening shipped

- Voice-out callbacks under SOS follow-ups now preserve the exact originating
  follow-up action, so "ready phrase", "what next", contacts and full-plan
  buttons speak the same short card the user is reading instead of replaying a
  generic scenario summary.
- Added a best-effort Telegram `upload_voice` chat action before TTS synthesis
  and regression coverage that repeated taps do not create duplicate provider
  calls.
- Added a regression fixture for the real voice transcript pattern "delivery
  only by card" so it stays mapped to `fake_delivery_payment` instead of
  falling back to an empty "not enough data" answer.
- Updated `FUNCTIONS_MAP.md`, `ROADMAP.md` and `OPEN_TASKS.md` to split the
  completed Voice-out hardening from the still-open Voice-in/STT UX work.

## 2026-06-18 - Emergency copy trust polish shipped

- Removed repeated "I am nearby" prefixes from SOS first cards, follow-up
  answers and Guardian Angel copy where the repetition made the bot feel
  templated instead of calm.
- Changed zero-report reputation wording for Telegram/phone passport cards to
  "confirmed complaints not found in Ishonch Guard" so absence of local reports
  is never presented as proof of safety.
- Updated the Telegram QA report generator fixture, regenerated
  `ai_docs/TELEGRAM_BOT_QA_REPORT.md` and refreshed regression expectations for
  emergency copy and reputation wording.

## 2026-06-18 - Emergency keyboard profile pass shipped

- `/panic` follow-up keyboards now use scenario-specific next-action buttons
  instead of reusing one bank/help template. Financial/APK/live-call cases keep
  safe callback; Telegram takeover shows recovery; blackmail/minor cases
  prioritize trusted help and help directory; romance uses pause/review; AI
  voice-clone uses voice verification; crypto uses wallet safety; job and grant
  cases point to source/official-channel checks.
- Guardian Angel keyboards now suppress bank-callback actions for non-bank
  contexts such as crypto, QR and Telegram recovery, keeping trusted-person,
  full-plan, Voice-out and new-check actions instead.
- Regenerated `ai_docs/TELEGRAM_BOT_QA_REPORT.md` and added regression tests
  for scenario-specific SOS and Guardian Angel button profiles.

## 2026-06-18 - Emergency callback context binding shipped

- Panic follow-up buttons and Voice-out callbacks now carry the originating
  scenario id, with legacy callback fallback retained for older keyboards.
- Added stale-keyboard regression coverage so an old APK follow-up button keeps
  answering as APK even after the user opens a different panic scenario.
- Removed unsafe Telegram recovery username guidance from takeover recovery
  copy; user-facing instructions now point to official Telegram app
  settings/support wording.
- Regenerated `ai_docs/TELEGRAM_BOT_QA_REPORT.md` and updated roadmap/open
  tasks/functions map to mark the first two 2026-06-18 emergency trust fixes as
  shipped.

## 2026-06-18 - Roadmap update after emergency UX feedback

- Updated `ai_docs/ROADMAP.md` with the new canonical implementation order from
  the 2026-06-18 Telegram bot feedback.
- The next priority is no longer adding broad new features first; it is closing
  trust-breaking emergency UX issues: scenario-bound panic callbacks, safe
  Telegram recovery wording, context-specific emergency keyboards, softer
  reputation wording and Voice-in v2.
- Added `OPEN_TASKS.md` items for private redacted moderation-chat
  notifications, weekly-scheme data modeling and stale-keyboard regression
  tests.
- Confirmed that Voice-out/TTS daily limits remain intentional cost protection;
  future work should improve waiting/idempotency UX rather than removing the
  quota guard.

## 2026-06-18 - Telegram timing diagnostics and delivery voice pattern

- Added sanitized `telegram_timing` diagnostics for Telegram text, image and
  voice handlers. The logs identify slow stages without printing raw user
  messages, transcripts, links, phone numbers, usernames, OCR text or QR
  payloads.
- Documented `TELEGRAM_TIMING_LOGS` and `TELEGRAM_TIMING_LOG_THRESHOLD_MS` for
  short production latency investigations.
- Added Telegram-specific AI latency budgets for explanations, image
  intelligence and voice STT, and documented the Railway env overrides.
- Low-signal username, phone and generic URL passport checks now skip AI so the
  bot answers quickly and avoids over-explaining when the honest result is
  "send the message/screen for context".
- Tightened `fake_delivery_payment` so plain payment-on-delivery text stays
  benign while delivery/card-only wording from voice transcripts becomes a
  risk signal.

## 2026-06-17 - Gemini TTS provider for Voice-out

- Voice-out now prefers `GEMINI_TTS_API_KEY` with
  `gemini-3.1-flash-tts-preview` and falls back to OpenAI TTS when configured.
- Gemini `audio/l16` responses are wrapped as WAV before sending to Telegram.
- `npm run tts:smoke` now verifies Gemini or OpenAI TTS without printing
  secrets, request bodies, audio, or provider error bodies.

## 2026-06-16 - Telegram OGG audio documents route to STT

- Telegram `.ogg`/`.m4a`/audio files sent as `document` messages now route to
  the same capped voice STT pipeline as voice notes and native Telegram audio.
- Non-audio documents such as PDF/APK/video files still stay in the safe
  unsupported-document path and are not downloaded.
- Fixed TypeScript strictness in Voice-out audio upload/fallback so `tsc`
  remains clean with the TTS code path.

## 2026-06-16 - QR decoded evidence in Telegram replies

- Telegram image explanations now surface decoded safe QR destinations such as
  `chenson.uz/loyalty` or `t.me/chensonuz_bot` so restaurant/menu QR results
  feel evidence-based instead of guessed.
- Sensitive QR payloads are not echoed: Telegram login tokens and 2FA secrets
  are summarized as hidden login/authenticator QR values in user-facing copy.
- Added `npm run qa:qr-decode -- <image>` for local QR checks against real
  screenshots and regenerated Telegram QA coverage for benign QR and login-QR
  cases.

## 2026-06-16 - Telegram visual QA board

- Added `scripts/telegram-bot-qa-visual.ts` and `npm run
qa:telegram-visual`.
- The visual board renders `ai_docs/TELEGRAM_BOT_QA_REPORT.md` as
  Telegram-like message cards under `output/playwright/` for desktop/mobile
  screenshot inspection.
- Updated open tasks so future bot copy/button changes include both textual
  and visual QA review.

## 2026-06-16 - QR auth and audio-file check polish

- Tightened Telegram image intelligence so QR-login/device-link/2FA screens
  such as Telegram "connect device", bank QR-login and authenticator QR prompts
  produce `qr_login` evidence and a QR-specific warning instead of a generic
  insufficient-data/menu answer.
- Kept restaurant/menu/program-loyalty QR posters below high risk unless a
  payment, login, code, card, wallet or APK request appears.
- Routed short Telegram `audio` files with `file_id` through the same capped
  voice STT pipeline as voice notes. Oversized or unclear voice/audio messages
  keep the safe text fallback.
- Clarified Telegram user-facing copy: unsupported-media fallback now says
  short voice/audio up to 60 seconds is supported, and restaurant/menu QR
  results no longer imply that the hidden QR payload was definitely decoded.

## 2026-06-16 - Telegram Voice-out / TTS v1

- Added opt-in `voiceout:*` callbacks for SOS follow-ups and Guardian Angel.
- Added `src/lib/telegram/voice-out.server.ts` with short RU/UZ/EN safety
  scripts, a 5/day user budget, TTS endpoint isolation and sanitization before
  speech synthesis.
- Voice-out strips links, Telegram usernames and long digit runs, refuses
  unsafe code/PIN/CVV/password-like text and never treats Gemini chat endpoints
  as speech endpoints.
- If `OPENAI_TTS_API_KEY` is missing or TTS fails, the bot sends a short text
  fallback and keeps the same recovery buttons.
- Regenerated the Telegram QA report to include Voice-out samples and buttons.

## 2026-06-16 - Telegram bot QA report

- Added `scripts/telegram-bot-qa-report.ts` and `npm run
qa:telegram-report`.
- The generated `ai_docs/TELEGRAM_BOT_QA_REPORT.md` renders current Telegram
  bot copy and keyboards from TypeScript formatters for product review.
- Coverage includes main menus, result cards, media fallbacks, image triage,
  asked-context hints, `/panic`, `/call`, Guardian Angel, Family Shield and
  report flow.
- Documented that the report should be regenerated whenever bot copy or
  buttons change.

## 2026-06-16 - Family Shield invite UX clarification

- Clarified Family Shield invite copy so the guardian understands the invite
  link is not for them and must be sent to another Telegram contact.
- Renamed the invite action to make the Telegram share flow explicit.
- Improved the self-link error to explain that opening your own invite does not
  enable the trusted-contact relationship.
- Added regression coverage for the invite handoff copy and `t.me/share/url`
  keyboard behavior.

## 2026-06-16 - Guardian Angel v1

- Added `.kiro/specs/telegram-guardian-angel-v1/`.
- High-risk Telegram check results now send a short companion message after
  the verdict: one safe step, done confirmation, safe callback, trusted-contact
  help, full plan and new-check actions.
- Added `src/lib/telegram/guardian-angel.ts` with privacy-safe snapshots,
  tri-lingual guidance, callback parsing and short follow-up routing.
- `telegram_sessions.scenario_data.guardian` stores only risk level, input
  type, reason codes and timestamp; raw messages, URLs, phone numbers, OCR,
  screenshots, codes and card data remain forbidden.
- Added regressions for snapshot privacy, high-risk companion messages and
  `guardian:*` callbacks.
- Roadmap now moves the next implementation slot to opt-in Voice-out/TTS v1.

## 2026-06-16 - Telegram Modern SOS Scenarios v1

- Added `.kiro/specs/telegram-modern-sos-scenarios-v1/`.
- Expanded `/panic` to a third page with `panic:12` through `panic:15`:
  fake job/easy money, delivery/top-up, crypto/TON/wallet and government
  grant/benefit.
- Added compact first cards, detailed checklists with verified contact paths
  and scenario-specific follow-up copy for next step, ready phrase,
  trusted-person guidance and help-directory actions.
- Updated regression coverage for page-3 keyboard routing, callback parsing,
  localization completeness and emergency text well-formedness.
- Roadmap now moves the next implementation slot to Guardian Angel v1, then
  opt-in Voice-out/TTS v1.

## 2026-06-16 - AI Voice-Clone SOS Scenario v1

- Added panic scenario `11` for AI voice-clone / fake relative calls.
- The second panic-menu page now includes the new scenario and callback parsing
  accepts `panic:11`.
- Added compact first-card guidance: verify the person via a saved number,
  family code word or private question before sending money or codes.
- Added scenario-specific follow-up copy for next step, ready phrase,
  trusted-person guidance and help-directory contacts, avoiding bank-first
  wording unless money was already sent.
- Updated regression coverage so the voice-clone flow stays in the correct SOS
  profile.

## 2026-06-15 - Financial ready phrases and CSP hardening

- Already-happened financial SOS scenarios now use their own ready phrases:
  SMS-code sent, transfer made and card data entered no longer reuse the generic
  incoming-call callback script.
- Added regression coverage that keeps financial ready phrases scenario-specific
  and verifies blackmail/minor flows do not fall back to bank-callback copy.
- Moved CSP policies into `src/lib/security/csp.ts`; main-site and embed
  `script-src` now use request-scoped SSR nonces instead of `unsafe-inline`,
  while the Unicorn Studio script is pinned to the exact CDN URL used by the
  component.
- Documented the intentional embed boundary: `/embed/check` remains frameable
  for partner sites, with partner allow-listing/logging tracked as a follow-up.

## 2026-06-15 - Direct Live-Call `/call` v1

- Added `.kiro/specs/telegram-live-call-direct-entry-v1/`.
- `/call` is now a known Telegram command and opens the live-call copilot
  directly, without first showing the broader `/panic` scenario menu.
- The command stores only the existing panic context id `6` plus timestamp so
  short follow-up questions stay in live-call context.
- Added `/call` to `/help`, localized `setMyCommands` payloads and webhook
  regression coverage.

## 2026-06-15 - SOS Ready Phrase Fix v1

- Added `.kiro/specs/sos-ready-phrase-fix-v1/`.
- Existing panic follow-ups now choose a scenario profile before rendering
  ready phrases, trusted-person guidance and contact/help destinations.
- Financial/APK/live-call cases keep safe official-callback wording, while
  Telegram takeover, romance, blackmail and minor-safety cases no longer get
  irrelevant "call the bank" copy.
- Expanded emergency follow-up routing for "куда обратиться", police/support
  and UZCERT wording.

## 2026-06-15 - Unified Risk Passport v1 (Telegram)

- Telegram `unknown` phone and username checks now render as a Risk Passport
  card instead of the generic "not enough data" verdict card.
- The passport keeps the honest boundary: visible facts, app-owned reputation
  and official-directory signals are allowed; hidden Telegram scam labels,
  account age, spam history and unmoderated complaints are not claimed.
- Contextual "what did they ask for?" buttons remain attached to shallow
  phone/username checks so users can continue with code/card/transfer/APK/QR
  or live-call guidance.
- Added formatter regressions that passport cards suppress the old generic
  unknown verdict while normal result cards still keep their verdict line.

## 2026-06-15 - Roadmap correction after Risk Passport feedback

- Promoted Unified Risk Passport v1 to the next implementation task after
  Website Embed Widget v1.
- Added `.kiro/specs/risk-passport-v1/` with requirements, design and tasks.
- Reordered near-term work around the latest Telegram UX feedback: Risk
  Passport v1, SOS ready phrase fixes, direct `/call`, new SOS scenarios,
  Guardian Angel, Voice-out/TTS, external URL signals and then public website
  trust surfaces.
- Reconfirmed the product boundary: do not copy MTProto-style hidden Telegram
  facts such as account age, hidden scam labels, DC/country or spam history.

## 2026-06-15 - Website Embed Widget v1

- Added `.kiro/specs/website-embed-widget-v1/`.
- Added `/embed`, a partner-facing page that explains the iframe widget, shows a
  live preview and generates a copyable snippet with sandbox and strict-origin
  referrer policy.
- Added `/embed/check`, a compact no-chrome iframe runtime that reuses the
  existing `checkInput` server function, shared rate limits, redaction and
  rules-first scoring.
- Added `src/lib/embed-widget.ts` helper tests for language fallback, partner
  label sanitization and iframe snippet safety.

## 2026-06-15 - Telegram Passport Context Buttons v1

- Telegram username and phone checks that cannot reach a firm verdict now add
  compact "what did they ask for?" buttons: code, card, transfer, APK, link/QR
  or live call.
- Button callbacks answer with one concrete safe next step instead of routing a
  user's follow-up question back into the generic risk pipeline.
- Phone Passport cards now use small visual sections for country/operator,
  official directory status, Ishonch Guard report count and the honest
  "number alone is not proof" boundary.
- Telegram Passport copy now avoids appending a second generic AI paragraph for
  low-signal username-only checks.

## 2026-06-15 - Telegram Passport Copy Polish v1

- Telegram username-only checks now render as a small "Telegram Passport":
  visible public facts, Ishonch Guard confirmed-report count, hard Bot API
  limitations and a concrete next step.
- Increased Telegram-result explanation truncation only for Telegram Passport
  cards so the limitation and next-step lines are not cut into an unhelpful
  ellipsis.
- Updated regression tests and `.kiro/specs/telegram-link-account-intelligence-v2/tasks.md`.

## 2026-06-15 - Telegram Main Menu UX v2

- Updated `.kiro/specs/telegram-main-menu-ux/` to match the current eight-action
  Telegram main menu.
- `/start` and `/menu` now present the in-chat menu as an action hub: emergency
  help is the first full-width action, while new check, Family Shield, weekly
  schemes, reports, safety, explanation and language are grouped below it.
- Clarified quick-action labels so users understand that "new check" starts a
  fresh number/link/text/screenshot check instead of repeating the previous
  result.

## 2026-06-14 - Report Screenshot Evidence v1

- Added `.kiro/specs/report-screenshot-evidence-v1/`.
- Telegram `/report` now accepts screenshots during the description step and
  converts usable structured image evidence into a short redacted report
  description.
- The feature intentionally avoids Supabase Storage: raw images, data URLs,
  decoded QR payloads and full OCR text are not persisted.
- Router and report handler tests cover screenshot routing, unreadable-image
  fallback, oversized images and redaction of URLs/usernames/phones/codes in
  saved report drafts.

## 2026-06-14 - Reputation Appeals v1

- Added `.kiro/specs/reputation-appeals-v1/`.
- Added privacy-safe `reputation_appeals` storage for correction/removal
  requests: raw targets and contact details are never stored, direct
  anon/authenticated access is revoked, and server code writes with service-role
  after hashing, masking and redaction.
- Added public `/appeal` page plus `submitReputationAppeal` server function for
  phone, Telegram, URL and APK targets.
- Extended the admin dashboard with an appeal queue. Admins can remove public
  reputation labels or keep them after review; decisions are recorded in
  `admin_actions`.
- Added `ai_docs/MODERATION_GUIDELINES.md` and updated the roadmap/open tasks,
  API, database, file/function maps and AI index.
- Applied the production migration and verified the table exists with RLS
  enabled, a service-role-only policy and no direct `anon`/`authenticated`
  table grants.
- Railway deployment `51bbcd7c-1c5c-4d70-89a3-50733674adaa` passed public
  `/appeal` HTTP smoke, `prod:security-smoke`, `prod:smoke`,
  `prod:family-smoke` and `monitor:prod`.

## 2026-06-14 - Bot Safety Firewall v1

- Added `.kiro/specs/bot-safety-firewall-v1/`.
- Added `src/lib/risk/ai-output-safety.ts`, a user-facing AI output firewall
  that blocks prompt-injection leakage and any AI-authored request for SMS/OTP,
  PIN, CVV/CVC, passwords, card/seed data, APK installs, wallet signing or
  payments.
- `aiExplain` now returns `null` for unsafe provider output before it can be
  persisted in `checks.ai_explanation` or rendered in Telegram/web.
- Structured image `summary` is also sanitized before it can become fallback
  user-facing text; OCR evidence remains available for deterministic scoring.

## 2026-06-14 - Production operational follow-up

- Hardened Telegram Voice STT cost controls: voice notes are now capped at 60
  seconds / 2 MB, STT has a separate 5/day per-user budget, repeated Telegram
  `file_unique_id` values reuse a short-lived in-memory redacted transcript
  cache, and `transcribeVoiceCore` no longer double-consumes the normal check
  rate limit.
- Added Supabase migration `20260614064831_schedule_retention_cleanup_v1` to
  enable `pg_cron` and schedule `ishonch_prune_app_retention_daily` at
  `17 20 * * *` (daily 20:17 UTC).
- Verified the production cron job exists exactly once and is active, then ran
  `prod:security-smoke`, `prod:smoke` and `monitor:prod` successfully.
- Applied Supabase migration `20260613182647_honest_impact_counters_v1` to the
  linked production project and verified `get_check_stats()` returns the new
  aggregate-only impact fields.
- Railway `prod:smoke` and `monitor:prod` passed against
  `https://scam-guard-main-production.up.railway.app`; Telegram webhook health,
  Telegram `getMe`, and AI provider probe were green.
- Production AI is currently configured as `gemini-3.5-flash`; the provider
  probe returned `200` during this verification.
- `MONITOR_ALERT_CHAT_ID` is configured in Railway and GitHub Secrets, and a
  direct Telegram alert test returned `ok: true`.
- Inline check code is shipped and tested; BotFather inline mode was enabled
  with the RU placeholder `Введите номер, ссылку или текст для проверки`.
- Added `ai_docs/ON_CALL_RUNBOOK.md` for sanitized monitor-alert triage,
  recovery commands and security boundaries.

## 2026-06-13 - Website Honest Impact Counters v1

- Added `.kiro/specs/website-honest-impact-counters-v1/`.
- Added aggregate-only homepage impact counters for checks, risk alerts,
  moderated records and user-reported loss totals.
- Extended `get_check_stats()` migration and the TanStack server function with
  backward-compatible count fallbacks.
- Added `src/lib/trust/impact-stats.ts` with normalization/formatting tests.
- Recorded the safety boundary: these counters do not expose raw reports,
  targets, descriptions or unsupported "money saved" claims.
- Railway deployment `0629556b-1fda-4c76-a703-e5db2983f66e` passed
  `prod:smoke` and `monitor:prod`; the homepage returned 200 with the impact
  counter section.

## 2026-06-13 - Website Public Scheme Trends v1

- Added `.kiro/specs/website-public-scheme-trends-v1/`.
- Added `/scam-trends`, a public non-personal trend map of common tactics:
  bank/SMS-code calls, APK, casino/free-spins, NFT/Stars, TON/wallet,
  Telegram account-takeover, delivery/payment links and dropper recruitment.
- Added homepage scheme-trends teaser and navigation/footer entry points.
- Added `src/lib/trust/scheme-trends.ts` with stats, category filters,
  severity ordering and tests.
- Recorded the safety boundary: trends describe tactics, not accused people,
  channels, numbers or raw reports.
- Railway deployment `16633468-c6b6-4466-9d97-ab5b7899ad0a` passed
  `prod:smoke` and `monitor:prod`; `/scam-trends` returned 200 with trend
  content.

## 2026-06-13 - Website Trust Surface v1

- Added `.kiro/specs/website-trust-surface-v1/`.
- Added `/official-numbers`, a searchable public directory backed only by
  `VERIFIED_CONTACTS`.
- Added homepage trust block and a verified-contact count in `StatsStrip`.
- Changed aggregate reputation wording from direct "confirmed scammers" to
  moderated risk records.
- Recorded the safety boundary: official contacts are callback destinations,
  not proof that an incoming caller ID is safe.
- Railway deployment `766306d6-ba44-4fb5-9ce2-5abe3eb16415` passed
  `prod:smoke` and `monitor:prod`; `/official-numbers` returned 200 with
  directory content.

## 2026-06-13 - Weekly Scam Digest v1

- Added `.kiro/specs/telegram-weekly-scam-digest-v1/`.
- Added deterministic Telegram `/digest` with compact RU/UZ/EN wording for
  casino/frispin/VIP forecast, NFT/Stars/gift, TON/wallet, bank/SMS-code and
  APK funnels.
- Added a digest entry to `/start` and `/menu`, plus callback routing and
  localized `setMyCommands` registration.
- The digest avoids raw reports, copied Telegram posts and unverifiable
  accusations; it offers check/report/emergency next actions.
- Added unit/QA coverage for digest length, content, keyboard callbacks, command
  menus and welcome-menu structure.
- Railway deployment `bd6ff05b-abde-44eb-8203-ffe4ede4e736` passed
  `prod:smoke`, `monitor:prod`, `prod:security-smoke` and
  `prod:family-smoke`; Telegram command scopes were registered successfully.

## 2026-06-13 - Live-call Copilot Polish v1

- Added `.kiro/specs/telegram-live-call-copilot-polish-v1/`.
- The active live-call emergency screen now focuses on ending the call first and
  no longer offers safe callback before the user confirms hangup.
- `livecall:hangup` now routes to a compact post-call next step with safe
  callback, trusted-person support, ready phrase and full checklist actions.
- Ready-phrase callbacks use a smaller keyboard focused on hangup confirmation
  and trusted help.
- Updated targeted webhook/emergency tests for the compressed live-call flow.
- Railway deployment `b6b29704-d119-4053-a3dc-d209cc5722ef` passed
  `prod:smoke`, `prod:security-smoke`, `prod:family-smoke` and `monitor:prod`.

## 2026-06-13 - Official-number Lookalike v1

- Added `.kiro/specs/official-number-lookalike-v1/`.
- Extended `PhoneIntelligencePassport` with optional verified-contact lookalike
  evidence for near-miss phone numbers and short codes.
- Telegram and web result cards now say when a number is similar to an official
  contact but not an exact match, and advise safe callback through the app,
  card, official site or verified directory.
- The feature does not change score/level/reasons and does not claim owner,
  hidden spam history, SCAM labels or fraud by itself.
- Railway production deploy passed `prod:smoke`, `prod:security-smoke`,
  `prod:family-smoke` and `monitor:prod`.
- Updated roadmap/open-tasks/file/function/architecture docs.

## 2026-06-12 - Telegram Voice STT v1

- Added `.kiro/specs/telegram-voice-stt-v1/`.
- Telegram `message.voice` now routes to a dedicated handler when no stronger
  text/caption/link evidence exists.
- Short voice files are downloaded only in memory, transcribed through the
  configured AI provider, redacted and passed into the existing rules-first
  `runCheck` pipeline.
- STT supports Gemini native audio for `generativelanguage.googleapis.com`
  providers and OpenAI-compatible `/audio/transcriptions` for other providers.
- If STT is unavailable, oversized or unreliable, the bot gives a localized
  fallback asking for one short typed summary and offers emergency actions.

## 2026-06-12 - Shared Rate Limits v1

- Added service-role-only `rate_limit_buckets` and `claim_rate_limit()` for
  cross-instance public check/report/Telegram throttling.
- Added `checkSharedRateLimit(scope, key, limit, windowMs)`, which HMAC-hashes
  raw keys before persistence and falls back to the existing in-memory limiter
  when Supabase or `HASH_PEPPER_SECRET` is unavailable locally.
- Wired `runCheck`, OCR/image analysis, report submission and public Telegram
  post fetch limits to the shared limiter.
- Extended retention cleanup and production security smoke coverage for the new
  table/RPC, and moved the roadmap task from pending to shipped.

## 2026-06-12 - Telegram Webhook Shared Dedup v1

- Added service-role-only `telegram_webhook_updates` table for short-lived
  Telegram `update_id` idempotency claims across production Node instances.
- Added `claimTelegramWebhookUpdate(updateId)` and wired the webhook to use
  local in-memory dedup as a fast path plus shared Postgres dedup as the source
  of truth.
- The original v1 chose fail-open behavior when the shared store was
  unavailable. This historical choice was later superseded by D-047: current
  code returns retryable HTTP 503 before dispatch.
- Extended retention cleanup and production security smoke coverage for the new
  service-only table.

## 2026-06-12 - Scheduled Production Monitor

- Added `.github/workflows/prod-monitor.yml` to run public production checks every
  30 minutes and on manual dispatch.
- Updated `prod-monitor` so secret-backed Telegram checks are skipped as warnings
  when secrets are absent, while private schedulers can enforce them with
  `MONITOR_REQUIRE_SECRET_CHECKS=true`.
- Documented the GitHub secrets needed for full scheduled monitoring and alerts.
- Configured repository secrets for scheduled webhook, Telegram Bot API and AI
  provider checks; manual `Production Monitor` workflow run passed.

## 2026-06-12 - Production Monitor v1

- Added `scripts/prod-monitor.ts` plus `npm run monitor:prod` for recurring
  production checks: homepage, `/healthz`, Telegram webhook auth,
  `getWebhookInfo`, pending/recent Telegram errors and AI provider status.
- Added optional sanitized Telegram operator alerts via
  `MONITOR_ALERT_CHAT_ID`, using `TELEGRAM_BOT_TOKEN` by default or
  `MONITOR_ALERT_BOT_TOKEN` for a separate operations bot.
- Documented monitor variables and runbook in `DEPLOYMENT.md`, `.env.example`,
  `FILE_MAP.md`, `FUNCTIONS_MAP.md`, `ROADMAP.md` and `OPEN_TASKS.md`.

## 2026-06-12 - Retention cleanup and RLS hardening

- Added Retention Cleanup v1: `private.prune_app_retention()` defines explicit
  cleanup windows for `checks`, `reports`, `telegram_sessions`,
  `telegram_reputation_targets` and `telegram_family_shield`. It returns
  deletion counts and does not run automatically.
- Added `scripts/prod-security-smoke.ts` plus `npm run prod:security-smoke` to
  verify anon cannot read/write sensitive tables or execute maintenance/stat
  RPCs, while service-role can count required tables.
- Moved homepage stats behind `getPublicStats()` server function and hardened
  `get_check_stats()` to service-role-only `SECURITY INVOKER`.
- Moved the admin RLS helper to `private.has_role()` and revoked public
  execution of legacy `public.has_role()`.
- Applied both production migrations and verified Railway production with
  `prod:smoke`, `prod:family-smoke`, `prod:security-smoke` and Supabase
  Security Advisors (`No issues found`).
- Confirmed GitHub secret scanning and push protection are enabled, then enabled
  Dependabot security updates for dependency vulnerability PRs.

## 2026-06-12 - Audit action plan, Family Shield hardening and webhook dedup

- Updated `ROADMAP.md` with the post-audit checkpoint: shipped phone/Telegram
  trust work, Family Shield production verification, and the immediate order of
  Family Shield hardening -> webhook dedup -> retention/compliance -> security
  hygiene.
- Marked Family Shield v1.1 as shipped: active-link guard, invite TTL,
  trusted-contact opt-out, env-driven bot username and redacted trusted alerts.
- Added Telegram webhook `update_id` deduplication as an in-memory LRU for the
  current single-instance Railway deploy, with docs noting the shared-store
  requirement before multi-instance scaling.
- Kept official-number lookalike detection as the next visible trust feature.
- Documented Family Shield storage and webhook behavior in `DATABASE.md`,
  `API.md`, `FILE_MAP.md` and `FUNCTIONS_MAP.md`.

## 2026-06-12 - Family Shield production verification

- Applied the `telegram_family_shield` production migration through Supabase SQL
  Editor and verified service-role-only access.
- Added `scripts/prod-family-shield-smoke.ts` plus `npm run prod:family-smoke`
  for repeatable invite/accept/notify/revoke production checks with synthetic
  Telegram ids and no secret output.
- Updated Family Shield documentation to match the actual invite hash prefix
  used by the implementation.

## 2026-06-11 - Telegram Inline Check v1

- Added `.kiro/specs/telegram-inline-check-v1/`.
- Telegram webhook/router now handles `inline_query` updates without requiring a chat id.
- Added `answerInlineQuery` Bot API helper and `src/lib/telegram/handlers/inline.ts` for compact inline result articles.
- Inline checks call `runCheck(skipAi:true, persist:false)`, so typed previews do not call AI/OCR and do not insert partial queries into `checks`.
- Deployment docs now call out the BotFather `/setinline` operational step.

## 2026-06-11 - Roadmap and Phone Intelligence Passport v1

- Added `ai_docs/ROADMAP.md` as the canonical product implementation order.
- Added `src/lib/risk/phone-intelligence.ts` for honest phone metadata: country/calling code, Uzbekistan prefix/operator hint, format status and official-directory status.
- `runCheck` now returns `phoneIntelligence` for phone inputs; Telegram result cards use it for compact, useful phone explanations without inventing owner, hidden scam labels, account age, spam history or report volume.
- Kept moderated phone reputation as a separate next-stage task.

## 2026-06-11 - Telegram Response UX Compression v1

- Added `.kiro/specs/telegram-response-ux-compression-v1/`.
- Split panic scenario rendering into compact first cards and detailed full checklists.
- The first `/panic` scenario card now shows one urgent action, a calm cue and three immediate steps; verified contacts remain behind `panicctx:full` / safe-callback buttons.
- Lightened the default emergency follow-up keyboard by removing the repeated generic share-advice button while keeping the legacy callback supported.
- Compressed unreadable-image fallback and image triage copy into shorter hook/risk/safe-step answers.
- Image triage category callbacks now use a compact follow-up keyboard instead of repeating the full category menu under every answer.
- High-risk check result first cards now show urgent actions plus a short evidence summary; long generic explanation/reporting detail is not printed in the initial result card. Short visible-source briefs for forwarded Telegram posts remain visible.
- Unknown check result cards now hide weak topic-only observations such as `unknown_sender`, suspicious cards use "what I noticed" wording, and the result `why` button explains the latest check context when available.
- High-risk confidence follow-ups such as "Точно?" now answer with action-first safe steps, and unknown phone/Telegram-profile explanations no longer surface weak topic-only evidence such as valid phone format or unknown sender.

## 2026-06-11 - Emergency First-Card Human Guidance

- Added short human reassurance/explanation cues to the first `/panic` scenario cards for SMS-code, APK, transfer, card-data, lost-Telegram and live-call cases.
- Preserved the urgent action as the first content line so stressed users still see the safest next step immediately.
- Added regression tests for APK, card-data and live-call first-card wording.

## 2026-06-11 - Telegram Follow-up Memory v1 regression lock

- Added `.kiro/specs/telegram-followup-memory-v1/`.
- Added handler-level regression coverage proving short Telegram follow-ups such as "Точно?", "Что еще посоветуешь?" and "дай номер банка" bypass `runCheck` when no new artifact is present.
- This keeps post-check and orphan helper questions from rendering a fake "Недостаточно данных" risk card.

## 2026-06-11 - Telegram Public Post Evidence v2

- Added `.kiro/specs/telegram-public-post-evidence-v2/`.
- Public Telegram post checks now include visible link preview fields and inline-button labels/URLs in the rules-first evidence.
- This improves detection of visible casino/free-spins, betting/VIP, NFT/Stars, voting/captcha and reward mechanics hidden in Telegram previews/buttons.
- False-positive coverage keeps ordinary Telegram news/product previews and buttons non-accusatory.

## 2026-06-11 - Telegram Public Post Fetch v1

- Added `.kiro/specs/telegram-public-post-fetch-v1/`.
- Public Telegram post links now get a best-effort fetch of the public `t.me/s/<channel>/<post>` web page before the metadata-only fallback.
- The parser extracts only visible post text and visible outbound links, redacts sensitive digits, clamps evidence and sends it through the existing rules-first pipeline as text.
- The user-facing brief keeps the safety boundary: no hidden SCAM labels, account age, Telegram report counts or spam-history claims.

## 2026-06-10 - Telegram Public Post Link Boundary

- Public Telegram post links now preserve the post id from `t.me/username/123` and `t.me/s/username/123`.
- Metadata briefs now say clearly that Bot API can identify the public channel/account but does not read the specific post body from a bare link; users are asked to forward the post, paste the text, or send a screenshot.
- Added regression coverage so post-link handling stays non-accusatory and does not invent account age, hidden SCAM labels, report history or spam behavior.

## 2026-06-10 - Telegram Image Intelligence precision pass

- Improved Telegram screenshot explanations so casino/free-spins, NFT/Stars gifts, voting/contest gates, task rewards, wallet/DeFi actions and TON referral posts get scenario-specific copy instead of a generic image-analysis paragraph.
- Added deterministic coverage for Stars/NFT spin/lucky-draw/777 mechanics and public contest/voting domains tied to prizes.
- Split Telegram promo advice so casino/free-spins, betting predictions, giveaways and task/referral loops no longer share one generic recommendation.
- Preserved the false-positive boundary for ordinary Telegram news, product announcements and advertising posts.

## 2026-06-10 - Telegram Image Fallback Triage v1

- Added `.kiro/specs/telegram-image-fallback-triage-v1/`.
- Unreadable Telegram images now show quick scenario buttons for NFT/Stars gifts, casino/free-spins, TON/wallet, bank/code and menu/QR instead of ending at a generic OCR failure.
- `imgtriage:*` callbacks return scenario-specific safe steps without changing scoring or persisting checks.
- Safety boundary: the bot still does not guess unreadable image content or claim hidden Telegram SCAM labels, account age, report history or spam behavior.

## 2026-06-10 - Telegram Forward Scheme Brief v1

- Added `.kiro/specs/telegram-forward-scheme-brief-v1/`.
- Forwarded Telegram post replies now preserve a mini-brief with source, likely scheme, likely attacker goal, safe next step and Telegram visibility limit.
- Formatter truncation was adjusted only for forward-source briefs so scheme/goal/step lines survive mobile result-card formatting.
- The safety boundary remains unchanged: no hidden SCAM-label, account-age, Telegram report-history or spam-history claims.

## 2026-06-10 - Telegram Forward Source Context v1

- Added `.kiro/specs/telegram-forward-source-context-v1/`.
- Forwarded public Telegram channel/group posts now include a short source note in bot replies when Telegram exposes title/username.
- The source note is reply-only: it is not appended to `runCheck` input, does not affect score/level/reasons and is not persisted in `checks`.
- Hidden/private forward origins remain excluded, and the copy explicitly avoids hidden SCAM-label, account-age, report-history or spam-history claims.

## 2026-06-10 - Telegram Video Thumbnail Intelligence v1

- Added `.kiro/specs/telegram-video-thumbnail-intelligence-v1/`.
- Telegram videos with no caption/link/button evidence now use the Telegram-provided thumbnail as image evidence when available.
- Full video files are still not downloaded; thumbnail analysis reuses the existing in-memory image/QR/OCR path and size limits.
- Unsupported-video copy now explains that preview frames are checked automatically when Telegram provides them, otherwise the user should send a link, screenshot frame or short description.

## 2026-06-10 - Telegram Evidence Brief v1

- Added `.kiro/specs/telegram-evidence-brief-v1/`.
- Telegram username/link/private invite explanations now put the visible scenario first when risk reasons are present: betting/VIP, casino/free-spins, NFT/Stars giveaways, captcha/voting gates, task rewards, wallet urgency, TON referrals, account takeover and official-looking credential requests.
- The brief still keeps the no-false-authority boundary: no account age, hidden Telegram SCAM labels, Telegram report counts or spam history unless a real trusted source exists.
- Profile-only and not-found checks without scam context still use the honest limitation-first answer and ask for the actual message, preview or screenshot.

## 2026-06-10 - Telegram QR Decoder v1

- Added `.kiro/specs/telegram-qr-decoder-v1/`.
- Added a bounded pure-JS QR decoder for Telegram PNG/JPEG images; images stay in memory and oversized decoded dimensions fail closed.
- Decoded QR values now merge into structured image evidence, so QR URLs can be scored even when AI image analysis returns `null`.
- Added embedded-URL scoring for text/multiline check inputs, allowing decoded QR URLs inside image evidence to trigger existing URL reason codes.

## 2026-06-10 - Telegram Image Intelligence v3

- Added `.kiro/specs/telegram-image-intelligence-v3/` for forwarded Telegram promo screenshots and video frames.
- Image evidence now recognizes Telegram casino/free-spins funnels, NFT/Stars giveaway gates, task-reward campaigns, wallet/DeFi urgency, TON referral earning, and private invite hints, then feeds existing scam-research-feed-v2 reason codes.
- Added false-positive coverage so ordinary news/product Telegram screenshots do not become scam promo results just because they mention Telegram, TON, NFT, wallet or Web3.

## 2026-06-10 - Telegram Image Fallback Follow-Ups

- Unreadable Telegram photos/screenshots now persist a safe `image_unreadable` last-check snapshot, so short follow-ups like "Точно?" / "sure?" answer the image limitation instead of creating a generic insufficient-data risk card.
- Repeated standalone unreadable images now get a shorter second fallback, while album duplicates remain suppressed.
- Image evidence usability now rejects model text that only says the image was unreadable, preventing pseudo-analysis from blurry screenshots.

## 2026-06-10 - Scam Research Feed v2

- Added `.kiro/specs/scam-research-feed-v2/` for Telegram/Web3 promo funnels from user screenshots plus external scam research.
- Added deterministic reason codes for casino/free-spins bonus funnels, CAPTCHA/voting prize gates, task-reward engagement bait, wallet/DeFi urgency and TON/crypto referral earning schemes.
- Extended Telegram advice and public metadata labels so these posts get contextual next steps instead of generic "insufficient data" or unrelated OTP/card advice.
- Added regression tests and false-positive guards for ordinary sports/news posts, Telegram product announcements, wallet feature news and non-crypto battery/top-up wording.

## 2026-06-09 - Production Smoke Script

- Added `scripts/prod-smoke.ts` and `npm run prod:smoke` as a repeatable Railway/Telegram/AI verification command that does not print secrets or chat ids.
- Deployment docs now include the normal smoke command and optional `--live-telegram` mode for one synthetic high-risk Telegram update.

## 2026-06-09 - AI Provider Resilience v1

- Added bounded retry for transient OpenAI-compatible provider failures (`429`, `500`, `502`, `503`, `504`) in the shared AI chat-completion helper.
- Provider `429` responses that contain Gemini/GCP-style quota exhaustion (`RESOURCE_EXHAUSTED`, `quota exceeded`, `generate_content_free_tier_requests`) are now treated as non-retryable, so one user check does not burn multiple quota attempts.
- `OPENAI_FALLBACK_*` is now attempted immediately after a failed primary AI provider call, including primary quota exhaustion, instead of only when the primary circuit breaker was already open.
- Non-retryable provider errors such as `401` still degrade immediately to rules-only results.
- Local AI request aborts/timeouts are not retried, preventing a hung provider from multiplying Telegram webhook latency.
- Circuit-breaker accounting now treats exhausted retries as one logical AI failure, while a successful retry resets the failure counter.

## 2026-06-09 - Telegram Link/Account QA Polish

- Telegram username and invite-link result cards now use shorter "what I can see / what I cannot see / safe next step" copy.
- Telegram profile-only checks now get a dedicated context prompt asking for the suspicious message or screenshot instead of a generic "send link/number/full text" fallback.
- High-risk Telegram invite/support-name results now show the Telegram limitation brief before reason labels, so useful context is not truncated behind generic reasons.
- Test mocks for Telegram handler property tests were updated to cover metadata enrichment without accidental Supabase or Bot API noise.
- Unsupported video/audio replies now include a media-specific "What to send?" button with concrete capture instructions instead of a generic how-it-works action.

## 2026-06-09 - Emergency Copilot Guided UX

- Live-call panic mode now starts with a guided "say this, hang up, then tap the button" flow instead of a plain warning.
- Emergency follow-up buttons were made more action-oriented: "Позвонить безопасно" and "Готовая фраза".
- Bank callback, trusted-person and post-call follow-ups now use step-by-step language for stressed or elderly users, while preserving the no-SMS-code/no-card-data safety boundary.

## 2026-06-09 - Telegram Orphan Follow-Up UX

- Short follow-up phrases without a stored last-check context, such as "Точно?", "что дальше?" and "дай номер банка", now receive helper guidance instead of a generic "insufficient data" risk card.
- Unsupported video/audio guidance now asks for the useful evidence: caption link, screenshot frame, visible QR/username/payment details, or the promise/request from the video.
- Private Telegram invite copy now explicitly says the bot can judge only the invite link and user-provided context, then asks for Telegram preview/channel/post screenshots before stronger conclusions.

## 2026-06-09 - Telegram Reputation Targets v1

- Added `telegram_reputation_targets` as a privacy-safe DB layer for Telegram targets.
- Telegram target observations and report candidates use HMAC-hashed identifiers and masked display hints only.
- Unverified user reports stay hidden from user-facing reputation; confirmed moderator decisions can add source/confidence labels.
- Updated Telegram Link & Account Intelligence v2 tasks 11-13 from future work to implemented.

## 2026-06-09 - Telegram Account Limits Help

- Extended `.kiro/specs/meta-intent-router/` from six to seven intents with `telegram_account_limits`.
- Added a user-facing RU/UZ/EN explanation of what Telegram account data the bot can and cannot see.
- Marked Telegram Link & Account Intelligence v2 task 14 complete.
- Covered scam-label/account-age/report-history questions so they no longer fall into generic "insufficient data" replies.

## 2026-06-09 - Report Flow Reputation Boundary v1

- Added `.kiro/specs/report-flow-reputation-boundary-v1/`.
- Added an incident-only report boundary for Telegram `/report` flows with no concrete target.
- Situation-only reports are stored for moderation/research but do not upsert or increment public `entities`.
- Admin moderation now skips entity sync for the incident-only marker, preserving audit logging.

## 2026-06-09 - Telegram Link & Account Intelligence v2

- Added `.kiro/specs/telegram-link-account-intelligence-v2/`.
- Extended Telegram username/link enrichment with compact visible risk signals and next steps.
- Clarified public/private/internal Telegram link handling and the no-false-authority boundary: no account age, hidden scam labels, Telegram report counts or spam history unless a real source is added later.
- Added regression coverage for private invite betting/prediction links and rendered not-found username limitations.

## 2026-06-07 - Telegram Public Metadata v1

- Added `.kiro/specs/telegram-public-metadata-v1/`.
- Added Bot API `getChatInfo` and Telegram-channel enrichment for public `@username` / `t.me/...` checks.
- Private invite/internal Telegram links now get an explicit limitation brief instead of a generic answer.
- Added `telegram_profile` last-check context so short follow-ups stay contextual.
- Suspicious Telegram results can render a short `brief` block when an explanation is available.

## 2026-06-07 - Telegram Media & Link Intelligence v1

- Added `.kiro/specs/telegram-media-link-intelligence-v1/`.
- Fixed Telegram routing so video/audio/voice/non-image document captions are analyzed before unsupported-media fallback.
- Added private invite normalization for `t.me/+...` links.
- Added `gambling_prediction_promo` for closed betting/prediction invite channels with false-positive guards for ordinary sports/news/restaurant QR contexts.
- Added context-specific advice for betting/prediction invite links and a more useful unsupported-media fallback.

## 2026-06-06 - Scam Research Feed v1

- Added `.kiro/specs/scam-research-feed-v1/`.
- Added deterministic rules for Telegram account deletion/"Cancel" phishing and card/SIM/account dropper recruitment.
- Added context-specific Telegram advice so these cases do not fall back to unrelated generic guidance.
- Updated scam coverage and open-task docs with source-backed research-feed handling.

## 2026-06-06 - Result Message UX live hardening

- Tightened Telegram result messages after live feedback: unknown crypto/investment, restaurant QR/menu, delivery SMS and phone checks now render shorter contextual briefs.
- Fixed scam-pattern matching so weak context codes such as `unknown_sender` no longer invent a specific scheme like "Fake bank in Telegram".
- Safe phone results now explain that a number alone does not prove risk and ask for the caller's request if they asked for a code, money or app.

## 2026-06-06 - Emergency follow-up hardening

- Broadened Telegram Emergency Copilot follow-up routing for live-user phrases like "what should I do next?", "bank hotline", "I'm nervous", and "what should I tell a close person?".
- Added a one-tap `panicctx:more` button so users can continue from an emergency answer without typing.
- Added regression tests for exact post-panic follow-up phrases that previously felt like dead ends.

# 2026-06-11 - Phone Reputation v1

- Added `.kiro/specs/phone-reputation-v1/`.
- Added a confirmed-only phone reputation summary built from moderated `entities` rows.
- Telegram result cards now show Ishonch Guard moderated report count and confidence for confirmed phone numbers, while explicitly avoiding owner/carrier/hidden-label claims.
- Updated roadmap, database, architecture, file/function maps and decisions.

## 2026-06-19 - Moderation duplicate report alerts

- Fixed `/report` duplicate handling: same-day reports for an already-seen target still avoid creating a duplicate DB row, but now send a safe "повторная жалоба" alert to the moderation chat.
- Moderation duplicate alerts keep the target masked and explicitly tell operators that the full review belongs in the admin panel.
- Added regression tests for duplicate report notification and duplicate alert formatting.

## 2026-06-06 - Telegram Image Intelligence v2

- Added `.kiro/specs/telegram-image-intelligence-v2/`.
- Added structured image evidence for Telegram photos/screenshots: visual category, QR purpose, risk hints, redacted OCR text and short explanation.
- Benign delivery SMS and restaurant/menu QR screenshots no longer become high-risk from negative safety wording; dangerous QR login/payment still scores through reason codes.
- Updated architecture, API, database, file/function maps and decisions.

## 2026-06-05 - Emergency Copilot v2

- Added a new Telegram emergency copilot layer for post-`/panic` follow-up questions.
- Panic context now stores only `lastPanicId` and `lastPanicAt` in `telegram_sessions.scenario_data`.
- Short follow-ups like "what next?", "bank number" and "what should I say?" get contextual replies; suspicious payloads still route to the risk pipeline.
- Added the `.kiro/specs/telegram-emergency-copilot-v2/` spec and updated file/function/API/database decision docs.

## 2026-06-02 - Live QA hardening

- Fixed Telegram inline callback acknowledgement: router now forwards
  `callback_query.id`; report skip callbacks also clear the Telegram spinner.
- Added integration coverage for `/start`, quick buttons, panic callback and
  report skip callback.
- Fixed Telegram short description script to respect Telegram's 120-character
  `setMyShortDescription` limit.
- Fixed mobile accessibility floating-button overlap on check/home forms.
- Railway `/healthz` currently responds; remaining deploy work is operational
  verification of secrets, migrations and live bot flow.

## 2026-06-02 - Sensitive DB write lockdown

- Revoked direct public inserts into `checks` and `reports`; writes now go
  through server functions/service-role after validation, redaction and hashing.
- Updated `DATABASE.md`, `API.md` and `DECISIONS.md` to reflect the security
  boundary.

## 2026-06-01 — Production deploy + pre-deploy hardening

- **Deployed to Railway** (https://scam-guard-main-production.up.railway.app). Telegram webhook registered, bot live at @scamguard_bot.
- PR #17: pre-deploy hardening — fixed .gitignore NUL bytes, removed duplicate consolidated migration, switched Dockerfile to Bun, enabled short-code verified lookup in pipeline, added verified contact UI to web RiskResultCard, fixed check logging order (finalLevel), updated README/OPEN_TASKS.
- PR #16: `/panic` interactive emergency mode — inline buttons for 6 scenarios instead of one big text wall.
- PR #15: dynamic `/emergency` checklist pulling real numbers from verified-contacts module.
- PR #14: integrated verified contacts into risk engine + Telegram formatter (badge + spoofing warning, dangerous override).
- PR #13: expanded verified contacts seed to 27 entries (banks, telecoms, payment systems, government, UZCERT).
- PR #12: initial verified contacts module.
- PR #11: public README + CONTRIBUTING.md.
- PR #10: CI workflow, /healthz endpoint, Dockerfile VITE\_\* ARGs, .gitignore fix.
- Supabase migrations applied (8 migrations; consolidated duplicate removed).
- 215+ tests, CI green, production build verified.

## 2026-06-02 - Payment input detector

- Added a conservative `payment` input detector for payment-flow text.
- Updated `OPEN_TASKS.md` and `SCAM_COVERAGE.md` so payment detection is no longer listed as missing.
- Recorded the detector boundaries: pure URLs/APKs/Telegram links keep their primary type.

## 2026-06-02 - Lovable build wrapper removed

- Updated architecture/deployment/tooling docs for direct Vite/TanStack/Nitro configuration.
- Recorded that the Lovable-authored design remains, but Lovable-specific build tooling is no longer part of the production path.
- Removed the stale `lovable-error-reporting.ts` file map reference.

## 2026-06-02 - Research-feed scam coverage rules

- Documented `known_reported`, `fake_delivery_payment`, `fake_boss_request`, `malicious_file_bait`, and stronger `payment_before_service` coverage.
- Updated `SCAM_COVERAGE.md` and `OPEN_TASKS.md` so completed research-feed patterns no longer appear as planned work.
- Recorded the removal of the old high-risk entity APK proxy in favor of `known_reported`.

## 2026-06-01 - Production-readiness sync

- Updated AI memory to reflect the actual runtime: self-hosted Node/Nitro `node-server`, Docker/Railway-ready, no Lovable Cloud production dependency.
- Updated AI integration docs from Lovable/Gemini to provider-neutral OpenAI-compatible Chat Completions (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`).
- Marked Telegram bot MVP as implemented and documented the webhook/session architecture.
- Added `pressauz` as a local research feed for new Uzbekistan scam patterns.
- Recorded privacy hardening: report descriptions and OCR model output must be deterministically redacted before persistence/use.

## 2026-05-30 - Initial AI memory created

- Analyzed the real codebase and supplied zip.
- Created `AI_INDEX.md`, `AGENTS.md`, and `ai_docs/`.
- Mapped TanStack Start + React 19 + Supabase stack, server-function RPC layer, rules-first risk engine, DB schema/RLS, auth/role model and deployment notes.
- Documented competitor/market research and current Uzbekistan scam landscape.
