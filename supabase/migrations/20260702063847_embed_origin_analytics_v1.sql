-- Embed Origin Analytics v1
--
-- Privacy-safe usage telemetry for the partner iframe at /embed/check.
-- Stores where the iframe is used and aggregate result shape only. It never
-- stores user input, redacted input, input hashes, full referrer URLs, query
-- strings, fragments, screenshots, OCR text, phone numbers or Telegram ids.

CREATE TABLE IF NOT EXISTS public.embed_origin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL CHECK (event_type IN ('check_result', 'meta_intent')),
  partner TEXT CHECK (partner IS NULL OR length(partner) <= 48),
  referrer_origin TEXT CHECK (referrer_origin IS NULL OR length(referrer_origin) <= 255),
  referrer_host TEXT CHECK (
    referrer_host IS NULL
    OR (
      length(referrer_host) <= 253
      AND referrer_host !~ '[/?#]'
    )
  ),
  language TEXT NOT NULL CHECK (language IN ('ru', 'uz', 'en')),
  input_type public.input_type,
  risk_level public.risk_level,
  reason_count INTEGER NOT NULL DEFAULT 0 CHECK (reason_count >= 0 AND reason_count <= 32)
);

CREATE INDEX IF NOT EXISTS idx_embed_origin_events_created
  ON public.embed_origin_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_embed_origin_events_referrer_host_created
  ON public.embed_origin_events(referrer_host, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_embed_origin_events_partner_created
  ON public.embed_origin_events(partner, created_at DESC);

ALTER TABLE public.embed_origin_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.embed_origin_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.embed_origin_events TO service_role;

COMMENT ON TABLE public.embed_origin_events IS
  'Privacy-safe /embed/check usage telemetry. Stores partner/referrer origin and aggregate result shape only; service-role only.';
COMMENT ON COLUMN public.embed_origin_events.referrer_origin IS
  'Normalized origin only, for example https://example.uz. Never stores path, query string or fragment.';
COMMENT ON COLUMN public.embed_origin_events.referrer_host IS
  'Normalized hostname only, without path, query string or fragment.';
COMMENT ON COLUMN public.embed_origin_events.reason_count IS
  'Count of reason codes on the result; reason code values and raw checked input are not stored here.';

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
  'Deletes expired sensitive Ishonch Guard rows according to retention policy; service_role/private only.';
