-- =====================================================================
-- v3.8.4 — Q-Hudoor Enterprise Subjects & Teacher Assignment Center
-- =====================================================================
-- ADDITIVE ONLY: does NOT modify existing rows, RLS policies, or
-- existing constraints in an incompatible way.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. subjects — academic subject catalog per institution
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subjects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  name_fr         text,
  code            text,
  coefficient     numeric(4,2) NOT NULL DEFAULT 1,
  weekly_hours    integer NOT NULL DEFAULT 2,
  academic_year   text,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by      uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_subject_code_institution UNIQUE (institution_id, code)
);

CREATE INDEX IF NOT EXISTS idx_subjects_institution_id
  ON public.subjects (institution_id);

CREATE INDEX IF NOT EXISTS idx_subjects_status
  ON public.subjects (status);

-- updated_at auto-trigger
DROP TRIGGER IF EXISTS trg_subjects_updated_at ON public.subjects;
CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 2. Extend teacher_assignments with subject and lesson metadata
--    (ADDITIVE — adds columns to existing table)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.teacher_assignments
  ADD COLUMN IF NOT EXISTS subject_id     uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weekly_lessons integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS academic_year  text,
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived'));

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_subject_id
  ON public.teacher_assignments (subject_id);

-- ─────────────────────────────────────────────────────────────────────
-- 3. Extend sessions with a normalized subject_id FK
--    (ADDITIVE — the existing free-text `subject` column is preserved)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_subject_id
  ON public.sessions (subject_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. RLS for subjects
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subjects tenant select" ON public.subjects;
DROP POLICY IF EXISTS "subjects tenant insert" ON public.subjects;
DROP POLICY IF EXISTS "subjects tenant update" ON public.subjects;
DROP POLICY IF EXISTS "subjects tenant delete" ON public.subjects;

CREATE POLICY "subjects tenant select" ON public.subjects
  FOR SELECT TO authenticated
  USING (private.can_access_institution(institution_id));

CREATE POLICY "subjects tenant insert" ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

CREATE POLICY "subjects tenant update" ON public.subjects
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

CREATE POLICY "subjects tenant delete" ON public.subjects
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 5. Register subjects in realtime publication
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'subjects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subjects;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Seed subjects permission keys into permission_catalog
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.permission_catalog (key, description, module_id)
VALUES
  ('subjects.read',    'View academic subjects list',          'school'),
  ('subjects.create',  'Create academic subjects',             'school'),
  ('subjects.update',  'Edit academic subjects',               'school'),
  ('subjects.archive', 'Archive academic subjects',            'school'),
  ('subjects.restore', 'Restore archived subjects',            'school'),
  ('subjects.assign',  'Assign teachers to subjects/classes',  'school'),
  ('subjects.remove',  'Remove teacher assignments',           'school'),
  ('subjects.export',  'Export subjects and assignment reports','school')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 7. Default role permissions for subjects
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.role_permission_defaults (role, permission_key, granted)
VALUES
  -- institution_admin: full access
  ('institution_admin', 'subjects.read',    true),
  ('institution_admin', 'subjects.create',  true),
  ('institution_admin', 'subjects.update',  true),
  ('institution_admin', 'subjects.archive', true),
  ('institution_admin', 'subjects.restore', true),
  ('institution_admin', 'subjects.assign',  true),
  ('institution_admin', 'subjects.remove',  true),
  ('institution_admin', 'subjects.export',  true),
  -- manager: read + assign (no create/archive)
  ('manager', 'subjects.read',    true),
  ('manager', 'subjects.assign',  true),
  ('manager', 'subjects.remove',  true),
  ('manager', 'subjects.export',  true),
  -- teacher: read only
  ('teacher', 'subjects.read',    true),
  -- viewer: read only
  ('viewer', 'subjects.read',     true)
ON CONFLICT (role, permission_key) DO NOTHING;
