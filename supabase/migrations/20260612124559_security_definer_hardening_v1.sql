-- Security Definer Hardening v1
--
-- Supabase advisors correctly flag SECURITY DEFINER functions callable from the
-- public API surface. Keep privileged helpers private/service-role-only while
-- preserving admin RLS behavior.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Private helper for admin RLS policies. It is SECURITY INVOKER on purpose:
-- authenticated users can only see their own user_roles row via RLS, which is
-- enough for "am I an admin?" checks and avoids advisor-visible definer grants.
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role)
  TO authenticated, service_role;

COMMENT ON FUNCTION private.has_role(uuid, public.app_role) IS
  'Private admin RLS helper. Uses user_roles RLS instead of SECURITY DEFINER.';

DROP POLICY IF EXISTS "Admins read reports" ON public.reports;
CREATE POLICY "Admins read reports"
ON public.reports FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update reports" ON public.reports;
CREATE POLICY "Admins update reports"
ON public.reports FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read entities" ON public.entities;
CREATE POLICY "Admins read entities"
ON public.entities FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update entities" ON public.entities;
CREATE POLICY "Admins update entities"
ON public.entities FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read checks" ON public.checks;
CREATE POLICY "Admins read checks"
ON public.checks FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_actions;
CREATE POLICY "Admins can read audit log"
ON public.admin_actions FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read telegram reputation" ON public.telegram_reputation_targets;
CREATE POLICY "Admins can read telegram reputation"
ON public.telegram_reputation_targets FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

-- Keep the public helper for backwards compatibility with older SQL notes, but
-- remove public/authenticated EXECUTE so it cannot be called as a public RPC.
-- Recreate it as invoker to remove public-schema SECURITY DEFINER surface.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO service_role;

-- Homepage stats are now fetched through a TanStack server function using the
-- service-role client. The RPC no longer needs to be public or SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_check_stats()
RETURNS TABLE(total bigint, today bigint, confirmed_entities bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.checks)::bigint AS total,
    (SELECT COUNT(*) FROM public.checks WHERE created_at >= date_trunc('day', now()))::bigint AS today,
    (SELECT COUNT(*) FROM public.entities WHERE moderation_status = 'confirmed')::bigint AS confirmed_entities;
$$;

REVOKE ALL ON FUNCTION public.get_check_stats()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_check_stats()
  TO service_role;

COMMENT ON FUNCTION public.get_check_stats() IS
  'Service-role-only aggregate stats RPC used by the web server function; not callable by anon/authenticated clients.';
