-- One provider attempt per server-issued, signed Web OCR operation ticket.
-- This is not image deduplication, proof of a human click or result recovery.
-- Issued/expiry times are immutable epoch milliseconds; no image, digest, IP,
-- session identity, OCR text, provider result or signature is stored here.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE private.web_ocr_ticket_claims (
  ticket_id UUID PRIMARY KEY CHECK (ticket_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  issued_at_ms BIGINT NOT NULL CHECK (issued_at_ms BETWEEN 0 AND 9007199254140991),
  expires_at_ms BIGINT NOT NULL CHECK (expires_at_ms BETWEEN 600000 AND 9007199254740991),
  CONSTRAINT web_ocr_ticket_exact_lifetime CHECK (expires_at_ms = issued_at_ms + 600000)
);

CREATE INDEX web_ocr_ticket_claims_expiry_idx
  ON private.web_ocr_ticket_claims (expires_at_ms);

ALTER TABLE private.web_ocr_ticket_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.web_ocr_ticket_claims FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT, INSERT ON TABLE private.web_ocr_ticket_claims TO service_role;

CREATE OR REPLACE FUNCTION public.claim_web_ocr_ticket(
  p_ticket_id UUID,
  p_issued_at_ms BIGINT,
  p_expires_at_ms BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_now_ms BIGINT;
  v_inserted INTEGER;
BEGIN
  -- Validate bounds separately before arithmetic, including malicious BIGINT
  -- extremes. The server alone verifies signature, purpose, language and digest.
  IF p_ticket_id IS NULL
     OR p_ticket_id = '00000000-0000-0000-0000-000000000000'::uuid
     OR p_issued_at_ms IS NULL OR p_expires_at_ms IS NULL
     OR p_issued_at_ms NOT BETWEEN 0 AND 9007199254140991
     OR p_expires_at_ms NOT BETWEEN 600000 AND 9007199254740991 THEN
    RETURN false;
  END IF;
  IF p_expires_at_ms <> p_issued_at_ms + 600000 THEN
    RETURN false;
  END IF;

  v_now_ms := pg_catalog.floor(EXTRACT(epoch FROM pg_catalog.clock_timestamp()) * 1000)::BIGINT;
  -- No future-issued grace. Clock skew can reject a ticket, never extend it.
  IF p_issued_at_ms > v_now_ms OR p_expires_at_ms <= v_now_ms THEN
    RETURN false;
  END IF;

  INSERT INTO private.web_ocr_ticket_claims (ticket_id, issued_at_ms, expires_at_ms)
  VALUES (p_ticket_id, p_issued_at_ms, p_expires_at_ms)
  ON CONFLICT (ticket_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> 1 THEN
    RETURN false;
  END IF;

  -- The unique-key insert can wait. Never admit using pre-wait time or now(),
  -- which is transaction-start time. A late insertion stays burned until prune
  -- but returns false; the service role cannot delete/update it to retry.
  v_now_ms := pg_catalog.floor(EXTRACT(epoch FROM pg_catalog.clock_timestamp()) * 1000)::BIGINT;
  RETURN p_issued_at_ms <= v_now_ms AND p_expires_at_ms > v_now_ms;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_web_ocr_ticket(UUID, BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_web_ocr_ticket(UUID, BIGINT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION private.prune_web_ocr_ticket_claims()
RETURNS BIGINT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_now_ms BIGINT;
  v_deleted BIGINT;
BEGIN
  -- Deliberately no caller cutoff: a future as_of could remove a live tombstone
  -- and re-enable a still-valid signed ticket. Expiry is checked even if absent.
  v_now_ms := pg_catalog.floor(EXTRACT(epoch FROM pg_catalog.clock_timestamp()) * 1000)::BIGINT;
  DELETE FROM private.web_ocr_ticket_claims WHERE expires_at_ms <= v_now_ms;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION private.prune_web_ocr_ticket_claims() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.prune_web_ocr_ticket_claims() TO service_role;

COMMENT ON TABLE private.web_ocr_ticket_claims IS
  'Metadata-only one-shot Web OCR ticket tombstones. UUID identity survives signing-key changes; no media, digest, IP, signature or result storage.';
COMMENT ON FUNCTION public.claim_web_ocr_ticket(UUID, BIGINT, BIGINT) IS
  'Service-only one-winner claim with exact 600000ms lifetime and DB-clock pre/post-wait checks. Expiry bounds admission, not remote processing; uncertainty never authorizes a retry.';
COMMENT ON FUNCTION private.prune_web_ocr_ticket_claims() IS
  'Deletes only DB-clock-expired Web OCR ticket tombstones; no future caller cutoff. Technical replay-state expiry, not a legal retention policy.';

-- Existing deployments have pg_cron. Keep plain/test environments usable when
-- absent; no extension installation or existing retention-job rewrite here.
DO $schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron')
     AND pg_catalog.to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
    PERFORM cron.schedule(
      'ishonch_prune_web_ocr_ticket_claims_hourly',
      '23 * * * *',
      'SELECT private.prune_web_ocr_ticket_claims();'
    );
  ELSE
    RAISE NOTICE 'pg_cron unavailable: Web OCR ticket cleanup schedule not installed';
  END IF;
END;
$schedule$;

NOTIFY pgrst, 'reload schema';
