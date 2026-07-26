# Recovery and Key Rotation

Operator checklist for Ishonch Guard. A drill must never overwrite production,
print credentials, copy user rows into CI artifacts, or use a destructive
command without a separately approved maintenance window.

## Current recovery contract

- Application rollback unit: one immutable Git commit and its Railway
  deployment/image digest.
- Database change unit: forward-only files in `supabase/migrations/`; repair a
  bad migration with a reviewed follow-up migration unless an approved database
  restore is required.
- Proposed launch target: RPO <= 24 hours with managed daily backups and RTO <=
  4 hours. PITR should replace this with the explicitly purchased recovery
  window before higher-volume launch.
- Current pilot plan: Supabase Free. It has no managed scheduled backups or
  PITR, so the proposed launch RPO is not guaranteed while the project remains
  on Free. Until an upgrade, create an encrypted logical export at least weekly
  and immediately before every approved risky schema or Auth change.
- Supabase documents managed daily backups for paid projects and optional PITR:
  <https://supabase.com/docs/guides/platform/backups>.

### Current evidence (2026-07-26)

- An encrypted logical archive exists at
  `C:\Users\user\Documents\Ishonch Guard Backups\ishonch-guard-production-20260726-1139.efs.zip`.
  Its recorded SHA-256 is
  `1b0e925008dfc3817d2497de5110d3b102b8bec93c4da6c56db8e93d5b9bcfce`,
  it contains 10 inventoried entries and its ZIP central directory was opened.
- Windows reports EFS AES-256 and one decrypting owner certificate with a
  private key. No recovery certificate is configured.
- The EFS private key was exported to the password-protected
  `ishonch-guard-efs-recovery-20260726.pfx`; its SHA-256 is
  `34a531f13d7f7f99b8deb71bd96424e1f0ab027834e44c2a3f8169fb4f576944`.
- A separate Document Encryption certificate with thumbprint
  `84263BAD3EC5730E4111797C3B8C23EDFDC0F699` was exported to the
  password-protected
  `ishonch-guard-portable-backup-recovery-20260726.pfx`; its SHA-256 is
  `0c2db18b2ba86cd0ba36a70568b201cfed406a54fd637d82f2f90a388e0aa98d`.
- The archive and metadata were CMS-encrypted into `.p7m` files under
  `C:\Users\user\OneDrive\Ishonch Guard Recovery`. In-memory decryption
  reproduced source SHA-256 values
  `1b0e925008dfc3817d2497de5110d3b102b8bec93c4da6c56db8e93d5b9bcfce`
  and
  `6a92db70355c568e1c5f57f03075048a06663af531b60985918bd3d1511c8a39`.
  No plaintext database dump was written there.
- The local Windows OneDrive folder was not connected to the authenticated
  cloud account, so no sync claim was made. The five files were uploaded
  through signed-in OneDrive web instead. Web readback confirmed exactly two
  PFX files, two `.p7m` files and `README-RECOVERY.txt` with the expected names
  and displayed sizes. The off-machine OneDrive copy is therefore confirmed.
  Copy the PFX files to a separate protected device or vault and keep their
  password elsewhere so one cloud-account failure cannot remove both data and
  its only recovery keys.
- The production migration head recorded with the archive is
  `20260726090000`. The current Railway artifact is commit `6a13419d`,
  deployment `199d6e63-3c8a-4cc1-bf61-8b86ec267ba8`.
- Hash-pepper overlap is active as `v2` plus the required `legacy` read slot.
  The bounded synthetic write/read/cleanup drill passed. Retirement of the
  legacy secret remains forbidden until the documented zero-dependency gate.

## Backup verification

1. In Supabase Dashboard, record plan, backup type, earliest/latest restore
   point and retention. Record metadata only; never attach a backup to the repo.
2. On Free, confirm a successful encrypted logical export exists before every
   risky schema or Auth change. If no approved encrypted offsite destination is
   available, record the recovery gate as open and do not claim the target RPO.
3. When a portable logical export is required, use an authorized operator shell
   and `supabase db dump`/`pg_dump`; store the encrypted output outside GitHub,
   Codex logs and the workspace. Do not pass a database password on the command
   line or paste it into an issue.
4. Include schema, roles and data in the inventory, and separately record any
   non-database asset store. Ishonch Guard currently persists no user screenshots
   in Supabase Storage.
5. Retain an owner, creation time, expiry, encryption/key owner and restore-test
   date for each export.

For the 2026-07-26 portable package, follow
`C:\Users\user\OneDrive\Ishonch Guard Recovery\README-RECOVERY.txt`. It restores
the CMS content only; the database must still be loaded into an isolated
non-production project and pass the drill below.

## Non-production restore drill

1. Create an isolated staging/duplicate project with no production Telegram,
   moderation, email or webhook credentials.
2. Restore the selected backup there. A local Supabase restore is inspection
   evidence only and is not a production replacement:
   <https://supabase.com/docs/guides/local-development/restoring-downloaded-backup>.
3. Apply any migrations newer than the restore point, then run schema lint,
   pgTAP, application tests and a production build.
4. Verify count-only invariants: Auth users, roles, allowlist, reports by status,
   appeals, checks, Telegram sessions/lifecycle rows and retention jobs. Do not
   export identifiers or matched secret values.
5. Run app/RLS/admin/report/appeal/Telegram smokes against the isolated project;
   disable all real outbound integrations.
6. Destroy the staging copy only after the evidence record contains the backup
   timestamp, restore duration, migration head, invariant counts and cleanup
   owner. The destructive cleanup itself requires operator approval.

## Application rollback drill

1. Record current commit, Railway deployment id, image digest and database
   migration head.
2. Select the latest previously successful deployment compatible with the
   current schema. Do not roll application code behind an incompatible
   forward-only migration.
3. Redeploy that immutable Railway artifact in a maintenance window, then run
   `/healthz`, `prod:smoke`, `prod:security-smoke`, polling leader and production
   monitor checks.
4. Redeploy the current release and repeat the same checks. Record both
   directions and elapsed recovery time.
5. Telegram rollback from polling to webhook follows the fenced procedure in
   `DEPLOYMENT.md`; never use `drop_pending_updates=true`.

## Key rotation matrix

| Secret                          | Safe rotation order                                                                                                                                      | Required verification                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY` / fallback key | Create new provider key, update Railway/GitHub consumers, verify primary/fallback, then revoke old key.                                                  | AI monitor 200 plus deterministic no-key/429/5xx fallback tests.                                                     |
| `TELEGRAM_WEBHOOK_SECRET`       | Generate a new high-entropy value, update Railway and GitHub monitor in one window, restart, then remove the old value.                                  | Missing secret 401, valid secret expected 503 in polling, leader 200, monitor green.                                 |
| `TELEGRAM_BOT_TOKEN`            | Rotate in BotFather, update every Railway/GitHub consumer, restart polling without dropping updates, then verify the old token is rejected.              | `getMe`, pending queue, leader health, approved QA chat dispatch and cleanup.                                        |
| Supabase service/secret key     | Use the Supabase Dashboard rotation workflow and overlap keys only when the platform supports it; update Railway and operator tooling before revocation. | App/RLS/security/admin smokes and no service key in client bundle/logs.                                              |
| Supabase publishable key        | Rotate through the Dashboard, update server and `VITE_*` build variables, rebuild the client, then revoke the old key.                                   | Login, public check/report/appeal and RLS-deny checks.                                                               |
| Hash pepper                     | Direct replacement remains forbidden. The local code and additive migration support one active and one previous version; deploy them first, then introduce a new active slot while retaining the old secret as `legacy`. | Focused/full tests, count-only version checks, known-legacy lookup, new-target write, pending Family Shield invite, report/appeal/admin continuity and rollback compatibility. |

Every rotation record contains only secret name, owners, timestamps, consumer
list, validation run ids and revocation confirmation. It never contains values.

## Hash-pepper overlap procedure

This is a bounded overlap design, not permission to rotate production. The old
pepper cannot be revoked merely because a new active value exists: historical
rows cannot be re-hashed without the normalized identifier. Keep the previous
slot until retention or a separately reviewed online-promotion procedure proves
that no required rows depend on it.

1. Verify a recoverable backup/export and record the current migration head,
   immutable application artifact and count-only row totals. Do not include
   hashes or identifiers in the evidence.
2. Apply `20260724190000_hash_pepper_versioning_v1.sql` while the application
   still uses only `HASH_PEPPER_SECRET`. It labels existing hashes `legacy` and
   never rewrites a hash.
3. Deploy the version-aware application with only `HASH_PEPPER_SECRET` still
   configured. Run the full local/release gate and bounded production smokes.
   This step proves schema/application compatibility before any secret changes.
4. In a separately approved maintenance window, add a new, independently
   generated `HASH_PEPPER_ACTIVE_SECRET` and a bounded version id such as `v2`.
   Keep the existing `HASH_PEPPER_SECRET`; it becomes the single previous
   `legacy` read slot. Never expose either value in commands, logs or evidence.
5. Verify count-only invariants and bounded synthetic cases:
   - a known legacy entity/report/appeal remains visible and is not duplicated;
   - a new synthetic identifier is written with the active version;
   - a pending legacy Family Shield invite can still be accepted;
   - moderation updates preserve the stored hash version;
   - shared rate limiting and health checks remain fail-closed.
6. If any invariant fails, restore the version-aware application configuration
   to legacy-only and investigate. Do not replace the database or rewrite
   hashes ad hoc.
7. Do not remove the legacy secret until a separate privacy review and
   retirement report prove zero required legacy dependencies. The current code
   intentionally preserves an established legacy canonical hash to prevent
   split histories; therefore this retirement gate is still open.

For a later explicit previous slot, remove `HASH_PEPPER_SECRET` before setting
`HASH_PEPPER_PREVIOUS_VERSION` and `HASH_PEPPER_PREVIOUS_SECRET`. Supplying both
legacy and explicit previous configuration is ambiguous and fails closed.

## Supabase Auth hardening gate

Before public launch, an authorized Dashboard operator must verify and record:

- leaked-password protection enabled (available on Pro and above);
- minimum password length at least 12 and digits/lowercase/uppercase/symbols
  required;
- email confirmation enabled;
- recent authentication required for password changes;
- admin accounts enrolled in MFA or an equivalent separately approved control;
- recovery and redirect URLs restricted to owned HTTPS origins.

Supabase documents password-strength and leaked-password settings here:
<https://supabase.com/docs/guides/auth/password-security>. Existing users may
need to replace weak passwords after the policy is strengthened, so capture the
user-support plan before enabling the gate.

Read-only Dashboard audit on 2026-07-24 (no settings were changed):

- the project is on Free and the Backups page explicitly reports that scheduled
  project backups are not included;
- Site URL is the production Railway HTTPS origin and the only redirect URL is
  the exact `/admin` path;
- email confirmation, secure email change, secure password change, current
  password requirement, minimum length 12 and the strongest character policy
  are enabled;
- leaked-password protection is disabled/unavailable on Free, CAPTCHA is
  disabled and user signups are enabled;
- TOTP is enabled and the 15-minute AAL1-session limit is on. The local
  application now has `/admin-mfa` enrollment and challenge/verify UI, refreshes
  the session to AAL2, and prevents protected admin queries before the
  authoritative policy check completes. A server-side AAL2 gate protects every
  admin action when `REQUIRE_ADMIN_MFA_AAL2=true`.
- The flag must remain unset/false until this exact build is deployed, an
  approved admin and a second recovery owner are enrolled, and the recovery
  drill below succeeds. The release gate therefore remains open; local code is
  not production evidence.

Safe enablement order:

1. deploy the enrollment/challenge UI while `REQUIRE_ADMIN_MFA_AAL2` is still
   unset/false; do not combine first deployment and enforcement;
2. enroll one approved admin from `Admin -> MFA / security`, verify AAL2, then
   enroll and independently verify a second recovery owner;
3. from a fresh AAL1 session, prove the policy routes to `/admin-mfa`, the
   refreshed token carries `aal2`, and no protected admin query runs before
   that transition;
4. rehearse loss of the first authenticator. The second owner must verify the
   operator through the approved out-of-band process and use the authorized
   Supabase Auth factor-reset procedure. Ishonch Guard does not create recovery
   codes and nobody may request the QR secret or TOTP code;
5. set `REQUIRE_ADMIN_MFA_AAL2=true` only in a separate approved window, then
   verify all read and mutation admin actions with both owners;
6. if the UI cannot complete a challenge, remove/disable the flag as the bounded
   rollback. Invalid explicit flag values intentionally fail closed.

## Evidence required to close the release gates

- one successful isolated restore and application rollback/return drill;
- measured RPO/RTO and named owners;
- one rotation drill for AI, Telegram webhook and one Supabase key class;
- an applied and drilled versioned hash-pepper overlap path plus a separately
  approved retirement strategy for the previous pepper;
- count-only evidence that leaked-password protection and Auth policy are on;
- no credential values or production user data in evidence artifacts.
