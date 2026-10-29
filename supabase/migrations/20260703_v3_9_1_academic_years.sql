-- =====================================================================
-- Q-Hudoor v3.9.1 — Enterprise Academic Year & Enrollment Management
-- =====================================================================

-- 1. Academic Years Table
CREATE TABLE IF NOT EXISTS public.academic_years (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_year_name_institution UNIQUE (institution_id, name)
);

CREATE INDEX IF NOT EXISTS idx_academic_years_institution ON public.academic_years (institution_id);

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "years select tenant" ON public.academic_years FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));
CREATE POLICY "years write tenant" ON public.academic_years FOR ALL TO authenticated USING (private.can_access_institution(institution_id)) WITH CHECK (private.can_access_institution(institution_id));

-- 2. Enrollment Batches Table
CREATE TABLE IF NOT EXISTS public.enrollment_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  registration_period text NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enrollment_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches select tenant" ON public.enrollment_batches FOR SELECT TO authenticated USING (exists (select 1 from public.academic_years y where y.id = academic_year_id));
CREATE POLICY "batches write tenant" ON public.enrollment_batches FOR ALL TO authenticated USING (exists (select 1 from public.academic_years y where y.id = academic_year_id)) WITH CHECK (exists (select 1 from public.academic_years y where y.id = academic_year_id));

-- 3. Add academic_year_id relationship to operational tables
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.teacher_substitutions ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.administrative_decisions ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.student_movements ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
ALTER TABLE public.daily_incidents ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;

-- 4. Seed Permissions Catalog
INSERT INTO public.permission_catalog (permission_key, category, description)
VALUES
  ('academicyear.read',     'academic_years', 'View academic years list'),
  ('academicyear.create',   'academic_years', 'Create new academic year'),
  ('academicyear.activate', 'academic_years', 'Activate academic year'),
  ('academicyear.close',    'academic_years', 'Close or archive academic year'),
  ('academicyear.promote',  'academic_years', 'Trigger batch student promotion rules'),
  ('academicyear.export',   'academic_years', 'Export promotions and batch details')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permission_defaults (role, permission_key, allowed)
VALUES
  ('institution_admin', 'academicyear.read',     true),
  ('institution_admin', 'academicyear.create',   true),
  ('institution_admin', 'academicyear.activate', true),
  ('institution_admin', 'academicyear.close',    true),
  ('institution_admin', 'academicyear.promote',  true),
  ('institution_admin', 'academicyear.export',   true),

  ('manager', 'academicyear.read',     true),
  ('manager', 'academicyear.promote',  true),

  ('teacher', 'academicyear.read',     true),
  
  ('viewer',  'academicyear.read',     true)
ON CONFLICT (role, permission_key) DO NOTHING;
