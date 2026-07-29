-- Family Shield notification claim retention.
--
-- The alert claim RPC opportunistically removes expired claims, but inactive
-- Family Shield accounts may never call it again. Include the metadata-only
-- claims in the existing daily retention function so expiry is guaranteed by
-- the already-scheduled ishonch_prune_app_retention_daily cron job.

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
  'Deletes expired sensitive Ishonch Guard rows according to retention policy, including Family Shield notification claims; service_role/private only.';
