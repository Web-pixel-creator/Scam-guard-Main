BEGIN;

SELECT plan(10);

DELETE FROM private.telegram_family_notification_claims;
DELETE FROM public.telegram_family_shield
WHERE id = '00000000-0000-4000-8000-00000000f701'::uuid
   OR guardian_telegram_user_id = 9100000701
   OR invite_code_hash = repeat('f', 64);

INSERT INTO public.telegram_family_shield (
  id,
  guardian_telegram_user_id,
  trusted_telegram_user_id,
  trusted_chat_id,
  invite_code_hash,
  status,
  accepted_at,
  guardian_auto_alerts_enabled,
  trusted_auto_alerts_enabled
)
VALUES (
  '00000000-0000-4000-8000-00000000f701'::uuid,
  9100000701,
  9100000702,
  9100000702,
  repeat('f', 64),
  'active',
  '2026-07-29 10:00:00+00'::timestamptz,
  true,
  true
);

INSERT INTO private.telegram_family_notification_claims (
  id,
  family_id,
  idempotency_key,
  mode,
  claimed_at,
  expires_at
)
VALUES
  (
    '00000000-0000-4000-8000-00000000f711'::uuid,
    '00000000-0000-4000-8000-00000000f701'::uuid,
    'family-retention-expired-before-000000000001',
    'automatic',
    '2026-07-28 12:00:00+00'::timestamptz,
    '2026-07-29 11:59:59+00'::timestamptz
  ),
  (
    '00000000-0000-4000-8000-00000000f712'::uuid,
    '00000000-0000-4000-8000-00000000f701'::uuid,
    'family-retention-expired-boundary-000000000002',
    'manual',
    '2026-07-28 12:00:00+00'::timestamptz,
    '2026-07-29 12:00:00+00'::timestamptz
  ),
  (
    '00000000-0000-4000-8000-00000000f713'::uuid,
    '00000000-0000-4000-8000-00000000f701'::uuid,
    'family-retention-future-0000000000000000000003',
    'automatic',
    '2026-07-29 11:00:00+00'::timestamptz,
    '2026-07-29 12:00:01+00'::timestamptz
  );

CREATE TEMP TABLE family_retention_result AS
SELECT private.prune_app_retention(
  '2026-07-29 12:00:00+00'::timestamptz
) AS result;

SELECT is(
  (
    SELECT (result->>'telegram_family_notification_claims_deleted')::integer
    FROM family_retention_result
  ),
  2,
  'retention reports the number of expired Family Shield claims deleted'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM private.telegram_family_notification_claims
    WHERE id = '00000000-0000-4000-8000-00000000f711'::uuid
  ),
  'a claim expiring before as_of is deleted'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM private.telegram_family_notification_claims
    WHERE id = '00000000-0000-4000-8000-00000000f712'::uuid
  ),
  'a claim expiring exactly at as_of is deleted'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM private.telegram_family_notification_claims
    WHERE id = '00000000-0000-4000-8000-00000000f713'::uuid
  ),
  'a claim expiring after as_of is retained'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.telegram_family_shield
    WHERE id = '00000000-0000-4000-8000-00000000f701'::uuid
  ),
  'claim retention does not delete the active Family Shield relationship'
);
SELECT ok(
  (
    SELECT procedure.prosecdef
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'private'
      AND procedure.proname = 'prune_app_retention'
      AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) = 'as_of timestamp with time zone'
  ),
  'the retention function remains SECURITY DEFINER'
);
SELECT ok(
  (
    SELECT 'search_path=pg_catalog, public' = ANY(procedure.proconfig)
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'private'
      AND procedure.proname = 'prune_app_retention'
      AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) = 'as_of timestamp with time zone'
  ),
  'the retention function keeps its hardened search_path'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'private.prune_app_retention(timestamp with time zone)',
    'EXECUTE'
  ),
  'anon cannot execute the retention function'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'private.prune_app_retention(timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated cannot execute the retention function'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'private.prune_app_retention(timestamp with time zone)',
    'EXECUTE'
  ),
  'service_role can execute the retention function'
);

SELECT * FROM finish();
ROLLBACK;
