BEGIN;

-- Keep the lifecycle assertions deterministic when they run against a restored
-- snapshot that already contains the production polling-leader fence. This
-- delete is part of the test transaction and is restored by the ROLLBACK below.
DELETE FROM private.telegram_update_leaders
WHERE name = 'telegram_updates';

SELECT plan(35);

SELECT ok(
  (SELECT acquired FROM public.acquire_telegram_update_leader(
    '00000000-0000-4000-8000-000000000001'::uuid, 60
  )),
  'first polling leader acquires the singleton lease'
);
SELECT is(
  (SELECT fence FROM public.acquire_telegram_update_leader(
    '00000000-0000-4000-8000-000000000001'::uuid, 60
  )),
  1::bigint,
  'leader fence starts at one'
);
SELECT ok(
  NOT (SELECT acquired FROM public.acquire_telegram_update_leader(
    '00000000-0000-4000-8000-000000000002'::uuid, 60
  )),
  'a second polling leader is rejected'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900001,
    '00000000-0000-4000-8000-000000000011'::uuid,
    120,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  )),
  'acquired',
  'the current leader acquires an update lease'
);
SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900001,
    '00000000-0000-4000-8000-000000000012'::uuid,
    120,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  )),
  'busy',
  'an in-flight update stays busy'
);
SELECT ok(
  NOT public.complete_telegram_update(
    900001,
    '00000000-0000-4000-8000-000000000011'::uuid,
    1,
    NULL,
    NULL
  ),
  'leader fencing cannot be bypassed with null arguments'
);
SELECT ok(
  public.telegram_update_lease_current(
    900001,
    '00000000-0000-4000-8000-000000000011'::uuid,
    1,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  ),
  'the matching update and leader fences are current'
);
SELECT ok(
  public.complete_telegram_update(
    900001,
    '00000000-0000-4000-8000-000000000011'::uuid,
    1,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  ),
  'only the current fenced worker completes the update'
);
SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900001,
    '00000000-0000-4000-8000-000000000013'::uuid,
    120,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  )),
  'completed',
  'redelivery after completion skips dispatch'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.begin_telegram_update(bigint,uuid,integer,uuid,bigint)',
    'EXECUTE'
  ),
  'anon cannot begin Telegram update processing'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.complete_telegram_update(bigint,uuid,bigint,uuid,bigint)',
    'EXECUTE'
  ),
  'authenticated cannot complete Telegram updates'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.begin_telegram_update(bigint,uuid,integer,uuid,bigint)',
    'EXECUTE'
  ),
  'service_role can call the lifecycle RPC'
);

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900002,
    '00000000-0000-4000-8000-000000000021'::uuid,
    120,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  )),
  'acquired',
  'a second update starts normally'
);
SELECT ok(
  public.mark_telegram_update_failure(
    900002,
    '00000000-0000-4000-8000-000000000021'::uuid,
    1,
    'dispatch',
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  ),
  'failure releases the update lease for retry'
);
SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900002,
    '00000000-0000-4000-8000-000000000022'::uuid,
    120,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  )),
  'acquired',
  'a failed update is reacquired immediately'
);
SELECT is(
  (SELECT processing_fence FROM public.begin_telegram_update(
    900002,
    '00000000-0000-4000-8000-000000000022'::uuid,
    120,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  )),
  2::bigint,
  'reacquisition increments the processing fence'
);
SELECT ok(
  NOT public.telegram_update_lease_current(
    900002,
    '00000000-0000-4000-8000-000000000021'::uuid,
    1,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  ),
  'the old update lease is stale after reacquisition'
);
SELECT ok(
  public.telegram_update_lease_current(
    900002,
    '00000000-0000-4000-8000-000000000022'::uuid,
    2,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  ),
  'the reacquired update lease is current'
);
SELECT ok(
  (SELECT lease_valid FROM public.save_telegram_session_fenced(
    700002,
    900002,
    '00000000-0000-4000-8000-000000000022'::uuid,
    2,
    '{"lang":"uz"}'::jsonb,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  )),
  'session writes accept only the current update and leader fences'
);
SELECT ok(
  (SELECT active FROM public.telegram_update_leader_status()),
  'leader health reports an active polling leader'
);

SELECT ok(
  public.release_telegram_update_leader(
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  ),
  'the first polling leader can release its singleton lease'
);
SELECT ok(
  (SELECT acquired FROM public.acquire_telegram_update_leader(
    '00000000-0000-4000-8000-000000000002'::uuid, 60
  )),
  'a replacement polling leader acquires the released singleton lease'
);
SELECT is(
  (SELECT fence FROM public.acquire_telegram_update_leader(
    '00000000-0000-4000-8000-000000000002'::uuid, 60
  )),
  2::bigint,
  'the replacement polling leader receives a new fence'
);
SELECT ok(
  NOT public.telegram_update_lease_current(
    900002,
    '00000000-0000-4000-8000-000000000022'::uuid,
    2,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  ),
  'the old worker is fenced as soon as its polling leader is superseded'
);
SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900002,
    '00000000-0000-4000-8000-000000000023'::uuid,
    120,
    '00000000-0000-4000-8000-000000000002'::uuid,
    2
  )),
  'busy',
  'the replacement leader waits for the outbound-effect drain grace'
);
SELECT ok(
  (SELECT retry_after_sec FROM public.begin_telegram_update(
    900002,
    '00000000-0000-4000-8000-000000000023'::uuid,
    120,
    '00000000-0000-4000-8000-000000000002'::uuid,
    2
  )) BETWEEN 1 AND 15,
  'the drain grace returns a bounded retry delay'
);

UPDATE private.telegram_update_leaders
SET acquired_at = pg_catalog.clock_timestamp() - interval '16 seconds'
WHERE name = 'telegram_updates'
  AND lease_token = '00000000-0000-4000-8000-000000000002'::uuid
  AND fence = 2;

SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900002,
    '00000000-0000-4000-8000-000000000023'::uuid,
    120,
    '00000000-0000-4000-8000-000000000002'::uuid,
    2
  )),
  'acquired',
  'the current leader reclaims the stale update after the drain grace'
);
SELECT is(
  (SELECT processing_fence FROM public.begin_telegram_update(
    900002,
    '00000000-0000-4000-8000-000000000023'::uuid,
    120,
    '00000000-0000-4000-8000-000000000002'::uuid,
    2
  )),
  3::bigint,
  'stale-leader reclamation increments the processing fence'
);
SELECT is(
  (SELECT attempt_count FROM public.begin_telegram_update(
    900002,
    '00000000-0000-4000-8000-000000000023'::uuid,
    120,
    '00000000-0000-4000-8000-000000000002'::uuid,
    2
  )),
  3,
  'stale-leader reclamation increments the attempt count'
);
SELECT ok(
  NOT public.complete_telegram_update(
    900002,
    '00000000-0000-4000-8000-000000000022'::uuid,
    2,
    '00000000-0000-4000-8000-000000000001'::uuid,
    1
  ),
  'the superseded worker cannot complete after reclamation'
);
SELECT ok(
  public.telegram_update_lease_current(
    900002,
    '00000000-0000-4000-8000-000000000023'::uuid,
    3,
    '00000000-0000-4000-8000-000000000002'::uuid,
    2
  ),
  'the replacement worker owns the new processing and leader fences'
);
SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900002,
    '00000000-0000-4000-8000-000000000024'::uuid,
    120,
    '00000000-0000-4000-8000-000000000002'::uuid,
    2
  )),
  'busy',
  'an active update owned by the current polling leader remains busy'
);
SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900003,
    '00000000-0000-4000-8000-000000000031'::uuid,
    120,
    NULL,
    NULL
  )),
  'acquired',
  'a webhook update starts with the existing non-leader lease semantics'
);
SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900003,
    '00000000-0000-4000-8000-000000000032'::uuid,
    120,
    '00000000-0000-4000-8000-000000000002'::uuid,
    2
  )),
  'busy',
  'the current polling leader cannot steal an active webhook lease'
);
SELECT is(
  (SELECT decision FROM public.begin_telegram_update(
    900003,
    '00000000-0000-4000-8000-000000000033'::uuid,
    120,
    NULL,
    NULL
  )),
  'busy',
  'a second webhook worker cannot steal an active webhook lease'
);

SELECT * FROM finish();
ROLLBACK;
