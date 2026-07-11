BEGIN;
SELECT plan(20);

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

SELECT * FROM finish();
ROLLBACK;
