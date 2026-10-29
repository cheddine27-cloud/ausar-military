-- =====================================================================
-- Q-Hudoor v3.9.0 — Enterprise Administrative Decision & Task Center
-- =====================================================================

-- 1. Administrative Decisions Table
CREATE TABLE IF NOT EXISTS public.administrative_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text NOT NULL,
  priority        text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'archived')),
  category        text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'discipline', 'attendance', 'justification', 'incident', 'staff')),
  reference_type  text, -- e.g., 'attendances', 'daily_incidents'
  reference_id    uuid,
  created_by      uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  assigned_to     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  due_date        date,
  completed_at    timestamptz,
  closed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisions_institution ON public.administrative_decisions (institution_id);
CREATE INDEX IF NOT EXISTS idx_decisions_reference ON public.administrative_decisions (reference_type, reference_id);

ALTER TABLE public.administrative_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decisions select tenant" ON public.administrative_decisions FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));
CREATE POLICY "decisions write tenant" ON public.administrative_decisions FOR ALL TO authenticated USING (private.can_access_institution(institution_id)) WITH CHECK (private.can_access_institution(institution_id));

-- 2. Decision Tasks Checklist Table
CREATE TABLE IF NOT EXISTS public.decision_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id     uuid NOT NULL REFERENCES public.administrative_decisions(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  assigned_to     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'delayed', 'cancelled')),
  due_date        date,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks select tenant" ON public.decision_tasks FOR SELECT TO authenticated USING (exists (select 1 from public.administrative_decisions d where d.id = decision_id));
CREATE POLICY "tasks write tenant" ON public.decision_tasks FOR ALL TO authenticated USING (exists (select 1 from public.administrative_decisions d where d.id = decision_id)) WITH CHECK (exists (select 1 from public.administrative_decisions d where d.id = decision_id));

-- 3. Decision Comments Table
CREATE TABLE IF NOT EXISTS public.decision_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id     uuid NOT NULL REFERENCES public.administrative_decisions(id) ON DELETE CASCADE,
  commenter_id    uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments select tenant" ON public.decision_comments FOR SELECT TO authenticated USING (exists (select 1 from public.administrative_decisions d where d.id = decision_id));
CREATE POLICY "comments write tenant" ON public.decision_comments FOR ALL TO authenticated USING (exists (select 1 from public.administrative_decisions d where d.id = decision_id)) WITH CHECK (exists (select 1 from public.administrative_decisions d where d.id = decision_id));

-- 4. Decision History logs Table
CREATE TABLE IF NOT EXISTS public.decision_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id     uuid NOT NULL REFERENCES public.administrative_decisions(id) ON DELETE CASCADE,
  actor_id        uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  action_type     text NOT NULL,
  remarks         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history select tenant" ON public.decision_history FOR SELECT TO authenticated USING (exists (select 1 from public.administrative_decisions d where d.id = decision_id));
CREATE POLICY "history write tenant" ON public.decision_history FOR ALL TO authenticated USING (exists (select 1 from public.administrative_decisions d where d.id = decision_id)) WITH CHECK (exists (select 1 from public.administrative_decisions d where d.id = decision_id));

-- 5. Seed Permissions Catalog
INSERT INTO public.permission_catalog (permission_key, category, description)
VALUES
  ('decision.read',     'decision_center', 'View administrative decisions'),
  ('decision.create',   'decision_center', 'Create new administrative decisions'),
  ('decision.update',   'decision_center', 'Update decisions and task status'),
  ('decision.assign',   'decision_center', 'Assign employees to decisions and tasks'),
  ('decision.close',    'decision_center', 'Complete and close administrative decisions'),
  ('decision.archive',  'decision_center', 'Archive closed decisions'),
  ('decision.export',   'decision_center', 'Export decisions report data')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permission_defaults (role, permission_key, allowed)
VALUES
  ('institution_admin', 'decision.read',     true),
  ('institution_admin', 'decision.create',   true),
  ('institution_admin', 'decision.update',   true),
  ('institution_admin', 'decision.assign',   true),
  ('institution_admin', 'decision.close',    true),
  ('institution_admin', 'decision.archive',  true),
  ('institution_admin', 'decision.export',   true),

  ('manager', 'decision.read',     true),
  ('manager', 'decision.update',   true),
  ('manager', 'decision.assign',   true),

  ('teacher', 'decision.read',     true),
  
  ('viewer',  'decision.read',     true)
ON CONFLICT (role, permission_key) DO NOTHING;
