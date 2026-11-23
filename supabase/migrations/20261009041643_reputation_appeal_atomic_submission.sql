-- Apply before deploying the RPC caller. Old direct INSERT callers must be
-- drained before claiming duplicate/notification suppression. This protocol
-- preserves distinct redacted evidence; it is not a global anti-Sybil budget.
CREATE OR REPLACE FUNCTION public.submit_reputation_appeal(
  p_target_type public.input_type,
  p_target_hashes jsonb,
  p_target_display text,
  p_reason text,
  p_contact_hashes jsonb,
  p_contact_display text
)
RETURNS TABLE (accepted boolean, notify_moderation boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_candidates jsonb;
  v_candidate jsonb;
  v_lock_key bigint;
  v_open_hash text;
  v_open_version text;
  v_entity_hash text;
  v_entity_version text;
  v_telegram_hash text;
  v_telegram_version text;
  v_inserted integer;
BEGIN
  -- A waiting writer must see the preceding writer's committed rows in its
  -- following statements. REPEATABLE READ/SERIALIZABLE snapshots cannot give
  -- that guarantee for this advisory-lock protocol.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING ERRCODE = '25001', MESSAGE = 'appeal_isolation_unsupported';
  END IF;

  IF p_target_type IS NULL OR p_target_type NOT IN ('phone', 'telegram', 'url', 'apk')
     OR p_target_display IS NULL
     OR pg_catalog.length(p_target_display) NOT BETWEEN 1 AND 500
     OR pg_catalog.btrim(p_target_display) = ''
     OR p_reason IS NULL
     OR pg_catalog.length(p_reason) NOT BETWEEN 1 AND 4000
     OR pg_catalog.btrim(p_reason) = ''
     OR p_target_hashes IS NULL
     OR pg_catalog.jsonb_typeof(p_target_hashes) <> 'array'
     OR p_contact_hashes IS NULL
     OR pg_catalog.jsonb_typeof(p_contact_hashes) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'appeal_invalid_payload';
  END IF;
  IF pg_catalog.jsonb_array_length(p_target_hashes) NOT BETWEEN 1 AND 3
     OR pg_catalog.jsonb_array_length(p_contact_hashes) NOT BETWEEN 0 AND 3
     OR (pg_catalog.jsonb_array_length(p_contact_hashes) = 0 AND p_contact_display IS NOT NULL)
     OR (pg_catalog.jsonb_array_length(p_contact_hashes) > 0 AND
         (p_contact_display IS NULL OR pg_catalog.length(p_contact_display) NOT BETWEEN 1 AND 160
          OR pg_catalog.btrim(p_contact_display) = '')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'appeal_invalid_payload';
  END IF;

  -- No raw identifiers enter this service-only API. Each alias is an exact
  -- HMAC/version pair, active first; additional arbitrary fields are rejected.
  FOREACH v_candidates IN ARRAY ARRAY[p_target_hashes, p_contact_hashes] LOOP
    FOR v_candidate IN SELECT value FROM pg_catalog.jsonb_array_elements(v_candidates) LOOP
      IF pg_catalog.jsonb_typeof(v_candidate) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'appeal_invalid_payload';
      END IF;
      IF (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_candidate)) <> 2
         OR pg_catalog.jsonb_typeof(v_candidate -> 'hash') IS DISTINCT FROM 'string'
         OR pg_catalog.jsonb_typeof(v_candidate -> 'version') IS DISTINCT FROM 'string'
         OR (v_candidate ->> 'hash') !~ '^[0-9a-f]{64}$'
         OR (v_candidate ->> 'version') !~ '^[a-z][a-z0-9_]{0,15}$' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'appeal_invalid_payload';
      END IF;
    END LOOP;
    IF (SELECT pg_catalog.count(DISTINCT value ->> 'hash') FROM pg_catalog.jsonb_array_elements(v_candidates))
         <> pg_catalog.jsonb_array_length(v_candidates)
       OR (SELECT pg_catalog.count(DISTINCT value ->> 'version') FROM pg_catalog.jsonb_array_elements(v_candidates))
         <> pg_catalog.jsonb_array_length(v_candidates) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'appeal_invalid_payload';
    END IF;
  END LOOP;

  -- Lock every configured alias, not only the active pepper. Sorted derived
  -- keys avoid opposite-order deadlocks, even if two lock hashes collide.
  -- Live writers must have the same complete alias set. Rotate only after
  -- quiescing old writers and retain prior aliases for stored-row discovery:
  -- a shared lock alone cannot make a new-active row readable by an old writer.
  FOR v_lock_key IN
    SELECT DISTINCT pg_catalog.hashtextextended(
      'ishonch:appeal-submission:v1:' || p_target_type::text || ':' || (value ->> 'hash'), 0
    ) AS lock_key
    FROM pg_catalog.jsonb_array_elements(p_target_hashes)
    ORDER BY lock_key
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);
  END LOOP;

  -- Always issue the same three lookups over all aliases. There is no
  -- application-visible early exit based on existence or moderation state.
  -- This removes that coarse round-trip oracle, not all physical DB timing.
  SELECT a.target_hash, a.target_hash_version INTO v_open_hash, v_open_version
  FROM public.reputation_appeals AS a
  JOIN pg_catalog.jsonb_array_elements(p_target_hashes) WITH ORDINALITY AS c(value, ordinal)
    ON a.target_hash = c.value ->> 'hash' AND a.target_hash_version = c.value ->> 'version'
  WHERE a.target_type = p_target_type AND a.status IN ('new', 'reviewing')
  ORDER BY CASE WHEN c.ordinal = 1 THEN 4 ELSE c.ordinal END, a.created_at, a.id
  LIMIT 1
  FOR UPDATE OF a;

  SELECT e.entity_hash, e.entity_hash_version INTO v_entity_hash, v_entity_version
  FROM public.entities AS e
  JOIN pg_catalog.jsonb_array_elements(p_target_hashes) WITH ORDINALITY AS c(value, ordinal)
    ON e.entity_hash = c.value ->> 'hash' AND e.entity_hash_version = c.value ->> 'version'
  WHERE e.entity_type = p_target_type
  ORDER BY CASE WHEN c.ordinal = 1 THEN 4 ELSE c.ordinal END, e.created_at, e.id
  LIMIT 1;

  SELECT t.target_hash, t.target_hash_version INTO v_telegram_hash, v_telegram_version
  FROM public.telegram_reputation_targets AS t
  JOIN pg_catalog.jsonb_array_elements(p_target_hashes) WITH ORDINALITY AS c(value, ordinal)
    ON t.target_hash = c.value ->> 'hash' AND t.target_hash_version = c.value ->> 'version'
  WHERE p_target_type = 'telegram'
  ORDER BY CASE WHEN c.ordinal = 1 THEN 4 ELSE c.ordinal END, t.created_at, t.id
  LIMIT 1;

  INSERT INTO public.reputation_appeals (
    target_type, target_hash, target_hash_version, target_display, reason,
    contact_hash, contact_hash_version, contact_display
  )
  SELECT p_target_type,
    COALESCE(v_open_hash, v_entity_hash, v_telegram_hash, p_target_hashes -> 0 ->> 'hash'),
    COALESCE(v_open_version, v_entity_version, v_telegram_version, p_target_hashes -> 0 ->> 'version'),
    p_target_display, p_reason,
    p_contact_hashes -> 0 ->> 'hash', p_contact_hashes -> 0 ->> 'version', p_contact_display
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reputation_appeals AS a
    JOIN pg_catalog.jsonb_array_elements(p_target_hashes) AS target(value)
      ON a.target_hash = target.value ->> 'hash' AND a.target_hash_version = target.value ->> 'version'
    WHERE a.target_type = p_target_type AND a.status IN ('new', 'reviewing')
      AND a.reason = p_reason
      AND (
        (pg_catalog.jsonb_array_length(p_contact_hashes) = 0 AND a.contact_hash IS NULL AND a.contact_hash_version IS NULL)
        OR EXISTS (
          SELECT 1 FROM pg_catalog.jsonb_array_elements(p_contact_hashes) AS contact(value)
          WHERE a.contact_hash = contact.value ->> 'hash' AND a.contact_hash_version = contact.value ->> 'version'
        )
      )
  );
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Only the first new row of an open-target episode gets a best-effort alert.
  -- Every distinct reason/contact remains a separate row for admin review.
  -- The server must never return notify_moderation to the public caller.
  RETURN QUERY SELECT true, v_inserted = 1 AND v_open_hash IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_reputation_appeal(public.input_type, jsonb, text, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_reputation_appeal(public.input_type, jsonb, text, text, jsonb, text)
  TO service_role;

COMMENT ON FUNCTION public.submit_reputation_appeal(public.input_type, jsonb, text, text, jsonb, text) IS
  'Service-only atomic open-appeal evidence deduplication; masked/redacted inputs only. Internal notification eligibility is not public status. Requires READ COMMITTED and migration-first caller cutover.';
