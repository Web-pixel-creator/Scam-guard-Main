-- Admin allowlist must not grant admin until Supabase has verified mailbox ownership.
-- The signup trigger may fire before email confirmation, so INSERT creates a
-- baseline user role and a separate UPDATE trigger grants admin after
-- email_confirmed_at becomes non-null for an allowlisted email.

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(coalesce(NEW.email, ''));
  v_is_verified_allowlisted boolean := false;
BEGIN
  IF v_email <> '' AND NEW.email_confirmed_at IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.admin_allowlist
      WHERE lower(email) = v_email
    )
      INTO v_is_verified_allowlisted;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN v_is_verified_allowlisted THEN 'admin'::public.app_role
      ELSE 'user'::public.app_role
    END
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_confirmed_admin_allowlist_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(coalesce(NEW.email, ''));
  v_is_allowlisted boolean := false;
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  IF v_email = '' OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.admin_allowlist
    WHERE lower(email) = v_email
  )
    INTO v_is_allowlisted;

  IF v_is_allowlisted THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed_role ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed_role
AFTER UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (
  NEW.email_confirmed_at IS NOT NULL
  AND (
    OLD.email IS DISTINCT FROM NEW.email
    OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at
  )
)
EXECUTE FUNCTION public.handle_confirmed_admin_allowlist_role();

-- Remove admin roles that the previous signup trigger may have granted before
-- the allowlisted mailbox was verified. Keep or create the baseline user role.
WITH downgraded AS (
  DELETE FROM public.user_roles AS ur
  USING auth.users AS au
  WHERE ur.user_id = au.id
    AND ur.role = 'admin'
    AND au.email_confirmed_at IS NULL
    AND lower(coalesce(au.email, '')) IN (
      SELECT lower(email)
      FROM public.admin_allowlist
    )
  RETURNING ur.user_id
)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'user'::public.app_role
FROM downgraded
ON CONFLICT DO NOTHING;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_confirmed_admin_allowlist_role() FROM PUBLIC, anon, authenticated;
