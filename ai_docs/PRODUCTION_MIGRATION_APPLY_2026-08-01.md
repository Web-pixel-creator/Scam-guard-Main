# Production migration apply evidence — 2026-08-01

Sanitized execution record for the two approved Supabase production
migrations. This file contains no credentials, private account identifiers,
TOTP material, raw user rows, Telegram payloads, or recovery passwords.

## Outcome

**SUCCESS.** The two target migrations were applied once through the linked
Supabase CLI, database postflight passed, and the exact pre-window Railway
application image was restored by rollback. No new application build or source
deployment was performed.

All timestamps below are UTC unless they include another offset. In
Asia/Tashkent, the Railway freeze and database apply occurred on 2026-08-01;
the post-resume observation crossed midnight and ended on 2026-08-02. The file
date identifies the UTC apply date and must not be read as saying the whole
operation occurred on one local calendar date.

## Immutable inputs

| Item                           | Verified value                                                            |
| ------------------------------ | ------------------------------------------------------------------------- |
| Supabase project ref           | `semaarjjdmbjwzgvbenu`                                                    |
| Apply worktree commit          | `d053e3502986343003d92e2e15eb25d560840de3`                                |
| Apply worktree tree            | `b30d10d898cf471f10d681828c2af841a1319aee`                                |
| Retention migration LF SHA-256 | `383dd0b468e04e2d9f4488ad7bf3b9641bdb5684321d512a5f7cc30656b99e2b`        |
| MFA/RLS migration LF SHA-256   | `68bc65b20a5e45bc4591f2435a4348a8f679bc76d4894c1442a9af9c24e8ca87`        |
| Supabase CLI                   | `2.104.0`                                                                 |
| PostgreSQL server              | `17.6`                                                                    |
| Restored application commit    | `bff76eb28877a188ca78b7e1509ec4874bb0be23`                                |
| Restored image digest          | `sha256:1d3c487de2b5ac64e538488f077118a21ed17a95e1ed5476bb11dc6aa9f87b65` |
| Restored region configuration  | `europe-west4-drams3a`, one replica                                       |

## Freeze and backup

- Railway removal was confirmed at `2026-08-01T17:46:41.783Z`; zero instances
  were confirmed at `2026-08-01T17:47:07.403Z`.
- Stable read-only snapshots at `17:50:23.758755Z` and
  `17:51:44.304944Z` were identical: `checks = 235`, watermark
  `2026-07-17T08:19:07.84457Z`, `embed_origin_events = 0`, no polling leader,
  no update lease and no long transaction.
- A fresh EFS-encrypted restore archive was produced from `roles.sql`,
  `schema.sql`, `data.sql` and `manifest.json`. Its plaintext ZIP SHA-256 is
  `2551202e70c26b69326e2bcde30464d756a0bedeb97750b72e41cef048c02ab7`.
- CMS AES-256-CBC ciphertext was generated and decrypted in memory. The archive
  ciphertext is `70822` bytes with SHA-256
  `cbc9e96dfe9a5ed6c73e20b63eec31f5be9d8a2b7445777cafdae089096fbbfd`.
  The encrypted metadata is `2081` bytes with SHA-256
  `64e2e8143df21a8d29a2916dd28d58b4125d21761c8b7c349be34f13d58c5ccb`.
- OneDrive reported two items uploaded to the private recovery folder and
  displayed the expected names and sizes. The in-app browser did not expose a
  completed download event, so no offsite byte-hash readback claim is made.
  The owner approved the database apply after this limitation was disclosed.
- The fresh archive passed local decrypt-and-hash verification but was not
  restored into a clean database. The earlier v2 hosted restore drill concerns
  a different archive and is not restore proof for this fresh pre-apply backup.

## Apply

The final read-only gate at `2026-08-01T18:42:12.630145Z` confirmed:

- migration history `31`, head `20260726090000`, target versions absent;
- exactly two pending migrations in the required order;
- admin allowlist / admin roles / verified TOTP admins `2 / 2 / 2`;
- zero entitlement drift, claims, conflicting locks and long transactions;
- all five protected tables had RLS enabled;
- the retention cron remained active at `17 20 * * *` with no recent failure;
- a final freeze snapshot at `18:43:26.732089Z` still matched the original
  frozen row count and watermark.

The `2 / 2 / 2` values are count-only database evidence. This execution record
does not retain independent action-time proof of both human owners' presence,
their individual role bindings, or factor-reset recoverability. Those human
and recovery checks remain separate operational evidence boundaries.

After separate owner approval, one canonical command was run from the clean
worktree:

```text
supabase db push --linked
```

It exited successfully after applying only:

1. `20260729105030_family_notification_claim_retention.sql`
2. `20260729131000_admin_mfa_aal2_rls.sql`

No retry, migration repair, seed apply, SQL Editor apply, or concurrent
operator was used.

## Database postflight

The read-only postflight at `2026-08-01T18:46:58.005713Z` confirmed:

- migration history `33`, head `20260729131000`, both targets present;
- a subsequent dry-run returned `Remote database is up to date`;
- `private.prune_app_retention(timestamptz)` includes Family notification
  claims, remains security-definer and executable only by `service_role`;
- `private.is_admin_aal2()` exists, is stable/security-invoker, returns false
  without an AAL2 JWT, is unavailable to `anon`, and is executable by
  `authenticated` and `service_role`;
- all seven expected admin policies use `private.is_admin_aal2()` and both
  UPDATE policies also enforce it in `WITH CHECK`;
- RLS remained enabled on all five protected tables and the private-schema ACL
  remained closed to `anon` and `authenticated`;
- no conflicting lock or long transaction existed;
- count-only data invariants remained unchanged: Auth users `2`, checks `235`,
  reports `8`, entities `7`, appeals `2`, Family Shield `5`, reputation targets
  `9`, Telegram sessions `4`, claims/webhook updates/storage objects `0`.

The destructive retention function was not invoked as a test.

## Application resume and smoke

- Railway rollback created deployment
  `5b2663c8-faed-40ab-8b1d-cc2462641c0f` at
  `2026-08-01T18:51:51.396Z`.
- Railway reported `SUCCESS`, reason `rollback`, one active deployment, the
  exact commit/image digest above and one replica in `europe-west4-drams3a`.
- `/healthz`, `/` and `/login` returned HTTP `200`.
- `/admin` and `/admin-mfa` rendered successfully. An existing administrator
  session remained AAL2-confirmed and loaded the expected protected data,
  proving an authorized AAL2 read still works after the RLS migration.
- The final database snapshot at `2026-08-01T18:54:07.231958Z` showed exactly
  one active polling leader, zero active update leases, zero long transactions,
  and unchanged `checks = 235` with the same watermark.
- The migration procedure itself sent no synthetic Telegram QA/user message,
  initiated no paid AI/API request, created no code commit or Git push, and made
  no new application release. The global scheduled Production Monitor continued
  independently. Its freeze-period run made one provider health request and
  sent one sanitized operator Telegram alert when the intentionally stopped
  application endpoints returned `404`; those automated effects are excluded
  from neither cost accounting nor the historical record.

## Observation-period verdict

From `2026-08-01T18:56:17Z` through `2026-08-01T19:02:58Z`, nine consecutive
checks reported HTTP `200`, deployment
`5b2663c8-faed-40ab-8b1d-cc2462641c0f` in `SUCCESS`, and zero Railway
`warn/error` log lines. Together with the earlier startup interval, this
exceeds the required ten-minute watch from deployment creation.

The final checks at `19:03:54Z` and `19:04:03Z` returned `/healthz = 200 ok`,
one active polling leader, zero active update leases, zero long transactions,
and unchanged `checks = 235` with the original watermark. The complete window
verdict is **SUCCESS; no database compensation was required**. The Railway
rollback used to resume the exact application image is already recorded above.
In Asia/Tashkent this observation interval ran from `23:56:17` on 2026-08-01
through `00:04:03` on 2026-08-02.

## Subsequent application release

This document's commit, image and deployment remain the immutable evidence for
the database window. A later, separately approved application action deployed
`main` commit `9e901b1673832e4e78d61500280f061ba39e245c` as Railway deployment
`12c9b9c2-d7de-4fb5-9817-9ae47c3b8cb7` without a Supabase mutation. Its release
and postflight evidence is recorded in
`PRODUCTION_APPLICATION_RELEASE_2026-08-02.md`.
Documentation-only PR #120 subsequently advanced `origin/main` to `b226bdd`;
it did not change the deployed application source.
