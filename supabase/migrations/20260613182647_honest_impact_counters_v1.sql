-- Honest Impact Counters v1
--
-- Keep the public website stats aggregate-only. The web app calls this function
-- through a TanStack server function using the service-role client; anon and
-- authenticated clients cannot call it directly.

DROP FUNCTION IF EXISTS public.get_check_stats();

CREATE OR REPLACE FUNCTION public.get_check_stats()
RETURNS TABLE(
  total bigint,
  today bigint,
  confirmed_entities bigint,
  high_risk bigint,
  suspicious bigint,
  dangerous bigint,
  reports_total bigint,
  reports_with_loss_amount bigint,
  reported_loss_uzs bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.checks)::bigint AS total,
    (SELECT COUNT(*) FROM public.checks WHERE created_at >= date_trunc('day', now()))::bigint AS today,
    (SELECT COUNT(*) FROM public.entities WHERE moderation_status = 'confirmed')::bigint AS confirmed_entities,
    (SELECT COUNT(*) FROM public.checks WHERE risk_level = 'high_risk')::bigint AS high_risk,
    (SELECT COUNT(*) FROM public.checks WHERE risk_level = 'suspicious')::bigint AS suspicious,
    (SELECT COUNT(*) FROM public.checks WHERE risk_level IN ('suspicious', 'high_risk'))::bigint AS dangerous,
    (SELECT COUNT(*) FROM public.reports)::bigint AS reports_total,
    (SELECT COUNT(*) FROM public.reports WHERE amount_lost_uzs > 0)::bigint AS reports_with_loss_amount,
    COALESCE((SELECT SUM(amount_lost_uzs) FROM public.reports WHERE amount_lost_uzs > 0), 0)::bigint AS reported_loss_uzs;
$$;

REVOKE ALL ON FUNCTION public.get_check_stats()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_check_stats()
  TO service_role;

COMMENT ON FUNCTION public.get_check_stats() IS
  'Service-role-only aggregate stats RPC for public website counters. Returns aggregate counts and user-reported loss total only.';
