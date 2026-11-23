BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DELETE FROM private.telegram_media_provider_consents
WHERE telegram_user_id = 91007701 AND chat_id = 91007801;
DELETE FROM public.telegram_webhook_updates
WHERE update_id BETWEEN 91007001 AND 91007003;
DELETE FROM private.telegram_update_leaders WHERE name = 'telegram_updates';

CREATE TEMP TABLE ordering_leader AS
SELECT * FROM public.acquire_telegram_update_leader(
  '91007000-0000-4000-8000-000000000000'::uuid, 600
);

SELECT plan(13);

SELECT ok((SELECT acquired FROM ordering_leader), 'ordering test owns a real polling leader');

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    91007002, '91007002-0000-4000-8000-000000000002'::uuid, 120,
    '91007000-0000-4000-8000-000000000000'::uuid, (SELECT fence FROM ordering_leader)
  )), 'acquired', 'newer registration has a current lifecycle lease'
);
SELECT ok(
  (SELECT applied FROM public.register_telegram_media_provider_consent(
    91007701, 91007801, 'private', 'image', 91007902, 91007002,
    '91007002-0000-4000-8000-000000000002'::uuid, 1,
    '91007000-0000-4000-8000-000000000000'::uuid, (SELECT fence FROM ordering_leader)
  )), 'newer registration creates a prompt'
);
SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    91007001, '91007001-0000-4000-8000-000000000001'::uuid, 120,
    '91007000-0000-4000-8000-000000000000'::uuid, (SELECT fence FROM ordering_leader)
  )), 'acquired', 'older update is lifecycle-valid, not denied by a stale lease'
);
SELECT results_eq(
  $$SELECT lease_valid, applied FROM public.register_telegram_media_provider_consent(
    91007701, 91007801, 'private', 'voice', 91007901, 91007001,
    '91007001-0000-4000-8000-000000000001'::uuid, 1,
    '91007000-0000-4000-8000-000000000000'::uuid, (SELECT fence FROM ordering_leader)
  )$$,
  $$VALUES (true, false)$$,
  'older registration cannot replace the live newer prompt'
);

-- Age only our ungranted metadata row. This preserves every table CHECK and
-- needs no sleep or fake clock in the real function under test.
UPDATE private.telegram_media_provider_consents
SET requested_at = clock_timestamp() - interval '11 minutes',
    expires_at = clock_timestamp() - interval '1 minute'
WHERE telegram_user_id = 91007701 AND chat_id = 91007801;
CREATE TEMP TABLE expired_ordering_snapshot AS
SELECT to_jsonb(consent)::text AS state
FROM private.telegram_media_provider_consents AS consent
WHERE telegram_user_id = 91007701 AND chat_id = 91007801;

SELECT ok(
  (SELECT expires_at <= clock_timestamp() FROM private.telegram_media_provider_consents
   WHERE telegram_user_id = 91007701 AND chat_id = 91007801),
  'the retained newer row has actually expired'
);
SELECT results_eq(
  $$SELECT lease_valid, applied FROM public.register_telegram_media_provider_consent(
    91007701, 91007801, 'private', 'voice', 91007901, 91007001,
    '91007001-0000-4000-8000-000000000001'::uuid, 1,
    '91007000-0000-4000-8000-000000000000'::uuid, (SELECT fence FROM ordering_leader)
  )$$,
  $$VALUES (true, false)$$,
  'expiry does not authorize an older registration to move a retained row backwards'
);
SELECT is(
  (SELECT to_jsonb(consent)::text FROM private.telegram_media_provider_consents AS consent
   WHERE telegram_user_id = 91007701 AND chat_id = 91007801),
  (SELECT state FROM expired_ordering_snapshot),
  'rejected old registration preserves all expired newer metadata and TTL'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    91007003, '91007003-0000-4000-8000-000000000003'::uuid, 120,
    '91007000-0000-4000-8000-000000000000'::uuid, (SELECT fence FROM ordering_leader)
  )), 'acquired', 'a genuinely newer update can renew the expired prompt'
);
SELECT ok(
  (SELECT applied FROM public.register_telegram_media_provider_consent(
    91007701, 91007801, 'private', 'voice', 91007903, 91007003,
    '91007003-0000-4000-8000-000000000003'::uuid, 1,
    '91007000-0000-4000-8000-000000000000'::uuid, (SELECT fence FROM ordering_leader)
  )), 'newer registration replaces the expired row successfully'
);
SELECT ok(
  (SELECT last_update_id = 91007003 AND prompt_message_id = 91007903
      AND media_kind = 'voice' AND expires_at > clock_timestamp()
      AND granted_at IS NULL AND terminal_at IS NULL
   FROM private.telegram_media_provider_consents
   WHERE telegram_user_id = 91007701 AND chat_id = 91007801),
  'renewal advances ordering and TTL but does not grant provider permission'
);
SELECT results_eq(
  $$SELECT lease_valid, applied FROM public.claim_telegram_media_provider_consent(
    91007701, 91007801, 'private', 'voice', 91007003,
    '91007003-0000-4000-8000-000000000003'::uuid, 1,
    '91007000-0000-4000-8000-000000000000'::uuid, (SELECT fence FROM ordering_leader)
  )$$,
  $$VALUES (true, false)$$,
  'an ungranted renewed prompt cannot authorize provider I/O'
);
SELECT ok(
  has_function_privilege('service_role',
    'public.register_telegram_media_provider_consent(bigint,bigint,text,text,bigint,bigint,uuid,bigint,uuid,bigint,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon',
    'public.register_telegram_media_provider_consent(bigint,bigint,text,text,bigint,bigint,uuid,bigint,uuid,bigint,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated',
    'public.register_telegram_media_provider_consent(bigint,bigint,text,text,bigint,bigint,uuid,bigint,uuid,bigint,uuid)', 'EXECUTE'),
  'registration ACL remains service-role-only after replacement'
);

SELECT * FROM finish();
ROLLBACK;
