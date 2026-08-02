# Production maintenance window record — 2026-08-02

This document is the sanitized, local-date record of the completed production
database maintenance window. It supersedes the prepared operator recipe that
previously occupied this path. Exact execution evidence is in
`ai_docs/PRODUCTION_MIGRATION_APPLY_2026-08-01.md`.

## Status

**COMPLETED / SUCCESS.** On `2026-08-01` UTC (`2026-08-02` in
Asia/Tashkent), the following two migrations were applied once to Supabase
production project `semaarjjdmbjwzgvbenu`:

1. `20260729105030_family_notification_claim_retention.sql`
2. `20260729131000_admin_mfa_aal2_rls.sql`

Production migration history is now `33` versions with head
`20260729131000`. A post-apply dry-run reported `Remote database is up to
date`. This completed database window is not authorization for a new
application build, source deployment, Telegram QA run, paid AI call, staging
deletion, or any future production mutation.

## Immutable inputs used

| Item                           | Verified value                                                            |
| ------------------------------ | ------------------------------------------------------------------------- |
| Approved migration merge       | `d053e3502986343003d92e2e15eb25d560840de3`                                |
| Approved tree                  | `b30d10d898cf471f10d681828c2af841a1319aee`                                |
| Retention migration LF SHA-256 | `383dd0b468e04e2d9f4488ad7bf3b9641bdb5684321d512a5f7cc30656b99e2b`        |
| MFA/RLS migration LF SHA-256   | `68bc65b20a5e45bc4591f2435a4348a8f679bc76d4894c1442a9af9c24e8ca87`        |
| Supabase CLI                   | `2.104.0`                                                                 |
| Restored application commit    | `bff76eb28877a188ca78b7e1509ec4874bb0be23`                                |
| Restored image digest          | `sha256:1d3c487de2b5ac64e538488f077118a21ed17a95e1ed5476bb11dc6aa9f87b65` |
| Restored Railway deployment    | `5b2663c8-faed-40ab-8b1d-cc2462641c0f`                                    |
| Railway region configuration   | `europe-west4-drams3a`, one replica                                       |

## Freeze and backup outcome

- The active Railway deployment was removed only after explicit owner approval;
  zero application instances were confirmed before the database snapshot.
- After the Telegram lease drain, two read-only snapshots were identical:
  `checks = 235`, the check watermark was unchanged, and no polling leader,
  update lease, conflicting lock, or long transaction remained.
- A fresh EFS-encrypted logical export and CMS AES-256-CBC encrypted archive
  were created. Local decrypt-and-hash verification passed.
- The two ciphertext files were uploaded to the private OneDrive recovery
  folder. The browser confirmed their names and displayed sizes, but did not
  expose a completed download event; therefore no cloud byte-hash readback is
  claimed. The owner explicitly accepted that disclosed limitation before the
  database apply.
- No plaintext database export was uploaded to cloud storage or committed to
  Git.

## Apply and postflight outcome

The clean, hash-verified worktree executed one canonical command after a
separate final approval:

```text
supabase db push --linked
```

Only the two approved migrations were applied, in the required order. There
was no retry, migration-history repair, SQL Editor apply, seed apply, or
concurrent operator.

Read-only postflight confirmed:

- the retention function includes expired Family notification claims and is
  executable only by `service_role`;
- `private.is_admin_aal2()` exists with the expected stable,
  security-invoker and privilege contract;
- all seven protected admin policies use `private.is_admin_aal2()`, including
  both UPDATE `WITH CHECK` clauses;
- RLS remained enabled on all five protected tables and the `private` schema
  remained closed to `anon` and `authenticated`;
- aggregate row counts and the check watermark were unchanged;
- no conflicting lock or long transaction existed.

The destructive retention function was not invoked as a test.

## Application resume and observation

Railway rollback restored the exact pre-window application commit and image as
deployment `5b2663c8-faed-40ab-8b1d-cc2462641c0f`. This was an immutable-image
resume, not a new source release.

- `/healthz`, `/`, `/login`, `/admin`, and `/admin-mfa` returned HTTP `200`.
- An existing AAL2 administrator session loaded protected data after the RLS
  migration.
- Exactly one polling leader returned; no active update lease or long
  transaction remained.
- Nine consecutive monitor samples plus final health/database checks covered
  more than ten minutes from deployment creation. Railway stayed `SUCCESS`,
  health stayed `200`, and no warning/error log lines appeared.
- No synthetic Telegram message, paid AI/API call, code commit, Git push, or
  new application release was made.

## Superseded freeze method and future safety rule

The prepared plan proposed `railway scale ... eu-west=0` and later
`eu-west=1`. During validation, Railway CLI scaling unexpectedly created a new
deployment from a newer source revision instead of acting as a guaranteed
in-place replica-only freeze. That behavior makes the old command unsafe for
this project.

**Do not reconstruct or reuse the removed `railway scale` commands from Git
history, chat logs, or an older copy of this document.** Do not assume that a
scale operation preserves the current immutable image.

The completed window used explicit removal of the exact active deployment and
an explicit rollback to the verified immutable image, each with separate owner
approval. That sequence is historical evidence, not a standing runbook. Any
future freeze/resume must start with fresh Railway behavior verification,
current immutable identifiers, a schema-compatibility check, a new encrypted
backup, and action-time approval.

## Remaining boundaries

- The application source changes outside the exact restored commit remain a
  separate release candidate and require their own local gate and approval.
- The retained staging Supabase project must not be deleted without separate
  destructive-action approval.
- A future complete restore drill still needs retained per-phase timing/error
  evidence and a measured hosted RTO/RPO basis.
- Real Direct/Inline RU/UZ/EN client acceptance, accessibility, legal/privacy
  review, Railway billing alerts, and the fixed-RC 72-hour canary remain open.
