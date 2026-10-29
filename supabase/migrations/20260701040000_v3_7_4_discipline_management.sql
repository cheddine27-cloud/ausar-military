-- =====================================================================
-- v3.7.4 — Q-Hudoor Enterprise Discipline Management Module
-- =====================================================================
-- ADDITIVE ONLY: Creates tables, indexes, and RLS policies for 
-- discipline cases and transition history.
-- =====================================================================

-- 1. discipline_cases
CREATE TABLE IF NOT EXISTS public.discipline_cases (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id            uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id            uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  session_id            uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  severity              text NOT NULL CHECK (severity IN ('minor', 'medium', 'critical')),
  category              text NOT NULL CHECK (category IN ('behavior', 'tardiness', 'cheating', 'violence', 'vandalism', 'other')),
  title                 text NOT NULL,
  description           text NOT NULL,
  teacher_note          text,
  admin_note            text,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'correction_requested')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  reviewed_at           timestamptz,
  reviewed_by           uuid REFERENCES public.admins(id) ON DELETE SET NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_discipline_cases_institution_id
  ON public.discipline_cases (institution_id);

CREATE INDEX IF NOT EXISTS idx_discipline_cases_student_id
  ON public.discipline_cases (student_id);

CREATE INDEX IF NOT EXISTS idx_discipline_cases_teacher_id
  ON public.discipline_cases (teacher_id);

CREATE INDEX IF NOT EXISTS idx_discipline_cases_status
  ON public.discipline_cases (institution_id, status);

-- 2. discipline_case_history (State transitions and notes)
CREATE TABLE IF NOT EXISTS public.discipline_case_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           uuid NOT NULL REFERENCES public.discipline_cases(id) ON DELETE CASCADE,
  from_state        text NOT NULL,
  to_state          text NOT NULL,
  actor_id          uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  actor_name        text NOT NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discipline_case_history_case_id
  ON public.discipline_case_history (case_id);

-- Enable RLS
ALTER TABLE public.discipline_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_case_history ENABLE ROW LEVEL SECURITY;

-- Drop policies if exists
DROP POLICY IF EXISTS "discipline_cases tenant select" ON public.discipline_cases;
DROP POLICY IF EXISTS "discipline_cases tenant insert" ON public.discipline_cases;
DROP POLICY IF EXISTS "discipline_cases tenant update" ON public.discipline_cases;
DROP POLICY IF EXISTS "discipline_cases tenant delete" ON public.discipline_cases;

DROP POLICY IF EXISTS "discipline_case_history tenant select" ON public.discipline_case_history;
DROP POLICY IF EXISTS "discipline_case_history tenant insert" ON public.discipline_case_history;

-- RLS Policies for discipline_cases
CREATE POLICY "discipline_cases tenant select" ON public.discipline_cases
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() <> 'teacher'
        OR (private.current_admin_role() = 'teacher' AND teacher_id = private.current_admin_id())
      )
    )
  );

CREATE POLICY "discipline_cases tenant insert" ON public.discipline_cases
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() <> 'teacher'
        OR (private.current_admin_role() = 'teacher' AND teacher_id = private.current_admin_id())
      )
    )
  );

CREATE POLICY "discipline_cases tenant update" ON public.discipline_cases
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() <> 'teacher'
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() <> 'teacher'
    )
  );

CREATE POLICY "discipline_cases tenant delete" ON public.discipline_cases
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() <> 'teacher'
    )
  );

-- RLS Policies for discipline_case_history
CREATE POLICY "discipline_case_history tenant select" ON public.discipline_case_history
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.discipline_cases c
      WHERE c.id = case_id AND private.can_access_institution(c.institution_id)
    )
  );

CREATE POLICY "discipline_case_history tenant insert" ON public.discipline_case_history
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.discipline_cases c
      WHERE c.id = case_id AND private.can_access_institution(c.institution_id)
    )
  );

-- 3. Register discipline permissions in catalog
INSERT INTO public.permission_catalog (permission_key, category, description) VALUES
  ('discipline.read', 'discipline', 'صلاحية قراءة وعرض تقارير الانضباط والسلوك'),
  ('discipline.create', 'discipline', 'صلاحية تسجيل تقرير سلوكي جديد لتلميذ'),
  ('discipline.review', 'discipline', 'صلاحية مراجعة واعتماد أو رفض تقارير الانضباط من الإدارة'),
  ('discipline.statistics', 'discipline', 'صلاحية عرض لوحة إحصائيات الانضباط والسلوك')
ON CONFLICT (permission_key) DO NOTHING;

-- 4. Assign default roles permissions
-- Teachers: read, create, statistics
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('teacher', 'discipline.read', true),
  ('teacher', 'discipline.create', true),
  ('teacher', 'discipline.statistics', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Staff: read, create, review, statistics
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('staff', 'discipline.read', true),
  ('staff', 'discipline.create', true),
  ('staff', 'discipline.review', true),
  ('staff', 'discipline.statistics', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Admins: read, create, review, statistics
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('admin', 'discipline.read', true),
  ('admin', 'discipline.create', true),
  ('admin', 'discipline.review', true),
  ('admin', 'discipline.statistics', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Owners: read, create, review, statistics
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('owner', 'discipline.read', true),
  ('owner', 'discipline.create', true),
  ('owner', 'discipline.review', true),
  ('owner', 'discipline.statistics', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Viewers: read, statistics
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('viewer', 'discipline.read', true),
  ('viewer', 'discipline.statistics', true)
ON CONFLICT (role, permission_key) DO NOTHING;
