# Recovery and Key Rotation

Operator checklist for Ishonch Guard. A drill must never overwrite production,
print credentials, copy user rows into CI artifacts, or use a destructive
command without a separately approved maintenance window.

## Current recovery contract

- Commit, Railway deployment and image identifiers in dated evidence sections
  are historical snapshots. Use `CURRENT_STATE.md` as the sole source for the
  current application baseline.
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
  on Free. Until an upgrade, create an encrypted logical export at least daily,
  alert on failure, verify an offsite read-back, and also export immediately
  before every approved risky schema or Auth change.
- Remaining on Free is an explicit pilot risk acceptance, not evidence that the
  proposed RPO is met. A logical snapshot proves one recoverable point only; it
  does not establish an ongoing backup SLA.
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
- Every one of the original nine SQL entries matched the byte length and
  SHA-256 recorded in `manifest.json`. The four separately generated schema
  files contain a real cross-schema dependency cycle, so they must not be
  treated as an operator-friendly one-pass restore.
- A disposable local Supabase CLI `2.104.0` / Postgres `17.6.1.127` cluster
  reconstructed the schema, then generated and independently restored a
  dependency-ordered `schema.sql` and consolidated `data.sql`. The resulting
  preferred local archive is
  `C:\Users\user\Documents\Ishonch Guard Backups\ishonch-guard-production-20260726-1139-restore-ready-v2.efs.zip`.
  It contains exactly `roles.sql`, `schema.sql`, `data.sql` and
  `manifest.json`; its SHA-256 is
  `35889f4a8a90c216a4e94f00a761c27f9934b057755e3abd7af8ca3617b1b8ea`.
- The v2 archive and v2 metadata were separately CMS-encrypted. Their encrypted
  SHA-256 values are
  `4154e81d5011cfe05d367e2194377627eb14f75bb744db1aa4d36c87e8fae20c`
  and
  `384b0b66149e8b509b1e529614b2b6705884549b9b37f7a4f7c2c09c6fcd9134`.
  In-memory decrypt-and-hash round trips reproduced source SHA-256 values
  `35889f4a8a90c216a4e94f00a761c27f9934b057755e3abd7af8ca3617b1b8ea`
  and
  `570e45c2a4db772ea82ddfd81cdbce47ea4d2c4b83348d66ba6762b3ef3603c4`.
- The local Windows OneDrive folder was not connected to the authenticated
  cloud account, so no sync claim was made. The five files were uploaded
  through signed-in OneDrive web instead. Web readback confirmed exactly two
  PFX files, two `.p7m` files and `README-RECOVERY.txt` with the expected names
  and displayed sizes. After the local restore drill, signed-in web upload and
  readback also confirmed the two v2 `.p7m` files and
  `README-RECOVERY-V2.txt`; all eight expected cloud items are present. The
  off-machine OneDrive copy is therefore confirmed.
- Both password-protected PFX recovery files were separately uploaded to a
  private Google Drive account independent of the workstation and OneDrive.
  Manually downloaded copies matched the local byte lengths and SHA-256 values,
  both rejected an empty password, and the operator confirmed recoverable
  password custody outside both backup clouds and chat. This closes the
  independent recovery-key-copy gate. A hardware device or dedicated vault
  remains optional defense in depth, not a blocker for the current free pilot.
- The production migration head recorded with the 2026-07-26 archive is
  `20260726090000`; its Railway identifiers are historical snapshot metadata.
- At the 2026-08-02 application-release snapshot, production migration history
  was `33` versions with head `20260729131000`. Railway deployment
  `12c9b9c2-d7de-4fb5-9817-9ae47c3b8cb7` runs application commit
  `9e901b1673832e4e78d61500280f061ba39e245c` with verified image digest
  `sha256:44b69a4a996393d39220702b07214fb622017aa83698051139d10ab2bdd8b41a`.
  At that snapshot, repository tip `origin/main` was later documentation-only PR #120 merge
  `b226bdd`; it is not the deployed application source.
  Its sanitized postflight is in
  `PRODUCTION_APPLICATION_RELEASE_2026-08-02.md`.
- Those 33 versions already include the 2026-08-01 production application of
  `20260729105030_family_notification_claim_retention.sql` and
  `20260729131000_admin_mfa_aal2_rls.sql`. The exact current application
  baseline remains in `CURRENT_STATE.md`; the older Railway identifiers above
  must not be presented as current.
- The 2026-08-01 UTC pre-apply freeze produced a fresh EFS/CMS-encrypted
  restore-ready logical export. Local decrypt/hash verification passed; the
  ciphertext archive SHA-256 is
  `cbc9e96dfe9a5ed6c73e20b63eec31f5be9d8a2b7445777cafdae089096fbbfd`
  and encrypted metadata SHA-256 is
  `64e2e8143df21a8d29a2916dd28d58b4125d21761c8b7c349be34f13d58c5ccb`.
  Private OneDrive showed both expected ciphertext names and sizes, but the
  browser did not expose a completed download event; no cloud byte-hash
  readback claim is made. This fresh archive also has no clean-database restore
  proof. The earlier hosted v2 restore used a different archive and must not be
  cited as proof that this specific pre-apply backup restores successfully.
- Hash-pepper overlap is active as `v2` plus the required `legacy` read slot.
  The bounded synthetic write/read/cleanup drill passed. Retirement of the
  legacy secret remains forbidden until the documented zero-dependency gate.
- Local restore inspection passed: roles restore, clean transactional schema
  restore, clean transactional data restore, schema lint and pgTAP 53/53.
  Count-only invariants were Auth users 2, admin allowlist 2, user roles 4,
  checks 235, reports 8, entities 7, appeals 2, Family Shield rows 7,
  reputation targets 9 and Telegram sessions 4. The application gate then
  passed 12,780/12,780 tests, TypeScript, production build and `npm audit`;
  lint had 0 errors and 8 established Fast Refresh warnings.

## Backup verification

0. The workflow files described in `BACKUP_AUTOMATION.md` are merged but
   **NOT ENABLED / NOT VERIFIED**. At the 2026-08-26 audit cutoff there were
   zero backup runs, zero restore-drill runs, zero artifacts and neither
   required repository secret. Their current raw `pg_dump`/plain-PostgreSQL
   restore design must pass Supabase-specific security and portability review
   before credentials are added. It is not current RPO or restore evidence.
   The checks below continue to govern manual exports and every
   pre-risky-change export.
1. In Supabase Dashboard, record plan, backup type, earliest/latest restore
   point and retention. Record metadata only; never attach a backup to the repo.
2. On Free, confirm a successful encrypted logical export exists before every
   risky schema or Auth change. If no approved encrypted offsite destination is
   available, record the recovery gate as open and do not claim the target RPO.
3. When a portable logical export is required, use an authorized operator shell
   and prefer Supabase's documented split inventory: roles via
   `supabase db dump --role-only`, schema via `supabase db dump`, and data via
   `supabase db dump --data-only --use-copy`. A raw `pg_dump` is not accepted as
   portable recovery evidence until an isolated Supabase-compatible restore
   proves it. Store encrypted output outside GitHub, Codex logs and the
   workspace. Do not pass a database password on the command line or paste it
   into an issue.
4. Include schema, roles and data in the inventory, and separately record any
   non-database asset store. Ishonch Guard currently persists no user screenshots
   in Supabase Storage.
5. Retain an owner, creation time, expiry, encryption/key owner and restore-test
   date for each export.

## Local operator workstation and linked-project guard

Git ignore prevents accidental tracking but does not restrict another local
account. Secret-bearing `.env` files must grant access only to the operator,
`SYSTEM` and Administrators. The 2026-07-29 workstation ACL was narrowed to
that set; never record secret values as evidence.

Do not run raw `supabase ... --linked` list, dry-run or mutation commands from
this repository. The live fixed package recipes are inspection-only:

```powershell
npm run supabase:linked:status
npm run supabase:staging:migration-list -- --confirm-project-ref=gwwcooupkmhihaigympb
npm run supabase:staging:db-push:dry-run -- --confirm-project-ref=gwwcooupkmhihaigympb
```

The list and dry-run execute only when the linked ref,
`HOSTED_STAGING_PROJECT_REF`, `SUPABASE_URL`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PROJECT_ID` and explicit confirmation all equal the approved
staging project. `SUPABASE_CLI_BINARY_OVERRIDE` is rejected, and the child CLI
receives only a minimal system/proxy/Supabase-CLI environment allowlist. The
known production ref and every unknown ref are hard blocked. No live package
recipe performs repair or push. This technical guard does not grant approval to
apply a migration; external changes still require a separately reviewed
manifest and authorized staging/production window.

The 2026-07-29 staging closeout used the earlier one-time guarded sequence. The
initial list showed only `20260729105030` and `20260729131000` missing remotely;
fixed repair required exact version acknowledgement and normalized migration
hashes, then marked only those versions applied; the second list fully matched and
guarded dry-run reported the remote database up to date. No ordinary
`db push` was executed. The subsequent same-client AAL1/AAL2 smoke also passed
and restored every synthetic baseline.

For the 2026-07-26 portable package, follow
`C:\Users\user\OneDrive\Ishonch Guard Recovery\README-RECOVERY-V2.txt`.
Prefer the restore-ready v2 package. The legacy archive is retained for audit
but its split schema files require reconstruction. Decrypting either CMS
package is not a database restore: the SQL must still be loaded into an
isolated non-production project and pass the drill below.

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
   disable all real outbound integrations. MFA evidence must use one ordinary
   user client to show protected PostgREST denial at AAL1 and success at AAL2;
   a service-role read is not a substitute.
6. Destroy the staging copy only after the evidence record contains the backup
   timestamp, restore duration, migration head, invariant counts and cleanup
   owner. The destructive cleanup itself requires operator approval.

### Local inspection evidence (2026-07-26)

The disposable local database reconstruction and count-only inspection passed.
It proves that the encrypted logical snapshot can reconstruct its schema and
data and that repository database tests still pass against the recovered
schema. It does not close the hosted-staging gate: Auth, Storage, RLS through
the service API, admin/report/appeal flows and application Telegram smokes must
still run in an isolated Supabase project with outbound integrations disabled.
The local database reconstruction/load took approximately 11 seconds after the
local Supabase database was ready; this is diagnostic timing, not a hosted RTO
measurement.

### Hosted functional evidence (2026-07-28)

The v2 archive was restored into isolated Free/nano project
`gwwcooupkmhihaigympb` with outbound integrations disabled. Catalog/RLS,
migration reconciliation, schema lint, pgTAP 53/53, bounded service paths,
synthetic TOTP and cleanup/count invariants passed. Staging is retained pending
separate deletion approval.

This closes the functional hosted restore/service check only. The first schema
client crossed its evidence timeout and its complete stderr/per-phase duration
was not retained. The run therefore does not provide a complete measured RTO or
an RPO basis. The original MFA smoke proved the application AAL1 gate and TOTP
upgrade, but its final database read used service role; it did not prove direct
PostgREST policy behavior. Migration `20260729131000` is applied in isolated
staging, where its database pgTAP passes, and in production, where the
2026-08-01 postflight confirmed the migration head and all seven protected
policies. The guarded official history repair, post-repair migration list and
no-change dry-run completed, and the revised same-user-client AAL1/AAL2
HTTP/PostgREST smoke closed the staging boundary with exact synthetic cleanup.

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

The 2026-08-01 UTC maintenance window proved one bounded recovery direction:
after removing the exact active deployment for the write freeze, Railway
rollback restored the same verified commit/image, health and AAL2 admin reads
passed, the polling leader returned, and monitoring stayed green for more than
ten minutes. It did not execute a previous-release-to-current-release
round-trip or retain a complete two-direction elapsed-time measurement, so the
full drill above remains open.

Do not use `railway scale` as the freeze/resume mechanism. Validation showed it
could create a deployment from newer source rather than preserve the immutable
image. Any future procedure requires fresh Railway behavior verification and
separate action-time approval.

## Key rotation matrix

| Secret                          | Safe rotation order                                                                                                                                                                                                      | Required verification                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY` / fallback key | Create new provider key, update Railway/GitHub consumers, verify primary/fallback, then revoke old key.                                                                                                                  | AI monitor 200 plus deterministic no-key/429/5xx fallback tests.                                                                                                               |
| `TELEGRAM_WEBHOOK_SECRET`       | Generate a new high-entropy value, update Railway and GitHub monitor in one window, restart, then remove the old value.                                                                                                  | Missing secret 401, valid secret expected 503 in polling, leader 200, monitor green.                                                                                           |
| `TELEGRAM_BOT_TOKEN`            | Rotate in BotFather, update every Railway/GitHub consumer, restart polling without dropping updates, then verify the old token is rejected.                                                                              | `getMe`, pending queue, leader health, approved QA chat dispatch and cleanup.                                                                                                  |
| Supabase service/secret key     | Use the Supabase Dashboard rotation workflow and overlap keys only when the platform supports it; update Railway and operator tooling before revocation.                                                                 | App/RLS/security/admin smokes and no service key in client bundle/logs.                                                                                                        |
| Supabase publishable key        | Rotate through the Dashboard, update server and `VITE_*` build variables, rebuild the client, then revoke the old key.                                                                                                   | Login, public check/report/appeal and RLS-deny checks.                                                                                                                         |
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
   Keep the existing `HASH_PEPPER_SECRET`; it becomes the previous `legacy`
   read slot. Never expose either value in commands, logs or evidence.
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

When an already-versioned active pepper must be rotated while required legacy
rows still exist, deploy the three-slot reader before changing configuration.
Then, in one reviewed configuration window:

1. copy the current active version and secret into
   `HASH_PEPPER_PREVIOUS_VERSION` and `HASH_PEPPER_PREVIOUS_SECRET` without
   revealing their values;
2. replace `HASH_PEPPER_ACTIVE_VERSION` and `HASH_PEPPER_ACTIVE_SECRET` with a
   new version and independently generated secret;
3. retain `HASH_PEPPER_SECRET` as the legacy read slot.

The resulting read order is new active, most-recent previous, then legacy. New
writes use only the new active slot. Duplicate versions, duplicate secrets,
partial pairs and an active/previous collision fail closed. Historical peppers
remain sensitive and cannot be called revoked while required stored hashes
still depend on them; this procedure contains new writes but does not erase the
confidentiality impact of an earlier exposure.

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
- TOTP is enabled and the 15-minute AAL1-session limit is on. Production has
  `/admin-mfa` enrollment/challenge UI, refreshes the session to AAL2 and
  protects every admin server function with
  `REQUIRE_ADMIN_MFA_AAL2=true`. Two independently controlled owners are
  enrolled.
- The 2026-07-29 audit found that deployed direct authenticated PostgREST admin
  policies still checked role without AAL2. Migration
  `20260729131000_admin_mfa_aal2_rls.sql` adds
  `private.is_admin_aal2()` to protected admin RLS SELECT/UPDATE policies while
  preserving public confirmed-row reads and service-role bypass. The migration
  is applied in isolated staging, its pgTAP passes there, guarded official
  migration history now matches local, and the revised real-user-client
  HTTP/PostgREST AAL1-deny/AAL2-allow smoke passed with exact cleanup.
  Production subsequently applied the migration and postflight confirmed all
  seven protected AAL2 policies, including both UPDATE `WITH CHECK` clauses.
- Production/Railway must set
  `REQUIRE_ADMIN_MFA_AAL2=true|false` explicitly. Missing, empty or invalid
  configuration fails closed. Explicit `false` is retained only as a bounded
  enrollment/recovery rollback state; dev/test may omit the flag.

Historical safe enablement order, completed for production and retained as the
future rollout/recovery template:

1. deploy the enrollment/challenge UI with explicit
   `REQUIRE_ADMIN_MFA_AAL2=false`; do not combine first deployment and
   enforcement, and never rely on an unset production value;
2. enroll one approved admin from `Admin -> MFA / security`, verify AAL2, then
   enroll and independently verify a second recovery owner;
3. from a fresh AAL1 session, prove the policy routes to `/admin-mfa`, the
   refreshed token carries `aal2`, and no protected server-function query runs
   before that transition;
4. rehearse loss of the first authenticator. The second owner must verify the
   operator through the approved out-of-band process and use the authorized
   Supabase Auth factor-reset procedure. Ishonch Guard does not create recovery
   codes and nobody may request the QR secret or TOTP code;
5. confirm the reviewed AAL2 RLS migration is already recorded in isolated
   staging and retain the completed same-client proof of protected direct
   PostgREST denial at AAL1 and success at AAL2; a service-role query is not
   evidence for this boundary. Any future migration version requires a separate
   reviewed apply process;
6. set `REQUIRE_ADMIN_MFA_AAL2=true` only in a separate approved window, then
   verify all read and mutation admin actions with both owners;
7. if the UI cannot complete a challenge, set explicit
   `REQUIRE_ADMIN_MFA_AAL2=false` only as the bounded rollback. Missing and
   invalid production values intentionally fail closed.

## Evidence required to close the release gates

- one successful isolated functional restore is recorded; a separately
  approved application rollback/return drill remains open;
- complete future restore start/end and per-phase timing/error evidence,
  measured recovery duration, explicit RPO basis and named owners;
- one rotation drill for AI, Telegram webhook and one Supabase key class;
- an applied and drilled versioned hash-pepper overlap path plus a separately
  approved retirement strategy for the previous pepper;
- count-only evidence that required Auth policies are on. While the pilot stays
  on Supabase Free, record leaked-password protection as an explicitly accepted
  unavailable control rather than falsely marking it enabled;
- no credential values or production user data in evidence artifacts.
