-- Family Shield v1: one trusted Telegram contact per protected user.
--
-- Privacy model:
-- - invite_code_hash is HMAC-SHA256("family_" || raw_token).
-- - raw invite tokens, checked messages, URLs, phone numbers, OCR text, codes,
--   screenshots, and report descriptions are never stored in this table.
-- - The table is private to server-side bot code via service_role.

CREATE TABLE IF NOT EXISTS public.telegram_family_shield (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_telegram_user_id BIGINT NOT NULL,
  trusted_telegram_user_id BIGINT,
  trusted_chat_id BIGINT,
  invite_code_hash TEXT NOT NULL UNIQUE CHECK (length(invite_code_hash) >= 64),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    trusted_telegram_user_id IS NULL
    OR trusted_telegram_user_id <> guardian_telegram_user_id
  ),
  CHECK (
    (status = 'pending' AND trusted_telegram_user_id IS NULL AND trusted_chat_id IS NULL AND accepted_at IS NULL AND revoked_at IS NULL)
    OR (status = 'active' AND trusted_telegram_user_id IS NOT NULL AND trusted_chat_id IS NOT NULL AND accepted_at IS NOT NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_family_one_open_link
  ON public.telegram_family_shield(guardian_telegram_user_id)
  WHERE status IN ('pending', 'active');

CREATE INDEX IF NOT EXISTS idx_telegram_family_invite_status
  ON public.telegram_family_shield(invite_code_hash, status);

CREATE INDEX IF NOT EXISTS idx_telegram_family_guardian_status
  ON public.telegram_family_shield(guardian_telegram_user_id, status);

CREATE INDEX IF NOT EXISTS idx_telegram_family_trusted_user
  ON public.telegram_family_shield(trusted_telegram_user_id)
  WHERE trusted_telegram_user_id IS NOT NULL;

ALTER TABLE public.telegram_family_shield ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.telegram_family_shield FROM anon, authenticated;
GRANT ALL ON public.telegram_family_shield TO service_role;
