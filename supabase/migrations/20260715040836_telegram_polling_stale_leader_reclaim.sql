-- Let the current polling leader reclaim an update lease that is still attached
-- to a superseded polling leader after a short outbound-effect drain grace.
-- Only operational lease/fence metadata is inspected or updated; no Telegram
-- payload or user content is persisted by these functions.
ALTER TABLE private.telegram_update_leaders
  ADD COLUMN IF NOT EXISTS acquired_at TIMESTAMPTZ;

UPDATE private.telegram_update_leaders
SET acquired_at = COALESCE(acquired_at, updated_at, pg_catalog.clock_timestamp())
WHERE acquired_at IS NULL;

ALTER TABLE private.telegram_update_leaders
  ALTER COLUMN acquired_at SET DEFAULT now(),
  ALTER COLUMN acquired_at SET NOT NULL;

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
    updated_at,
    acquired_at
  )
  VALUES (
    'telegram_updates',
    p_lease_token,
    1,
    v_now + pg_catalog.make_interval(secs => p_lease_seconds),
    v_now,
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
        updated_at = v_now,
        acquired_at = v_now
    WHERE name = 'telegram_updates';

    RETURN QUERY
    SELECT true, v_row.fence + 1, v_now + pg_catalog.make_interval(secs => p_lease_seconds);
    RETURN;
  END IF;

  RETURN QUERY SELECT false, v_row.fence, v_row.lease_expires_at;
END;
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
  v_superseded_polling_owner BOOLEAN := false;
  v_stale_polling_owner BOOLEAN := false;
  v_current_leader_acquired_at TIMESTAMPTZ := NULL;
  v_reclaim_not_before TIMESTAMPTZ := NULL;
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

  -- The row lock may have waited behind another worker. Refresh the clock and
  -- confirm that a polling caller still owns the singleton leader fence before
  -- making any lifecycle decision.
  v_now := pg_catalog.clock_timestamp();
  IF p_leader_token IS NOT NULL
     AND NOT private.telegram_update_leader_is_current(p_leader_token, p_leader_fence) THEN
    RETURN QUERY SELECT 'unavailable', 0::BIGINT, 1, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  IF p_leader_token IS NOT NULL THEN
    SELECT leader.acquired_at
    INTO v_current_leader_acquired_at
    FROM private.telegram_update_leaders AS leader
    WHERE leader.name = 'telegram_updates'
      AND leader.lease_token = p_leader_token
      AND leader.fence = p_leader_fence;
    v_reclaim_not_before := v_current_leader_acquired_at + interval '15 seconds';
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN QUERY
    SELECT 'completed', v_row.processing_fence, 0, NULL::TIMESTAMPTZ, v_row.attempt_count;
    RETURN;
  END IF;

  -- A webhook/non-leader caller must not steal an active polling lease, and a
  -- polling leader must not steal an active webhook lease. Reclaim is allowed
  -- only when both the caller and stored owner are polling leaders and the
  -- stored leader token/fence is no longer current.
  v_superseded_polling_owner := p_leader_token IS NOT NULL
    AND v_row.leader_token IS NOT NULL
    AND (
      v_row.leader_token IS DISTINCT FROM p_leader_token
      OR v_row.leader_fence IS DISTINCT FROM p_leader_fence
    )
    AND NOT private.telegram_update_leader_is_current(
      v_row.leader_token,
      v_row.leader_fence
    );

  v_stale_polling_owner := v_superseded_polling_owner
    AND v_reclaim_not_before IS NOT NULL
    AND v_now >= v_reclaim_not_before;

  -- A leader handoff is not atomic with an already-started Telegram Bot API
  -- request. Wait longer than the application's eight-second outbound timeout
  -- before redispatch so the superseded process can drain that bounded call.
  IF v_superseded_polling_owner
     AND NOT v_stale_polling_owner
     AND v_reclaim_not_before IS NOT NULL THEN
    v_retry := GREATEST(
      1,
      pg_catalog.ceil(EXTRACT(epoch FROM (v_reclaim_not_before - v_now)))::INTEGER
    );
    RETURN QUERY
    SELECT 'busy', v_row.processing_fence, v_retry, v_row.lease_expires_at, v_row.attempt_count;
    RETURN;
  END IF;

  IF NOT v_stale_polling_owner
     AND v_row.lease_token = p_lease_token
     AND v_row.lease_expires_at > v_now THEN
    RETURN QUERY
    SELECT 'acquired', v_row.processing_fence, 0, v_row.lease_expires_at, v_row.attempt_count;
    RETURN;
  END IF;

  IF NOT v_stale_polling_owner AND v_row.lease_expires_at > v_now THEN
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

REVOKE ALL ON FUNCTION public.begin_telegram_update(BIGINT, UUID, INTEGER, UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acquire_telegram_update_leader(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_telegram_update(BIGINT, UUID, INTEGER, UUID, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_telegram_update_leader(UUID, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.begin_telegram_update(BIGINT, UUID, INTEGER, UUID, BIGINT) IS
  'Begins or safely reacquires metadata-only Telegram update processing, including grace-bounded takeover from a superseded polling leader; service-role only.';
