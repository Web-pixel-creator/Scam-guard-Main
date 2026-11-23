BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

SELECT no_plan();

SELECT ok(NOT (SELECT prosecdef FROM pg_catalog.pg_proc WHERE oid =
  'public.submit_reputation_appeal(public.input_type,jsonb,text,text,jsonb,text)'::regprocedure),
  'appeal RPC is invoker, not an RLS-bypassing definer');
SELECT is((SELECT provolatile::text FROM pg_catalog.pg_proc WHERE oid =
  'public.submit_reputation_appeal(public.input_type,jsonb,text,text,jsonb,text)'::regprocedure),
  'v', 'volatile statements obtain fresh READ COMMITTED snapshots after lock wait');
SELECT ok((SELECT 'search_path=""' = ANY(proconfig) FROM pg_catalog.pg_proc WHERE oid =
  'public.submit_reputation_appeal(public.input_type,jsonb,text,text,jsonb,text)'::regprocedure),
  'RPC has an empty search path');
SELECT ok((SELECT 'lock_timeout=5s' = ANY(proconfig) FROM pg_catalog.pg_proc WHERE oid =
  'public.submit_reputation_appeal(public.input_type,jsonb,text,text,jsonb,text)'::regprocedure),
  'RPC bounds each lock wait');
SELECT ok(NOT has_function_privilege('anon',
  'public.submit_reputation_appeal(public.input_type,jsonb,text,text,jsonb,text)', 'EXECUTE'),
  'anon has no RPC EXECUTE');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.submit_reputation_appeal(public.input_type,jsonb,text,text,jsonb,text)', 'EXECUTE'),
  'authenticated has no RPC EXECUTE');
SELECT ok(has_function_privilege('service_role',
  'public.submit_reputation_appeal(public.input_type,jsonb,text,text,jsonb,text)', 'EXECUTE'),
  'service role has RPC EXECUTE');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc p,
    LATERAL pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
  WHERE p.oid = 'public.submit_reputation_appeal(public.input_type,jsonb,text,text,jsonb,text)'::regprocedure
    AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
), 'PUBLIC has no inherited EXECUTE grant');
SELECT ok((SELECT relrowsecurity FROM pg_catalog.pg_class
  WHERE oid = 'public.reputation_appeals'::regclass), 'appeal table RLS stays enabled');

CREATE FUNCTION pg_temp.appeal_aliases(tokens text[], versions text[])
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'hash', repeat(md5(tokens[n]), 2), 'version', versions[n]
  ) ORDER BY n), '[]'::jsonb) FROM generate_subscripts(tokens, 1) AS n
$$;
CREATE TEMP TABLE appeal_inputs (
  name text PRIMARY KEY,
  target_type public.input_type NOT NULL DEFAULT 'phone',
  hashes jsonb NOT NULL,
  display text NOT NULL DEFAULT '+998 ** *** ** 11',
  reason text NOT NULL DEFAULT 'Synthetic redacted correction evidence.',
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_display text
);
CREATE TEMP TABLE appeal_results (scenario text PRIMARY KEY, accepted boolean, notify boolean);
GRANT SELECT, UPDATE ON appeal_inputs TO service_role;
GRANT SELECT, INSERT ON appeal_results TO service_role;
CREATE FUNCTION pg_temp.appeal_submit(input_name text)
RETURNS TABLE(accepted boolean, notify_moderation boolean)
LANGUAGE sql VOLATILE SECURITY INVOKER AS $$
  SELECT r.* FROM pg_temp.appeal_inputs i
  CROSS JOIN LATERAL public.submit_reputation_appeal(
    i.target_type, i.hashes, i.display, i.reason, i.contacts, i.contact_display
  ) r WHERE i.name = input_name
$$;

INSERT INTO appeal_inputs(name, hashes) VALUES
  ('fresh', pg_temp.appeal_aliases(ARRAY['appeal-fresh-v3','appeal-fresh-v2','appeal-fresh-legacy'], ARRAY['v3','v2','legacy'])),
  ('entity', pg_temp.appeal_aliases(ARRAY['appeal-entity-v3','appeal-entity-v2','appeal-entity-legacy'], ARRAY['v3','v2','legacy'])),
  ('telegram', pg_temp.appeal_aliases(ARRAY['appeal-tg-v3','appeal-tg-v2','appeal-tg-legacy'], ARRAY['v3','v2','legacy'])),
  ('priority', pg_temp.appeal_aliases(ARRAY['appeal-priority-v3','appeal-priority-v2','appeal-priority-legacy'], ARRAY['v3','v2','legacy'])),
  ('type-boundary', pg_temp.appeal_aliases(ARRAY['appeal-other-type-v3','appeal-other-type-v2'], ARRAY['v3','v2'])),
  ('version-boundary', pg_temp.appeal_aliases(ARRAY['appeal-wrong-version-v3','appeal-wrong-version-v2'], ARRAY['v3','v2'])),
  ('contact-rotation', pg_temp.appeal_aliases(ARRAY['appeal-rotation-v2','appeal-rotation-legacy'], ARRAY['v2','legacy']));
UPDATE appeal_inputs SET target_type = 'telegram', display = '@s***' WHERE name IN ('telegram', 'priority');

SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT * FROM public.submit_reputation_appeal(
  'phone', '[]', 'masked', 'masked reason', '[]', NULL)$$,
  '42501', 'permission denied for function submit_reputation_appeal',
  'actual anon invocation is denied before payload validation');
SELECT throws_ok($$SELECT reason FROM public.reputation_appeals$$, '42501',
  'permission denied for table reputation_appeals', 'anon cannot inspect evidence');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT * FROM public.submit_reputation_appeal(
  'phone', '[]', 'masked', 'masked reason', '[]', NULL)$$,
  '42501', 'permission denied for function submit_reputation_appeal',
  'actual authenticated invocation is denied');
SELECT throws_ok($$SELECT reason FROM public.reputation_appeals$$, '42501',
  'permission denied for table reputation_appeals', 'authenticated cannot inspect evidence');
RESET ROLE;

SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'first', * FROM pg_temp.appeal_submit('fresh');
INSERT INTO appeal_results SELECT 'duplicate', * FROM pg_temp.appeal_submit('fresh');
RESET ROLE;
SELECT results_eq($$SELECT accepted, notify FROM appeal_results WHERE scenario = 'first'$$,
  $$SELECT true,true$$, 'first unseen target accepts and authorizes one notification');
SELECT results_eq($$SELECT accepted, notify FROM appeal_results WHERE scenario = 'duplicate'$$,
  $$SELECT true,false$$, 'identical retry succeeds without another notification');
SELECT is((SELECT count(*) FROM public.reputation_appeals WHERE target_hash =
  (SELECT hashes->0->>'hash' FROM appeal_inputs WHERE name = 'fresh')), 1::bigint,
  'identical retry stores one row');
SELECT is((SELECT target_hash_version FROM public.reputation_appeals WHERE target_hash =
  (SELECT hashes->0->>'hash' FROM appeal_inputs WHERE name = 'fresh')), 'v3',
  'unseen target uses active version');

UPDATE appeal_inputs SET reason = 'Different synthetic evidence remains visible.' WHERE name = 'fresh';
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'distinct-reason', * FROM pg_temp.appeal_submit('fresh');
RESET ROLE;
SELECT results_eq($$SELECT accepted, notify FROM appeal_results WHERE scenario = 'distinct-reason'$$,
  $$SELECT true,false$$, 'distinct reason accepted without another open-episode alert');
SELECT is((SELECT count(*) FROM public.reputation_appeals WHERE target_hash =
  (SELECT hashes->0->>'hash' FROM appeal_inputs WHERE name = 'fresh')), 2::bigint,
  'distinct reason adds a separate evidence row');
SELECT ok(EXISTS(SELECT 1 FROM public.reputation_appeals WHERE target_hash =
  (SELECT hashes->0->>'hash' FROM appeal_inputs WHERE name = 'fresh')
  AND reason = 'Synthetic redacted correction evidence.'), 'old evidence is never overwritten');

UPDATE appeal_inputs SET contacts = pg_temp.appeal_aliases(ARRAY['appeal-contact-v3'], ARRAY['v3']),
  contact_display = 'c***@example.invalid' WHERE name = 'fresh';
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'distinct-contact', * FROM pg_temp.appeal_submit('fresh');
INSERT INTO appeal_results SELECT 'contact-duplicate', * FROM pg_temp.appeal_submit('fresh');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.reputation_appeals WHERE target_hash =
  (SELECT hashes->0->>'hash' FROM appeal_inputs WHERE name = 'fresh')), 3::bigint,
  'contact identity differs from NULL and its retry deduplicates');
SELECT ok(NOT EXISTS(SELECT 1 FROM appeal_results WHERE scenario IN
  ('distinct-contact','contact-duplicate') AND notify), 'contacts do not create repeat episode notifications');

UPDATE public.reputation_appeals SET status = 'reviewing' WHERE target_hash =
  (SELECT hashes->0->>'hash' FROM appeal_inputs WHERE name = 'fresh');
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'reviewing-duplicate', * FROM pg_temp.appeal_submit('fresh');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.reputation_appeals WHERE target_hash =
  (SELECT hashes->0->>'hash' FROM appeal_inputs WHERE name = 'fresh')), 3::bigint,
  'reviewing evidence is still deduplicated');
UPDATE public.reputation_appeals SET status = 'resolved' WHERE target_hash =
  (SELECT hashes->0->>'hash' FROM appeal_inputs WHERE name = 'fresh');
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'after-resolved', * FROM pg_temp.appeal_submit('fresh');
RESET ROLE;
SELECT results_eq($$SELECT accepted, notify FROM appeal_results WHERE scenario = 'after-resolved'$$,
  $$SELECT true,true$$, 'identical appeal may reopen after all evidence is resolved');
UPDATE public.reputation_appeals SET status = 'rejected' WHERE target_hash =
  (SELECT hashes->0->>'hash' FROM appeal_inputs WHERE name = 'fresh');
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'after-rejected', * FROM pg_temp.appeal_submit('fresh');
RESET ROLE;
SELECT results_eq($$SELECT accepted, notify FROM appeal_results WHERE scenario = 'after-rejected'$$,
  $$SELECT true,true$$, 'identical appeal may reopen after rejected evidence');

INSERT INTO public.entities(entity_type, entity_hash, entity_hash_version, display_mask)
SELECT target_type, hashes->n->>'hash', hashes->n->>'version', display
FROM appeal_inputs CROSS JOIN generate_series(0,2) n WHERE name = 'entity';
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'entity', * FROM pg_temp.appeal_submit('entity');
RESET ROLE;
SELECT is((SELECT target_hash_version FROM public.reputation_appeals WHERE target_hash =
  (SELECT hashes->1->>'hash' FROM appeal_inputs WHERE name = 'entity')), 'v2',
  'previous entity wins over legacy and active in established read order');
SELECT ok((SELECT notify FROM appeal_results WHERE scenario = 'entity'),
  'known entity has same first-open notification policy as an unseen target');

INSERT INTO public.telegram_reputation_targets(target_hash, target_hash_version, target_type, display_hint)
SELECT hashes->2->>'hash', 'legacy', 'public_username', display
FROM appeal_inputs WHERE name = 'telegram';
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'telegram', * FROM pg_temp.appeal_submit('telegram');
RESET ROLE;
SELECT is((SELECT target_hash_version FROM public.reputation_appeals WHERE target_hash =
  (SELECT hashes->2->>'hash' FROM appeal_inputs WHERE name = 'telegram')), 'legacy',
  'Telegram target provides canonical alias when no appeal/entity exists');

INSERT INTO public.entities(entity_type, entity_hash, entity_hash_version, display_mask)
SELECT target_type, hashes->1->>'hash', 'v2', display FROM appeal_inputs WHERE name = 'priority';
INSERT INTO public.telegram_reputation_targets(target_hash, target_hash_version, target_type, display_hint)
SELECT hashes->0->>'hash', 'v3', 'public_username', display FROM appeal_inputs WHERE name = 'priority';
INSERT INTO public.reputation_appeals(target_type,target_hash,target_hash_version,target_display,reason)
SELECT target_type, hashes->2->>'hash','legacy',display,'Existing independent evidence.'
FROM appeal_inputs WHERE name = 'priority';
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'priority', * FROM pg_temp.appeal_submit('priority');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.reputation_appeals WHERE target_hash =
  (SELECT hashes->2->>'hash' FROM appeal_inputs WHERE name = 'priority')), 2::bigint,
  'open appeal alias takes precedence over entity and Telegram aliases');
SELECT ok(NOT (SELECT notify FROM appeal_results WHERE scenario = 'priority'),
  'existing open evidence suppresses another alert without discarding new reason');

INSERT INTO public.entities(entity_type, entity_hash, entity_hash_version, display_mask)
SELECT 'url', hashes->1->>'hash', 'v2', display FROM appeal_inputs WHERE name = 'type-boundary';
INSERT INTO public.reputation_appeals(target_type,target_hash,target_hash_version,target_display,reason)
SELECT 'url', hashes->1->>'hash','v2',display,reason FROM appeal_inputs WHERE name = 'type-boundary';
INSERT INTO public.entities(entity_type, entity_hash, entity_hash_version, display_mask)
SELECT target_type, hashes->1->>'hash', 'legacy', display FROM appeal_inputs WHERE name = 'version-boundary';
INSERT INTO public.reputation_appeals(target_type,target_hash,target_hash_version,target_display,reason)
SELECT target_type, hashes->1->>'hash','legacy',display,reason FROM appeal_inputs WHERE name = 'version-boundary';
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'type-boundary', * FROM pg_temp.appeal_submit('type-boundary');
INSERT INTO appeal_results SELECT 'version-boundary', * FROM pg_temp.appeal_submit('version-boundary');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.reputation_appeals a JOIN appeal_inputs i
  ON a.target_hash = i.hashes->0->>'hash' WHERE i.name IN ('type-boundary','version-boundary')), 2::bigint,
  'wrong target type or hash version never selects or deduplicates unrelated evidence');
SELECT ok((SELECT bool_and(notify) FROM appeal_results WHERE scenario IN
  ('type-boundary','version-boundary')), 'unrelated rows do not suppress first-open notification');

UPDATE appeal_inputs SET contacts = pg_temp.appeal_aliases(ARRAY['rotation-contact-v2','rotation-contact-legacy'],
  ARRAY['v2','legacy']), contact_display = 'r***@example.invalid' WHERE name = 'contact-rotation';
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'before-rotation', * FROM pg_temp.appeal_submit('contact-rotation');
RESET ROLE;
UPDATE appeal_inputs SET hashes = pg_temp.appeal_aliases(
  ARRAY['appeal-rotation-v3','appeal-rotation-v2','appeal-rotation-legacy'], ARRAY['v3','v2','legacy']),
  contacts = pg_temp.appeal_aliases(ARRAY['rotation-contact-v3','rotation-contact-v2','rotation-contact-legacy'],
  ARRAY['v3','v2','legacy']) WHERE name = 'contact-rotation';
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'after-rotation', * FROM pg_temp.appeal_submit('contact-rotation');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.reputation_appeals WHERE target_hash =
  (SELECT hashes->1->>'hash' FROM appeal_inputs WHERE name = 'contact-rotation')), 1::bigint,
  'forward rotation deduplicates prior target and contact versions together');
SELECT ok(NOT (SELECT notify FROM appeal_results WHERE scenario = 'after-rotation'),
  'forward rotation does not re-notify the same evidence');
UPDATE appeal_inputs SET reason = 'New evidence after forward pepper rotation.' WHERE name = 'contact-rotation';
SET LOCAL ROLE service_role;
INSERT INTO appeal_results SELECT 'rotation-new-evidence', * FROM pg_temp.appeal_submit('contact-rotation');
RESET ROLE;
SELECT ok(EXISTS(SELECT 1 FROM public.reputation_appeals a JOIN appeal_inputs i
  ON a.target_hash = i.hashes->1->>'hash' WHERE i.name = 'contact-rotation'
  AND a.reason = i.reason AND a.contact_hash_version = 'v3'),
  'new rotated evidence keeps established target alias but writes active contact version');

-- Invalid inputs always fail before any lookup/insert and use one safe message.
CREATE TEMP TABLE invalid_appeal_inputs AS SELECT * FROM appeal_inputs WHERE false;
INSERT INTO invalid_appeal_inputs SELECT 'invalid-' || n::text, target_type, hashes, display, reason, contacts, contact_display
FROM appeal_inputs CROSS JOIN generate_series(1,28) n WHERE name = 'entity';
UPDATE invalid_appeal_inputs SET hashes = CASE name
  WHEN 'invalid-1' THEN '[]'::jsonb
  WHEN 'invalid-2' THEN '{}'::jsonb
  WHEN 'invalid-3' THEN '[null]'::jsonb
  WHEN 'invalid-4' THEN '["raw"]'::jsonb
  WHEN 'invalid-5' THEN '[{"hash":"raw-target","version":"v3"}]'::jsonb
  WHEN 'invalid-6' THEN jsonb_build_array(jsonb_build_object('hash', repeat('a',64), 'version','UPPER'))
  WHEN 'invalid-7' THEN jsonb_build_array(jsonb_build_object('hash', repeat('a',64), 'version','v3','raw','not-allowed'))
  WHEN 'invalid-8' THEN jsonb_build_array(jsonb_build_object('hash', repeat('a',64), 'version',NULL))
  WHEN 'invalid-9' THEN pg_temp.appeal_aliases(ARRAY['one','one'],ARRAY['v3','v2'])
  WHEN 'invalid-10' THEN pg_temp.appeal_aliases(ARRAY['one','two'],ARRAY['v3','v3'])
  WHEN 'invalid-11' THEN pg_temp.appeal_aliases(ARRAY['one','two','three','four'],ARRAY['v4','v3','v2','legacy'])
  ELSE hashes END;
UPDATE invalid_appeal_inputs SET target_type = 'text' WHERE name = 'invalid-12';
UPDATE invalid_appeal_inputs SET display = ' ' WHERE name = 'invalid-13';
UPDATE invalid_appeal_inputs SET reason = repeat('x',4001) WHERE name = 'invalid-14';
UPDATE invalid_appeal_inputs SET contacts = '[false]' WHERE name = 'invalid-15';
UPDATE invalid_appeal_inputs SET contact_display = 'unhashed contact' WHERE name = 'invalid-16';
UPDATE invalid_appeal_inputs SET contacts = pg_temp.appeal_aliases(ARRAY['contact'],ARRAY['v3']) WHERE name = 'invalid-17';
UPDATE invalid_appeal_inputs SET contacts = '{}' WHERE name = 'invalid-18';
UPDATE invalid_appeal_inputs SET reason = ' ' WHERE name = 'invalid-19';
UPDATE invalid_appeal_inputs SET display = repeat('x',501) WHERE name = 'invalid-20';
UPDATE invalid_appeal_inputs SET display = 'x' || repeat(' ',500) WHERE name = 'invalid-21';
UPDATE invalid_appeal_inputs SET reason = 'x' || repeat(' ',4000) WHERE name = 'invalid-22';
UPDATE invalid_appeal_inputs SET contacts = pg_temp.appeal_aliases(ARRAY['contact'],ARRAY['v3']),
  contact_display = 'x' || repeat(' ',160) WHERE name = 'invalid-23';
UPDATE invalid_appeal_inputs SET contacts = '[{"hash":"raw","version":"v3"}]',
  contact_display = 'masked' WHERE name = 'invalid-24';
UPDATE invalid_appeal_inputs SET contacts = pg_temp.appeal_aliases(ARRAY['contact','contact'],ARRAY['v3','v2']),
  contact_display = 'masked' WHERE name = 'invalid-25';
UPDATE invalid_appeal_inputs SET contacts = pg_temp.appeal_aliases(ARRAY['contact1','contact2'],ARRAY['v3','v3']),
  contact_display = 'masked' WHERE name = 'invalid-26';
UPDATE invalid_appeal_inputs SET contacts = pg_temp.appeal_aliases(ARRAY['contact'],ARRAY['v3']),
  contact_display = ' ' WHERE name = 'invalid-27';
UPDATE invalid_appeal_inputs SET hashes = jsonb_build_array(jsonb_build_object('hash',repeat('a',64)))
  WHERE name = 'invalid-28';
GRANT SELECT ON invalid_appeal_inputs TO service_role;
CREATE FUNCTION pg_temp.appeal_invalid(input_name text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE i record;
BEGIN
  SELECT * INTO i FROM pg_temp.invalid_appeal_inputs WHERE name = input_name;
  PERFORM * FROM public.submit_reputation_appeal(i.target_type,i.hashes,i.display,i.reason,i.contacts,i.contact_display);
END;
$$;
SET LOCAL ROLE service_role;
SELECT throws_ok(format('SELECT pg_temp.appeal_invalid(%L)', name), '22023', 'appeal_invalid_payload',
  name || ' is rejected with safe generic error') FROM invalid_appeal_inputs ORDER BY name;
SELECT throws_ok($$SELECT * FROM public.submit_reputation_appeal(NULL,NULL,NULL,NULL,NULL,NULL)$$,
  '22023','appeal_invalid_payload','NULL inputs fail safely');
RESET ROLE;

SELECT results_eq($$SELECT DISTINCT accepted FROM appeal_results$$,
  $$SELECT true$$, 'every supported state returns the same acceptance boolean');
SELECT ok(NOT EXISTS(SELECT 1 FROM public.reputation_appeals WHERE reason = repeat('x',4001)
  OR contact_display = 'unhashed contact'), 'rejected payloads are not stored');
SELECT matches(pg_catalog.pg_get_functiondef(
  'public.submit_reputation_appeal(public.input_type,jsonb,text,text,jsonb,text)'::regprocedure),
  'appeal_isolation_unsupported', 'unsupported isolation has a fail-closed guard');
SELECT matches(pg_catalog.pg_get_functiondef(
  'public.submit_reputation_appeal(public.input_type,jsonb,text,text,jsonb,text)'::regprocedure),
  'FOR UPDATE OF a', 'open canonical evidence is locked against concurrent moderation');

SELECT * FROM finish();
ROLLBACK;
