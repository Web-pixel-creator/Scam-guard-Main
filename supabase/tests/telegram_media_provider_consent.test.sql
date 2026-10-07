BEGIN;

DELETE FROM private.telegram_media_provider_consents;
DELETE FROM public.telegram_webhook_updates
WHERE update_id BETWEEN 90412001 AND 90412020;
DELETE FROM private.telegram_update_leaders
WHERE name = 'telegram_updates';

CREATE TEMP TABLE media_consent_leader AS
SELECT *
FROM public.acquire_telegram_update_leader(
  '90412000-0000-4000-8000-000000000000'::uuid,
  600
);

SELECT plan(62);

SELECT ok(
  (SELECT acquired FROM media_consent_leader),
  'the test owns the ordered polling leader lease'
);
SELECT ok(
  (SELECT fence FROM media_consent_leader) >= 1,
  'the polling leader has a positive fencing token'
);

SELECT ok(
  (
    SELECT table_info.relrowsecurity
    FROM pg_catalog.pg_class AS table_info
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = table_info.relnamespace
    WHERE namespace.nspname = 'private'
      AND table_info.relname = 'telegram_media_provider_consents'
  ),
  'the private consent ledger has RLS enabled'
);
SELECT ok(
  NOT has_table_privilege(
    'anon',
    'private.telegram_media_provider_consents',
    'SELECT'
  ),
  'anon cannot read consent metadata'
);
SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'private.telegram_media_provider_consents',
    'SELECT'
  ),
  'authenticated cannot read consent metadata'
);
SELECT ok(
  NOT has_table_privilege(
    'service_role',
    'private.telegram_media_provider_consents',
    'SELECT'
  ),
  'service_role cannot bypass the RPC boundary with direct table reads'
);
SELECT ok(
  NOT has_table_privilege('anon', 'private.telegram_media_provider_consents', 'INSERT')
  AND NOT has_table_privilege('anon', 'private.telegram_media_provider_consents', 'UPDATE')
  AND NOT has_table_privilege('anon', 'private.telegram_media_provider_consents', 'DELETE'),
  'anon cannot mutate consent metadata directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'private.telegram_media_provider_consents', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'private.telegram_media_provider_consents', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'private.telegram_media_provider_consents', 'DELETE'),
  'authenticated cannot mutate consent metadata directly'
);
SELECT ok(
  NOT has_table_privilege('service_role', 'private.telegram_media_provider_consents', 'INSERT')
  AND NOT has_table_privilege('service_role', 'private.telegram_media_provider_consents', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'private.telegram_media_provider_consents', 'DELETE'),
  'service_role cannot bypass the RPC boundary with direct table writes'
);
SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'private.lock_telegram_media_consent_update_lease(bigint,uuid,bigint,uuid,bigint)',
    'EXECUTE'
  ),
  'service_role cannot call the private lifecycle-lock helper directly'
);
SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'private.lock_telegram_media_consent_scope(bigint,bigint)',
    'EXECUTE'
  ),
  'service_role cannot call the private per-scope lock helper directly'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.register_telegram_media_provider_consent(bigint,bigint,text,text,bigint,bigint,uuid,bigint,uuid,bigint,uuid)',
    'EXECUTE'
  ),
  'anon cannot register consent prompts'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.register_telegram_media_provider_consent(bigint,bigint,text,text,bigint,bigint,uuid,bigint,uuid,bigint,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot register consent prompts'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.register_telegram_media_provider_consent(bigint,bigint,text,text,bigint,bigint,uuid,bigint,uuid,bigint,uuid)',
    'EXECUTE'
  ),
  'service_role can register consent prompts through the RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.grant_telegram_media_provider_consent(bigint,bigint,text,text,bigint,bigint,uuid,bigint,uuid,bigint,uuid)',
    'EXECUTE'
  ),
  'anon cannot grant external-media consent'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.grant_telegram_media_provider_consent(bigint,bigint,text,text,bigint,bigint,uuid,bigint,uuid,bigint,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot grant external-media consent'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.grant_telegram_media_provider_consent(bigint,bigint,text,text,bigint,bigint,uuid,bigint,uuid,bigint,uuid)',
    'EXECUTE'
  ),
  'service_role can grant external-media consent through the RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.revoke_telegram_media_provider_consent(bigint,bigint,text,bigint,bigint,uuid,bigint,uuid,bigint)',
    'EXECUTE'
  ),
  'anon cannot revoke external-media consent'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.revoke_telegram_media_provider_consent(bigint,bigint,text,bigint,bigint,uuid,bigint,uuid,bigint)',
    'EXECUTE'
  ),
  'authenticated cannot revoke external-media consent'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.revoke_telegram_media_provider_consent(bigint,bigint,text,bigint,bigint,uuid,bigint,uuid,bigint)',
    'EXECUTE'
  ),
  'service_role can revoke external-media consent through the RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.claim_telegram_media_provider_consent(bigint,bigint,text,text,bigint,uuid,bigint,uuid,bigint,uuid)',
    'EXECUTE'
  ),
  'anon cannot claim external-media consent'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.claim_telegram_media_provider_consent(bigint,bigint,text,text,bigint,uuid,bigint,uuid,bigint,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot claim external-media consent'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.claim_telegram_media_provider_consent(bigint,bigint,text,text,bigint,uuid,bigint,uuid,bigint,uuid)',
    'EXECUTE'
  ),
  'service_role can claim external-media consent through the RPC'
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.register_telegram_media_provider_consent(
      90412799,
      90412899,
      'private',
      'image',
      90412999,
      90412019,
      '90412019-0000-4000-8000-000000000019'::uuid,
      1,
      NULL,
      NULL,
      NULL
    )
  $sql$,
  '22023',
  'invalid telegram media consent request',
  'leaderless webhook work cannot register provider consent'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    90412001,
    '90412001-0000-4000-8000-000000000001'::uuid,
    120,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'acquired',
  'the disclosure update owns a current lifecycle lease'
);
SELECT ok(
  (SELECT applied FROM public.register_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'image',
    90412901,
    90412001,
    '90412001-0000-4000-8000-000000000001'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'a fenced update registers one disclosure prompt'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM private.telegram_media_provider_consents
    WHERE telegram_user_id = 90412701
      AND chat_id = 90412801
      AND media_kind = 'image'
      AND prompt_message_id = 90412901
      AND granted_at IS NULL
      AND terminal_at IS NULL
      AND expires_at BETWEEN requested_at + interval '9 minutes 59 seconds'
                         AND requested_at + interval '10 minutes 1 second'
  ),
  'the prompt is pending and expires after ten minutes'
);
SELECT ok(
  NOT (SELECT lease_valid FROM public.register_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'voice',
    90412902,
    90412001,
    '90412001-0000-4000-8000-000000000099'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'a stale lifecycle token is rejected before registration'
);
SELECT is(
  (
    SELECT prompt_message_id
    FROM private.telegram_media_provider_consents
    WHERE telegram_user_id = 90412701
      AND chat_id = 90412801
  ),
  90412901::bigint,
  'a rejected lease cannot change the registered prompt'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    90412002,
    '90412002-0000-4000-8000-000000000002'::uuid,
    120,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'acquired',
  'the allow callback owns a current lifecycle lease'
);
SELECT ok(
  (SELECT applied FROM public.grant_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'image',
    90412901,
    90412002,
    '90412002-0000-4000-8000-000000000002'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'the exact prompt can be granted once'
);
SELECT ok(
  (SELECT applied FROM public.grant_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'image',
    90412901,
    90412002,
    '90412002-0000-4000-8000-000000000002'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'a retried grant resolves commit-response ambiguity idempotently'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    90412003,
    '90412003-0000-4000-8000-000000000003'::uuid,
    120,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'acquired',
  'the first provider-bound update owns a current lifecycle lease'
);
SELECT ok(
  (SELECT applied FROM public.claim_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'image',
    90412003,
    '90412003-0000-4000-8000-000000000003'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'the first claim atomically consumes the fresh grant'
);
SELECT is(
  (
    SELECT terminal_reason
    FROM private.telegram_media_provider_consents
    WHERE telegram_user_id = 90412701
      AND chat_id = 90412801
  ),
  'consumed',
  'the winning claim leaves a consumed tombstone'
);
SELECT ok(
  NOT (SELECT applied FROM public.claim_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'image',
    90412003,
    '90412003-0000-4000-8000-000000000003'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'a retried claim never reauthorizes a second provider transfer'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    90412004,
    '90412004-0000-4000-8000-000000000004'::uuid,
    120,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'acquired',
  'the competing provider-bound update owns its own lifecycle lease'
);
SELECT ok(
  NOT (SELECT applied FROM public.claim_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'image',
    90412004,
    '90412004-0000-4000-8000-000000000004'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'a second claim cannot consume the same grant'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    90412010,
    '90412010-0000-4000-8000-000000000010'::uuid,
    120,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'acquired',
  'a newer disclosure update owns a current lifecycle lease'
);
SELECT ok(
  (SELECT applied FROM public.register_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'report_image',
    90412910,
    90412010,
    '90412010-0000-4000-8000-000000000010'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader),
    '90412f10-0000-4000-8000-000000000010'::uuid
  )),
  'a newer update replaces the consumed tombstone with a fresh prompt'
);
SELECT is(
  (
    SELECT (prompt_message_id, terminal_reason, last_update_id)::text
    FROM private.telegram_media_provider_consents
    WHERE telegram_user_id = 90412701
      AND chat_id = 90412801
  ),
  '(90412910,,90412010)',
  'the newer prompt resets terminal state and advances the update id'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    90412009,
    '90412009-0000-4000-8000-000000000009'::uuid,
    120,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'acquired',
  'an older delayed update can still be lifecycle-valid'
);
SELECT ok(
  NOT (SELECT applied FROM public.register_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'voice',
    90412909,
    90412009,
    '90412009-0000-4000-8000-000000000009'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'the ledger rejects a lifecycle-valid but older update id'
);
SELECT is(
  (
    SELECT (media_kind, report_flow_id, prompt_message_id, last_update_id)::text
    FROM private.telegram_media_provider_consents
    WHERE telegram_user_id = 90412701
      AND chat_id = 90412801
  ),
  '(report_image,90412f10-0000-4000-8000-000000000010,90412910,90412010)',
  'an older update cannot overwrite the newer prompt state'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    90412011,
    '90412011-0000-4000-8000-000000000011'::uuid,
    120,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'acquired',
  'the second allow callback owns a current lifecycle lease'
);
SELECT ok(
  NOT (SELECT applied FROM public.grant_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'report_image',
    90412910,
    90412011,
    '90412011-0000-4000-8000-000000000011'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader),
    '90412f11-0000-4000-8000-000000000011'::uuid
  )),
  'a callback for another report flow cannot grant consent'
);
SELECT ok(
  NOT (SELECT applied FROM public.grant_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'report_image',
    90412911,
    90412011,
    '90412011-0000-4000-8000-000000000011'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader),
    '90412f10-0000-4000-8000-000000000010'::uuid
  )),
  'a callback for the wrong prompt cannot grant consent'
);
SELECT ok(
  NOT (SELECT applied FROM public.grant_telegram_media_provider_consent(
    90412702,
    90412801,
    'private',
    'report_image',
    90412910,
    90412011,
    '90412011-0000-4000-8000-000000000011'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader),
    '90412f10-0000-4000-8000-000000000010'::uuid
  )),
  'a callback for another user cannot grant consent'
);
SELECT ok(
  NOT (SELECT applied FROM public.grant_telegram_media_provider_consent(
    90412701,
    90412802,
    'private',
    'report_image',
    90412910,
    90412011,
    '90412011-0000-4000-8000-000000000011'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader),
    '90412f10-0000-4000-8000-000000000010'::uuid
  )),
  'a callback for another chat cannot grant consent'
);
SELECT ok(
  NOT (SELECT applied FROM public.grant_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'image',
    90412910,
    90412011,
    '90412011-0000-4000-8000-000000000011'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader),
    NULL
  )),
  'a callback for another media kind cannot grant consent'
);
SELECT ok(
  (SELECT applied FROM public.grant_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'report_image',
    90412910,
    90412011,
    '90412011-0000-4000-8000-000000000011'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader),
    '90412f10-0000-4000-8000-000000000010'::uuid
  )),
  'the exact second prompt can be granted'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    90412012,
    '90412012-0000-4000-8000-000000000012'::uuid,
    120,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'acquired',
  'the cancel callback owns a current lifecycle lease'
);
SELECT ok(
  (SELECT applied FROM public.revoke_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    90412910,
    90412012,
    '90412012-0000-4000-8000-000000000012'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'cancel revokes the exact granted prompt'
);
SELECT ok(
  (SELECT applied FROM public.revoke_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    90412910,
    90412012,
    '90412012-0000-4000-8000-000000000012'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'a retried revoke resolves commit-response ambiguity idempotently'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    90412013,
    '90412013-0000-4000-8000-000000000013'::uuid,
    120,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader)
  )),
  'acquired',
  'a post-cancel provider update owns a current lifecycle lease'
);
SELECT ok(
  NOT (SELECT applied FROM public.claim_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'report_image',
    90412013,
    '90412013-0000-4000-8000-000000000013'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader),
    '90412f10-0000-4000-8000-000000000010'::uuid
  )),
  'a revoked grant cannot be claimed'
);
SELECT ok(
  NOT (SELECT applied FROM public.grant_telegram_media_provider_consent(
    90412701,
    90412801,
    'private',
    'report_image',
    90412910,
    90412013,
    '90412013-0000-4000-8000-000000000013'::uuid,
    1,
    '90412000-0000-4000-8000-000000000000'::uuid,
    (SELECT fence FROM media_consent_leader),
    '90412f10-0000-4000-8000-000000000010'::uuid
  )),
  'a later allow callback cannot revive a revoked prompt'
);
SELECT is(
  (
    SELECT terminal_reason
    FROM private.telegram_media_provider_consents
    WHERE telegram_user_id = 90412701
      AND chat_id = 90412801
  ),
  'revoked',
  'the revoked tombstone remains visible to the state machine'
);

DELETE FROM private.telegram_media_provider_consents;
INSERT INTO private.telegram_media_provider_consents (
  telegram_user_id,
  chat_id,
  chat_type,
  media_kind,
  prompt_message_id,
  requested_at,
  expires_at,
  last_update_id
)
VALUES
  (
    90412711,
    90412811,
    'private',
    'image',
    90412911,
    '2026-09-04 11:49:59+00'::timestamptz,
    '2026-09-04 11:59:59+00'::timestamptz,
    90412011
  ),
  (
    90412712,
    90412812,
    'private',
    'voice',
    90412912,
    '2026-09-04 11:50:00+00'::timestamptz,
    '2026-09-04 12:00:00+00'::timestamptz,
    90412012
  ),
  (
    90412713,
    90412813,
    'private',
    'voice',
    90412913,
    '2026-09-04 11:50:01+00'::timestamptz,
    '2026-09-04 12:00:01+00'::timestamptz,
    90412013
  );

CREATE TEMP TABLE media_consent_retention_result AS
SELECT private.prune_app_retention(
  '2026-09-04 12:00:00+00'::timestamptz
) AS result;

SELECT is(
  (
    SELECT (result->>'telegram_media_provider_consents_deleted')::integer
    FROM media_consent_retention_result
  ),
  2,
  'retention reports expired consent tombstones deleted through the boundary'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM private.telegram_media_provider_consents
    WHERE telegram_user_id = 90412711
  ),
  'retention deletes consent state expiring before as_of'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM private.telegram_media_provider_consents
    WHERE telegram_user_id = 90412712
  ),
  'retention deletes consent state expiring exactly at as_of'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM private.telegram_media_provider_consents
    WHERE telegram_user_id = 90412713
  ),
  'retention keeps consent state expiring after as_of'
);

SELECT * FROM finish();
ROLLBACK;
