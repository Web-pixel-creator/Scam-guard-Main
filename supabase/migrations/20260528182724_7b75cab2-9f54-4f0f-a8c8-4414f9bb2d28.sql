
-- Enums
CREATE TYPE public.risk_level AS ENUM ('safe','unknown','suspicious','high_risk');
CREATE TYPE public.input_type AS ENUM ('phone','telegram','url','text','payment','apk','unknown');
CREATE TYPE public.report_status AS ENUM ('new','reviewing','confirmed','rejected','duplicate');

-- checks: log of every risk check
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
  WITH CHECK (true);
-- No SELECT policy for anon/authenticated => no read access (service_role bypasses RLS)

-- reports: user-submitted scam reports
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

-- entities: aggregated suspicious entities (publicly readable, server-managed)
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
