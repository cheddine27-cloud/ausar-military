-- Q-Hudoor v2.5.6 - Super Admin activity log center
-- Safe additive migration: no attendance tables, functions, or registration flow are changed.

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT UNIQUE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  actor_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  outcome_status TEXT NOT NULL DEFAULT 'success',
  review_status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'info',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT activity_logs_category_check CHECK (category IN ('attendance', 'security', 'subscription', 'report', 'user', 'institution', 'system')),
  CONSTRAINT activity_logs_outcome_status_check CHECK (outcome_status IN ('success', 'warning', 'rejected', 'pending')),
  CONSTRAINT activity_logs_review_status_check CHECK (review_status IN ('open', 'reviewed', 'archived')),
  CONSTRAINT activity_logs_priority_check CHECK (priority IN ('high', 'medium', 'low', 'info'))
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_institution_id
  ON public.activity_logs(institution_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_category_created_at
  ON public.activity_logs(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_review_status
  ON public.activity_logs(review_status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_activity_logs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_activity_logs_updated_at ON public.activity_logs;
CREATE TRIGGER set_activity_logs_updated_at
BEFORE UPDATE ON public.activity_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_activity_logs_updated_at();

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs super select all" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs tenant select own" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs super insert" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs super update" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs super delete" ON public.activity_logs;

CREATE POLICY "activity_logs super select all" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (private.is_super_admin());

CREATE POLICY "activity_logs tenant select own" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    institution_id IS NOT NULL
    AND private.can_access_institution(institution_id)
  );

CREATE POLICY "activity_logs super insert" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());

CREATE POLICY "activity_logs super update" ON public.activity_logs
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

CREATE POLICY "activity_logs super delete" ON public.activity_logs
  FOR DELETE TO authenticated
  USING (private.is_super_admin());
