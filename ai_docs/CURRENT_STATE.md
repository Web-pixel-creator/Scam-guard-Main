# Current State

Last reconciled: 2026-07-29

This is the short operational source of truth. Dated audit and release-plan
documents preserve the evidence available when they were written; their old
commit ids, test totals and unchecked rows are historical unless repeated
here.

## Deployed baseline

- Checked-out branch: `agent/security-regression-hardening-20260729`.
- The application release commit is
  `bff76eb28877a188ca78b7e1509ec4874bb0be23`.
- Current Railway production deployment
  `22204af1-97d4-4f52-84d9-7a07511e401e` reports `SUCCESS`, with image digest
  `sha256:1d3c487de2b5ac64e538488f077118a21ed17a95e1ed5476bb11dc6aa9f87b65`.
- Production `/healthz`, `/`, `/login`, `/report`, `/appeal`, `/admin`,
  `/privacy` and `/emergency` returned `200` during the 2026-07-29
  re-verification.
- Production negotiates streaming Brotli/gzip for eligible dynamic `GET`
  responses and serves precompressed public assets. The release smoke measured
  homepage Brotli at 14,158 bytes for 62,216 decoded bytes and main CSS Brotli
  at 40,302 bytes for 258,542 decoded bytes. Gzip fallback, explicit identity,
  ordinary quality weights, CSP preservation and exact CSS round trip passed.
  This is normal-response evidence only: the deployed dynamic stream still has
  the error/cancellation defect described below, and Nitro's static asset
  handler does not correctly honor all `q`-weighted `Accept-Encoding` forms.
- The webhook without its secret returned `401`; no Telegram message, synthetic
  update or AI request was sent during the compression release smoke.
- The safe production smoke passed with polling leader health `200`, an empty
  Telegram pending queue and AI explicitly skipped. No message or synthetic
  Telegram update was delivered.
- The exact deployed commit passed 161 test files and 12,796/12,796 tests,
  TypeScript, production build and `npm audit`; lint had 0 errors and 8
  established Fast Refresh warnings.

## Closed in the current release

- The historical 227 Direct-topic failures are not the current baseline. The
  deployed corpus is green, but the 2026-07-29 audit found three exact semantic
  tails that were not represented by that oracle; their fixes are currently
  local-only.
- The approved UI release is integrated with the backend/security work.
- Public emergency contacts use the centralized verified registry, and the
  mobile accessibility fixes from `74663ce` are deployed.
- Family Shield defaults to consent-aware behavior and uses idempotent alert
  claims; migration `20260726090000` is applied. Guaranteed scheduled pruning
  for inactive expired claims is not deployed yet.
- The Supabase service client is outside the browser dependency graph and the
  client-bundle guard is present.
- Two independent approved admin owners are enrolled in TOTP MFA.
  `REQUIRE_ADMIN_MFA_AAL2=true` is deployed and a fresh AAL2 login succeeded.
  The deployed server functions enforce AAL2, but the deployed RLS policies do
  not yet require AAL2 for direct authenticated PostgREST access.
- Hash-pepper versioning is applied. New synthetic writes were verified as
  `v2`, legacy reads remained valid and the synthetic row was deleted.
  `HASH_PEPPER_SECRET` remains required for historical `legacy` rows and must
  not be removed.

## Local hardening and staging evidence awaiting the release gate

Branch `agent/security-regression-hardening-20260729` is based on production
commit `bff76eb`. These changes are not in production. The two database
migrations below were applied through the isolated staging SQL Editor on
2026-07-29. Because SQL Editor does not update Supabase migration history, the
guarded official repair later recorded exactly those two reviewed versions.
The post-repair migration list fully matches local history and the guarded
`db push --dry-run` reports `Remote database is up to date`:

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
  roles and fixture were removed and the baseline counts were restored;
- production/Railway now requires an explicit `REQUIRE_ADMIN_MFA_AAL2` value.
  Missing, empty or invalid configuration fails closed; dev/test may still omit
  it;
- dynamic HTTP compression now uses an abort-aware stream pipeline, propagates
  upstream failure/downstream cancellation and returns `406` when every
  supported encoding including identity is forbidden. Focused checks pass
  27/27. Nitro static precompression still has an open `q`-weight negotiation
  limitation;
- the three audited Telegram cases are fixed locally: bank/card code theft in a
  Telegram message stays a code request, Uzbek `rostdan firibgarlarmi` preserves
  bank/code context through `endi nima qilay`, and the common typo
  `безапасный счет` reaches explicit no-transfer guidance. Targeted checks pass
  468/468, the Telegram suite 10,872/10,872 and the adversarial corpus
  2,161/2,161;
- migration `20260729105030_family_notification_claim_retention.sql` adds
  expired Family notification claims to the existing daily retention function.
  Its focused contract passes 15/15 and hosted transaction-isolated pgTAP
  passes 10/10. The restored staging project does not currently expose
  `cron.job`, so the production schedule itself was not re-verified there;
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

The local branch now passes 165 Vitest files and 12,853/12,853 tests, TypeScript,
production build with non-secret placeholders, `npm audit` with zero findings
and lint with zero errors plus the eight established Fast Refresh warnings. A
fresh local Supabase database applied all 33 migrations from scratch; schema
lint reported no errors and all four pgTAP files passed 86/86. Production
deployment has not run for this set. The disposable local cluster was then
stopped with `--no-backup`; no local Supabase containers or project volumes
remain. Do not promote local or staging totals to deployed evidence.

## Recovery progress

- The Windows EFS certificate/private key was exported to the
  password-protected
  `ishonch-guard-efs-recovery-20260726.pfx`.
- A separate 10-year Document Encryption certificate was created for portable
  CMS recovery and exported to the password-protected
  `ishonch-guard-portable-backup-recovery-20260726.pfx`.
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
- The hosted restore is functional recovery evidence, not a closed RPO/RTO
  measurement. The first schema phase crossed its evidence timeout and did not
  retain complete stderr or full per-phase timing.
- Staging is deliberately retained. Its deletion is a separate destructive
  action and still requires explicit operator approval.

## Open operational and release gates

1. Review and preserve the complete dirty-worktree diff before any commit or
   integration. In particular, both migrations already registered in staging
   are still untracked local files and must be preserved in a verified commit
   and remote branch or an independent archive before staging deletion or any
   production work. Production remains unchanged until separate approvals.
2. Place the PFX files in a second protected device or vault independent of the
   OneDrive account while keeping their password separate.
3. Record a complete future hosted restore with retained per-phase error
   classification, start/end timing, measured recovery duration and named
   owner. Supabase Free still provides no guaranteed managed RPO.
4. Decide when to delete the retained hosted-restore staging project. Do not
   infer deletion approval from permission to continue other work.
5. Perform the separately approved Railway rollback/return drill against
   schema-compatible immutable artifacts.
6. Rehearse the authorized MFA factor-reset recovery path using the second
   owner; do not collect QR secrets or TOTP codes.
7. Capture the non-destructive multi-instance polling failover/re-election and
   Telegram provider-failure recovery evidence.
8. Record Railway payment-method expiry/spend alerts and the response owner.
   Railway currently reports `plan=pro`, one replica and
   `sleepApplication=false`.
9. Complete the final real-client Direct/Inline RU/UZ/EN matrix, human
   listen-through of all prerecorded Voice-out assets, real RU/UZ provider STT
   examples, the complete accessibility scale/zoom/reduced-motion matrix,
   legal/privacy approval and a fresh fixed-RC 72-hour canary.

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
