-- Atomic one-shot consent state for raw Telegram media sent to an external
-- vision/STT provider. The table stores metadata only: no Telegram file id,
-- media bytes, OCR, transcript, user text, provider payload or secret value.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE private.telegram_media_provider_consents (
  telegram_user_id BIGINT NOT NULL CHECK (telegram_user_id > 0),
  chat_id BIGINT NOT NULL CHECK (chat_id <> 0),
  chat_type TEXT NOT NULL CHECK (chat_type IN ('private', 'group', 'supergroup', 'channel')),
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'voice', 'report_image')),
  report_flow_id UUID,
  prompt_message_id BIGINT NOT NULL CHECK (prompt_message_id > 0),
  requested_at TIMESTAMPTZ NOT NULL,
  granted_at TIMESTAMPTZ,
  terminal_at TIMESTAMPTZ,
  terminal_reason TEXT CHECK (terminal_reason IN ('consumed', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  last_update_id BIGINT NOT NULL CHECK (last_update_id >= 0),
  PRIMARY KEY (telegram_user_id, chat_id),
  CONSTRAINT telegram_media_provider_consents_expiry_order
    CHECK (expires_at > requested_at),
  CONSTRAINT telegram_media_provider_consents_grant_order
    CHECK (granted_at IS NULL OR granted_at >= requested_at),
  CONSTRAINT telegram_media_provider_consents_grant_before_expiry
    CHECK (granted_at IS NULL OR granted_at < expires_at),
  CONSTRAINT telegram_media_provider_consents_terminal_pair
    CHECK ((terminal_at IS NULL) = (terminal_reason IS NULL)),
  CONSTRAINT telegram_media_provider_consents_terminal_order
    CHECK (terminal_at IS NULL OR terminal_at >= requested_at),
  CONSTRAINT telegram_media_provider_consents_terminal_before_expiry
    CHECK (terminal_at IS NULL OR terminal_at < expires_at),
  CONSTRAINT telegram_media_provider_consents_terminal_after_grant
    CHECK (terminal_at IS NULL OR granted_at IS NULL OR terminal_at >= granted_at),
  CONSTRAINT telegram_media_provider_consents_consumed_requires_grant
    CHECK (terminal_reason IS DISTINCT FROM 'consumed' OR granted_at IS NOT NULL),
  CONSTRAINT telegram_media_provider_consents_report_flow_scope
    CHECK ((media_kind = 'report_image') = (report_flow_id IS NOT NULL))
);

CREATE INDEX telegram_media_provider_consents_expires_idx
  ON private.telegram_media_provider_consents (expires_at);

ALTER TABLE private.telegram_media_provider_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.telegram_media_provider_consents
  FROM PUBLIC, anon, authenticated, service_role;

-- Serialize every consent transition with the lifecycle row that authorizes
-- its Telegram update. Locks are always taken update -> leader -> consent DML,
-- matching the lifecycle lock order and preventing a stale worker from
-- mutating consent after waiting on another transaction.
CREATE OR REPLACE FUNCTION private.lock_telegram_media_consent_update_lease(
  p_update_id BIGINT,
  p_lease_token UUID,
  p_processing_fence BIGINT,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
BEGIN
  PERFORM 1
  FROM public.telegram_webhook_updates AS update_row
  WHERE update_row.update_id = p_update_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF p_leader_token IS NOT NULL THEN
    PERFORM 1
    FROM private.telegram_update_leaders AS leader
    WHERE leader.name = 'telegram_updates'
    FOR SHARE;
    IF NOT FOUND THEN RETURN false; END IF;
  END IF;

  RETURN private.telegram_update_lease_is_current(
    p_update_id,
    p_lease_token,
    p_processing_fence,
    p_leader_token,
    p_leader_fence
  );
END;
$$;

REVOKE ALL ON FUNCTION private.lock_telegram_media_consent_update_lease(
  BIGINT, UUID, BIGINT, UUID, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.lock_telegram_media_consent_scope(
  p_telegram_user_id BIGINT,
  p_chat_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'telegram_media_consent:' || p_telegram_user_id::TEXT || ':' || p_chat_id::TEXT,
      0
    )
  );
  PERFORM 1
  FROM private.telegram_media_provider_consents AS consent
  WHERE consent.telegram_user_id = p_telegram_user_id
    AND consent.chat_id = p_chat_id
  FOR UPDATE;
END;
$$;

REVOKE ALL ON FUNCTION private.lock_telegram_media_consent_scope(BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

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
  WHERE (
      EXCLUDED.last_update_id >= consent.last_update_id
      OR consent.expires_at <= v_now
    )
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

CREATE OR REPLACE FUNCTION public.grant_telegram_media_provider_consent(
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
      MESSAGE = 'invalid telegram media consent grant';
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

  UPDATE private.telegram_media_provider_consents AS consent
  SET
    granted_at = COALESCE(consent.granted_at, v_now),
    last_update_id = p_update_id
  WHERE consent.telegram_user_id = p_telegram_user_id
    AND consent.chat_id = p_chat_id
    AND consent.chat_type = p_chat_type
    AND consent.media_kind = p_media_kind
    AND consent.report_flow_id IS NOT DISTINCT FROM p_report_flow_id
    AND consent.prompt_message_id = p_prompt_message_id
    AND consent.requested_at <= v_now
    AND consent.expires_at > v_now
    AND (
      (
        consent.granted_at IS NULL
        AND consent.terminal_at IS NULL
        AND p_update_id > consent.last_update_id
      )
      OR (
        consent.granted_at IS NOT NULL
        AND consent.terminal_at IS NULL
        AND p_update_id = consent.last_update_id
      )
    )
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

CREATE OR REPLACE FUNCTION public.revoke_telegram_media_provider_consent(
  p_telegram_user_id BIGINT,
  p_chat_id BIGINT,
  p_chat_type TEXT,
  p_prompt_message_id BIGINT,
  p_update_id BIGINT,
  p_lease_token UUID,
  p_processing_fence BIGINT,
  p_leader_token UUID DEFAULT NULL,
  p_leader_fence BIGINT DEFAULT NULL
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
     OR p_prompt_message_id IS NULL OR p_prompt_message_id <= 0
     OR p_update_id IS NULL OR p_update_id < 0
     OR p_lease_token IS NULL OR p_processing_fence IS NULL OR p_processing_fence < 1
     OR p_leader_token IS NULL OR p_leader_fence IS NULL OR p_leader_fence < 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'invalid telegram media consent revocation';
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

  UPDATE private.telegram_media_provider_consents AS consent
  SET
    terminal_at = COALESCE(consent.terminal_at, v_now),
    terminal_reason = 'revoked',
    last_update_id = p_update_id
  WHERE consent.telegram_user_id = p_telegram_user_id
    AND consent.chat_id = p_chat_id
    AND consent.chat_type = p_chat_type
    AND consent.prompt_message_id = p_prompt_message_id
    AND consent.requested_at <= v_now
    AND consent.expires_at > v_now
    AND (
      (
        consent.terminal_at IS NULL
        AND p_update_id > consent.last_update_id
      )
      OR (
        consent.terminal_reason = 'revoked'
        AND p_update_id = consent.last_update_id
      )
    )
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

CREATE OR REPLACE FUNCTION public.claim_telegram_media_provider_consent(
  p_telegram_user_id BIGINT,
  p_chat_id BIGINT,
  p_chat_type TEXT,
  p_media_kind TEXT,
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
     OR p_update_id IS NULL OR p_update_id < 0
     OR p_lease_token IS NULL OR p_processing_fence IS NULL OR p_processing_fence < 1
     OR p_leader_token IS NULL OR p_leader_fence IS NULL OR p_leader_fence < 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'invalid telegram media consent claim';
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

  UPDATE private.telegram_media_provider_consents AS consent
  SET
    terminal_at = v_now,
    terminal_reason = 'consumed',
    last_update_id = p_update_id
  WHERE consent.telegram_user_id = p_telegram_user_id
    AND consent.chat_id = p_chat_id
    AND consent.chat_type = p_chat_type
    AND consent.media_kind = p_media_kind
    AND consent.report_flow_id IS NOT DISTINCT FROM p_report_flow_id
    AND consent.requested_at <= v_now
    AND consent.expires_at > v_now
    AND consent.granted_at IS NOT NULL
    AND consent.granted_at <= v_now
    AND consent.terminal_at IS NULL
    AND p_update_id > consent.last_update_id
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
REVOKE ALL ON FUNCTION public.grant_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.revoke_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.register_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID
) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID
) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID
) TO service_role;

COMMENT ON TABLE private.telegram_media_provider_consents IS
  'Metadata-only, prompt-bound Telegram media consent state; raw/derived media is forbidden.';
COMMENT ON FUNCTION public.claim_telegram_media_provider_consent(
  BIGINT, BIGINT, TEXT, TEXT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID
) IS 'Atomically consumes at most one fresh external-media grant under the current Telegram update lease.';

CREATE OR REPLACE FUNCTION private.prune_app_retention(as_of TIMESTAMPTZ DEFAULT now())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  deleted_checks INT := 0;
  deleted_reports_terminal INT := 0;
  deleted_reports_stale_open INT := 0;
  deleted_sessions INT := 0;
  deleted_reputation_stale INT := 0;
  deleted_family_revoked INT := 0;
  deleted_family_stale_pending INT := 0;
  deleted_family_notification_claims INT := 0;
  deleted_media_provider_consents INT := 0;
  deleted_webhook_updates INT := 0;
  deleted_rate_limit_buckets INT := 0;
  deleted_embed_origin_events INT := 0;
BEGIN
  DELETE FROM public.checks
  WHERE created_at < as_of - interval '90 days';
  GET DIAGNOSTICS deleted_checks = ROW_COUNT;

  DELETE FROM public.reports
  WHERE status IN ('confirmed', 'rejected', 'duplicate')
    AND created_at < as_of - interval '365 days';
  GET DIAGNOSTICS deleted_reports_terminal = ROW_COUNT;

  DELETE FROM public.reports
  WHERE status IN ('new', 'reviewing')
    AND created_at < as_of - interval '180 days';
  GET DIAGNOSTICS deleted_reports_stale_open = ROW_COUNT;

  DELETE FROM public.telegram_sessions
  WHERE updated_at < as_of - interval '30 days';
  GET DIAGNOSTICS deleted_sessions = ROW_COUNT;

  DELETE FROM public.telegram_reputation_targets
  WHERE moderation_status <> 'confirmed'
    AND source_type IN ('system_observed', 'telegram_public', 'user_submitted_unverified')
    AND last_seen_at < as_of - interval '180 days';
  GET DIAGNOSTICS deleted_reputation_stale = ROW_COUNT;

  DELETE FROM private.telegram_family_notification_claims
  WHERE expires_at <= as_of;
  GET DIAGNOSTICS deleted_family_notification_claims = ROW_COUNT;

  DELETE FROM public.telegram_family_shield
  WHERE status = 'revoked'
    AND COALESCE(revoked_at, updated_at, created_at) < as_of - interval '30 days';
  GET DIAGNOSTICS deleted_family_revoked = ROW_COUNT;

  DELETE FROM public.telegram_family_shield
  WHERE status = 'pending'
    AND created_at < as_of - interval '7 days';
  GET DIAGNOSTICS deleted_family_stale_pending = ROW_COUNT;

  DELETE FROM public.telegram_webhook_updates
  WHERE expires_at <= as_of;
  GET DIAGNOSTICS deleted_webhook_updates = ROW_COUNT;

  -- Keep lifecycle -> consent lock order aligned with the transition RPCs.
  DELETE FROM private.telegram_media_provider_consents
  WHERE expires_at <= as_of;
  GET DIAGNOSTICS deleted_media_provider_consents = ROW_COUNT;

  DELETE FROM public.rate_limit_buckets
  WHERE expires_at <= as_of;
  GET DIAGNOSTICS deleted_rate_limit_buckets = ROW_COUNT;

  DELETE FROM public.embed_origin_events
  WHERE created_at < as_of - interval '180 days';
  GET DIAGNOSTICS deleted_embed_origin_events = ROW_COUNT;

  RETURN jsonb_build_object(
    'checks_deleted', deleted_checks,
    'reports_terminal_deleted', deleted_reports_terminal,
    'reports_stale_open_deleted', deleted_reports_stale_open,
    'telegram_sessions_deleted', deleted_sessions,
    'telegram_reputation_stale_deleted', deleted_reputation_stale,
    'telegram_family_revoked_deleted', deleted_family_revoked,
    'telegram_family_stale_pending_deleted', deleted_family_stale_pending,
    'telegram_family_notification_claims_deleted', deleted_family_notification_claims,
    'telegram_media_provider_consents_deleted', deleted_media_provider_consents,
    'telegram_webhook_updates_deleted', deleted_webhook_updates,
    'rate_limit_buckets_deleted', deleted_rate_limit_buckets,
    'embed_origin_events_deleted', deleted_embed_origin_events,
    'as_of', as_of
  );
END;
$$;

REVOKE ALL ON FUNCTION private.prune_app_retention(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.prune_app_retention(TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION private.prune_app_retention(TIMESTAMPTZ) IS
  'Deletes expired sensitive Ishonch Guard rows, including metadata-only external-media consent state; service_role/private only.';

NOTIFY pgrst, 'reload schema';
