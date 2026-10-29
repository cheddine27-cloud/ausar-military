-- =====================================================================
-- Q-Hudoor v3.9.3 — Student Enrollment & Bulk Import Database Schema
-- =====================================================================

-- 1. Extend existing students table with new acceptance/enrollment columns
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS student_registration_number text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS birth_certificate_number text,
  ADD COLUMN IF NOT EXISTS guardian_relationship text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS import_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS import_status text DEFAULT 'completed';

-- Add unique constraints safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_students_registration_number'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT uq_students_registration_number UNIQUE (student_registration_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_students_national_id'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT uq_students_national_id UNIQUE (national_id);
  END IF;
END $$;

-- 2. Create student_import_batches table
CREATE TABLE IF NOT EXISTS public.student_import_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  file_type       text NOT NULL,
  total_rows      integer NOT NULL DEFAULT 0,
  successful_rows integer NOT NULL DEFAULT 0,
  failed_rows     integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'rolled_back')),
  uploaded_by     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_institution ON public.student_import_batches (institution_id);

ALTER TABLE public.student_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches select tenant" ON public.student_import_batches FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));
CREATE POLICY "batches write tenant" ON public.student_import_batches FOR ALL TO authenticated USING (private.can_access_institution(institution_id)) WITH CHECK (private.can_access_institution(institution_id));

-- 3. Create student_import_errors table
CREATE TABLE IF NOT EXISTS public.student_import_errors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid NOT NULL REFERENCES public.student_import_batches(id) ON DELETE CASCADE,
  row_number      integer NOT NULL,
  column_name     text,
  error_message   text NOT NULL,
  raw_value       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_errors_batch ON public.student_import_errors (batch_id);

ALTER TABLE public.student_import_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "errors select tenant" ON public.student_import_errors FOR SELECT TO authenticated USING (exists (select 1 from public.student_import_batches b where b.id = batch_id));
CREATE POLICY "errors write tenant" ON public.student_import_errors FOR ALL TO authenticated USING (exists (select 1 from public.student_import_batches b where b.id = batch_id)) WITH CHECK (exists (select 1 from public.student_import_batches b where b.id = batch_id));

-- 4. Seed Permissions Catalog for Student acceptance center
INSERT INTO public.permission_catalog (permission_key, category, description)
VALUES
  ('students.create',   'students_center', 'Manual enrollment of students'),
  ('students.update',   'students_center', 'Edit student enrollment records'),
  ('students.import',   'students_center', 'Access bulk file upload and validation wizard'),
  ('students.export',   'students_center', 'Export student rosters to CSV/Excel'),
  ('students.archive',  'students_center', 'Archive student records'),
  ('students.restore',  'students_center', 'Restore archived student records'),
  ('students.print',    'students_center', 'Print official student rosters')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permission_defaults (role, permission_key, allowed)
VALUES
  ('institution_admin', 'students.create',   true),
  ('institution_admin', 'students.update',   true),
  ('institution_admin', 'students.import',   true),
  ('institution_admin', 'students.export',   true),
  ('institution_admin', 'students.archive',  true),
  ('institution_admin', 'students.restore',  true),
  ('institution_admin', 'students.print',    true),

  ('manager', 'students.create',   true),
  ('manager', 'students.update',   true),
  ('manager', 'students.import',   true),
  ('manager', 'students.export',   true),

  ('teacher', 'students.print',    true),
  
  ('viewer',  'students.export',   true)
ON CONFLICT (role, permission_key) DO NOTHING;
