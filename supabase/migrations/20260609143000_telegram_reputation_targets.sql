-- DB-backed Telegram reputation targets.
--
-- Privacy model:
-- - target_hash is HMAC-SHA256 from the normalized Telegram target.
-- - display_hint is a masked, non-authoritative UI hint only.
-- - raw usernames, invite tokens, titles and descriptions are not stored here.
-- - unmoderated reports are counted for admin review only and must not affect
--   public risk or user-facing scam labels.

CREATE TABLE IF NOT EXISTS public.telegram_reputation_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_hash TEXT NOT NULL UNIQUE,
  target_type TEXT NOT NULL CHECK (
    target_type IN (
      'public_username',
      'public_channel',
      'public_group',
      'private_invite',
      'internal_or_private'
    )
  ),
  display_hint TEXT NOT NULL CHECK (length(display_hint) <= 120),
  source_type TEXT NOT NULL DEFAULT 'system_observed' CHECK (
    source_type IN (
      'system_observed',
      'telegram_public',
      'official',
      'moderated_report',
      'user_submitted_unverified'
    )
  ),
  confidence TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  risk_level public.risk_level NOT NULL DEFAULT 'unknown',
  moderation_status public.report_status NOT NULL DEFAULT 'new',
  unverified_report_count INT NOT NULL DEFAULT 0 CHECK (unverified_report_count >= 0),
  moderated_report_count INT NOT NULL DEFAULT 0 CHECK (moderated_report_count >= 0),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_reputation_type
  ON public.telegram_reputation_targets(target_type);
CREATE INDEX IF NOT EXISTS idx_telegram_reputation_status
  ON public.telegram_reputation_targets(moderation_status, risk_level);
CREATE INDEX IF NOT EXISTS idx_telegram_reputation_last_seen
  ON public.telegram_reputation_targets(last_seen_at DESC);

ALTER TABLE public.telegram_reputation_targets ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.telegram_reputation_targets TO anon, authenticated;
GRANT ALL ON public.telegram_reputation_targets TO service_role;

DROP POLICY IF EXISTS "Public can read confirmed telegram reputation" ON public.telegram_reputation_targets;
CREATE POLICY "Public can read confirmed telegram reputation"
  ON public.telegram_reputation_targets FOR SELECT TO anon, authenticated
  USING (
    moderation_status = 'confirmed'
    AND source_type IN ('official', 'moderated_report')
    AND moderated_report_count > 0
  );

DROP POLICY IF EXISTS "Admins can read telegram reputation" ON public.telegram_reputation_targets;
CREATE POLICY "Admins can read telegram reputation"
  ON public.telegram_reputation_targets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

