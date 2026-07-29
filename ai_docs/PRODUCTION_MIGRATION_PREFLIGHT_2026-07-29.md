# Production Migration Preflight — 2026-07-29

This document is the operator gate for:

1. `20260729105030_family_notification_claim_retention.sql`
2. `20260729131000_admin_mfa_aal2_rls.sql`

It records a read-only preflight. It does **not** authorize or record a
production migration, Railway deployment, Telegram QA run, paid AI call, or
backup restore.

## Current verdict

**NO-GO for applying the migrations now.**

The migration SQL and the live production baseline are internally consistent.
The remaining blockers are operational:

- a new encrypted logical export must be created immediately before the
  production schema/Auth change; the verified 2026-07-26 restore-ready v2
  archive is a valuable disaster-recovery point, but it is not a fresh
  pre-change backup;
- a production maintenance window, migration operator, rollback owner, and
  explicit apply/deploy approval have not been recorded;
- the production connection currently reports `lock_timeout = 0` and
  `statement_timeout = 2min`. Supabase CLI 2.104.0 did not propagate a
  process-local `PGOPTIONS` override in a read-only probe. The local candidate
  now adds reviewed `SET lock_timeout = '5s'` and
  `SET statement_timeout = '60s'` statements to both still-unapplied migration
  files. The 60-second value applies per SQL statement, not to the whole
  migration or `db push`. Both settings are connection-local; a fresh connection
  still reports production defaults. It has passed every local
  database/repository gate recorded below, but before GO it must still be
  recorded in an approved remote commit. Never rely on `PGOPTIONS` for this
  window, and require the exact-two-pending gate so these session settings never
  carry into an unrelated migration;
- both independently controlled MFA owners must confirm availability during
  the window. Count-only evidence proves two verified owners exist, not that
  both people are presently reachable.

Supabase currently recommends regular CLI exports and off-site copies for Free
projects:
<https://supabase.com/docs/guides/platform/backups>. Supabase also recommends
deploying remote schema changes through migration files and `supabase db push`,
not the Dashboard SQL Editor:
<https://supabase.com/docs/guides/deployment/database-migrations>.

## Immutable release inputs

| Item                                           | Expected value                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Base release commit on `origin/main`           | `fbdeaec350f13477e98eddbc184ca28dd1556620`                         |
| Base Git tree                                  | `5f14a621abd7d247c372552ff8c51f58d028d6ba`                         |
| Timeout-only follow-up commit                  | Must be recorded in window evidence after approval                 |
| Migration order                                | `20260729105030` then `20260729131000`                             |
| LF-normalized SHA-256, retention with timeouts | `383dd0b468e04e2d9f4488ad7bf3b9641bdb5684321d512a5f7cc30656b99e2b` |
| LF-normalized SHA-256, MFA/RLS with timeouts   | `68bc65b20a5e45bc4591f2435a4348a8f679bc76d4894c1442a9af9c24e8ca87` |
| Supabase CLI used for staging and preflight    | `2.104.0`                                                          |
| Production Supabase ref                        | `semaarjjdmbjwzgvbenu`                                             |

If either migration file changes, both hashes and all database/repository test
evidence become stale. Re-run the full release gate and update this document
before applying anything.

## Timeout-only candidate validation

The timeout-only candidate is local on
`agent/production-migration-timeouts-20260729` and is not committed, pushed,
merged, deployed, or applied to hosted Supabase.

Validation completed after adding the two session settings and two regression
assertions:

- a fresh local Supabase reset applied all 33 migrations in order;
- local migration history contains both `SET lock_timeout = '5s'` and
  `SET statement_timeout = '60s'` for each target version;
- schema lint reported no errors;
- pgTAP passed 4 files and 86/86 assertions;
- focused migration contract tests passed 16/16;
- the full Vitest suite passed 165 files and 12,855/12,855 tests;
- TypeScript passed;
- ESLint reported 0 errors and the same 8 established Fast Refresh warnings;
- the production build passed;
- `npm audit --audit-level=high` reported 0 vulnerabilities;
- the local Supabase stack was stopped with no backup after verification;
- Prettier, `git diff --check`, and a secret-shape scan of this runbook passed.

The earlier hosted-staging document correctly retains the old pre-timeout file
hashes as historical evidence. The added `SET` statements affect only the
migration apply session and do not change the resulting function, policy, ACL,
or table schema. The new production candidate hashes are the values in the
immutable-input table above.

## Read-only production evidence

Evidence was collected at approximately `2026-07-29T18:12Z`. The database query
ran inside `BEGIN TRANSACTION READ ONLY ... ROLLBACK`. A temporary isolated
Supabase work directory was deleted afterward. The repository's existing link
still points to staging `gwwcooupkmhihaigympb`.

| Check                             | Observed                                                                       | Required                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| PostgreSQL                        | `17.6`, database/user `postgres`                                               | Informational                                                                            |
| Migration count/head              | `31`, head `20260726090000`                                                    | Exactly this baseline                                                                    |
| Target migration rows             | `0`                                                                            | Both must be absent before apply                                                         |
| Required dependency versions      | All five present                                                               | `20260528184815`, `20260612124559`, `20260614064831`, `20260702063847`, `20260726090000` |
| `private.is_admin_aal2()`         | Absent                                                                         | Must be absent before apply                                                              |
| Retention function                | Present; old body does not reference Family notification claims                | Exact pre-migration state                                                                |
| Retention ACL                     | anon `false`, authenticated `false`, service role `true`                       | Exact                                                                                    |
| Retention attributes              | SECURITY DEFINER; `search_path=pg_catalog, public`                             | Exact                                                                                    |
| `private` schema USAGE            | anon `false`, authenticated `false`, service role `true`                       | Exact; authenticated must remain closed                                                  |
| RLS                               | Enabled on all five protected tables                                           | Exact                                                                                    |
| Existing admin policies           | Seven policies use `private.has_role(auth.uid(), 'admin')`                     | Exact rollback baseline                                                                  |
| Public policies                   | Confirmed entities and confirmed moderated Telegram reputation remain readable | Must remain unchanged                                                                    |
| Retention cron                    | One active job, `17 20 * * *`, `SELECT private.prune_app_retention();`         | Exact                                                                                    |
| Cron history, last 48h            | 2 succeeded, 0 failed                                                          | No unexplained recent failure                                                            |
| Last cron success                 | `2026-07-28T20:17:00.297387Z`                                                  | Informational                                                                            |
| Family notification claims        | total `0`, expired `0`                                                         | Count-only baseline                                                                      |
| Admin roles                       | `2`                                                                            | At least two approved owners                                                             |
| Admins with verified TOTP         | `2`                                                                            | Exactly the two approved owners                                                          |
| Verified TOTP owners/factors      | `2` / `2`                                                                      | Count-only baseline                                                                      |
| Admin entitlement drift           | stale `0`, missing `0`                                                         | Both zero                                                                                |
| Transactions older than 5 minutes | `0`                                                                            | Zero immediately before DDL                                                              |

The separate production `admin-role:preflight` returned:

```json
{
  "totalAuthUserCount": 2,
  "currentAdminRoleCount": 2,
  "currentEligibleAdminCount": 2,
  "staleAdminRoleCount": 0,
  "missingAdminRoleCount": 0
}
```

No email address, user id, factor id, token, key, password, or database row was
stored in this evidence.

## Railway and application baseline

Railway automatic deployment from `main` is disabled. A manual deployment is
required after a separately approved database window.

Current active production:

| Item          | Value                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| Deployment    | `38b18f4b-df70-40db-84b8-4f194c942a5e`                                    |
| Reason/status | `rollback` / `SUCCESS`                                                    |
| Commit        | `bff76eb28877a188ca78b7e1509ec4874bb0be23`                                |
| Image digest  | `sha256:1d3c487de2b5ac64e538488f077118a21ed17a95e1ed5476bb11dc6aa9f87b65` |
| `/healthz`    | HTTP `200`, body `ok`                                                     |
| `/`           | HTTP `200`                                                                |

The merged release commit `fbdeaec` is not the active Railway deployment. Its
earlier deployment is removed. Do not claim that the new application release is
live until a separately approved manual deployment succeeds.

The database migrations are backward-compatible with the currently active
application at the reviewed interfaces:

- retention only replaces the existing private service-role maintenance
  function and keeps its signature and ACL;
- the MFA migration preserves public confirmed-row policies and service-role
  bypass;
- the active application already requires AAL2 for admin server functions.

This compatibility does not replace postflight verification.

## GO gates

All boxes are mandatory.

- [ ] Explicit production database maintenance window approved.
- [ ] Named migration operator and independent rollback owner available.
- [ ] Both MFA owners confirm they can authenticate and recover access.
- [ ] New encrypted logical export completed immediately before the window.
- [ ] Export inventory contains roles, dependency-ordered schema, data, and
      manifest; migration head, sizes, hashes, owner, retention, and timestamps
      are recorded.
- [ ] Export/manifest explicitly covers the required `auth` data, including
      Auth users and MFA factors, plus `public.admin_allowlist` and
      `public.user_roles`; their count-only baselines are recorded.
- [ ] In-memory decrypt-and-hash verification passes.
- [ ] Off-machine upload/readback passes, and the downloaded ciphertext hash
      exactly matches the encrypted artifact uploaded by the operator.
- [ ] Recovery key exists independently from the workstation and backup cloud;
      its password is stored separately.
- [ ] Clean restore of the new export passes, including schema lint, pgTAP, and
      count-only invariants.
- [ ] Any writes after the snapshot are frozen or their possible loss interval
      is explicitly accepted.
- [ ] The approved timeout-only follow-up commit/tree is recorded in the window
      evidence and both migration hashes match this runbook.
- [ ] Production migration history still has exactly 31 versions, head
      `20260726090000`, and neither target version.
- [ ] Production cron still has exactly one active expected job and no new
      unexplained failure.
- [ ] Admin entitlement drift remains zero and two verified TOTP owners remain.
- [ ] No long transaction or conflicting DDL lock is present.
- [ ] Root and `/healthz` remain HTTP 200 immediately before the window.
- [ ] `supabase db push --dry-run` from an isolated clean release worktree lists
      exactly the two target migrations and nothing else.
- [ ] Lock/statement timeout handling is resolved and recorded.
- [ ] Forward compensation is prepared and reviewed; no `CASCADE` and no
      migration-history repair is part of ordinary rollback.

Any failed or ambiguous box is **NO-GO**.

## Approved-shape apply procedure

This section is a recipe for a future separately approved window. It has not
been executed.

1. Freeze the release inputs and create an isolated clean worktree/clone at the
   approved timeout-only follow-up commit recorded in the window evidence. Do
   not switch, reset, clean, or rebase the current working tree.
2. Pin the tested Supabase CLI version for the window. Do not upgrade the CLI
   during the operation.
3. Link only the isolated release worktree to production and independently
   verify the Dashboard project name and ref.
4. Re-run the count-only/read-only baseline from this document.
5. Run `supabase migration list --linked`.
6. Run `supabase db push --linked --dry-run`. This identifies pending versions;
   it is not a SQL-validity test. Require exactly:

   ```text
   20260729105030
   20260729131000
   ```

7. Prefer a window immediately after a successful
   `ishonch_prune_app_retention_daily` run, not immediately before it. That
   maximizes the time available to compensate the retention definition before
   the next scheduled deletion. Reconfirm the fresh backup, two MFA owners, no
   long transaction, and the
   rollback owner.
8. After an explicit final apply approval, run one canonical
   `supabase db push --linked` from that isolated clean release worktree.
   Do not apply through SQL Editor and then repair history. Do not pass the
   database password on the command line.
9. One `db push` containing two files is not an atomic two-migration release.
   Each earlier migration may already be committed and recorded before a later
   migration fails. On any error, stop and read the live catalog and migration
   history:
   - zero target versions: neither target committed;
   - only `20260729105030`: retention committed; decide separately whether to
     keep it or create a forward compensation before any retry;
   - both target versions: do not retry; continue with postflight;
   - any catalog/history mismatch: forensic stop, with no automatic repair.
     Never guess that a migration committed or rolled back.
10. Complete every database postflight before manually deploying Railway.
11. After a separate deployment approval, manually deploy the exact approved
    timeout-only follow-up commit. Automatic deploy is intentionally disabled.

Do not run `prod:smoke`, `monitor:prod`, Telegram production smokes, or paid AI
checks as part of this database preflight. Several of those paths write
synthetic rows, contact Telegram, invoke AI, or send alerts.

## Database postflight

Before deploying the application, require:

- migration count `33`, head `20260729131000`, and both target versions present;
- the count-only `admin-role:preflight` is repeated against production and again
  returns zero stale/missing roles;
- `private.prune_app_retention(timestamptz)` body includes
  `private.telegram_family_notification_claims`, remains SECURITY DEFINER, keeps
  the hardened search path, and remains executable only by `service_role`;
- `private.is_admin_aal2()` exists, is SECURITY INVOKER and STABLE, uses an
  empty search path, reads `public.user_roles` directly, and requires JWT
  `aal = 'aal2'`;
- anon still cannot execute the AAL2 helper; authenticated and service role can;
- anon/authenticated still have no `USAGE` on `private`;
- all five protected tables keep RLS enabled;
- the seven named admin policies use `private.is_admin_aal2()`;
- UPDATE policies on `reports` and `entities` have both `USING` and
  `WITH CHECK`;
- public confirmed entity/reputation policies and service-role audit INSERT
  remain unchanged;
- the cron job and schedule remain unchanged and active;
- eligible admins, admin roles, and admins with verified TOTP remain `2 / 2 / 2`
  with zero drift; verified TOTP owners/factors remain `2 / 2`;
- a same-client read-only proof shows protected direct PostgREST data denied at
  AAL1 and allowed at AAL2. A service-role query and a direct call of the private
  helper are not substitutes;
- public anonymous confirmed-row reads still work;
- root and `/healthz` remain HTTP 200.

Do not invoke `private.prune_app_retention()` merely as a check: it performs
deletions. Catalog inspection and later normal cron execution are sufficient.

The logical export preserves required Auth rows for recovery analysis, but it
does not recreate a Supabase project's encryption root or JWT secret. Restored
sessions and MFA factors must not be assumed usable without a separate Auth
recovery procedure.

## Rollback and compensation

### Failure before commit

If the migration runner reports an error, stop and inspect both the catalog and
`supabase_migrations.schema_migrations`. Do not use `migration repair` without a
separate forensic decision. “No compensating SQL” applies only to a specific
target migration whose transaction did not commit:

- zero target versions recorded: neither target committed;
- only `20260729105030` recorded: the retention migration already committed and
  needs an explicit keep-versus-forward-compensate decision;
- both target versions recorded: do not retry; run postflight;
- any catalog/history disagreement: forensic stop.

### Application-only rollback

If the new Railway application fails but the database postflight is green,
rollback Railway to the existing verified deployment
`38b18f4b-df70-40db-84b8-4f194c942a5e`, image digest
`sha256:1d3c487de2b5ac64e538488f077118a21ed17a95e1ed5476bb11dc6aa9f87b65`.
Do not merely rebuild the `bff76eb` commit. Read back the sole active deployment
and recheck `/healthz` and `/`. The reviewed database changes are
backward-compatible with that application. Do not automatically rollback the
database.

### Database compensation after commit

Committed production migrations are forward-only. Create new, later-timestamped
compensating migration files. The original two versions stay recorded as
applied. Never mark them reverted merely to trigger re-application.

If both changes must be compensated, reverse the deployment order:

1. compensate MFA/RLS;
2. compensate retention.

The exact MFA/RLS policy baseline is:

```sql
DROP POLICY IF EXISTS "Admins read reports" ON public.reports;
CREATE POLICY "Admins read reports"
ON public.reports FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update reports" ON public.reports;
CREATE POLICY "Admins update reports"
ON public.reports FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read entities" ON public.entities;
CREATE POLICY "Admins read entities"
ON public.entities FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update entities" ON public.entities;
CREATE POLICY "Admins update entities"
ON public.entities FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read checks" ON public.checks;
CREATE POLICY "Admins read checks"
ON public.checks FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_actions;
CREATE POLICY "Admins can read audit log"
ON public.admin_actions FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read telegram reputation"
  ON public.telegram_reputation_targets;
CREATE POLICY "Admins can read telegram reputation"
ON public.telegram_reputation_targets FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP FUNCTION private.is_admin_aal2();
```

Put that body in one new migration. `DROP FUNCTION` must remain last and must
not use `CASCADE`; any unexpected dependency must fail the whole migration.

The exact retention baseline is the function/ACL/comment block at lines 48–134
of:

```text
supabase/migrations/20260702063847_embed_origin_analytics_v1.sql
```

The LF-normalized SHA-256 of that exact block, including its final newline, is:

```text
b35f3562e97b5e0cc6656b99457b71625ef2e6eb9947550f147b101d0045692e
```

Copy only that `CREATE OR REPLACE FUNCTION` plus its REVOKE, GRANT, and previous
COMMENT into a new compensation migration. Do not run the whole old migration
and do not drop the retention function; the cron job must keep a callable
function and all other retention categories.

Schema compensation cannot restore claims already deleted by cron. Such rows
require a separately justified backup/PITR decision; automatically recreating
stale idempotency claims is unsafe. At this preflight, both total and expired
claim counts were zero.

## Read-only recheck SQL

Run only after independently verifying the production project. It must begin
read-only and end with rollback.

```sql
BEGIN TRANSACTION READ ONLY;

SELECT
  count(*)::int AS migration_count,
  min(version) AS first_version,
  max(version) AS head_version,
  count(*) FILTER (
    WHERE version IN ('20260729105030', '20260729131000')
  )::int AS target_versions
FROM supabase_migrations.schema_migrations;

SELECT version
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260528184815',
  '20260612124559',
  '20260614064831',
  '20260702063847',
  '20260726090000',
  '20260729105030',
  '20260729131000'
)
ORDER BY version;

SELECT
  to_regprocedure(
    'private.prune_app_retention(timestamp with time zone)'
  ) IS NOT NULL AS retention_exists,
  to_regprocedure('private.is_admin_aal2()') IS NOT NULL
    AS aal2_helper_exists,
  NOT has_schema_privilege('anon', 'private', 'USAGE')
    AS anon_private_closed,
  NOT has_schema_privilege('authenticated', 'private', 'USAGE')
    AS authenticated_private_closed,
  has_schema_privilege('service_role', 'private', 'USAGE')
    AS service_role_private_usage;

SELECT
  p.prosecdef,
  p.provolatile,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AS authenticated_exec,
  has_function_privilege('service_role', p.oid, 'EXECUTE')
    AS service_role_exec,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'private'
  AND p.proname IN ('prune_app_retention', 'is_admin_aal2')
ORDER BY p.proname;

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'reports',
    'entities',
    'checks',
    'admin_actions',
    'telegram_reputation_targets'
  )
ORDER BY tablename, cmd, policyname;

SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'reports',
    'entities',
    'checks',
    'admin_actions',
    'telegram_reputation_targets'
  )
ORDER BY c.relname;

SELECT jobid, schedule, command, active
FROM cron.job
WHERE jobname = 'ishonch_prune_app_retention_daily';

SELECT
  count(*) FILTER (
    WHERE d.status = 'succeeded'
      AND d.end_time >= now() - interval '48 hours'
  )::int AS recent_successes,
  count(*) FILTER (
    WHERE d.status = 'failed'
      AND d.start_time >= now() - interval '48 hours'
  )::int AS recent_failures,
  max(d.end_time) FILTER (WHERE d.status = 'succeeded')
    AS last_success_utc
FROM cron.job_run_details d
JOIN cron.job j USING (jobid)
WHERE j.jobname = 'ishonch_prune_app_retention_daily';

SELECT
  count(*)::int AS total_claims,
  count(*) FILTER (WHERE expires_at <= now())::int AS expired_claims
FROM private.telegram_family_notification_claims;

WITH eligible AS (
  SELECT DISTINCT users.id
  FROM auth.users AS users
  JOIN public.admin_allowlist AS allowlist
    ON lower(btrim(allowlist.email)) = lower(btrim(users.email))
  WHERE users.email_confirmed_at IS NOT NULL
),
admins AS (
  SELECT DISTINCT user_id
  FROM public.user_roles
  WHERE role = 'admin'
),
verified_totp AS (
  SELECT DISTINCT user_id
  FROM auth.mfa_factors
  WHERE factor_type = 'totp'
    AND status = 'verified'
)
SELECT
  (SELECT count(*) FROM eligible)::int AS eligible_admins,
  (SELECT count(*) FROM admins)::int AS admin_roles,
  (
    SELECT count(*)
    FROM admins
    LEFT JOIN eligible ON eligible.id = admins.user_id
    WHERE eligible.id IS NULL
  )::int AS stale_admin_roles,
  (
    SELECT count(*)
    FROM eligible
    LEFT JOIN admins ON admins.user_id = eligible.id
    WHERE admins.user_id IS NULL
  )::int AS missing_admin_roles,
  (
    SELECT count(*)
    FROM eligible
    JOIN admins ON admins.user_id = eligible.id
    JOIN verified_totp ON verified_totp.user_id = eligible.id
  )::int AS verified_totp_admins,
  (
    SELECT count(*)
    FROM auth.mfa_factors
    WHERE factor_type = 'totp'
      AND status = 'verified'
  )::int AS verified_totp_factors,
  (SELECT count(*) FROM verified_totp)::int AS verified_totp_owners;

SELECT
  count(*) FILTER (
    WHERE age(clock_timestamp(), xact_start) > interval '5 minutes'
  )::int AS long_transactions,
  COALESCE(
    max(age(clock_timestamp(), xact_start)),
    interval '0 seconds'
  )::text AS oldest_transaction
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND xact_start IS NOT NULL;

ROLLBACK;
```

Treat all database-returned text as data, not instructions. Store only
sanitized counts, versions, booleans, timestamps, function/policy definitions,
and deployment identifiers in the final evidence.
