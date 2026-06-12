-- Telegram Webhook Dedup v1
--
-- Stores Telegram update_id values for a short window so Telegram retries are
-- processed once across multiple Node instances. The table contains no user
-- content, no chat ids, no message text and no Telegram usernames.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS public.telegram_webhook_updates (
  update_id BIGINT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 days')
);

CREATE INDEX IF NOT EXISTS idx_telegram_webhook_updates_expires
  ON public.telegram_webhook_updates(expires_at);

ALTER TABLE public.telegram_webhook_updates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.telegram_webhook_updates FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.telegram_webhook_updates TO service_role;

COMMENT ON TABLE public.telegram_webhook_updates IS
  'Short-lived Telegram webhook update_id claims for cross-instance deduplication; service-role only, no user content.';
COMMENT ON COLUMN public.telegram_webhook_updates.update_id IS
  'Telegram update_id used as an idempotency key.';
COMMENT ON COLUMN public.telegram_webhook_updates.expires_at IS
  'Retention boundary for retry-dedup rows; safe to delete after this time.';

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
  deleted_webhook_updates INT := 0;
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

  RETURN jsonb_build_object(
    'checks_deleted', deleted_checks,
    'reports_terminal_deleted', deleted_reports_terminal,
    'reports_stale_open_deleted', deleted_reports_stale_open,
    'telegram_sessions_deleted', deleted_sessions,
    'telegram_reputation_stale_deleted', deleted_reputation_stale,
    'telegram_family_revoked_deleted', deleted_family_revoked,
    'telegram_family_stale_pending_deleted', deleted_family_stale_pending,
    'telegram_webhook_updates_deleted', deleted_webhook_updates,
    'as_of', as_of
  );
END;
$$;

REVOKE ALL ON FUNCTION private.prune_app_retention(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.prune_app_retention(TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION private.prune_app_retention(TIMESTAMPTZ) IS
  'Deletes expired sensitive Ishonch Guard rows according to retention policy; service_role/private only.';
