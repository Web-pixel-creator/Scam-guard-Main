-- Prevent an older Telegram webhook update from overwriting session state
-- written by a newer update on another application instance.
ALTER TABLE public.telegram_sessions
  ADD COLUMN IF NOT EXISTS last_update_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_update_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.save_telegram_session_sequenced(
  p_telegram_user_id BIGINT,
  p_update_id BIGINT,
  p_patch JSONB
)
RETURNS TABLE(applied BOOLEAN, current_update_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_current_update_id BIGINT;
BEGIN
  IF p_telegram_user_id IS NULL
     OR p_telegram_user_id <= 0
     OR p_update_id IS NULL
     OR p_update_id < 0
     OR p_patch IS NULL
     OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'invalid telegram session patch';
  END IF;

  INSERT INTO public.telegram_sessions (
    telegram_user_id,
    lang,
    scenario,
    scenario_step,
    scenario_data,
    updated_at,
    last_update_id,
    last_update_at
  )
  VALUES (
    p_telegram_user_id,
    CASE WHEN p_patch ? 'lang' THEN p_patch ->> 'lang' ELSE 'ru' END,
    CASE WHEN p_patch ? 'scenario' THEN p_patch ->> 'scenario' ELSE 'none' END,
    CASE WHEN p_patch ? 'scenario_step' THEN (p_patch ->> 'scenario_step')::INT ELSE 0 END,
    CASE WHEN p_patch ? 'scenario_data' THEN p_patch -> 'scenario_data' ELSE '{}'::JSONB END,
    now(),
    p_update_id,
    now()
  )
  ON CONFLICT (telegram_user_id) DO UPDATE
  SET
    lang = CASE
      WHEN p_patch ? 'lang' THEN p_patch ->> 'lang'
      ELSE telegram_sessions.lang
    END,
    scenario = CASE
      WHEN p_patch ? 'scenario' THEN p_patch ->> 'scenario'
      ELSE telegram_sessions.scenario
    END,
    scenario_step = CASE
      WHEN p_patch ? 'scenario_step' THEN (p_patch ->> 'scenario_step')::INT
      ELSE telegram_sessions.scenario_step
    END,
    scenario_data = CASE
      WHEN p_patch ? 'scenario_data' THEN p_patch -> 'scenario_data'
      ELSE telegram_sessions.scenario_data
    END,
    updated_at = now(),
    last_update_id = EXCLUDED.last_update_id,
    last_update_at = now()
  WHERE EXCLUDED.last_update_id >= telegram_sessions.last_update_id
     OR telegram_sessions.last_update_at IS NULL
     OR telegram_sessions.last_update_at <= now() - interval '7 days'
  RETURNING telegram_sessions.last_update_id INTO v_current_update_id;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, v_current_update_id;
    RETURN;
  END IF;

  SELECT telegram_sessions.last_update_id
  INTO v_current_update_id
  FROM public.telegram_sessions
  WHERE telegram_user_id = p_telegram_user_id;

  RETURN QUERY SELECT FALSE, COALESCE(v_current_update_id, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.save_telegram_session_sequenced(BIGINT, BIGINT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_telegram_session_sequenced(BIGINT, BIGINT, JSONB)
  TO service_role;

COMMENT ON FUNCTION public.save_telegram_session_sequenced(BIGINT, BIGINT, JSONB) IS
  'Service-role-only Telegram session last-write guard keyed by update_id with a seven-day inactivity epoch for Telegram id randomization.';
