-- Reputation Appeals v1
--
-- Public reputation must have a correction/removal path before wider launch.
-- Privacy model:
-- - raw phone numbers, Telegram handles, URLs and contact details are not stored;
-- - target/contact hashes use the app HMAC pepper before insertion;
-- - display fields are masked/redacted and safe for admin triage only;
-- - no anon/authenticated direct table access; all writes go through server code.

CREATE TABLE IF NOT EXISTS public.reputation_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type public.input_type NOT NULL,
  target_hash TEXT NOT NULL,
  target_display TEXT NOT NULL,
  reason TEXT NOT NULL,
  contact_hash TEXT,
  contact_display TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'resolved', 'rejected')),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reputation_appeals_status_created
  ON public.reputation_appeals(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reputation_appeals_target
  ON public.reputation_appeals(target_type, target_hash);

ALTER TABLE public.reputation_appeals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reputation_appeals FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.reputation_appeals TO service_role;

DROP POLICY IF EXISTS "Service role manages reputation appeals"
  ON public.reputation_appeals;
CREATE POLICY "Service role manages reputation appeals"
  ON public.reputation_appeals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
