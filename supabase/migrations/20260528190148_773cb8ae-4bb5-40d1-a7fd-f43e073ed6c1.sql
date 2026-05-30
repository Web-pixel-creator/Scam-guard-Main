-- admin_allowlist: explicit deny-all policy for non-service roles (RLS already enabled)
CREATE POLICY "Nobody can read allowlist"
  ON public.admin_allowlist FOR SELECT TO authenticated, anon USING (false);

-- Revoke EXECUTE on SECURITY DEFINER functions from public roles.
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- has_role must remain callable by authenticated (used inside RLS policy USING clauses
-- which run as the calling role) — keep authenticated EXECUTE.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
