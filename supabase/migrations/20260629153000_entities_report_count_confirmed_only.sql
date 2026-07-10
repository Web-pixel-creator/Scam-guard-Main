-- Public entity report_count must count only moderated confirmed reports.
-- Unmoderated report submissions are stored as reports/candidates, but they
-- must not inflate public reputation counts on already confirmed entities.

UPDATE public.entities AS entity
SET report_count = counts.confirmed_count
FROM (
  SELECT
    entity_inner.id,
    COUNT(report.id)::int AS confirmed_count
  FROM public.entities AS entity_inner
  LEFT JOIN public.reports AS report
    ON report.entity_hash = entity_inner.entity_hash
   AND report.status = 'confirmed'
  GROUP BY entity_inner.id
) AS counts
WHERE entity.id = counts.id
  AND entity.report_count IS DISTINCT FROM counts.confirmed_count;

COMMENT ON COLUMN public.entities.report_count IS
  'Number of moderated confirmed reports for this entity; unmoderated submissions do not increment this public count.';
