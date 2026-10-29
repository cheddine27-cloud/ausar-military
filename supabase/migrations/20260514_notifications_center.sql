-- Q-Hudoor v2.5.2 - Super Admin notifications center
-- Safe additive migration: no attendance tables, functions, or flows are changed.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  actor_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'unread',
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_category_check CHECK (category IN ('security', 'attendance', 'subscription', 'report', 'system')),
  CONSTRAINT notifications_priority_check CHECK (priority IN ('high', 'medium', 'low', 'info')),
  CONSTRAINT notifications_status_check CHECK (status IN ('unread', 'read', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_institution_id
  ON public.notifications(institution_id);

CREATE INDEX IF NOT EXISTS idx_notifications_category_status
  ON public.notifications(category, status);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_notifications_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_notifications_updated_at ON public.notifications;
CREATE TRIGGER set_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_notifications_updated_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications super select all" ON public.notifications;
DROP POLICY IF EXISTS "notifications tenant select own" ON public.notifications;
DROP POLICY IF EXISTS "notifications super insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications super update" ON public.notifications;
DROP POLICY IF EXISTS "notifications super delete" ON public.notifications;

CREATE POLICY "notifications super select all" ON public.notifications
  FOR SELECT TO authenticated
  USING (private.is_super_admin());

CREATE POLICY "notifications tenant select own" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    institution_id IS NOT NULL
    AND private.can_access_institution(institution_id)
  );

CREATE POLICY "notifications super insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());

CREATE POLICY "notifications super update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

CREATE POLICY "notifications super delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (private.is_super_admin());
