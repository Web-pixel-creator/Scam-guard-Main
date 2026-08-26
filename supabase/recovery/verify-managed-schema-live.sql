-- Read-only, fail-closed verification of application-owned objects in
-- Supabase-managed schemas. Run only inside a READ ONLY transaction.

SET TRANSACTION READ ONLY;

DO $$
DECLARE
  auth_users_trigger_count integer;
  storage_application_trigger_count integer;
  managed_policy_count integer;
BEGIN
  -- Scoped to auth.users on purpose: Supabase may add its own platform
  -- triggers elsewhere in managed schemas, and fail-red noise there would
  -- erode the gate. The two reviewed application hooks live on auth.users.
  SELECT count(*)
  INTO auth_users_trigger_count
  FROM pg_trigger AS trigger
  JOIN pg_proc AS function ON function.oid = trigger.tgfoid
  JOIN pg_namespace AS function_namespace
    ON function_namespace.oid = function.pronamespace
  WHERE trigger.tgrelid = 'auth.users'::regclass
    AND function_namespace.nspname NOT IN (
      'auth',
      'storage',
      'extensions',
      'pg_catalog'
    )
    AND NOT trigger.tgisinternal;

  IF auth_users_trigger_count <> 2 THEN
    RAISE EXCEPTION 'managed-schema application trigger inventory mismatch';
  END IF;

  SELECT count(*)
  INTO storage_application_trigger_count
  FROM pg_trigger AS trigger
  JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
  JOIN pg_namespace AS relation_namespace
    ON relation_namespace.oid = relation.relnamespace
  JOIN pg_proc AS function ON function.oid = trigger.tgfoid
  JOIN pg_namespace AS function_namespace
    ON function_namespace.oid = function.pronamespace
  WHERE relation_namespace.nspname = 'storage'
    AND function_namespace.nspname NOT IN (
      'auth',
      'storage',
      'extensions',
      'pg_catalog'
    )
    AND NOT trigger.tgisinternal;

  IF storage_application_trigger_count <> 0 THEN
    RAISE EXCEPTION 'storage application trigger inventory mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger AS trigger
    WHERE trigger.tgrelid = 'auth.users'::regclass
      AND trigger.tgname = 'on_auth_user_created_role'
      AND NOT trigger.tgisinternal
      AND trigger.tgenabled = 'O'
      AND trigger.tgtype = 5
      AND trigger.tgfoid = 'public.handle_new_user_role()'::regprocedure
      AND trigger.tgqual IS NULL
  ) THEN
    RAISE EXCEPTION 'managed-schema INSERT trigger mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger AS trigger
    WHERE trigger.tgrelid = 'auth.users'::regclass
      AND trigger.tgname = 'on_auth_user_email_confirmed_role'
      AND NOT trigger.tgisinternal
      AND trigger.tgenabled = 'O'
      AND trigger.tgtype = 17
      AND trigger.tgfoid =
        'public.handle_confirmed_admin_allowlist_role()'::regprocedure
      AND ARRAY(
        SELECT attribute.attname
        FROM unnest(trigger.tgattr::smallint[])
          WITH ORDINALITY AS trigger_attribute(attnum, position)
        JOIN pg_attribute AS attribute
          ON attribute.attrelid = trigger.tgrelid
          AND attribute.attnum = trigger_attribute.attnum
        ORDER BY trigger_attribute.position
      ) = ARRAY['email', 'email_confirmed_at']
      AND trigger.tgqual IS NOT NULL
      AND regexp_replace(
        lower(pg_get_expr(trigger.tgqual, trigger.tgrelid)),
        '[[:space:]()]',
        '',
        'g'
      ) =
        'old.emailisdistinctfromnew.emailorold.email_confirmed_atisdistinctfromnew.email_confirmed_at'
  ) THEN
    RAISE EXCEPTION 'managed-schema confirmation trigger mismatch';
  END IF;

  -- Ishonch Guard intentionally owns no policies in managed schemas. Any
  -- policy there is unreviewed Dashboard/manual drift and blocks the export.
  SELECT count(*)
  INTO managed_policy_count
  FROM pg_policies
  WHERE schemaname IN ('auth', 'storage');

  IF managed_policy_count <> 0 THEN
    RAISE EXCEPTION 'managed-schema policy inventory mismatch';
  END IF;
END
$$;
