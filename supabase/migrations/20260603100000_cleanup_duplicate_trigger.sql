-- Remove the old trigger name created by migration 3 (20260528184815).
-- Migration 5 (20260528190119) already created a replacement with the proper
-- name "on_auth_user_created_role". Both fire handle_new_user_role() which has
-- ON CONFLICT DO NOTHING, so no data corruption — but it's wasteful and confusing.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Also create the admin_actions audit log table for moderation transparency.
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,          -- 'confirm_report', 'reject_report', 'confirm_entity', etc.
  target_type TEXT NOT NULL,     -- 'report', 'entity'
  target_id UUID NOT NULL,       -- the report or entity id
  reason TEXT,                   -- optional moderator note
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON public.admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON public.admin_actions(target_type, target_id);

-- Only service_role and admins can read/write this table.
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.admin_actions TO service_role;
GRANT SELECT ON public.admin_actions TO authenticated;
CREATE POLICY "Admins can read audit log"
  ON public.admin_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role inserts audit entries"
  ON public.admin_actions FOR INSERT TO service_role
  WITH CHECK (true);
