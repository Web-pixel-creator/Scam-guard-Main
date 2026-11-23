BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SELECT no_plan();

SELECT is(
  ARRAY(SELECT attname::text FROM pg_catalog.pg_attribute
    WHERE attrelid = 'private.web_ocr_ticket_claims'::regclass AND attnum > 0 AND NOT attisdropped
    ORDER BY attnum) COLLATE "C",
  ARRAY['ticket_id', 'issued_at_ms', 'expires_at_ms']::text[] COLLATE "C",
  'claim ledger contains only operation UUID and immutable issued/expiry metadata'
);
SELECT ok((SELECT relrowsecurity FROM pg_catalog.pg_class
  WHERE oid = 'private.web_ocr_ticket_claims'::regclass), 'claim ledger has RLS enabled');
SELECT ok(NOT (SELECT prosecdef FROM pg_catalog.pg_proc
  WHERE oid = 'public.claim_web_ocr_ticket(uuid,bigint,bigint)'::regprocedure),
  'claim RPC is security invoker');
SELECT is((SELECT provolatile::text FROM pg_catalog.pg_proc
  WHERE oid = 'public.claim_web_ocr_ticket(uuid,bigint,bigint)'::regprocedure),
  'v', 'claim RPC is volatile');
SELECT ok((SELECT 'search_path=""' = ANY(proconfig) FROM pg_catalog.pg_proc
  WHERE oid = 'public.claim_web_ocr_ticket(uuid,bigint,bigint)'::regprocedure),
  'claim RPC has an empty search path');
SELECT ok((SELECT 'lock_timeout=5s' = ANY(proconfig) FROM pg_catalog.pg_proc
  WHERE oid = 'public.claim_web_ocr_ticket(uuid,bigint,bigint)'::regprocedure),
  'claim RPC bounds unique-key waits');
SELECT ok(has_function_privilege('service_role',
  'public.claim_web_ocr_ticket(uuid,bigint,bigint)', 'EXECUTE'), 'service can claim');
SELECT ok(NOT has_function_privilege('anon',
  'public.claim_web_ocr_ticket(uuid,bigint,bigint)', 'EXECUTE'), 'anon has no claim grant');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.claim_web_ocr_ticket(uuid,bigint,bigint)', 'EXECUTE'), 'authenticated has no claim grant');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc p,
    LATERAL pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
  WHERE p.oid IN ('public.claim_web_ocr_ticket(uuid,bigint,bigint)'::regprocedure,
                 'private.prune_web_ocr_ticket_claims()'::regprocedure)
    AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
), 'neither function inherits PUBLIC execute');
SELECT ok(has_table_privilege('service_role', 'private.web_ocr_ticket_claims', 'INSERT')
  AND has_table_privilege('service_role', 'private.web_ocr_ticket_claims', 'SELECT'),
  'service has exactly the read/insert capabilities needed by claim');
SELECT ok(NOT has_table_privilege('service_role', 'private.web_ocr_ticket_claims', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'private.web_ocr_ticket_claims', 'DELETE')
  AND NOT has_table_privilege('service_role', 'private.web_ocr_ticket_claims', 'TRUNCATE'),
  'service cannot update/delete/truncate tombstones to rearm a ticket');
SELECT ok(NOT has_table_privilege(role_name, 'private.web_ocr_ticket_claims', privilege_name),
  role_name || ' has no direct ' || privilege_name || ' on claim ledger')
FROM unnest(ARRAY['anon','authenticated']) AS role_name
CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) AS privilege_name;

SELECT ok((SELECT prosecdef FROM pg_catalog.pg_proc
  WHERE oid = 'private.prune_web_ocr_ticket_claims()'::regprocedure),
  'private prune can delete without granting service direct DELETE');
SELECT is((SELECT pronargs::integer FROM pg_catalog.pg_proc
  WHERE oid = 'private.prune_web_ocr_ticket_claims()'::regprocedure), 0,
  'prune has no caller-controlled future cutoff');
SELECT ok((SELECT 'lock_timeout=5s' = ANY(proconfig) FROM pg_catalog.pg_proc
  WHERE oid = 'private.prune_web_ocr_ticket_claims()'::regprocedure),
  'prune bounds each lock wait');

CREATE FUNCTION pg_temp.ocr_now_ms() RETURNS bigint LANGUAGE sql VOLATILE AS $$
  SELECT floor(EXTRACT(epoch FROM clock_timestamp()) * 1000)::bigint
$$;
CREATE TEMP TABLE ocr_ticket_inputs (
  name text PRIMARY KEY, ticket_id uuid, issued_at_ms bigint, expires_at_ms bigint
);
INSERT INTO ocr_ticket_inputs VALUES
  ('fresh', '94001001-0000-4000-8000-000000000001', pg_temp.ocr_now_ms()-1000, NULL),
  ('expired', '94001002-0000-4000-8000-000000000002', pg_temp.ocr_now_ms()-600001, NULL),
  ('future', '94001003-0000-4000-8000-000000000003', pg_temp.ocr_now_ms()+60000, NULL),
  ('independent', '94001004-0000-4000-8000-000000000004', pg_temp.ocr_now_ms()-1000, NULL);
UPDATE ocr_ticket_inputs SET expires_at_ms = issued_at_ms + 600000;
GRANT SELECT ON ocr_ticket_inputs TO service_role;
CREATE FUNCTION pg_temp.ocr_claim(input_name text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER AS $$
  SELECT public.claim_web_ocr_ticket(ticket_id, issued_at_ms, expires_at_ms)
  FROM pg_temp.ocr_ticket_inputs WHERE name = input_name
$$;

SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.claim_web_ocr_ticket(NULL,NULL,NULL)$$,
  '42501', 'permission denied for function claim_web_ocr_ticket', 'actual anon claim denied');
SELECT throws_ok($$SELECT private.prune_web_ocr_ticket_claims()$$,
  '42501', NULL, 'actual anon prune denied');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.claim_web_ocr_ticket(NULL,NULL,NULL)$$,
  '42501', 'permission denied for function claim_web_ocr_ticket', 'actual authenticated claim denied');
SELECT throws_ok($$SELECT private.prune_web_ocr_ticket_claims()$$,
  '42501', NULL, 'actual authenticated prune denied');
RESET ROLE;

-- Grant only schema lookup in this rolled-back test to isolate table ACLs from
-- schema denial. Production schema permissions are not broadened by migration.
GRANT USAGE ON SCHEMA private TO anon, authenticated;
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT * FROM private.web_ocr_ticket_claims$$,
  '42501', 'permission denied for table web_ocr_ticket_claims', 'anon cannot read claim metadata');
SELECT throws_ok($$INSERT INTO private.web_ocr_ticket_claims VALUES
  ('94001901-0000-4000-8000-000000000001',1,600001)$$,
  '42501', 'permission denied for table web_ocr_ticket_claims', 'anon cannot insert a claim');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT * FROM private.web_ocr_ticket_claims$$,
  '42501', 'permission denied for table web_ocr_ticket_claims', 'authenticated cannot read claim metadata');
SELECT throws_ok($$INSERT INTO private.web_ocr_ticket_claims VALUES
  ('94001902-0000-4000-8000-000000000002',1,600001)$$,
  '42501', 'permission denied for table web_ocr_ticket_claims', 'authenticated cannot insert a claim');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT is(pg_temp.ocr_claim('fresh'), true, 'actual service role admits a fresh signed-metadata shape');
SELECT is(pg_temp.ocr_claim('fresh'), false, 'same ticket replay is denied');
SELECT is(pg_temp.ocr_claim('independent'), true, 'a distinct issued operation is independent');
SELECT is(pg_temp.ocr_claim('expired'), false, 'expired missing ticket cannot be claimed');
SELECT is(pg_temp.ocr_claim('future'), false, 'future-issued ticket fails closed without clock grace');
SELECT throws_ok($$UPDATE private.web_ocr_ticket_claims SET expires_at_ms=expires_at_ms+1$$,
  '42501', 'permission denied for table web_ocr_ticket_claims', 'service cannot extend expiry');
SELECT throws_ok($$DELETE FROM private.web_ocr_ticket_claims$$,
  '42501', 'permission denied for table web_ocr_ticket_claims', 'service cannot delete a live claim');
SELECT throws_ok($$TRUNCATE private.web_ocr_ticket_claims$$,
  '42501', 'permission denied for table web_ocr_ticket_claims', 'service cannot truncate replay state');
SELECT is(public.claim_web_ocr_ticket(NULL,NULL,NULL), false, 'NULL inputs are denied');
SELECT is(public.claim_web_ocr_ticket('00000000-0000-0000-0000-000000000000',
  pg_temp.ocr_now_ms()-1000,pg_temp.ocr_now_ms()+599000), false, 'nil operation UUID is denied');
RESET ROLE;

SELECT is((SELECT count(*) FROM private.web_ocr_ticket_claims c JOIN ocr_ticket_inputs i
  USING(ticket_id)), 2::bigint, 'only the two fresh operations have metadata rows');
CREATE TEMP TABLE ocr_before_retry AS SELECT * FROM private.web_ocr_ticket_claims c
  WHERE c.ticket_id = (SELECT ticket_id FROM ocr_ticket_inputs WHERE name='fresh');
UPDATE ocr_ticket_inputs SET issued_at_ms=issued_at_ms+1,expires_at_ms=expires_at_ms+1 WHERE name='fresh';
SET LOCAL ROLE service_role;
SELECT is(pg_temp.ocr_claim('fresh'), false, 'same UUID with changed signed times cannot rearm a claim');
RESET ROLE;
SELECT results_eq($$SELECT * FROM private.web_ocr_ticket_claims WHERE ticket_id =
  (SELECT ticket_id FROM ocr_ticket_inputs WHERE name='fresh')$$,
  $$SELECT * FROM ocr_before_retry$$, 'claim metadata is unchanged after a conflicting retry');

CREATE TEMP TABLE ocr_invalid_inputs (name text, issued_at_ms bigint, expires_at_ms bigint);
INSERT INTO ocr_invalid_inputs VALUES
  ('null issued',NULL,600000), ('null expiry',1,NULL), ('negative issued',-1,599999),
  ('negative expiry',0,-1),
  ('max bigint issued',9223372036854775807,9223372036854775807),
  ('min bigint issued',-9223372036854775808,1),
  ('max bigint expiry',1,9223372036854775807),
  ('above JS safe expiry',9007199254140992,9007199254740992);
-- Derive each lifetime from one sampled clock value, so these assertions never
-- accidentally pass because two clock reads straddled a millisecond boundary.
WITH sampled AS MATERIALIZED (SELECT pg_temp.ocr_now_ms() AS now_ms)
INSERT INTO ocr_invalid_inputs
SELECT 'short lifetime',now_ms-1000,now_ms+598000 FROM sampled
UNION ALL SELECT 'long lifetime',now_ms-1000,now_ms+600000 FROM sampled
UNION ALL SELECT 'at expired boundary',now_ms-600000,now_ms FROM sampled;
GRANT SELECT ON ocr_invalid_inputs TO service_role;
SET LOCAL ROLE service_role;
SELECT is(public.claim_web_ocr_ticket('94001903-0000-4000-8000-000000000003',issued_at_ms,expires_at_ms),
  false, name || ' fails closed without inserting') FROM ocr_invalid_inputs;
RESET ROLE;
SELECT ok(NOT EXISTS(SELECT 1 FROM private.web_ocr_ticket_claims
  WHERE ticket_id='94001903-0000-4000-8000-000000000003'), 'invalid calls leave no claim row');

-- A consumed row is aged only through a fixture insert, never a runtime reset.
INSERT INTO private.web_ocr_ticket_claims
SELECT ticket_id,issued_at_ms,expires_at_ms FROM ocr_ticket_inputs WHERE name='expired';
SET LOCAL ROLE service_role;
SELECT ok(private.prune_web_ocr_ticket_claims() >= 1, 'actual service invocation prunes expired claims');
SELECT is(pg_temp.ocr_claim('expired'), false, 'expired ticket stays rejected after its tombstone is pruned');
SELECT is(pg_temp.ocr_claim('fresh'), false, 'pruning does not rearm a live consumed operation');
RESET ROLE;
SELECT ok(NOT EXISTS(SELECT 1 FROM private.web_ocr_ticket_claims WHERE ticket_id=
  (SELECT ticket_id FROM ocr_ticket_inputs WHERE name='expired')), 'pruned replay cannot recreate expired state');
SELECT is((SELECT count(*) FROM private.web_ocr_ticket_claims WHERE ticket_id IN
  (SELECT ticket_id FROM ocr_ticket_inputs WHERE name IN ('fresh','independent'))),2::bigint,
  'unexpired claims survive DB-clock cleanup');

SELECT matches(pg_catalog.pg_get_functiondef('public.claim_web_ocr_ticket(uuid,bigint,bigint)'::regprocedure),
  'v_inserted <> 1', 'only an inserted row can authorize a transfer');
SELECT matches(pg_catalog.pg_get_functiondef('public.claim_web_ocr_ticket(uuid,bigint,bigint)'::regprocedure),
  'RETURN p_issued_at_ms <= v_now_ms AND p_expires_at_ms > v_now_ms',
  'post-insert wall-clock gate checks both future issue and expiry after waits');
SELECT is((SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='private' AND p.proname='prune_web_ocr_ticket_claims'),1::bigint,
  'no cleanup overload accepts an arbitrary cutoff');

CREATE FUNCTION pg_temp.ocr_cron_is_correct() RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_ok boolean;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension WHERE extname='pg_cron') THEN RETURN true; END IF;
  EXECUTE 'SELECT count(*)=1 AND bool_and(schedule=''23 * * * *'' AND command=''SELECT private.prune_web_ocr_ticket_claims();'')
    FROM cron.job WHERE jobname=''ishonch_prune_web_ocr_ticket_claims_hourly''' INTO v_ok;
  RETURN v_ok;
END;
$$;
SELECT ok(pg_temp.ocr_cron_is_correct(), 'hourly cleanup schedule is correct when pg_cron is present');

SELECT * FROM finish();
ROLLBACK;
