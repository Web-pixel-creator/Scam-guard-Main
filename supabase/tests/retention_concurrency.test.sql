BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

SELECT plan(13);

SELECT ok(
  (SELECT 'lock_timeout=5s' = ANY(proconfig)
   FROM pg_catalog.pg_proc WHERE oid = 'private.prune_app_retention(timestamptz)'::regprocedure),
  'retention has its own bounded runtime lock timeout'
);
SELECT matches(
  pg_catalog.pg_get_functiondef('private.prune_app_retention(timestamptz)'::regprocedure),
  'pg_try_advisory_xact_lock',
  'retention acquires a non-waiting transaction-scoped singleton'
);
SELECT matches(
  pg_catalog.pg_get_functiondef('private.prune_app_retention(timestamptz)'::regprocedure),
  'retention_prune_busy',
  'overlapping retention is an explicit failure, never an empty success'
);
SELECT ok(
  (SELECT prosecdef FROM pg_catalog.pg_proc
   WHERE oid = 'private.prune_app_retention(timestamptz)'::regprocedure),
  'retention remains a private definer function'
);
SELECT ok(
  (SELECT 'search_path=pg_catalog, public' = ANY(proconfig)
   FROM pg_catalog.pg_proc WHERE oid = 'private.prune_app_retention(timestamptz)'::regprocedure),
  'retention retains its hardened search path'
);
SELECT ok(NOT has_function_privilege('anon', 'private.prune_app_retention(timestamptz)', 'EXECUTE'),
          'anon cannot prune');
SELECT ok(NOT has_function_privilege('authenticated', 'private.prune_app_retention(timestamptz)', 'EXECUTE'),
          'authenticated cannot prune');
SELECT ok(has_function_privilege('service_role', 'private.prune_app_retention(timestamptz)', 'EXECUTE'),
          'service role can prune');

DELETE FROM private.telegram_media_provider_consents
WHERE telegram_user_id IN (91008801, 91008802) AND chat_id = 91008901;
INSERT INTO private.telegram_media_provider_consents (
  telegram_user_id, chat_id, chat_type, media_kind, prompt_message_id,
  requested_at, expires_at, last_update_id
) VALUES
  (91008801, 91008901, 'private', 'image', 91008911,
   '2026-10-07 23:50:00+00', '2026-10-08 00:00:00+00', 91008811),
  (91008802, 91008901, 'private', 'voice', 91008912,
   '2026-10-07 23:50:01+00', '2026-10-08 00:00:01+00', 91008812);

SET LOCAL ROLE service_role;
CREATE TEMP TABLE retention_concurrency_result AS
SELECT private.prune_app_retention('2026-10-08 00:00:00+00'::timestamptz) AS result;
RESET ROLE;

SELECT results_eq(
  $$SELECT jsonb_object_keys(result) FROM retention_concurrency_result ORDER BY 1$$,
  $$SELECT unnest(ARRAY[
    'as_of', 'checks_deleted', 'embed_origin_events_deleted', 'rate_limit_buckets_deleted',
    'reports_stale_open_deleted', 'reports_terminal_deleted',
    'telegram_family_notification_claims_deleted', 'telegram_family_revoked_deleted',
    'telegram_family_stale_pending_deleted', 'telegram_media_provider_consents_deleted',
    'telegram_reputation_stale_deleted', 'telegram_sessions_deleted',
    'telegram_webhook_updates_deleted'
  ]) ORDER BY 1$$,
  'successful pruning preserves the existing result keys'
);
SELECT is((SELECT (result->>'telegram_media_provider_consents_deleted')::integer
           FROM retention_concurrency_result), 1,
          'exact-expiry consent is pruned');
SELECT ok(NOT EXISTS(SELECT 1 FROM private.telegram_media_provider_consents
                     WHERE telegram_user_id = 91008801 AND chat_id = 91008901),
          'expired metadata is gone');
SELECT ok(EXISTS(SELECT 1 FROM private.telegram_media_provider_consents
                 WHERE telegram_user_id = 91008802 AND chat_id = 91008901),
          'future-expiry metadata survives');
SELECT is((SELECT (result->>'as_of')::timestamptz FROM retention_concurrency_result),
          '2026-10-08 00:00:00+00'::timestamptz,
          'pruning keeps the caller cutoff');

SELECT * FROM finish();
ROLLBACK;
