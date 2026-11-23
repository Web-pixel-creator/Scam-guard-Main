-- Keep persisted consent metadata monotonic even after the grant TTL expires.
-- This deliberately does not add a permanent watermark after retention deletes a row.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.register_telegram_media_provider_consent(
  p_telegram_user_id BIGINT,
  p_chat_id BIGINT,
  p_chat_type TEXT,
  p_media_kind TEXT,
  p_prompt_message_id BIGINT,
  p_update_id BIGINT,
  p_lease_token UUID,
  p_processing_fence BIGINT,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL,
  p_report_flow_id UUID DEFAULT NULL
)
RETURNS TABLE(lease_valid BOOLEAN, applied BOOLEAN)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_row_count INTEGER := 0;
BEGIN
  IF p_telegram_user_id IS NULL OR p_telegram_user_id <= 0
     OR p_chat_id IS NULL OR p_chat_id = 0
     OR p_chat_type IS NULL OR p_chat_type NOT IN ('private', 'group', 'supergroup', 'channel')
     OR p_media_kind IS NULL OR p_media_kind NOT IN ('image', 'voice', 'report_image')
     OR ((p_media_kind = 'report_image') <> (p_report_flow_id IS NOT NULL))
     OR p_prompt_message_id IS NULL OR p_prompt_message_id <= 0
     OR p_update_id IS NULL OR p_update_id < 0
     OR p_lease_token IS NULL OR p_processing_fence IS NULL OR p_processing_fence < 1
     OR p_leader_token IS NULL OR p_leader_fence IS NULL OR p_leader_fence < 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'invalid telegram media consent request';
  END IF;

  IF NOT private.lock_telegram_media_consent_update_lease(
    p_update_id,
    p_lease_token,
    p_processing_fence,
    p_leader_token,
    p_leader_fence
  ) THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;
  PERFORM private.lock_telegram_media_consent_scope(p_telegram_user_id, p_chat_id);
  IF NOT private.telegram_update_lease_is_current(
    p_update_id,
    p_lease_token,
    p_processing_fence,
    p_leader_token,
    p_leader_fence
  ) THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;
  v_now := pg_catalog.clock_timestamp();

  INSERT INTO private.telegram_media_provider_consents AS consent (
    telegram_user_id,
    chat_id,
    chat_type,
    media_kind,
    report_flow_id,
    prompt_message_id,
    requested_at,
    granted_at,
    terminal_at,
    terminal_reason,
    expires_at,
    last_update_id
  )
  SELECT
    p_telegram_user_id,
    p_chat_id,
    p_chat_type,
    p_media_kind,
    p_report_flow_id,
    p_prompt_message_id,
    v_now,
    NULL,
    NULL,
    NULL,
    v_now + interval '10 minutes',
    p_update_id
  WHERE private.telegram_update_lease_is_current(
    p_update_id,
    p_lease_token,
    p_processing_fence,
    p_leader_token,
    p_leader_fence
  )
  ON CONFLICT (telegram_user_id, chat_id) DO UPDATE
  SET
    chat_type = EXCLUDED.chat_type,
    media_kind = EXCLUDED.media_kind,
    report_flow_id = EXCLUDED.report_flow_id,
    prompt_message_id = EXCLUDED.prompt_message_id,
    requested_at = EXCLUDED.requested_at,
    granted_at = NULL,
    terminal_at = NULL,
    terminal_reason = NULL,
    expires_at = EXCLUDED.expires_at,
    last_update_id = EXCLUDED.last_update_id
  -- Expiry ends permission, not the ordering watermark of an existing row.
  WHERE EXCLUDED.last_update_id >= consent.last_update_id
    AND private.telegram_update_lease_is_current(
      p_update_id,
      p_lease_token,
      p_processing_fence,
      p_leader_token,
      p_leader_fence
    );
  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count = 1 THEN
    RETURN QUERY SELECT true, true;
    RETURN;
  END IF;
  RETURN QUERY SELECT private.telegram_update_lease_is_current(
    p_update_id,
    p_lease_token,
    p_processing_fence,
    p_leader_token,
    p_leader_fence
  ), false;
END;
$$;

REVOKE ALL ON FUNCTION public.register_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID
) TO service_role;

COMMENT ON FUNCTION public.register_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID
) IS 'Registers prompt-bound media consent under the current lease without decreasing the update watermark of an existing row, including expired rows.';
