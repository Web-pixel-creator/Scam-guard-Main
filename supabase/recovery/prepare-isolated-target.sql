-- ONLY after the caller proves this is an empty, isolated Supabase-local target.
-- Never run on production or a populated database. A logical schema dump emits
-- grants present on the source, not every absent grant. Supabase-local public
-- defaults otherwise add anon/authenticated rights before that dump is replayed.
SET lock_timeout = '5s';
DO $recovery_target$
BEGIN
  IF current_user <> 'postgres' OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'private') AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
  ) THEN
    RAISE EXCEPTION 'recovery preparation requires empty isolated application schemas';
  END IF;
END $recovery_target$;

-- Only bootstrap application-schema defaults, not Auth/Storage defaults.
-- The exported ALTER DEFAULT PRIVILEGES statements replay after object creation.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
