-- telegram_sessions: per-user dialog state for the Telegram bot channel.
-- Server-only (service_role). No anon/authenticated access — holds no
-- public reputation data, only language + scenario step.
CREATE TABLE public.telegram_sessions (
  telegram_user_id BIGINT PRIMARY KEY,
  lang TEXT NOT NULL DEFAULT 'ru',
  scenario TEXT NOT NULL DEFAULT 'none',
  scenario_step INT NOT NULL DEFAULT 0,
  scenario_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_sessions_updated ON public.telegram_sessions(updated_at);

GRANT ALL ON public.telegram_sessions TO service_role;
ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated → RLS denies all non-service-role access.
CREATE POLICY "No public access to telegram_sessions"
  ON public.telegram_sessions FOR SELECT TO anon, authenticated USING (false);

-- Optional housekeeping: prune sessions idle for > 30 days.
CREATE OR REPLACE FUNCTION public.prune_telegram_sessions()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ DELETE FROM public.telegram_sessions WHERE updated_at < now() - interval '30 days'; $$;
REVOKE EXECUTE ON FUNCTION public.prune_telegram_sessions() FROM PUBLIC, anon, authenticated;
