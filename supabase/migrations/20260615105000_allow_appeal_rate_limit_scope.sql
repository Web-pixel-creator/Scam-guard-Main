-- Allow reputation appeal submissions to use the shared cross-instance rate
-- limiter. The TypeScript layer already uses scope='appeal'; without this SQL
-- update the RPC falls back to local in-memory limits on production.

ALTER TABLE public.rate_limit_buckets
  DROP CONSTRAINT IF EXISTS rate_limit_buckets_scope_check;

ALTER TABLE public.rate_limit_buckets
  ADD CONSTRAINT rate_limit_buckets_scope_check
  CHECK (scope IN ('check', 'report', 'telegram_public_post', 'appeal'));

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
  IF p_scope NOT IN ('check', 'report', 'telegram_public_post', 'appeal') THEN
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
