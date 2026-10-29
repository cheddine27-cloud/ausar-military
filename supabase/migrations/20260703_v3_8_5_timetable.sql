-- =====================================================================
-- v3.8.5 — Q-Hudoor Enterprise Academic Timetable & Session Scheduler
-- =====================================================================

-- 1. Academic Periods
CREATE TABLE IF NOT EXISTS public.academic_periods (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  period_number   integer NOT NULL,
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  break_duration  integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_period_number_institution UNIQUE (institution_id, period_number)
);

CREATE INDEX IF NOT EXISTS idx_academic_periods_institution ON public.academic_periods (institution_id);

ALTER TABLE public.academic_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periods tenant select" ON public.academic_periods
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

CREATE POLICY "periods tenant write" ON public.academic_periods
  FOR ALL TO authenticated
  USING (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()))
  WITH CHECK (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()));

-- 2. Working Days configuration
CREATE TABLE IF NOT EXISTS public.working_days (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  day_name        text NOT NULL CHECK (day_name IN ('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  is_enabled      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_working_day_institution UNIQUE (institution_id, day_name)
);

CREATE INDEX IF NOT EXISTS idx_working_days_institution ON public.working_days (institution_id);

ALTER TABLE public.working_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "working_days tenant select" ON public.working_days
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

CREATE POLICY "working_days tenant write" ON public.working_days
  FOR ALL TO authenticated
  USING (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()))
  WITH CHECK (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()));

-- Seed default working days for existing institutions
DO $$
DECLARE
  inst RECORD;
  day text;
  days text[] := ARRAY['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  weekend text[] := ARRAY['Friday', 'Saturday'];
BEGIN
  FOR inst IN SELECT id FROM public.institutions LOOP
    FOREACH day IN ARRAY days LOOP
      INSERT INTO public.working_days (institution_id, day_name, is_enabled)
      VALUES (inst.id, day, true) ON CONFLICT DO NOTHING;
    END LOOP;
    FOREACH day IN ARRAY weekend LOOP
      INSERT INTO public.working_days (institution_id, day_name, is_enabled)
      VALUES (inst.id, day, false) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 3. Holidays and Events Calendar
CREATE TABLE IF NOT EXISTS public.holiday_calendar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  type            text NOT NULL CHECK (type IN ('holiday', 'exam', 'event')),
  override_allowed boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holiday_calendar_institution ON public.holiday_calendar (institution_id);

ALTER TABLE public.holiday_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holidays tenant select" ON public.holiday_calendar
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

CREATE POLICY "holidays tenant write" ON public.holiday_calendar
  FOR ALL TO authenticated
  USING (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()))
  WITH CHECK (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()));

-- 4. Institution Timetables (Main Header)
CREATE TABLE IF NOT EXISTS public.institution_timetables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  academic_year   text NOT NULL,
  semester        text,
  created_by      uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timetables_institution ON public.institution_timetables (institution_id);

ALTER TABLE public.institution_timetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timetables tenant select" ON public.institution_timetables
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

CREATE POLICY "timetables tenant write" ON public.institution_timetables
  FOR ALL TO authenticated
  USING (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()))
  WITH CHECK (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()));

-- 5. Timetable Entries (Concrete schedule items)
CREATE TABLE IF NOT EXISTS public.timetable_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id    uuid NOT NULL REFERENCES public.institution_timetables(id) ON DELETE CASCADE,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  day_name        text NOT NULL CHECK (day_name IN ('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  period_id       uuid NOT NULL REFERENCES public.academic_periods(id) ON DELETE CASCADE,
  teacher_id      uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  cohort_id       uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  room_name       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entries_timetable ON public.timetable_entries (timetable_id);
CREATE INDEX IF NOT EXISTS idx_entries_teacher ON public.timetable_entries (teacher_id);
CREATE INDEX IF NOT EXISTS idx_entries_cohort ON public.timetable_entries (cohort_id);

ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries tenant select" ON public.timetable_entries
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

CREATE POLICY "entries tenant write" ON public.timetable_entries
  FOR ALL TO authenticated
  USING (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()))
  WITH CHECK (private.is_super_admin() OR (private.is_institution_manager() AND institution_id = private.current_admin_institution_id()));

-- 6. Add trigger logic for updated_at
DROP TRIGGER IF EXISTS trg_academic_periods_updated_at ON public.academic_periods;
CREATE TRIGGER trg_academic_periods_updated_at BEFORE UPDATE ON public.academic_periods FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

DROP TRIGGER IF EXISTS trg_working_days_updated_at ON public.working_days;
CREATE TRIGGER trg_working_days_updated_at BEFORE UPDATE ON public.working_days FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

DROP TRIGGER IF EXISTS trg_holiday_calendar_updated_at ON public.holiday_calendar;
CREATE TRIGGER trg_holiday_calendar_updated_at BEFORE UPDATE ON public.holiday_calendar FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

DROP TRIGGER IF EXISTS trg_institution_timetables_updated_at ON public.institution_timetables;
CREATE TRIGGER trg_institution_timetables_updated_at BEFORE UPDATE ON public.institution_timetables FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

DROP TRIGGER IF EXISTS trg_timetable_entries_updated_at ON public.timetable_entries;
CREATE TRIGGER trg_timetable_entries_updated_at BEFORE UPDATE ON public.timetable_entries FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

-- 7. Add columns to Sessions (Additive)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS timetable_entry_id uuid REFERENCES public.timetable_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_name text;

-- 8. Seed permissions catalog
INSERT INTO public.permission_catalog (permission_key, category, description)
VALUES
  ('timetable.read',       'timetable', 'View academic timetables'),
  ('timetable.create',     'timetable', 'Create academic timetables'),
  ('timetable.update',     'timetable', 'Edit academic timetables'),
  ('timetable.archive',    'timetable', 'Archive timetables'),
  ('timetable.restore',    'timetable', 'Restore archived timetables'),
  ('timetable.activate',   'timetable', 'Activate or deactivate timetables'),
  ('timetable.export',     'timetable', 'Export scheduling reports'),
  ('periods.manage',       'timetable', 'Manage academic period definitions'),
  ('workingdays.manage',   'timetable', 'Configure institution working days'),
  ('holidays.manage',      'timetable', 'Manage holiday calendar')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permission_defaults (role, permission_key, allowed)
VALUES
  ('institution_admin', 'timetable.read',       true),
  ('institution_admin', 'timetable.create',     true),
  ('institution_admin', 'timetable.update',     true),
  ('institution_admin', 'timetable.archive',    true),
  ('institution_admin', 'timetable.restore',    true),
  ('institution_admin', 'timetable.activate',   true),
  ('institution_admin', 'timetable.export',     true),
  ('institution_admin', 'periods.manage',       true),
  ('institution_admin', 'workingdays.manage',   true),
  ('institution_admin', 'holidays.manage',      true),

  ('manager', 'timetable.read',       true),
  ('manager', 'timetable.update',     true),
  ('manager', 'timetable.export',     true),

  ('teacher', 'timetable.read',       true),
  ('viewer',  'timetable.read',       true)
ON CONFLICT (role, permission_key) DO NOTHING;
