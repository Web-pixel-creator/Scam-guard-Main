-- Allowlist of emails that may auto-become admin on signup
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_allowlist TO service_role;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
-- No public policies: only service_role / SQL can manage allowlist.

-- Replace the existing handle_new_user_role trigger function with an allowlist-based one.
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(coalesce(NEW.email, ''));
  v_is_allowed boolean := false;
BEGIN
  IF v_email <> '' THEN
    SELECT EXISTS (SELECT 1 FROM public.admin_allowlist WHERE lower(email) = v_email)
      INTO v_is_allowed;
  END IF;

  IF v_is_allowed THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
