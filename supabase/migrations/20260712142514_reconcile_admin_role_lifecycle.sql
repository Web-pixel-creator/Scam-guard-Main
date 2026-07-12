-- Keep the durable admin role synchronized with the current source of truth:
-- the Auth user must have a confirmed email that is still allowlisted.

-- Fail safely instead of waiting indefinitely for trigger/table DDL locks.
SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION private.reconcile_admin_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_eligible boolean := false;
BEGIN
  -- Serialize every eligibility transition for the same Auth user.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  SELECT EXISTS (
    SELECT 1
    FROM auth.users AS au
    JOIN public.admin_allowlist AS al
      ON pg_catalog.lower(pg_catalog.btrim(al.email)) =
        pg_catalog.lower(pg_catalog.btrim(coalesce(au.email, '')))
    WHERE au.id = p_user_id
      AND au.email_confirmed_at IS NOT NULL
  )
  INTO v_is_eligible;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'user'::public.app_role)
  ON CONFLICT DO NOTHING;

  IF v_is_eligible THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = 'admin'::public.app_role;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.reconcile_admin_role(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.reconcile_admin_role(uuid) IS
  'Internal trigger helper: exact projection of confirmed admin allowlist eligibility.';

-- Preserve the established trigger-function names while making both positive
-- and negative Auth transitions use the same exact-projection reconciler.
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.reconcile_admin_role(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_confirmed_admin_allowlist_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.reconcile_admin_role(NEW.id);
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
  OLD.email IS DISTINCT FROM NEW.email
  OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at
)
EXECUTE FUNCTION public.handle_confirmed_admin_allowlist_role();

REVOKE ALL ON FUNCTION public.handle_new_user_role()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_confirmed_admin_allowlist_role()
  FROM PUBLIC, anon, authenticated, service_role;

-- An allowlist INSERT/UPDATE/DELETE is itself an entitlement transition. Find
-- every Auth user affected by the old/new normalized email and reconcile it in
-- the same transaction as the allowlist change.
CREATE OR REPLACE FUNCTION private.handle_admin_allowlist_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    FOR v_user_id IN
      SELECT au.id
      FROM auth.users AS au
      WHERE pg_catalog.lower(pg_catalog.btrim(coalesce(au.email, ''))) =
        pg_catalog.lower(pg_catalog.btrim(coalesce(OLD.email, '')))
    LOOP
      PERFORM private.reconcile_admin_role(v_user_id);
    END LOOP;
  END IF;

  IF TG_OP = 'INSERT' THEN
    FOR v_user_id IN
      SELECT au.id
      FROM auth.users AS au
      WHERE pg_catalog.lower(pg_catalog.btrim(coalesce(au.email, ''))) =
        pg_catalog.lower(pg_catalog.btrim(coalesce(NEW.email, '')))
    LOOP
      PERFORM private.reconcile_admin_role(v_user_id);
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    IF pg_catalog.lower(pg_catalog.btrim(coalesce(OLD.email, ''))) IS DISTINCT FROM
      pg_catalog.lower(pg_catalog.btrim(coalesce(NEW.email, '')))
    THEN
      FOR v_user_id IN
        SELECT au.id
        FROM auth.users AS au
        WHERE pg_catalog.lower(pg_catalog.btrim(coalesce(au.email, ''))) =
          pg_catalog.lower(pg_catalog.btrim(coalesce(NEW.email, '')))
      LOOP
        PERFORM private.reconcile_admin_role(v_user_id);
      END LOOP;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_admin_allowlist_role_change()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS on_admin_allowlist_role_change ON public.admin_allowlist;
CREATE TRIGGER on_admin_allowlist_role_change
AFTER INSERT OR UPDATE OF email OR DELETE ON public.admin_allowlist
FOR EACH ROW EXECUTE FUNCTION private.handle_admin_allowlist_role_change();

-- Repair pre-existing drift set-wise. Calling the runtime reconciler once per
-- Auth user would retain one advisory transaction lock per user until commit.
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'user'::public.app_role
FROM auth.users AS au
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin'::public.app_role
FROM auth.users AS au
JOIN public.admin_allowlist AS al
  ON pg_catalog.lower(pg_catalog.btrim(al.email)) =
    pg_catalog.lower(pg_catalog.btrim(coalesce(au.email, '')))
WHERE au.email_confirmed_at IS NOT NULL
ON CONFLICT DO NOTHING;

DELETE FROM public.user_roles AS ur
WHERE ur.role = 'admin'::public.app_role
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users AS au
    JOIN public.admin_allowlist AS al
      ON pg_catalog.lower(pg_catalog.btrim(al.email)) =
        pg_catalog.lower(pg_catalog.btrim(coalesce(au.email, '')))
    WHERE au.id = ur.user_id
      AND au.email_confirmed_at IS NOT NULL
  );
