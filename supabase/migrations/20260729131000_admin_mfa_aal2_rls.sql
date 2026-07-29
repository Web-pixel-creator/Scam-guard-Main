-- Enforce admin MFA at the database authorization boundary.
--
-- The application server already requires an AAL2 session before invoking
-- admin functions. These RLS policies apply the same requirement to direct
-- PostgREST access made with an authenticated admin JWT.
--
-- service_role keeps its normal RLS bypass. Existing public SELECT policies
-- for confirmed entities and confirmed Telegram reputation remain unchanged.
--
-- Read user_roles directly instead of nesting another private-schema helper. Later
-- hardening migrations intentionally revoke authenticated USAGE on the private
-- schema. RLS can invoke this stored helper by OID, but a SECURITY INVOKER SQL
-- body cannot resolve another private-schema function without that broader
-- schema grant.

CREATE OR REPLACE FUNCTION private.is_admin_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'::public.app_role
    )
    AND COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

REVOKE ALL ON FUNCTION private.is_admin_aal2()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin_aal2()
  TO authenticated, service_role;

COMMENT ON FUNCTION private.is_admin_aal2() IS
  'True only for the current authenticated admin when the JWT assurance level is aal2.';

DROP POLICY IF EXISTS "Admins read reports" ON public.reports;
CREATE POLICY "Admins read reports"
ON public.reports FOR SELECT TO authenticated
USING (private.is_admin_aal2());

DROP POLICY IF EXISTS "Admins update reports" ON public.reports;
CREATE POLICY "Admins update reports"
ON public.reports FOR UPDATE TO authenticated
USING (private.is_admin_aal2())
WITH CHECK (private.is_admin_aal2());

DROP POLICY IF EXISTS "Admins read entities" ON public.entities;
CREATE POLICY "Admins read entities"
ON public.entities FOR SELECT TO authenticated
USING (private.is_admin_aal2());

DROP POLICY IF EXISTS "Admins update entities" ON public.entities;
CREATE POLICY "Admins update entities"
ON public.entities FOR UPDATE TO authenticated
USING (private.is_admin_aal2())
WITH CHECK (private.is_admin_aal2());

DROP POLICY IF EXISTS "Admins read checks" ON public.checks;
CREATE POLICY "Admins read checks"
ON public.checks FOR SELECT TO authenticated
USING (private.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_actions;
CREATE POLICY "Admins can read audit log"
ON public.admin_actions FOR SELECT TO authenticated
USING (private.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can read telegram reputation"
  ON public.telegram_reputation_targets;
CREATE POLICY "Admins can read telegram reputation"
ON public.telegram_reputation_targets FOR SELECT TO authenticated
USING (private.is_admin_aal2());
