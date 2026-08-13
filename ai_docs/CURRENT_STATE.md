# Current State

Last reconciled: 2026-08-13

This is the short operational source of truth. Dated audit and release-plan
documents preserve the evidence available when they were written; their old
commit ids, test totals and unchecked rows are historical unless repeated
here.

## Deployed baseline

- GitHub `main` and the deployed application source are PR #126 merge
  `8a76a5ec6994fd208cccde731bab2d5c70b6d232` (tree
  `62903a6c844d4d7284f2e2bdc93ba47361cbe538`). It includes PR #123-125
  action-state, task-scam, BNPL and transfer-secrecy hardening plus PR #126
  post-canary multilingual routing and secret-sink reconciliation.
- Current Railway production deployment
  `895a82f3-6e59-4b91-8ec7-513330e4f7cb` reports `SUCCESS`, with image digest
  `sha256:6bc60d2089cc4c61e2c2b7ca6f6af1239cc1d84c5b1dcd4d7f96679f4c1f1f27`
  and one running instance in US West. A 2026-08-13 post-deploy read-back
  confirmed that the active deployment and `origin/main` use the same commit.
- Production `/healthz`, `/`, `/login`, `/admin`, `/admin-mfa`, `/report`,
  `/appeal`, `/privacy` and `/emergency` returned `200` after the application
  release; `/healthz` returned body `ok`. An existing AAL2 admin session loaded
  protected data and showed the established aggregate check count of `235`.
- Supabase production migration history is `33` versions with head
  `20260729131000`. Both `20260729105030` and `20260729131000` are applied; a
  subsequent linked dry-run reported `Remote database is up to date`.
- Production source negotiates streaming Brotli/gzip for eligible dynamic `GET`
  responses and serves precompressed public assets. The release smoke measured
  homepage Brotli at 14,158 bytes for 62,216 decoded bytes and main CSS Brotli
  at 40,302 bytes for 258,542 decoded bytes. Gzip fallback, explicit identity,
  ordinary quality weights, CSP preservation and exact CSS round trip passed.
  The abort/error/cancellation hardening is now deployed in source, but its
  forced-failure path still has only local deterministic evidence. Nitro's
  static asset handler does not correctly honor all `q`-weighted
  `Accept-Encoding` forms.
- The webhook without its secret returned `401`; the authenticated webhook
  boundary returned the expected `503` in polling mode, polling-leader health
  returned `200`, Telegram pending updates were `0`, and no synthetic Telegram
  update or message was delivered.
- The deployed Direct P0 behavior distinguishes definitive retryable,
  definitive permanent and ambiguous primary `sendMessage` failures. A
  context-neutral sequenced/fenced claim runs before send without writing
  `lastCheck`; context is committed only after successful or ambiguous delivery.
  A definitive retryable failure returns a sanitized bounded delay through
  webhook `503`/`Retry-After` or the polling frontier without rollback.
  Ambiguous outcomes are not replayed because Telegram may already have
  accepted the card; secondary Guardian/trusted-contact effects are suppressed.
  Permanent rejections are drained without phantom context, and a post-send
  context failure is operator-only. Focused Direct/session tests passed
  475/475, the broader delivery/lifecycle set passed 247/247 and lifecycle
  pgTAP passed 41/41. Exactly-once delivery is still not claimed because
  Telegram exposes no idempotency key and there is no durable outbound outbox.
- The manual release postflight unintentionally made one provider health
  request because an inherited Railway environment key was not removed by the
  local PowerShell override. It returned `200` for `gemini-3.5-flash`, contained
  no user content and may be billable. Separately, the configured scheduled
  Production Monitor ran 60 times in the 2026-07-29 through 2026-08-02
  Asia/Tashkent audit interval (59 successful workflow runs and one failed
  workflow run). Its configured path attempts one provider health request per
  run; 56/56 inspected run logs explicitly contained a provider result. Budget
  accounting must therefore include the 60 scheduled attempts plus the one
  manual release request. Do not describe the interval or release verification
  as zero-AI-call.
- The deployed half-hour baseline is cost-safe: it sets
  `MONITOR_CHECK_AI=false`, exposes no `OPENAI_*` secret to
  scheduled runs, and makes warnings fail and alert. A false-by-default manual
  boolean starts an independent `--ai-only` job; enabled missing-key,
  `429`/`5xx` and network failures are hard failures. The manual job receives no
  Telegram credentials, and manual workflow runs cannot cancel scheduled
  observations. The general `prod:smoke` is also no-AI by default even when a
  Railway environment injects the key; only `--check-ai` opts in. Manual
  baseline run `31242484006` passed with its AI job skipped. Eleven scheduled
  fixed-RC runs through `2026-08-08T14:23:57Z` passed with sampled logs stating
  `disabled by policy` and `no request sent`. Historical `60 + 1` provider-call
  accounting for the earlier interval remains unchanged.
- PR #125 CI passed 168 Vitest files / 13,003 tests, repository coverage
  thresholds, TypeScript, production build and ESLint with zero errors plus the
  eight established Fast Refresh warnings. Its migration/schema job and all
  Security Gates also passed. All seven reported CI/security checks were green
  for each of PR #123, PR #124 and PR #125. The earlier PR #121 clean-database,
  pgTAP, container, audit and secret-scan evidence remains the database/release
  foundation because PR #123-125 changed no migrations or dependencies.
- Railway plan/payment activation made the configured US West region usable.
  Production is bound to `main`, Auto Deploy is enabled and Wait for CI is
  enabled. PR #122 first proved that binding end to end; PR #123-126 then
  repeated the green-CI automatic-deployment path. The current deployment was
  created directly from the PR #126 merge after both merge-commit workflows
  passed.
- The historical 72-hour wall-clock observation for `1576e21` contained 66 scheduled
  Production Monitor runs: 65 succeeded and one timed out after eight seconds
  while checking that a webhook without its secret is rejected. The same failed
  run passed home, health, authenticated polling webhook, Telegram status,
  zero-pending and polling-leader checks; adjacent and all final-24-hour runs
  recovered without a deploy. This supports an operational checkpoint `GO` for
  that prior release/transport, with no sustained outage or repeated
  silent-update confirmed. Formal `CANARY_72H` closure remains `OPEN`: the
  unchanged contract requires at least 144 eligible successes and a documented
  disposition of the failed security-boundary observation. Full device,
  accessibility and legal/privacy acceptance is also still open. See
  `CANARY_72H.md`. Deployment of PR #126 restarted the observation clock; its
  formal current-RC canary remains `OPEN`.

## Merged and deployed Telegram hardening

- PR #123 added completed-action RU/UZ/EN routing plus bounded spaced-letter
  and `0`-leet normalization. Ambiguous “I told them everything” wording
  requires recent code context; quotes, third-party actions, physical access
  codes and negations remain negative controls.
- PR #124 added deterministic task-scam, unauthorized BNPL/credit and
  official-operation/coercive-secrecy handling in Direct and Inline. PR #125
  preserved the transfer-secrecy topic in the real-client Direct and Inline
  follow-up variants that remained too generic after PR #124.
- A post-canary offline recheck on exact `1576e21` passed 36 focused files and
  10,518/10,518 tests, including the 2,161/2,161 adversarial corpus, 3,805
  Inline-handler cases, 1,008 human-router cases and 105/105 meaningful Inline
  mass results. The test harness blocked unmocked network calls; it made no
  Telegram, AI or database request.

## Deployed post-canary hardening (PR #126)

- PR #126 was built on the isolated branch
  `agent/post-canary-reconciliation-20260813` from exact `1576e21`, then merged
  as `8a76a5e` after all PR and merge-commit CI/security gates passed. Building
  and validating the candidate used no real Telegram message, AI/TTS request or
  database operation and did not touch the protected dirty worktree.
- The candidate closes additional completed-action RU/UZ/EN variants, bounded
  confusable/leet normalization false positives, task-scam/BNPL/coercive
  secrecy variants and report-callback expiry/cross-chat binding.
- Secret handling now covers typed and Voice routes, mixed-script multi-secret
  input, spaced/typo labels, formatted/value-first alphanumeric codes,
  private keys and canonical recovery lists. Inline secret cards contain no
  user-derived context; Voice secrets are neither cached nor shared raw.
- Focused final reconciliation passed 3,683/3,683 tests and a separate security
  review passed 1,783/1,783 with no reproducible P0/P1 blocker. The final full
  gate passed 174 files / 13,482 tests, TypeScript, production build and ESLint
  with zero errors plus the eight established Fast Refresh warnings. Changed
  code passes Prettier and `git diff --check`. Coverage passed at 86.25%
  statements, 81.06% branches, 91.56% functions and 88.10% lines.
  Dependencies did not change. GitHub nevertheless repeated migrations/schema,
  CodeQL, Gitleaks and container/SBOM gates successfully on both the PR head and
  merge commit. Post-deploy no-AI smoke passed home, health, webhook boundaries,
  Telegram pending `0`/no last error and polling-leader health without sending a
  Telegram message or provider request.

## Closed in the current release

- The historical 227 Direct-topic failures are not the current baseline. The
  corpus is green, and the three exact semantic tails found by the 2026-07-29
  audit are included in the deployed source. Final real-client proof remains
  open.
- The approved UI release is integrated with the backend/security work.
- Public emergency contacts use the centralized verified registry, and the
  mobile accessibility fixes from `74663ce` are deployed.
- Family Shield defaults to consent-aware behavior and uses idempotent alert
  claims. Migration `20260729105030` is applied in production, so inactive
  expired claims are included in the existing scheduled retention function.
- The Supabase service client is outside the browser dependency graph and the
  client-bundle guard is present.
- Two independent approved admin owners are enrolled in TOTP MFA.
  `REQUIRE_ADMIN_MFA_AAL2=true` is deployed and a fresh AAL2 login succeeded.
  Migration `20260729131000` is applied in production: all seven protected
  admin policies require `private.is_admin_aal2()`, including both UPDATE
  `WITH CHECK` clauses. Public confirmed-row policies and service-role behavior
  remain intact.
- Hash-pepper versioning is applied. New synthetic writes were verified as
  `v2`, legacy reads remained valid and the synthetic row was deleted.
  `HASH_PEPPER_SECRET` remains required for historical `legacy` rows and must
  not be removed.

## Database hardening and application release

The two database migrations below were first proven in isolated staging on
2026-07-29, including official history reconciliation, and were then applied
once to production from approved merge `d053e35` during the separately
authorized maintenance operation. The freeze and migration apply occurred on
2026-08-01 in Asia/Tashkent; post-resume observation crossed midnight into
2026-08-02 local time. The compatible
application/security/Telegram source was subsequently released from approved
`main` commit `9e901b1` in its own production action:

- migration `20260729131000_admin_mfa_aal2_rls.sql` adds
  `private.is_admin_aal2()` and requires an AAL2 admin JWT for protected
  authenticated SELECT/UPDATE policies. The revised hosted smoke now uses the
  same real user client before and after TOTP instead of substituting a
  service-role read. Hosted catalog checks and the transaction-isolated pgTAP
  suite pass 23/23, including AAL2 non-admin denial. Staging exposed and closed
  two pre-release defects: the
  helper now reads `public.user_roles` directly so the intentionally closed
  `private` schema remains closed, and five write assertions now use top-level
  data-modifying CTEs accepted by hosted PostgreSQL. The revised hosted smoke
  passed with the same ordinary user client: the protected direct read was
  denied at AAL1, TOTP upgraded the session to AAL2, and the same read then
  returned exactly one fixture. The factor, synthetic Auth user, allowlist,
  roles and fixture were removed and the baseline counts were restored.
  Production postflight later confirmed the helper privileges and all seven
  protected AAL2 policies;
- production/Railway now requires an explicit `REQUIRE_ADMIN_MFA_AAL2` value.
  Missing, empty or invalid configuration fails closed; dev/test may still omit
  it;
- dynamic HTTP compression uses an abort-aware stream pipeline, propagates
  upstream failure/downstream cancellation and returns `406` when every
  supported encoding including identity is forbidden. Focused checks pass
  27/27. Nitro static precompression still has an open `q`-weight negotiation
  limitation. The hardening is deployed in source; production forced-failure
  evidence remains open;
- the three audited Telegram cases are deployed in source: bank/card code theft in a
  Telegram message stays a code request, Uzbek `rostdan firibgarlarmi` preserves
  bank/code context through `endi nima qilay`, and the common typo
  `безапасный счет` reaches explicit no-transfer guidance. Targeted checks pass
  468/468, the Telegram suite 10,872/10,872 and the adversarial corpus
  2,161/2,161;
- migration `20260729105030_family_notification_claim_retention.sql` adds
  expired Family notification claims to the existing daily retention function.
  Its focused contract passes 15/15 and hosted transaction-isolated pgTAP
  passes 10/10. The restored staging project does not currently expose
  `cron.job`, so schedule parity was never claimed from staging. Production
  postflight confirmed the existing `17 20 * * *` cron and updated function;
- the local `.env` ACL is restricted to the owner, `SYSTEM` and Administrators.
  New guarded Supabase package commands hard-block a production link and require
  the linked ref, staging env refs and an explicit staging ref confirmation to
  agree before a linked migration list or no-change dry-run. After the guarded
  staging closeout, the one-time fixed repair and ordinary `db push` recipes
  were retired so they cannot be repeated from package scripts. The child CLI
  now receives only a system/proxy/Supabase-CLI environment allowlist, excluding
  application service-role, Telegram, AI and Vite variables. The historical
  guarded run completed the exact two-version repair, post-repair list and
  no-change dry-run without running an ordinary `db push`;
- Supabase CLI `2.104.0` on Windows has a credential-store interoperability
  defect: automatic login writes the legacy Go credential to Windows Credential
  Manager successfully, while the TypeScript `projects list` path cannot reload
  that physical target. The token was not printed and was not written to a
  plaintext file or the repository; the native CLI read it through the OS
  credential store. Do not log out or manually move the credential;
  a separately reviewed update to CLI `2.110.0` or newer contains the Windows
  compatibility fallback.

The historical PR #121 application candidate passed 167 Vitest files and
12,890/12,890 tests, coverage floors, TypeScript, production build with
non-secret placeholders and lint with zero errors plus the eight established
Fast Refresh warnings. GitHub CI and Security Gates passed again on merge
`c5fa51d`. A fresh local Supabase database applied all 33 migrations from
scratch; schema lint reported no errors and all four pgTAP files passed 92/92.
The database-only production window remains documented separately and must not
be presented as the later app release. No local Supabase container is running;
the disposable validation volume remains. Local clean-database evidence and
production deployment evidence remain distinct even though the verified PR
tree exactly matches the deployed release tree.

## Recovery progress

- The Windows EFS certificate/private key was exported to the
  password-protected
  `ishonch-guard-efs-recovery-20260726.pfx`.
- A separate 10-year Document Encryption certificate was created for portable
  CMS recovery and exported to the password-protected
  `ishonch-guard-portable-backup-recovery-20260726.pfx`.
- Both password-protected PFX files are also stored in a private Google Drive
  account independent of the workstation and OneDrive backup. Manually
  downloaded copies matched the local byte lengths and SHA-256 values, both
  rejected an empty password, and the operator confirmed separate recoverable
  password custody. No password or private key material is in the repository.
- The database archive and its metadata were CMS-encrypted as `.p7m` files in
  `C:\Users\user\OneDrive\Ishonch Guard Recovery`.
- Both `.p7m` files passed in-memory decrypt-and-SHA-256 round trips. No
  plaintext database dump was written to the OneDrive folder.
- The local Windows OneDrive folder was not connected to the signed-in cloud
  account, so the five recovery files were uploaded through the authenticated
  OneDrive web interface instead of assuming local sync.
- The first signed-in OneDrive web readback confirmed five original recovery
  items. After the restore drill, a preferred restore-ready v2 archive,
  encrypted v2 metadata and `README-RECOVERY-V2.txt` were added. Final cloud
  readback confirmed all eight expected names and displayed sizes.
- The original 10-entry archive passed every manifest byte-length and SHA-256
  check. Its four separately generated schema files have cross-schema
  dependencies, so a naive one-pass empty-database restore is not valid.
- A disposable local Supabase/Postgres cluster reconstructed those schemas,
  generated a dependency-ordered `schema.sql`, generated a consolidated
  `data.sql`, and then restored both into a second clean database in single
  transactions. Roles restore, schema lint and pgTAP 53/53 passed.
- Count-only restored invariants matched the snapshot: Auth users 2,
  admin allowlist 2, user roles 4, checks 235, reports 8, entities 7,
  appeals 2, Family Shield rows 7, reputation targets 9 and Telegram
  sessions 4. No row identifiers or secret values were printed.
- The preferred EFS-protected local archive is
  `ishonch-guard-production-20260726-1139-restore-ready-v2.efs.zip`, with
  SHA-256
  `35889f4a8a90c216a4e94f00a761c27f9934b057755e3abd7af8ca3617b1b8ea`.
  Its CMS copy and metadata both passed in-memory decrypt-and-hash round trips
  before the cloud upload.
- The v2 archive was restored into isolated Free/nano Supabase staging project
  `gwwcooupkmhihaigympb` with outbound integrations disabled.
- Hosted catalog/RLS checks, schema lint, pgTAP 53/53, exact migration-history
  reconciliation, service-role paths and a synthetic TOTP flow passed. Every
  synthetic row/factor/user was removed and the ten count-only invariants
  returned to `2, 2, 4, 235, 8, 7, 2, 7, 9, 4`. The original smoke proved the
  application AAL1 gate and TOTP upgrade but used service role for its final
  database read; it did not prove direct AAL1/AAL2 PostgREST policy behavior.
- On 2026-07-29, the two new hardening migrations were applied to the same
  isolated staging database. Retention pgTAP passed 10/10, admin AAL2 RLS pgTAP
  passed 23/23, all twelve final catalog/postflight checks passed and every
  synthetic test fixture rolled back to zero rows. The guarded CLI repair then
  marked only `20260729105030` and `20260729131000` as applied. A second
  migration list fully matched local history and guarded `db push --dry-run`
  reported the remote database up to date; no ordinary push ran. The revised
  same-client HTTP/PostgREST smoke proved AAL1 denial and AAL2 success and
  restored Auth/allowlist/role counts to `2, 2, 4` with no synthetic fixture
  remaining. The restored staging database still lacks `cron.job`, so the
  scheduled job is an explicit staging-parity gap rather than claimed evidence.
- Before the production apply, Railway reached zero instances and two stable
  read-only snapshots matched. A fresh EFS/CMS-encrypted logical backup passed
  local decrypt/hash verification and its ciphertext files were uploaded to
  private OneDrive. OneDrive displayed the expected names and sizes, but the
  browser did not expose a completed download event, so cloud byte-hash
  readback is not claimed. That fresh pre-apply archive was not restored into a
  clean database; the earlier v2 hosted restore is separate evidence and does
  not prove restorability of this specific fresh archive.
- The production apply and read-only postflight passed without data-count or
  watermark drift. Railway rollback restored the exact pre-window app
  commit/image as deployment `5b2663c8-faed-40ab-8b1d-cc2462641c0f`; health,
  AAL2 admin read, polling-leader recovery and more than ten minutes of monitor
  samples passed. The migration procedure itself sent no Telegram QA/user
  message and initiated no AI request or new app release. However, the global
  scheduled monitor continued independently: its run during the freeze made a
  provider health request and sent one sanitized operator Telegram alert when
  the intentionally stopped app endpoints returned `404`.
- A separately approved application release later deployed `main` commit
  `9e901b1` as Railway deployment `12c9b9c2-d7de-4fb5-9817-9ae47c3b8cb7`.
  Public-route, AAL2-admin, polling and log postflight passed. The migration
  head stayed `20260729131000`; the release made no Supabase mutation. See
  `PRODUCTION_APPLICATION_RELEASE_2026-08-02.md`.
- PR #121 later superseded that application image without changing the database.
  Exact merge `c5fa51d` is Railway deployment
  `4d00a730-d8e2-462f-b820-e3cecbfb0994`; see
  `PRODUCTION_APPLICATION_RELEASE_2026-08-08.md`.
- PR #126 now supersedes that application image without changing the database.
  Exact merge `8a76a5e` is Railway deployment
  `895a82f3-6e59-4b91-8ec7-513330e4f7cb`; PR #123-126 contain the subsequent
  deterministic Telegram language, completed-action, task-scam, BNPL,
  coercive-secrecy and secret-sink hardening.
- The hosted restore is functional recovery evidence, not a closed RPO/RTO
  measurement. The first schema phase crossed its evidence timeout and did not
  retain complete stderr or full per-phase timing.
- Staging is deliberately retained. Its deletion is a separate destructive
  action and still requires explicit operator approval.

## Open operational and release gates

1. Start a new exact-RC observation for `8a76a5e` without changing production.
   PR #126 restarted the canary clock. The earlier `1576e21` checkpoint remains
   historical operational `GO`, while formal closure for the current RC is
   `OPEN` until the unchanged entry, 144-success and failure/restart rules are
   satisfied. The remaining release-scope acceptance evidence is independent
   and still required.
2. Capture non-destructive multi-instance polling handoff/re-election and
   definitive Telegram-provider failure-recovery evidence.
3. Complete real-client Direct/Inline RU/UZ/EN, human Voice-out listen-through,
   bounded real RU/UZ Voice-in/STT, accessibility scale/zoom/reduced-motion and
   legal/privacy acceptance.
4. Record a complete future hosted restore with retained per-phase error
   classification, start/end timing, measured recovery duration and named
   owner. Supabase Free still provides no guaranteed managed RPO.
5. Decide when to delete the retained hosted-restore staging project. Do not
   infer deletion approval from permission to continue other work.
6. Complete the separately approved bidirectional Railway rollback/return drill
   with measured timing. The maintenance window proved exact-image resume only,
   not a previous-release/current-release round trip.
7. Rehearse the authorized MFA factor-reset recovery path using the second
   owner; do not collect QR secrets or TOTP codes. The production preflight
   recorded count-only `2 / 2 / 2` eligibility/role/verified-TOTP aggregates,
   but the maintenance record does not retain independent action-time evidence
   of both human owners' presence or factor recoverability.
8. Record Railway payment-method expiry/spend alerts and the response owner.
   Railway currently reports `plan=pro`, one replica and
   `sleepApplication=false`.
9. Keep the Nitro static precompressed `q`-weight limitation, durable outbound
   outbox/journal and OCR fallback two-phase correction as explicit follow-up
   engineering work.

Railway Auto Deploy plus Wait for CI is no longer an open gate: PR #122 proved
it first, and PR #123-126 repeated the same path successfully.

Supabase Free remains an intentional pilot choice, but it provides no managed
scheduled backups or PITR. The target recovery point is therefore not guaranteed
until portable exports or a paid backup plan close that gap.

## Product order after the release gates

1. Add privacy-safe feature events and agree the outcome taxonomy.
2. Run moderated discovery for a simpler `/start`, pressure/secrecy triage and
   caregiver-first Family onboarding before changing those flows.
3. Build the short ordered SOS flow from the existing verified actions.
4. Add one durable outbound queue, first in shadow mode, then run a small
   consented outcome pilot.
5. Consider hybrid classification, paid AI and partner signal feeds only after
   real labeled data, privacy review and a separate budget approval.
