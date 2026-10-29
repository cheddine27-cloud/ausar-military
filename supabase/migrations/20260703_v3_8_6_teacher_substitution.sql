-- =====================================================================
-- Q-Hudoor v3.8.6 — Enterprise Teacher Substitution & Coverage Center
-- =====================================================================

-- 1. Teacher Absence Requests
CREATE TABLE IF NOT EXISTS public.teacher_absence_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  teacher_id      uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  absence_type    text NOT NULL CHECK (absence_type IN ('sick', 'emergency', 'vacation', 'official')),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  reason          text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_absence_req_institution ON public.teacher_absence_requests (institution_id);
CREATE INDEX IF NOT EXISTS idx_absence_req_teacher ON public.teacher_absence_requests (teacher_id);

ALTER TABLE public.teacher_absence_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "absence_requests tenant select" ON public.teacher_absence_requests
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

CREATE POLICY "absence_requests tenant write" ON public.teacher_absence_requests
  FOR ALL TO authenticated
  USING (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()))
  WITH CHECK (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()));

-- 2. Teacher Substitutions
CREATE TABLE IF NOT EXISTS public.teacher_substitutions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  absence_request_id    uuid REFERENCES public.teacher_absence_requests(id) ON DELETE SET NULL,
  original_teacher_id   uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  substitute_teacher_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  subject_id            uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id              uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  timetable_entry_id    uuid REFERENCES public.timetable_entries(id) ON DELETE SET NULL,
  substitution_date     date NOT NULL,
  lesson_period         text,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_by            uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  approved_by           uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_substitutions_institution ON public.teacher_substitutions (institution_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_substitute ON public.teacher_substitutions (substitute_teacher_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_original ON public.teacher_substitutions (original_teacher_id);

ALTER TABLE public.teacher_substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "substitutions tenant select" ON public.teacher_substitutions
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

CREATE POLICY "substitutions tenant write" ON public.teacher_substitutions
  FOR ALL TO authenticated
  USING (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()))
  WITH CHECK (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()));

-- 3. Substitution History
CREATE TABLE IF NOT EXISTS public.substitution_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  substitution_id uuid NOT NULL REFERENCES public.teacher_substitutions(id) ON DELETE CASCADE,
  old_teacher     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  new_teacher     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  action          text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.substitution_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_history tenant select" ON public.substitution_history
  FOR SELECT TO authenticated USING (true);

-- 4. Triggers
DROP TRIGGER IF EXISTS trg_teacher_absence_requests_updated_at ON public.teacher_absence_requests;
CREATE TRIGGER trg_teacher_absence_requests_updated_at BEFORE UPDATE ON public.teacher_absence_requests FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

DROP TRIGGER IF EXISTS trg_teacher_substitutions_updated_at ON public.teacher_substitutions;
CREATE TRIGGER trg_teacher_substitutions_updated_at BEFORE UPDATE ON public.teacher_substitutions FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

-- 5. Seed Permissions Catalog
INSERT INTO public.permission_catalog (permission_key, category, description)
VALUES
  ('substitution.read',    'substitution', 'View teacher substitution records'),
  ('substitution.create',  'substitution', 'Create teacher absence or substitution'),
  ('substitution.update',  'substitution', 'Edit or change substitutes'),
  ('substitution.cancel',  'substitution', 'Cancel active substitutions'),
  ('substitution.approve', 'substitution', 'Approve teacher absence requests'),
  ('substitution.export',  'substitution', 'Export teacher coverage analytics')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permission_defaults (role, permission_key, allowed)
VALUES
  ('institution_admin', 'substitution.read',    true),
  ('institution_admin', 'substitution.create',  true),
  ('institution_admin', 'substitution.update',  true),
  ('institution_admin', 'substitution.cancel',  true),
  ('institution_admin', 'substitution.approve', true),
  ('institution_admin', 'substitution.export',  true),

  ('manager', 'substitution.read',    true),
  ('manager', 'substitution.create',  true),
  ('manager', 'substitution.update',  true),
  ('manager', 'substitution.cancel',  true),

  ('teacher', 'substitution.read',    true),
  ('viewer',  'substitution.read',    true)
ON CONFLICT (role, permission_key) DO NOTHING;
