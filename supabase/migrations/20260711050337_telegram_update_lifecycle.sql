-- Durable Telegram update lifecycle and single-leader polling support.
--
-- Privacy boundary: only update_id plus operational lease/fence metadata is
-- persisted. No Telegram payload, user/chat id, username, text, URL, phone,
-- media, OCR, report narrative or AI output is stored here.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

ALTER TABLE public.telegram_webhook_updates
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS processing_fence BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS leader_token UUID,
  ADD COLUMN IF NOT EXISTS leader_fence BIGINT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_error_stage TEXT;

-- Existing v1 rows were already acknowledged under the old claim-only model.
-- They cannot be replayed because the payload was intentionally never stored.
UPDATE public.telegram_webhook_updates
SET status = 'completed',
    completed_at = COALESCE(completed_at, first_seen_at),
    updated_at = now()
WHERE status IS NULL;

ALTER TABLE public.telegram_webhook_updates
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '3 days');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'telegram_webhook_updates_status_check'
      AND conrelid = 'public.telegram_webhook_updates'::regclass
  ) THEN
    ALTER TABLE public.telegram_webhook_updates
      ADD CONSTRAINT telegram_webhook_updates_status_check
      CHECK (status IN ('processing', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'telegram_webhook_updates_processing_shape_check'
      AND conrelid = 'public.telegram_webhook_updates'::regclass
  ) THEN
    ALTER TABLE public.telegram_webhook_updates
      ADD CONSTRAINT telegram_webhook_updates_processing_shape_check
      CHECK (
        (status = 'completed' AND completed_at IS NOT NULL)
        OR
        (
          status = 'processing'
          AND processing_fence > 0
          AND lease_token IS NOT NULL
          AND lease_expires_at IS NOT NULL
          AND attempt_count > 0
          AND started_at IS NOT NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'telegram_webhook_updates_error_stage_check'
      AND conrelid = 'public.telegram_webhook_updates'::regclass
  ) THEN
    ALTER TABLE public.telegram_webhook_updates
      ADD CONSTRAINT telegram_webhook_updates_error_stage_check
      CHECK (
        last_error_stage IS NULL
        OR last_error_stage IN (
          'dispatch',
          'completion',
          'heartbeat',
          'session',
          'leader_lost'
        )
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_telegram_webhook_updates_processing_lease
  ON public.telegram_webhook_updates(lease_expires_at)
  WHERE status = 'processing';

ALTER TABLE public.telegram_webhook_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_webhook_updates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON public.telegram_webhook_updates TO service_role;

CREATE TABLE IF NOT EXISTS private.telegram_update_leaders (
  name TEXT PRIMARY KEY,
  lease_token UUID NOT NULL,
  fence BIGINT NOT NULL CHECK (fence > 0),
  lease_expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT telegram_update_leaders_name_check CHECK (name = 'telegram_updates')
);

ALTER TABLE private.telegram_update_leaders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.telegram_update_leaders FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.telegram_update_leader_is_current(
  p_lease_token UUID,
  p_fence BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.telegram_update_leaders AS leader
    WHERE leader.name = 'telegram_updates'
      AND leader.lease_token = p_lease_token
      AND leader.fence = p_fence
      AND leader.lease_expires_at > pg_catalog.clock_timestamp()
  );
$$;

CREATE OR REPLACE FUNCTION private.telegram_update_lease_is_current(
  p_update_id BIGINT,
  p_lease_token UUID,
  p_processing_fence BIGINT,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.telegram_webhook_updates AS update_row
    WHERE update_row.update_id = p_update_id
      AND update_row.status = 'processing'
      AND update_row.lease_token = p_lease_token
      AND update_row.processing_fence = p_processing_fence
      AND update_row.lease_expires_at > pg_catalog.clock_timestamp()
      AND (
        (
          update_row.leader_token IS NULL
          AND p_leader_token IS NULL
          AND p_leader_fence IS NULL
        )
        OR (
          p_leader_token IS NOT NULL
          AND update_row.leader_token = p_leader_token
          AND update_row.leader_fence = p_leader_fence
          AND private.telegram_update_leader_is_current(
            p_leader_token,
            p_leader_fence
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.telegram_update_leader_is_current(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.telegram_update_lease_is_current(BIGINT, UUID, BIGINT, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.acquire_telegram_update_leader(
  p_lease_token UUID,
  p_lease_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(acquired BOOLEAN, fence BIGINT, lease_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_row private.telegram_update_leaders%ROWTYPE;
BEGIN
  IF p_lease_token IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RETURN QUERY SELECT false, 0::BIGINT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  INSERT INTO private.telegram_update_leaders(
    name,
    lease_token,
    fence,
    lease_expires_at,
    updated_at
  )
  VALUES (
    'telegram_updates',
    p_lease_token,
    1,
    v_now + pg_catalog.make_interval(secs => p_lease_seconds),
    v_now
  )
  ON CONFLICT (name) DO NOTHING;

  SELECT *
  INTO v_row
  FROM private.telegram_update_leaders
  WHERE name = 'telegram_updates'
  FOR UPDATE;

  IF v_row.lease_token = p_lease_token AND v_row.lease_expires_at > v_now THEN
    UPDATE private.telegram_update_leaders
    SET lease_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
        updated_at = v_now
    WHERE name = 'telegram_updates';

    RETURN QUERY
    SELECT true, v_row.fence, v_now + pg_catalog.make_interval(secs => p_lease_seconds);
    RETURN;
  END IF;

  IF v_row.lease_expires_at <= v_now THEN
    UPDATE private.telegram_update_leaders
    SET lease_token = p_lease_token,
        fence = v_row.fence + 1,
        lease_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
        updated_at = v_now
    WHERE name = 'telegram_updates';

    RETURN QUERY
    SELECT true, v_row.fence + 1, v_now + pg_catalog.make_interval(secs => p_lease_seconds);
    RETURN;
  END IF;

  RETURN QUERY SELECT false, v_row.fence, v_row.lease_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_telegram_update_leader(
  p_lease_token UUID,
  p_fence BIGINT,
  p_lease_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  IF p_lease_token IS NULL OR p_fence < 1 OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RETURN false;
  END IF;

  UPDATE private.telegram_update_leaders
  SET lease_expires_at = pg_catalog.clock_timestamp()
        + pg_catalog.make_interval(secs => p_lease_seconds),
      updated_at = pg_catalog.clock_timestamp()
  WHERE name = 'telegram_updates'
    AND lease_token = p_lease_token
    AND fence = p_fence
    AND lease_expires_at > pg_catalog.clock_timestamp();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_telegram_update_leader(
  p_lease_token UUID,
  p_fence BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  UPDATE private.telegram_update_leaders
  SET lease_expires_at = pg_catalog.clock_timestamp(),
      updated_at = pg_catalog.clock_timestamp()
  WHERE name = 'telegram_updates'
    AND lease_token = p_lease_token
    AND fence = p_fence;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.telegram_update_leader_status()
RETURNS TABLE(active BOOLEAN, fence BIGINT, lease_expires_at TIMESTAMPTZ)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    leader.lease_expires_at > pg_catalog.clock_timestamp(),
    leader.fence,
    leader.lease_expires_at
  FROM private.telegram_update_leaders AS leader
  WHERE leader.name = 'telegram_updates'
  UNION ALL
  SELECT false, 0::BIGINT, NULL::TIMESTAMPTZ
  WHERE NOT EXISTS (
    SELECT 1
    FROM private.telegram_update_leaders AS leader
    WHERE leader.name = 'telegram_updates'
  )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.begin_telegram_update(
  p_update_id BIGINT,
  p_lease_token UUID,
  p_lease_seconds INTEGER DEFAULT 120,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL
)
RETURNS TABLE(
  decision TEXT,
  processing_fence BIGINT,
  retry_after_sec INTEGER,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_row public.telegram_webhook_updates%ROWTYPE;
  v_retry INTEGER := 1;
BEGIN
  IF p_update_id < 0
     OR p_lease_token IS NULL
     OR p_lease_seconds < 30
     OR p_lease_seconds > 600
     OR (p_leader_token IS NULL) <> (p_leader_fence IS NULL)
     OR (
       p_leader_token IS NOT NULL
       AND NOT private.telegram_update_leader_is_current(p_leader_token, p_leader_fence)
     ) THEN
    RETURN QUERY SELECT 'unavailable', 0::BIGINT, 1, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  INSERT INTO public.telegram_webhook_updates(
    update_id,
    first_seen_at,
    expires_at,
    status,
    processing_fence,
    lease_token,
    leader_token,
    leader_fence,
    lease_expires_at,
    attempt_count,
    started_at,
    completed_at,
    updated_at,
    last_error_stage
  )
  VALUES (
    p_update_id,
    v_now,
    v_now + interval '7 days',
    'processing',
    1,
    p_lease_token,
    p_leader_token,
    p_leader_fence,
    v_now + pg_catalog.make_interval(secs => p_lease_seconds),
    1,
    v_now,
    NULL,
    v_now,
    NULL
  )
  ON CONFLICT (update_id) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.telegram_webhook_updates
  WHERE update_id = p_update_id
  FOR UPDATE;

  IF v_row.status = 'completed' THEN
    RETURN QUERY
    SELECT 'completed', v_row.processing_fence, 0, NULL::TIMESTAMPTZ, v_row.attempt_count;
    RETURN;
  END IF;

  IF v_row.lease_token = p_lease_token AND v_row.lease_expires_at > v_now THEN
    RETURN QUERY
    SELECT 'acquired', v_row.processing_fence, 0, v_row.lease_expires_at, v_row.attempt_count;
    RETURN;
  END IF;

  IF v_row.lease_expires_at > v_now THEN
    v_retry := GREATEST(
      1,
      pg_catalog.ceil(EXTRACT(epoch FROM (v_row.lease_expires_at - v_now)))::INTEGER
    );
    RETURN QUERY
    SELECT 'busy', v_row.processing_fence, v_retry, v_row.lease_expires_at, v_row.attempt_count;
    RETURN;
  END IF;

  UPDATE public.telegram_webhook_updates
  SET processing_fence = v_row.processing_fence + 1,
      lease_token = p_lease_token,
      leader_token = p_leader_token,
      leader_fence = p_leader_fence,
      lease_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
      attempt_count = v_row.attempt_count + 1,
      started_at = v_now,
      completed_at = NULL,
      updated_at = v_now,
      expires_at = v_now + interval '7 days',
      last_error_stage = NULL
  WHERE update_id = p_update_id;

  RETURN QUERY
  SELECT
    'acquired',
    v_row.processing_fence + 1,
    0,
    v_now + pg_catalog.make_interval(secs => p_lease_seconds),
    v_row.attempt_count + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_telegram_update(
  p_update_id BIGINT,
  p_lease_token UUID,
  p_processing_fence BIGINT,
  p_lease_seconds INTEGER DEFAULT 120,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  IF p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RETURN false;
  END IF;

  UPDATE public.telegram_webhook_updates
  SET lease_expires_at = pg_catalog.clock_timestamp()
        + pg_catalog.make_interval(secs => p_lease_seconds),
      updated_at = pg_catalog.clock_timestamp()
  WHERE update_id = p_update_id
    AND status = 'processing'
    AND lease_token = p_lease_token
    AND processing_fence = p_processing_fence
    AND lease_expires_at > pg_catalog.clock_timestamp()
    AND (
      (leader_token IS NULL AND p_leader_token IS NULL AND p_leader_fence IS NULL)
      OR (
        p_leader_token IS NOT NULL
        AND leader_token = p_leader_token
        AND leader_fence = p_leader_fence
        AND private.telegram_update_leader_is_current(p_leader_token, p_leader_fence)
      )
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_telegram_update(
  p_update_id BIGINT,
  p_lease_token UUID,
  p_processing_fence BIGINT,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER := 0;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  UPDATE public.telegram_webhook_updates
  SET status = 'completed',
      completed_at = v_now,
      lease_token = NULL,
      leader_token = NULL,
      leader_fence = NULL,
      lease_expires_at = NULL,
      updated_at = v_now,
      expires_at = v_now + interval '3 days',
      last_error_stage = NULL
  WHERE update_id = p_update_id
    AND status = 'processing'
    AND lease_token = p_lease_token
    AND processing_fence = p_processing_fence
    AND lease_expires_at > v_now
    AND (
      (leader_token IS NULL AND p_leader_token IS NULL AND p_leader_fence IS NULL)
      OR (
        p_leader_token IS NOT NULL
        AND leader_token = p_leader_token
        AND leader_fence = p_leader_fence
        AND private.telegram_update_leader_is_current(p_leader_token, p_leader_fence)
      )
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_telegram_update_failure(
  p_update_id BIGINT,
  p_lease_token UUID,
  p_processing_fence BIGINT,
  p_stage TEXT,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  IF p_stage NOT IN ('dispatch', 'completion', 'heartbeat', 'session', 'leader_lost') THEN
    RETURN false;
  END IF;

  UPDATE public.telegram_webhook_updates
  SET last_error_stage = p_stage,
      lease_expires_at = pg_catalog.clock_timestamp(),
      updated_at = pg_catalog.clock_timestamp()
  WHERE update_id = p_update_id
    AND status = 'processing'
    AND lease_token = p_lease_token
    AND processing_fence = p_processing_fence
    AND (
      (leader_token IS NULL AND p_leader_token IS NULL AND p_leader_fence IS NULL)
      OR (
        p_leader_token IS NOT NULL
        AND leader_token = p_leader_token
        AND leader_fence = p_leader_fence
      )
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.telegram_update_lease_current(
  p_update_id BIGINT,
  p_lease_token UUID,
  p_processing_fence BIGINT,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.telegram_update_lease_is_current(
    p_update_id,
    p_lease_token,
    p_processing_fence,
    p_leader_token,
    p_leader_fence
  );
$$;

CREATE OR REPLACE FUNCTION public.load_telegram_session_fenced(
  p_telegram_user_id BIGINT,
  p_update_id BIGINT,
  p_lease_token UUID,
  p_processing_fence BIGINT,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session JSONB;
BEGIN
  IF NOT private.telegram_update_lease_is_current(
    p_update_id,
    p_lease_token,
    p_processing_fence,
    p_leader_token,
    p_leader_fence
  ) THEN
    RETURN pg_catalog.jsonb_build_object('lease_valid', false);
  END IF;

  SELECT pg_catalog.to_jsonb(session_row)
  INTO v_session
  FROM public.telegram_sessions AS session_row
  WHERE session_row.telegram_user_id = p_telegram_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'lease_valid',
    true,
    'session',
    v_session
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_telegram_session_fenced(
  p_telegram_user_id BIGINT,
  p_update_id BIGINT,
  p_lease_token UUID,
  p_processing_fence BIGINT,
  p_patch JSONB,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL
)
RETURNS TABLE(lease_valid BOOLEAN, applied BOOLEAN, current_update_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.telegram_update_lease_is_current(
    p_update_id,
    p_lease_token,
    p_processing_fence,
    p_leader_token,
    p_leader_fence
  ) THEN
    RETURN QUERY SELECT false, false, NULL::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true, result.applied, result.current_update_id
  FROM public.save_telegram_session_sequenced(
    p_telegram_user_id,
    p_update_id,
    p_patch
  ) AS result;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_telegram_update_leader(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_telegram_update_leader(UUID, BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_telegram_update_leader(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.telegram_update_leader_status()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_telegram_update(BIGINT, UUID, INTEGER, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_telegram_update(BIGINT, UUID, BIGINT, INTEGER, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_telegram_update(BIGINT, UUID, BIGINT, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_telegram_update_failure(BIGINT, UUID, BIGINT, TEXT, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.telegram_update_lease_current(BIGINT, UUID, BIGINT, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.load_telegram_session_fenced(BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_telegram_session_fenced(BIGINT, BIGINT, UUID, BIGINT, JSONB, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.acquire_telegram_update_leader(UUID, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_telegram_update_leader(UUID, BIGINT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_telegram_update_leader(UUID, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.telegram_update_leader_status()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_telegram_update(BIGINT, UUID, INTEGER, UUID, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_telegram_update(BIGINT, UUID, BIGINT, INTEGER, UUID, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_telegram_update(BIGINT, UUID, BIGINT, UUID, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_telegram_update_failure(BIGINT, UUID, BIGINT, TEXT, UUID, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.telegram_update_lease_current(BIGINT, UUID, BIGINT, UUID, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.load_telegram_session_fenced(BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.save_telegram_session_fenced(BIGINT, BIGINT, UUID, BIGINT, JSONB, UUID, BIGINT)
  TO service_role;

COMMENT ON TABLE private.telegram_update_leaders IS
  'Singleton metadata-only lease for the active Telegram getUpdates worker; no Telegram payload or user data.';
COMMENT ON FUNCTION public.begin_telegram_update(BIGINT, UUID, INTEGER, UUID, BIGINT) IS
  'Begins or safely reacquires metadata-only Telegram update processing; service-role only.';
COMMENT ON FUNCTION public.complete_telegram_update(BIGINT, UUID, BIGINT, UUID, BIGINT) IS
  'Marks Telegram update processing complete only for the current lease/fence; service-role only.';
