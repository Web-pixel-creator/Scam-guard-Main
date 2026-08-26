-- Versioned recovery for application-owned hooks on Supabase-managed schemas.
-- Supabase CLI logical schema dumps intentionally exclude auth/storage DDL.
-- Keep this file synchronized with the canonical migration definitions.

SET lock_timeout = '5s';

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed_role ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed_role
AFTER UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (
  OLD.email IS DISTINCT FROM NEW.email
  OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at
)
EXECUTE FUNCTION public.handle_confirmed_admin_allowlist_role();
