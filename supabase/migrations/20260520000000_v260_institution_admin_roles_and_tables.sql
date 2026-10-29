-- =====================================================================
-- v2.6.0 — Institution Admin Dashboard: schema foundations
-- =====================================================================
-- Adds:
-- (1) New role helper functions for the expanded role hierarchy.
-- (2) institution_units table: hierarchical structure (faculties/departments/
--     specialties/groups, and equivalents for schools, training centers,
--     companies). Sector-agnostic by design.
-- (3) absence_justifications table.
-- (4) RLS policies on the new tables, scoped strictly by institution.
--
-- Does NOT change:
--   - admins.role check constraints (none exist; we accept any text).
--   - any existing RLS policy.
--   - the register-attendance edge function or its tables.
-- =====================================================================

CREATE OR REPLACE FUNCTION private.is_institution_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT private.current_admin_role() = ANY (ARRAY[
    'institution_owner',
    'institution_admin',
    'faculty_admin',
    'department_admin'
  ]);
$$;

COMMENT ON FUNCTION private.is_institution_manager() IS
  'True when current admin holds any institution-level management role.';

CREATE OR REPLACE FUNCTION private.can_manage_institution(target_institution_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND target_institution_id = private.current_admin_institution_id()
    );
$$;

CREATE TABLE IF NOT EXISTS public.institution_units (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  parent_id       uuid REFERENCES public.institution_units(id) ON DELETE CASCADE,
  type            text NOT NULL,
  name            text NOT NULL,
  code            text,
  description     text,
  status          text NOT NULL DEFAULT 'active',
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institution_units_type_check CHECK (type IN (
    'faculty', 'department', 'specialty', 'group',
    'school_year', 'class', 'subject',
    'branch', 'course',
    'team', 'shift'
  )),
  CONSTRAINT institution_units_status_check CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_institution_units_institution_id ON public.institution_units (institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_units_parent_id      ON public.institution_units (parent_id);
CREATE INDEX IF NOT EXISTS idx_institution_units_type           ON public.institution_units (institution_id, type);

ALTER TABLE public.institution_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institution_units select" ON public.institution_units;
CREATE POLICY "institution_units select" ON public.institution_units
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "institution_units insert" ON public.institution_units;
CREATE POLICY "institution_units insert" ON public.institution_units
  FOR INSERT TO authenticated WITH CHECK (private.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "institution_units update" ON public.institution_units;
CREATE POLICY "institution_units update" ON public.institution_units
  FOR UPDATE TO authenticated
  USING (private.can_manage_institution(institution_id))
  WITH CHECK (private.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "institution_units delete" ON public.institution_units;
CREATE POLICY "institution_units delete" ON public.institution_units
  FOR DELETE TO authenticated USING (private.can_manage_institution(institution_id));


CREATE TABLE IF NOT EXISTS public.absence_justifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id            uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_id         uuid REFERENCES public.attendances(id) ON DELETE SET NULL,
  session_id            uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  reason                text NOT NULL,
  attachment_url        text,
  status                text NOT NULL DEFAULT 'pending',
  reviewed_by_admin_id  uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,
  admin_note            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT absence_justifications_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_absence_justifications_institution_id ON public.absence_justifications (institution_id);
CREATE INDEX IF NOT EXISTS idx_absence_justifications_student_id     ON public.absence_justifications (student_id);
CREATE INDEX IF NOT EXISTS idx_absence_justifications_status         ON public.absence_justifications (institution_id, status);
CREATE INDEX IF NOT EXISTS idx_absence_justifications_session_id     ON public.absence_justifications (session_id);
CREATE INDEX IF NOT EXISTS idx_absence_justifications_attendance_id  ON public.absence_justifications (attendance_id);

ALTER TABLE public.absence_justifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "absence_justifications select" ON public.absence_justifications;
CREATE POLICY "absence_justifications select" ON public.absence_justifications
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "absence_justifications insert" ON public.absence_justifications;
CREATE POLICY "absence_justifications insert" ON public.absence_justifications
  FOR INSERT TO authenticated WITH CHECK (private.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "absence_justifications update" ON public.absence_justifications;
CREATE POLICY "absence_justifications update" ON public.absence_justifications
  FOR UPDATE TO authenticated
  USING (private.can_manage_institution(institution_id))
  WITH CHECK (private.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "absence_justifications delete" ON public.absence_justifications;
CREATE POLICY "absence_justifications delete" ON public.absence_justifications
  FOR DELETE TO authenticated USING (private.can_manage_institution(institution_id));

CREATE OR REPLACE FUNCTION public._set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_institution_units_updated_at ON public.institution_units;
CREATE TRIGGER trg_institution_units_updated_at
  BEFORE UPDATE ON public.institution_units
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

DROP TRIGGER IF EXISTS trg_absence_justifications_updated_at ON public.absence_justifications;
CREATE TRIGGER trg_absence_justifications_updated_at
  BEFORE UPDATE ON public.absence_justifications
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['institution_units', 'absence_justifications'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
