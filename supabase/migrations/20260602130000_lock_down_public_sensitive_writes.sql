-- Sensitive writes must go through server functions that validate, redact and
-- hash the payload before using the service-role client. Direct anon/auth writes
-- can pollute stats and bypass redaction, so remove them.

DROP POLICY IF EXISTS "Anyone can insert checks" ON public.checks;
DROP POLICY IF EXISTS "Anyone can submit reports" ON public.reports;

REVOKE INSERT ON public.checks FROM anon, authenticated;
REVOKE INSERT ON public.reports FROM anon, authenticated;

