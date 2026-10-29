-- =====================================================================
-- Q-Hudoor v3.8.9 — Enterprise Daily Operations & Student Movement Center
-- =====================================================================

-- 1. Student Movements Table (Early Exit)
CREATE TABLE IF NOT EXISTS public.student_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_id   uuid REFERENCES public.attendances(id) ON DELETE SET NULL,
  movement_type   text NOT NULL CHECK (movement_type IN ('early_exit', 'returned', 'medical', 'administrative', 'family_request')),
  reason          text NOT NULL,
  approved_by     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  guardian_name   text,
  guardian_identity text,
  departure_time  timestamptz NOT NULL DEFAULT now(),
  return_time     timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movements_student ON public.student_movements (student_id);
CREATE INDEX IF NOT EXISTS idx_movements_institution ON public.student_movements (institution_id);

ALTER TABLE public.student_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements select tenant" ON public.student_movements FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));
CREATE POLICY "movements write tenant" ON public.student_movements FOR ALL TO authenticated USING (private.can_access_institution(institution_id)) WITH CHECK (private.can_access_institution(institution_id));

-- 2. Visitors Table
CREATE TABLE IF NOT EXISTS public.institution_visitors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name            text NOT NULL,
  national_id     text,
  phone           text,
  visit_reason    text NOT NULL,
  visited_person  text NOT NULL,
  entry_time      timestamptz NOT NULL DEFAULT now(),
  exit_time       timestamptz,
  badge_number    text,
  status          text NOT NULL DEFAULT 'inside' CHECK (status IN ('inside', 'checked_out')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitors_institution ON public.institution_visitors (institution_id);

ALTER TABLE public.institution_visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitors select tenant" ON public.institution_visitors FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));
CREATE POLICY "visitors write tenant" ON public.institution_visitors FOR ALL TO authenticated USING (private.can_access_institution(institution_id)) WITH CHECK (private.can_access_institution(institution_id));

-- 3. Incident Management Table
CREATE TABLE IF NOT EXISTS public.daily_incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  incident_type   text NOT NULL CHECK (incident_type IN ('medical', 'discipline', 'violence', 'property_damage', 'emergency', 'other')),
  title           text NOT NULL,
  description     text NOT NULL,
  student_id      uuid REFERENCES public.students(id) ON DELETE SET NULL,
  reported_by     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_investigation', 'resolved', 'archived')),
  resolution      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_student ON public.daily_incidents (student_id);

ALTER TABLE public.daily_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents select tenant" ON public.daily_incidents FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));
CREATE POLICY "incidents write tenant" ON public.daily_incidents FOR ALL TO authenticated USING (private.can_access_institution(institution_id)) WITH CHECK (private.can_access_institution(institution_id));

-- 4. Teacher Attendance Monitoring Table
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  teacher_id      uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  status          text NOT NULL CHECK (status IN ('present', 'late', 'absent')),
  arrival_time    timestamptz NOT NULL DEFAULT now(),
  departure_time  timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON public.teacher_attendance (teacher_id);

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher_att select tenant" ON public.teacher_attendance FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));
CREATE POLICY "teacher_att write tenant" ON public.teacher_attendance FOR ALL TO authenticated USING (private.can_access_institution(institution_id)) WITH CHECK (private.can_access_institution(institution_id));

-- 5. Seed Permissions Catalog
INSERT INTO public.permission_catalog (permission_key, category, description)
VALUES
  ('student.exit.manage',       'daily_operations', 'Manage student early exits'),
  ('student.return.manage',     'daily_operations', 'Register student returns'),
  ('visitor.manage',            'daily_operations', 'Register and manage school visitors'),
  ('incident.manage',           'daily_operations', 'Create and investigate daily school incidents'),
  ('teacher.attendance.view',   'daily_operations', 'View teacher arrival status logs'),
  ('daily.operations.view',     'daily_operations', 'View general operations dashboard'),
  ('daily.operations.export',   'daily_operations', 'Export daily logs reports')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permission_defaults (role, permission_key, allowed)
VALUES
  ('institution_admin', 'student.exit.manage',       true),
  ('institution_admin', 'student.return.manage',     true),
  ('institution_admin', 'visitor.manage',            true),
  ('institution_admin', 'incident.manage',           true),
  ('institution_admin', 'teacher.attendance.view',   true),
  ('institution_admin', 'daily.operations.view',     true),
  ('institution_admin', 'daily.operations.export',   true),

  ('manager', 'student.exit.manage',       true),
  ('manager', 'visitor.manage',            true),
  ('manager', 'daily.operations.view',     true),

  ('teacher', 'student.exit.manage',       true),
  ('teacher', 'incident.manage',           true)
ON CONFLICT (role, permission_key) DO NOTHING;
