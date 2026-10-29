-- =====================================================================
-- Q-Hudoor v3.8.7 — Enterprise Academic Structure & Classroom Management
-- =====================================================================

-- 1. Classrooms / Rooms Table
CREATE TABLE IF NOT EXISTS public.classrooms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  capacity        integer NOT NULL DEFAULT 30,
  floor           integer DEFAULT 0,
  room_type       text NOT NULL CHECK (room_type IN ('general', 'computer', 'lab', 'lecture_hall', 'sports')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_classroom_name_institution UNIQUE (institution_id, name)
);

CREATE INDEX IF NOT EXISTS idx_classrooms_institution ON public.classrooms (institution_id);

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classrooms tenant select" ON public.classrooms
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

CREATE POLICY "classrooms tenant write" ON public.classrooms
  FOR ALL TO authenticated
  USING (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()))
  WITH CHECK (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()));

-- 2. Update Cohorts with Main Teacher & Classroom (Normalized FK)
ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS main_teacher_id uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_room_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cohorts_main_teacher ON public.cohorts (main_teacher_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_primary_room ON public.cohorts (primary_room_id);

-- 3. Update Timetable Entries to reference classrooms instead of text room_name
ALTER TABLE public.timetable_entries
  ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_entries_classroom ON public.timetable_entries (classroom_id);

-- 4. Triggers
DROP TRIGGER IF EXISTS trg_classrooms_updated_at ON public.classrooms;
CREATE TRIGGER trg_classrooms_updated_at BEFORE UPDATE ON public.classrooms FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

-- 5. Seed Permissions Catalog
INSERT INTO public.permission_catalog (permission_key, category, description)
VALUES
  ('classrooms.read',    'academic_structure', 'View classrooms and capacity metrics'),
  ('classrooms.create',  'academic_structure', 'Add new classrooms'),
  ('classrooms.update',  'academic_structure', 'Edit classroom specifications'),
  ('classrooms.archive', 'academic_structure', 'Archive or disable classrooms'),
  ('cohorts.assign_main', 'academic_structure', 'Assign main class teachers'),
  ('cohorts.manage',      'academic_structure', 'Full administrative management of cohorts')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permission_defaults (role, permission_key, allowed)
VALUES
  ('institution_admin', 'classrooms.read',      true),
  ('institution_admin', 'classrooms.create',    true),
  ('institution_admin', 'classrooms.update',    true),
  ('institution_admin', 'classrooms.archive',   true),
  ('institution_admin', 'cohorts.assign_main',  true),
  ('institution_admin', 'cohorts.manage',       true),

  ('manager', 'classrooms.read',      true),
  ('manager', 'cohorts.manage',       true),

  ('teacher', 'classrooms.read',      true),
  ('viewer',  'classrooms.read',      true)
ON CONFLICT (role, permission_key) DO NOTHING;
