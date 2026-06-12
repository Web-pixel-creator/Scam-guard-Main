-- Shared Rate Limits v1
--
-- Cross-instance rate-limit buckets for public check/report surfaces.
-- Stores only HMAC-SHA256 key hashes, not IPs, Telegram ids, phone numbers,
-- URLs, message text, OCR text or screenshots.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  scope TEXT NOT NULL CHECK (
    scope IN ('check', 'report', 'telegram_public_post')
  ),
  key_hash TEXT NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  bucket_start TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL CHECK (
    window_seconds >= 1
    AND window_seconds <= 86400
  ),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key_hash, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expires
  ON public.rate_limit_buckets(expires_at);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_buckets TO service_role;

COMMENT ON TABLE public.rate_limit_buckets IS
  'Short-lived HMAC-hashed rate-limit buckets for cross-instance public API and Telegram throttling; service-role only.';
COMMENT ON COLUMN public.rate_limit_buckets.key_hash IS
  'HMAC-SHA256("rate-limit:" || scope || ":" || raw_key) computed with HASH_PEPPER_SECRET in server code.';
COMMENT ON COLUMN public.rate_limit_buckets.expires_at IS
  'Retention boundary for rate-limit buckets; safe to delete after this time.';

CREATE OR REPLACE FUNCTION public.claim_rate_limit(
  p_scope TEXT,
  p_key_hash TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  retry_after_sec INTEGER,
  current_count INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  now_ts TIMESTAMPTZ := now();
  bucket_start_time TIMESTAMPTZ;
  bucket_end_time TIMESTAMPTZ;
  observed_count INTEGER;
BEGIN
  IF p_scope NOT IN ('check', 'report', 'telegram_public_post') THEN
    RAISE EXCEPTION 'invalid rate-limit scope' USING ERRCODE = '22023';
  END IF;

  IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid rate-limit key hash' USING ERRCODE = '22023';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 10000 THEN
    RAISE EXCEPTION 'invalid rate-limit limit' USING ERRCODE = '22023';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate-limit window' USING ERRCODE = '22023';
  END IF;

  bucket_start_time := to_timestamp(
    floor(extract(epoch from now_ts) / p_window_seconds) * p_window_seconds
  );
  bucket_end_time := bucket_start_time + make_interval(secs => p_window_seconds);

  INSERT INTO public.rate_limit_buckets (
    scope,
    key_hash,
    bucket_start,
    window_seconds,
    count,
    expires_at
  )
  VALUES (
    p_scope,
    p_key_hash,
    bucket_start_time,
    p_window_seconds,
    1,
    bucket_end_time + interval '5 minutes'
  )
  ON CONFLICT (scope, key_hash, bucket_start)
  DO UPDATE SET
    count = public.rate_limit_buckets.count + 1,
    window_seconds = EXCLUDED.window_seconds,
    expires_at = GREATEST(public.rate_limit_buckets.expires_at, EXCLUDED.expires_at),
    updated_at = now_ts
  RETURNING public.rate_limit_buckets.count INTO observed_count;

  allowed := observed_count <= p_limit;
  remaining := GREATEST(p_limit - observed_count, 0);
  retry_after_sec := CASE
    WHEN allowed THEN 0
    ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (bucket_end_time - now_ts)))::INTEGER)
  END;
  current_count := observed_count;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.claim_rate_limit(TEXT, TEXT, INTEGER, INTEGER) IS
  'Atomically claims a short-lived shared rate-limit bucket; executable only by service_role.';

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
