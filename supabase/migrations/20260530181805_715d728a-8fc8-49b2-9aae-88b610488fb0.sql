-- Public-safe stats RPC for the homepage counter.
-- The checks table is admin-only; this function exposes only aggregate counts.
CREATE OR REPLACE FUNCTION public.get_check_stats()
RETURNS TABLE(total bigint, today bigint, confirmed_entities bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.checks)::bigint AS total,
    (SELECT COUNT(*) FROM public.checks WHERE created_at >= date_trunc('day', now()))::bigint AS today,
    (SELECT COUNT(*) FROM public.entities WHERE moderation_status = 'confirmed')::bigint AS confirmed_entities;
$$;

GRANT EXECUTE ON FUNCTION public.get_check_stats() TO anon, authenticated;