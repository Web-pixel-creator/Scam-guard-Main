-- Real role/lease/scope negatives. Helpers are session-local SECURITY INVOKER;
-- every application RPC below executes as the named role, never as postgres.
-- Fixtures contain synthetic metadata only and the entire file rolls back.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

SELECT plan(346);

CREATE FUNCTION pg_temp.consent_sql(op text, patch jsonb DEFAULT '{}'::jsonb)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  args jsonb := '{"user":91807701,"chat":91807801,"type":"private",
    "kind":"image","prompt":91807901,"update":91807010,
    "lease":"91807010-0000-4000-8000-000000000010","fence":1,
    "leader":"91807000-0000-4000-8000-000000000000","leader_fence":17,
    "flow":null}'::jsonb || patch;
  names text[] := ARRAY['user','chat','type'];
  types text[] := ARRAY['bigint','bigint','text'];
  pieces text[] := '{}';
  i integer;
BEGIN
  IF op NOT IN ('register','grant','revoke','claim') THEN
    RAISE EXCEPTION 'unknown test operation';
  END IF;
  IF op <> 'revoke' THEN
    names := names || ARRAY['kind']; types := types || ARRAY['text'];
  END IF;
  IF op <> 'claim' THEN
    names := names || ARRAY['prompt']; types := types || ARRAY['bigint'];
  END IF;
  names := names || ARRAY['update','lease','fence','leader','leader_fence'];
  types := types || ARRAY['bigint','uuid','bigint','uuid','bigint'];
  IF op <> 'revoke' THEN
    names := names || ARRAY['flow']; types := types || ARRAY['uuid'];
  END IF;
  FOR i IN 1..array_length(names, 1) LOOP
    pieces := pieces || format('%L::%s', args ->> names[i], types[i]);
  END LOOP;
  RETURN format('SELECT to_jsonb(r) FROM public.%I(%s) r',
    op || '_telegram_media_provider_consent', array_to_string(pieces, ','));
END;
$$;

CREATE FUNCTION pg_temp.consent_run_as(who text, command text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE answer jsonb; failure text;
BEGIN
  IF who NOT IN ('anon','authenticated','service_role') THEN
    RAISE EXCEPTION 'unknown test role';
  END IF;
  EXECUTE format('SET LOCAL ROLE %I', who);
  BEGIN
    EXECUTE command INTO answer;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS failure = RETURNED_SQLSTATE;
    answer := jsonb_build_object('sqlstate', failure);
  END;
  RESET ROLE;
  RETURN answer;
END;
$$;

CREATE FUNCTION pg_temp.consent_snapshot()
RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY telegram_user_id, chat_id), '[]')::text
  FROM private.telegram_media_provider_consents c;
$$;

CREATE FUNCTION pg_temp.consent_fixture(op text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE decision text; instant timestamptz := clock_timestamp();
BEGIN
  DELETE FROM private.telegram_media_provider_consents
    WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
  DELETE FROM public.telegram_webhook_updates WHERE update_id = 91807010;
  DELETE FROM private.telegram_update_leaders WHERE name = 'telegram_updates';
  INSERT INTO private.telegram_update_leaders(name, lease_token, fence, lease_expires_at)
  VALUES ('telegram_updates', '91807000-0000-4000-8000-000000000000', 17,
    instant + interval '10 minutes');
  SELECT b.decision INTO decision FROM public.begin_telegram_update(
    91807010, '91807010-0000-4000-8000-000000000010', 120,
    '91807000-0000-4000-8000-000000000000', 17
  ) b;
  IF decision IS DISTINCT FROM 'acquired' THEN
    RAISE EXCEPTION 'fixture did not acquire real update lease';
  END IF;
  INSERT INTO private.telegram_media_provider_consents (
    telegram_user_id, chat_id, chat_type, media_kind, prompt_message_id,
    requested_at, granted_at, expires_at, last_update_id
  ) VALUES (91807701, 91807801, 'private', 'image', 91807901,
    instant - interval '2 minutes',
    CASE WHEN op IN ('claim','revoke') THEN instant - interval '1 minute' END,
    instant + interval '8 minutes', 91807001);
END;
$$;

CREATE FUNCTION pg_temp.consent_expect_denied(
  op text, patch jsonb, expected jsonb, label text, who text DEFAULT 'service_role'
) RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE before_state text := pg_temp.consent_snapshot(); answer jsonb;
BEGIN
  answer := pg_temp.consent_run_as(who, pg_temp.consent_sql(op, patch));
  RETURN NEXT is(answer::text, expected::text, label || ': exact rejection');
  RETURN NEXT is(pg_temp.consent_snapshot(), before_state, label || ': ledger unchanged');
END;
$$;

-- The positive controls prevent an always-false RPC or broken test role from
-- passing the negative matrix. Assert the persisted transition, not only JSON.
CREATE FUNCTION pg_temp.consent_positive_controls()
RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE op text; answer jsonb; c private.telegram_media_provider_consents%ROWTYPE;
BEGIN
  FOREACH op IN ARRAY ARRAY['register','grant','revoke','claim'] LOOP
    PERFORM pg_temp.consent_fixture(op);
    answer := pg_temp.consent_run_as('service_role', pg_temp.consent_sql(op));
    RETURN NEXT is(answer::text, '{"applied":true,"lease_valid":true}'::jsonb::text,
      op || ': service role positive control');
    SELECT * INTO c FROM private.telegram_media_provider_consents
      WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
    RETURN NEXT ok(c.last_update_id = 91807010 AND CASE op
      WHEN 'register' THEN c.granted_at IS NULL AND c.terminal_at IS NULL
        AND c.expires_at > clock_timestamp()
      WHEN 'grant' THEN c.granted_at IS NOT NULL AND c.terminal_at IS NULL
      WHEN 'revoke' THEN c.terminal_reason = 'revoked'
      WHEN 'claim' THEN c.terminal_reason = 'consumed' END,
      op || ': real persisted state transition');
  END LOOP;
END;
$$;
SELECT * FROM pg_temp.consent_positive_controls();

CREATE FUNCTION pg_temp.consent_acl_matrix()
RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE who text; op text; command text; before_state text; answer jsonb; privilege text;
BEGIN
  FOREACH who IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH op IN ARRAY ARRAY['register','grant','revoke','claim'] LOOP
      PERFORM pg_temp.consent_fixture(op);
      RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied(op, '{}',
        '{"sqlstate":"42501"}', who || '/' || op, who);
    END LOOP;
  END LOOP;
  PERFORM pg_temp.consent_fixture('claim');
  FOREACH who IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH command IN ARRAY ARRAY[
      'SELECT to_jsonb(c) FROM private.telegram_media_provider_consents c LIMIT 1',
      'INSERT INTO private.telegram_media_provider_consents SELECT * FROM private.telegram_media_provider_consents',
      'UPDATE private.telegram_media_provider_consents SET last_update_id = last_update_id + 1',
      'DELETE FROM private.telegram_media_provider_consents',
      'TRUNCATE private.telegram_media_provider_consents',
      'SELECT to_jsonb(private.lock_telegram_media_consent_scope(91807701,91807801))',
      'SELECT to_jsonb(private.lock_telegram_media_consent_update_lease(91807010, ''91807010-0000-4000-8000-000000000010'', 1, ''91807000-0000-4000-8000-000000000000'', 17))'
    ] LOOP
      before_state := pg_temp.consent_snapshot();
      answer := pg_temp.consent_run_as(who, command);
      RETURN NEXT is(answer::text, '{"sqlstate":"42501"}'::jsonb::text,
        who || ': direct SQL denied: ' || command);
      RETURN NEXT is(pg_temp.consent_snapshot(), before_state, who || ': no direct SQL mutation');
    END LOOP;
    RETURN NEXT ok(NOT has_table_privilege(who,
      'private.telegram_media_provider_consents','TRUNCATE'), who || ': no TRUNCATE grant');
    FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE'] LOOP
      RETURN NEXT ok(NOT has_any_column_privilege(who,
        'private.telegram_media_provider_consents', privilege),
        who || ': no column-level ' || privilege || ' grant');
    END LOOP;
  END LOOP;
END;
$$;
SELECT * FROM pg_temp.consent_acl_matrix();

CREATE FUNCTION pg_temp.consent_lease_matrix()
RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE op text; fault text; patch jsonb;
BEGIN
  FOREACH op IN ARRAY ARRAY['register','grant','revoke','claim'] LOOP
    FOREACH fault IN ARRAY ARRAY['missing_update','wrong_lease','wrong_fence',
      'expired_update','completed_update','missing_leader','wrong_leader',
      'wrong_leader_fence','expired_leader','unbound_update','different_update_leader'] LOOP
      PERFORM pg_temp.consent_fixture(op);
      patch := '{}';
      CASE fault
        WHEN 'missing_update' THEN DELETE FROM public.telegram_webhook_updates WHERE update_id = 91807010;
        WHEN 'wrong_lease' THEN patch := '{"lease":"91807010-0000-4000-8000-000000000099"}';
        WHEN 'wrong_fence' THEN patch := '{"fence":2}';
        WHEN 'expired_update' THEN UPDATE public.telegram_webhook_updates
          SET lease_expires_at = clock_timestamp() WHERE update_id = 91807010;
        WHEN 'completed_update' THEN UPDATE public.telegram_webhook_updates
          SET status = 'completed', completed_at = clock_timestamp() WHERE update_id = 91807010;
        WHEN 'missing_leader' THEN DELETE FROM private.telegram_update_leaders WHERE name = 'telegram_updates';
        WHEN 'wrong_leader' THEN patch := '{"leader":"91807000-0000-4000-8000-000000000099"}';
        WHEN 'wrong_leader_fence' THEN patch := '{"leader_fence":18}';
        WHEN 'expired_leader' THEN UPDATE private.telegram_update_leaders
          SET lease_expires_at = clock_timestamp() WHERE name = 'telegram_updates';
        WHEN 'unbound_update' THEN UPDATE public.telegram_webhook_updates
          SET leader_token = NULL, leader_fence = NULL WHERE update_id = 91807010;
        WHEN 'different_update_leader' THEN UPDATE public.telegram_webhook_updates
          SET leader_fence = 16 WHERE update_id = 91807010;
      END CASE;
      RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied(op, patch,
        '{"lease_valid":false,"applied":false}', op || '/' || fault);
    END LOOP;
  END LOOP;
END;
$$;
SELECT * FROM pg_temp.consent_lease_matrix();

CREATE FUNCTION pg_temp.consent_validation_matrix()
RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE op text; patch jsonb;
BEGIN
  FOREACH op IN ARRAY ARRAY['register','grant','revoke','claim'] LOOP
    FOR patch IN SELECT value FROM jsonb_array_elements('[
      {"user":0},{"chat":0},{"type":"invalid"},{"update":-1},
      {"lease":null},{"fence":0},{"leader":null},{"leader_fence":null},
      {"leader_fence":0}]'::jsonb) LOOP
      PERFORM pg_temp.consent_fixture(op);
      RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied(op, patch,
        '{"sqlstate":"22023"}', op || '/invalid/' || patch::text);
    END LOOP;
    IF op <> 'revoke' THEN
      FOR patch IN SELECT value FROM jsonb_array_elements('[
        {"kind":"video"},{"kind":"report_image","flow":null},
        {"flow":"91807000-0000-4000-8000-000000000099"}]'::jsonb) LOOP
        PERFORM pg_temp.consent_fixture(op);
        RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied(op, patch,
          '{"sqlstate":"22023"}', op || '/invalid/' || patch::text);
      END LOOP;
    END IF;
    IF op <> 'claim' THEN
      PERFORM pg_temp.consent_fixture(op);
      RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied(op, '{"prompt":0}',
        '{"sqlstate":"22023"}', op || '/invalid/prompt');
    END IF;
  END LOOP;
END;
$$;
SELECT * FROM pg_temp.consent_validation_matrix();

CREATE FUNCTION pg_temp.consent_scope_matrix()
RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE op text; patch jsonb;
BEGIN
  -- Registration intentionally creates/replaces a scope, so scope mismatch is
  -- not a rejection contract for it. Revoke has no kind/flow argument; claim
  -- has no prompt argument. Test only dimensions each RPC actually accepts.
  FOREACH op IN ARRAY ARRAY['grant','revoke','claim'] LOOP
    FOR patch IN SELECT value FROM jsonb_array_elements('[
      {"user":91807702},{"chat":91807802},{"type":"supergroup"}]'::jsonb) LOOP
      PERFORM pg_temp.consent_fixture(op);
      RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied(op, patch,
        '{"lease_valid":true,"applied":false}', op || '/scope/' || patch::text);
    END LOOP;
    IF op <> 'claim' THEN
      PERFORM pg_temp.consent_fixture(op);
      RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied(op, '{"prompt":91807902}',
        '{"lease_valid":true,"applied":false}', op || '/scope/prompt');
    END IF;
    IF op <> 'revoke' THEN
      PERFORM pg_temp.consent_fixture(op);
      RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied(op, '{"kind":"voice"}',
        '{"lease_valid":true,"applied":false}', op || '/scope/kind');
      PERFORM pg_temp.consent_fixture(op);
      UPDATE private.telegram_media_provider_consents SET media_kind = 'report_image',
        report_flow_id = '91807000-0000-4000-8000-000000000001'
        WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
      RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied(op,
        '{"kind":"report_image","flow":"91807000-0000-4000-8000-000000000002"}',
        '{"lease_valid":true,"applied":false}', op || '/scope/report_flow');
      RETURN NEXT is(pg_temp.consent_run_as('service_role', pg_temp.consent_sql(op,
        '{"kind":"report_image","flow":"91807000-0000-4000-8000-000000000001"}'))::text,
        '{"lease_valid":true,"applied":true}'::jsonb::text, op || '/matching report flow succeeds');
    END IF;
  END LOOP;
END;
$$;
SELECT * FROM pg_temp.consent_scope_matrix();

CREATE FUNCTION pg_temp.consent_state_matrix()
RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE op text; fault text; instant timestamptz; before_state text;
BEGIN
  FOREACH op IN ARRAY ARRAY['grant','revoke','claim'] LOOP
    FOREACH fault IN ARRAY ARRAY['missing','expired','future_request','consumed','revoked','newer_watermark'] LOOP
      PERFORM pg_temp.consent_fixture(op);
      instant := clock_timestamp();
      CASE fault
        WHEN 'missing' THEN DELETE FROM private.telegram_media_provider_consents
          WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
        WHEN 'expired' THEN UPDATE private.telegram_media_provider_consents SET expires_at = instant
          WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
        WHEN 'future_request' THEN UPDATE private.telegram_media_provider_consents
          SET requested_at = instant + interval '1 minute',
              granted_at = CASE WHEN granted_at IS NOT NULL THEN instant + interval '2 minutes' END
          WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
        WHEN 'consumed' THEN UPDATE private.telegram_media_provider_consents
          SET granted_at = instant - interval '1 minute', terminal_at = instant,
              terminal_reason = 'consumed' WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
        WHEN 'revoked' THEN UPDATE private.telegram_media_provider_consents
          SET terminal_at = instant, terminal_reason = 'revoked'
          WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
        WHEN 'newer_watermark' THEN UPDATE private.telegram_media_provider_consents
          SET last_update_id = 91807011 WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
      END CASE;
      RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied(op, '{}',
        '{"lease_valid":true,"applied":false}', op || '/state/' || fault);
    END LOOP;
  END LOOP;
  FOREACH fault IN ARRAY ARRAY['ungranted','future_grant','same_update'] LOOP
    PERFORM pg_temp.consent_fixture('claim');
    CASE fault
      WHEN 'ungranted' THEN UPDATE private.telegram_media_provider_consents SET granted_at = NULL
        WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
      WHEN 'future_grant' THEN UPDATE private.telegram_media_provider_consents
        SET granted_at = clock_timestamp() + interval '1 minute'
        WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
      WHEN 'same_update' THEN UPDATE private.telegram_media_provider_consents SET last_update_id = 91807010
        WHERE telegram_user_id = 91807701 AND chat_id = 91807801;
    END CASE;
    RETURN QUERY SELECT * FROM pg_temp.consent_expect_denied('claim', '{}',
      '{"lease_valid":true,"applied":false}', 'claim/' || fault);
  END LOOP;
  FOREACH op IN ARRAY ARRAY['grant','revoke','claim'] LOOP
    PERFORM pg_temp.consent_fixture(op);
    RETURN NEXT is(pg_temp.consent_run_as('service_role', pg_temp.consent_sql(op))::text,
      '{"lease_valid":true,"applied":true}'::jsonb::text, op || '/replay setup');
    before_state := pg_temp.consent_snapshot();
    RETURN NEXT is(pg_temp.consent_run_as('service_role', pg_temp.consent_sql(op))::text,
      jsonb_build_object('lease_valid',true,'applied',op <> 'claim')::text,
      op || '/same update replay is idempotent except one-shot claim');
    RETURN NEXT is(pg_temp.consent_snapshot(), before_state, op || '/replay does not refresh TTL/state');
  END LOOP;
END;
$$;
SELECT * FROM pg_temp.consent_state_matrix();

SELECT is(current_user::text, session_user::text, 'all temporary role switches were reset');
SELECT * FROM finish();
ROLLBACK;
