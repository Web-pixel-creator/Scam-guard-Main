# Backup Automation (Supabase Free pilot)

Workflow files merged on 2026-08-26, but operational status is
**NOT ENABLED / NOT VERIFIED**. The independent audit found zero backup runs,
zero restore-drill runs, zero backup artifacts and no required backup
credentials. The inactive PR #133 workflow contract must not be enabled. This
document records the replacement plan only; it is not recovery evidence and it
does not prove a daily RPO while the project remains on Supabase Free (no
managed backups, no PITR).

## Replacement design — PLAN ONLY

The backup-hardening candidate replaces the legacy passphrase contract with
`age` authenticated encryption to an X25519 recipient:

- the public `age1...` recipient is derived offline from a separately held
  private identity and committed only after independent review;
- the export job receives the production database credential and public
  recipient, but never the private age identity;
- read-back and restore jobs receive the private identity through their approved
  protected scope, but never the production database credential;
- only age-encrypted bundle bytes, a transport checksum and non-sensitive
  manifest metadata may become an artifact;
- successful age decryption authenticates ciphertext integrity to the identity
  holder, but sender/origin trust still comes from the reviewed successful
  GitHub run and immutable workflow/toolchain evidence.

The planned logical export follows Supabase's roles/schema/data split and retains
migration-history evidence plus a reviewed managed-schema hook. The restore
target is an isolated, pinned Supabase-local database rather than an ordinary
stock PostgreSQL container. Exact tool versions, image digests and the recipient
must remain immutable review inputs. See Supabase's supported sequence:
<https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>.

No executable decrypt/restore recipe is approved in this document. The final
infrastructure PR must supply a separately reviewed runbook after the staged
restore drill proves its exact bundle, manifest and cleanup contract.

## Plaintext lifecycle — mandatory design gate

Logical export and restore necessarily create transient plaintext on an
ephemeral runner. The hardened workflow must:

- use a fresh isolated runner directory outside the repository checkout;
- never upload, cache, log or print plaintext, identifiers, credentials or the
  private age identity;
- encrypt before artifact upload and upload only the ciphertext/checksum set;
- run cleanup on every success and failure path, then assert that plaintext,
  decrypted bundles, identity files, containers, volumes and networks are gone;
- state the residual risk honestly: forced runner termination can interrupt
  workflow cleanup, so ephemeral-runner destruction remains part of the trust
  boundary.

The encrypted artifact still contains sensitive production rows. Encryption is
not data minimization, and artifact access/retention must remain restricted.

## Activation gate — do not add production credentials yet

1. Complete independent review of the Supabase-compatible export, managed-schema
   hook, pinned toolchain, age recipient/identity separation, failure cleanup and
   isolated restore design.
2. Rehearse export, authenticated read-back and restore against an approved
   non-production Supabase target. Retain run IDs, artifact identity, manifest
   hashes, count-only invariants, cleanup assertions and timing evidence without
   identifiers or key material.
3. Treat the sole-owner `main` ruleset with `0` approvals as an interim integrity
   control only. It does **not** protect a secret-consuming backup workflow from
   an unreviewed change by the same owner and is not an eligible credential gate.
4. Before adding a production database credential or backup decryption identity,
   implement and prove one of these controls:
   - add a second independent trusted reviewer with verified recovery access;
     make backup workflow paths owned by `CODEOWNERS`, require at least one
     approval with stale approvals dismissed on push, and require code-owner
     review with no bypass; or
   - scope every secret-consuming backup job and credential to a protected
     environment that requires trusted manual approval before the job can read
     secrets. Enable prevent-self-review and disable bypass for this gate. A
     scheduled run will wait for approval, so this path is manual-gated and must
     not be described as an unattended daily backup or proven 24-hour RPO.
5. In a separately approved canary-restart window, provision only the minimum
   production database credential and private age identity required by the final
   reviewed workflow. Keep the private identity in independent owner custody as
   well; never commit it or the database credential.
6. Trigger the revised backup once manually and prove export, ciphertext-only
   artifact upload, authenticated read-back and cleanup.
7. Trigger the revised restore drill once and prove the isolated restore,
   count-only invariants and destructive cleanup.
8. Only after the protection gate, both runs and retained evidence pass may this
   document change status from `NOT ENABLED / NOT VERIFIED`.

## Required evidence and honest limits

- **Not yet proven:** a successful main-branch backup run whose artifact contains
  only the expected age-encrypted bundle and transport checksum.
- **Not yet proven:** authenticated read-back validates ciphertext, manifest and
  every expected logical component without exposing values.
- **Not yet proven:** an isolated Supabase-local restore recreates required
  roles/schema/data, migration history, managed Auth/Storage relations and
  application-owned hooks, then passes count-only invariants and cleanup.
- Storage metadata is not Storage object bytes. Confirm the live object inventory
  before activation and define a separate object-backup path if any required
  object exists; re-evaluate this scope whenever Storage use changes.
- A logical snapshot provides one restore point, not PITR. A protected-environment
  approval that leaves scheduled runs waiting also does not prove an unattended
  daily backup or the launch RPO target.
- The proposed 90-day artifact retention is not an independent offsite copy.
  Identity custody and any separately retained encrypted copy need their own
  inventory and rotation evidence.

Until all gates pass, use only the separately approved non-production procedure
in `RECOVERY_AND_KEY_ROTATION.md`; never restore this candidate into production.
