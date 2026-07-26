# Current State

Last reconciled: 2026-07-26

This is the short operational source of truth. Dated audit and release-plan
documents preserve the evidence available when they were written; their old
commit ids, test totals and unchecked rows are historical unless repeated
here.

## Deployed baseline

- Repository worktree was clean before this documentation reconciliation.
- Checked-out branch:
  `agent/backend-mfa-security-integration-20260726`.
- The working branch currently includes docs reconciliation commit `46c6266`;
  local `main` and `origin/main` remain
  `6a13419dc256f0a08dae3032999cc36d665662b1`.
- Railway production deployment
  `199d6e63-3c8a-4cc1-bf61-8b86ec267ba8` is `SUCCESS` for that commit,
  image digest
  `sha256:9c1acb729188b485e5546d5ab576989c73c3f22a9ef6252519f5dbf674f6987f`.
- Production `/` and `/healthz` returned `200` during the 2026-07-26
  read-only check.
- The 2026-07-26 restore-drill gate passed 160 test files and
  12,780/12,780 tests, TypeScript, production build and `npm audit`; lint had
  0 errors and 8 established Fast Refresh warnings.

## Closed in the current release

- The July Direct/Inline RU/UZ/EN deterministic regressions are covered by the
  current green corpus; the historical 227 direct-topic failures are not the
  current baseline.
- The approved UI release is integrated with the backend/security work.
- Public emergency contacts use the centralized verified registry, and the
  mobile accessibility fixes from `74663ce` are deployed.
- Family Shield defaults to consent-aware behavior and uses idempotent alert
  claims; migration `20260726090000` is applied.
- The Supabase service client is outside the browser dependency graph and the
  client-bundle guard is present.
- Two independent approved admin owners are enrolled in TOTP MFA.
  `REQUIRE_ADMIN_MFA_AAL2=true` is deployed and a fresh AAL2 login succeeded.
- Hash-pepper versioning is applied. New synthetic writes were verified as
  `v2`, legacy reads remained valid and the synthetic row was deleted.
  `HASH_PEPPER_SECRET` remains required for historical `legacy` rows and must
  not be removed.

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

## Open operational and release gates

1. Place the PFX files in a second protected device or vault independent of the
   OneDrive account while keeping their password separate.
2. The local inspection restore is complete. Perform the remaining isolated
   hosted/staging restore with Auth/Storage/application services enabled but
   outbound integrations disabled, then record service smokes and measured
   RPO/RTO.
3. Perform the approved Railway rollback/return drill against schema-compatible
   immutable artifacts.
4. Rehearse the authorized MFA factor-reset recovery path using the second
   owner; do not collect QR secrets or TOTP codes.
5. Add and verify HTTP compression. On 2026-07-26 production returned no
   `Content-Encoding` for `/` even when the request advertised `gzip, br`.
6. Capture the non-destructive multi-instance polling failover/re-election and
   Telegram provider-failure recovery evidence.
7. Record Railway payment-method expiry/spend alerts and the response owner.
   Railway currently reports `plan=pro`, one replica and
   `sleepApplication=false`.
8. Complete the final real-client Direct/Inline RU/UZ/EN matrix, the complete
   accessibility scale/zoom/reduced-motion matrix, legal/privacy approval and a
   fresh fixed-RC 72-hour canary.

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
