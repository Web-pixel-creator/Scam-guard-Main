
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level') THEN
    CREATE TYPE public.risk_level AS ENUM ('safe','unknown','suspicious','high_risk');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'input_type') THEN
    CREATE TYPE public.input_type AS ENUM ('phone','telegram','url','text','payment','apk','unknown');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE public.report_status AS ENUM ('new','reviewing','confirmed','rejected','duplicate');
  END IF;
END $$;

CREATE TABLE public.checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_type public.input_type NOT NULL,
  redacted_input TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  risk_level public.risk_level NOT NULL,
  risk_score INT NOT NULL DEFAULT 0,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  ai_explanation TEXT,
  language TEXT NOT NULL DEFAULT 'ru',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checks_hash ON public.checks(input_hash);
CREATE INDEX idx_checks_created ON public.checks(created_at DESC);
GRANT SELECT, INSERT ON public.checks TO anon, authenticated;
GRANT ALL ON public.checks TO service_role;
ALTER TABLE public.checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert checks"
  ON public.checks FOR INSERT TO anon, authenticated
  WITH CHECK (length(redacted_input) BETWEEN 1 AND 2000 AND (array_length(reason_codes, 1) IS NULL OR array_length(reason_codes, 1) <= 30));

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.input_type NOT NULL,
  redacted_value TEXT NOT NULL,
  entity_hash TEXT NOT NULL,
  description TEXT NOT NULL,
  screenshot_url TEXT,
  scam_type TEXT,
  city TEXT,
  amount_lost_uzs BIGINT,
  status public.report_status NOT NULL DEFAULT 'new',
  language TEXT NOT NULL DEFAULT 'ru',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_hash ON public.reports(entity_hash);
CREATE INDEX idx_reports_status ON public.reports(status);
GRANT INSERT ON public.reports TO anon, authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit reports"
  ON public.reports FOR INSERT TO anon, authenticated
  WITH CHECK (length(description) BETWEEN 5 AND 5000 AND length(redacted_value) <= 500);

CREATE TABLE public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.input_type NOT NULL,
  entity_hash TEXT NOT NULL UNIQUE,
  display_mask TEXT NOT NULL,
  risk_level public.risk_level NOT NULL DEFAULT 'suspicious',
  report_count INT NOT NULL DEFAULT 0,
  moderation_status public.report_status NOT NULL DEFAULT 'new',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_entities_type ON public.entities(entity_type);
GRANT SELECT ON public.entities TO anon, authenticated;
GRANT ALL ON public.entities TO service_role;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read confirmed entities"
  ON public.entities FOR SELECT TO anon, authenticated
  USING (moderation_status = 'confirmed');

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END $$;
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE TABLE public.admin_allowlist (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_allowlist TO service_role;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nobody can read allowlist"
  ON public.admin_allowlist FOR SELECT TO authenticated, anon USING (false);

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(coalesce(NEW.email, ''));
  v_is_allowed boolean := false;
BEGIN
  IF v_email <> '' THEN
    SELECT EXISTS (SELECT 1 FROM public.admin_allowlist WHERE lower(email) = v_email) INTO v_is_allowed;
  END IF;
  IF v_is_allowed THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

CREATE POLICY "Admins read reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update reports" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read entities" ON public.entities FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update entities" ON public.entities FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read checks" ON public.checks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
