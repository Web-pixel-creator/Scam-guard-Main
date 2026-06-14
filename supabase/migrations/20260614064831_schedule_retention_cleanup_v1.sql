-- Schedule Retention Cleanup v1
--
-- Runs the existing privacy cleanup helper once per day through pg_cron.
-- Do not update cron.job directly; Supabase/Postgres requires cron.schedule /
-- cron.unschedule so extension-level safety checks run.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid
    INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'ishonch_prune_app_retention_daily'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'ishonch_prune_app_retention_daily',
    '17 20 * * *',
    'SELECT private.prune_app_retention();'
  );
END;
$$;

COMMENT ON EXTENSION pg_cron IS
  'Schedules Ishonch Guard retention cleanup via cron.schedule; do not edit cron.job directly.';
