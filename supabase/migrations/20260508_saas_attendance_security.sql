-- Q-Hudoor SaaS security hardening.
-- Attendance writes must go through the register-attendance Edge Function.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Admin username login support without exposing the admins table directly.
CREATE OR REPLACE FUNCTION public.resolve_admin_login_email(login_identifier TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.admins
  WHERE lower(username) = lower(trim(login_identifier))
     OR lower(email) = lower(trim(login_identifier))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_admin_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_admin_login_email(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_admin_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.admins WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.admins WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_admin_institution_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM public.admins WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_admin_role() = 'super_admin', false)
$$;

CREATE OR REPLACE FUNCTION public.can_access_institution(target_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
      OR target_institution_id = public.current_admin_institution_id()
$$;

REVOKE ALL ON FUNCTION public.current_admin_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_admin_institution_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_institution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_admin_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_admin_institution_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_institution(UUID) TO authenticated;

-- Hard DB guarantees. These protect the data even if a client has a bug.
DO $$
BEGIN
  ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_student_number_key;
  ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_studentNumber_key;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS students_institution_student_number_uidx
  ON public.students(institution_id, student_number)
  WHERE institution_id IS NOT NULL AND student_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attendances_session_student_uidx
  ON public.attendances(session_id, student_id)
  WHERE session_id IS NOT NULL AND student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS student_devices_active_student_uidx
  ON public.student_devices(student_id)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS student_devices_active_fingerprint_uidx
  ON public.student_devices(device_fingerprint)
  WHERE is_active = true AND device_fingerprint IS NOT NULL;

-- RLS tenant isolation.
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institutions tenant select" ON public.institutions;
DROP POLICY IF EXISTS "institutions super manage" ON public.institutions;
CREATE POLICY "institutions tenant select" ON public.institutions
  FOR SELECT TO authenticated
  USING (public.can_access_institution(id));
CREATE POLICY "institutions super manage" ON public.institutions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "admins tenant select" ON public.admins;
DROP POLICY IF EXISTS "admins tenant insert" ON public.admins;
DROP POLICY IF EXISTS "admins tenant update" ON public.admins;
DROP POLICY IF EXISTS "admins tenant delete" ON public.admins;
CREATE POLICY "admins tenant select" ON public.admins
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.can_access_institution(institution_id));
CREATE POLICY "admins tenant insert" ON public.admins
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_institution(institution_id));
CREATE POLICY "admins tenant update" ON public.admins
  FOR UPDATE TO authenticated
  USING (public.can_access_institution(institution_id))
  WITH CHECK (public.can_access_institution(institution_id));
CREATE POLICY "admins tenant delete" ON public.admins
  FOR DELETE TO authenticated
  USING (public.can_access_institution(institution_id));

DROP POLICY IF EXISTS "faculties tenant all" ON public.faculties;
CREATE POLICY "faculties tenant all" ON public.faculties
  FOR ALL TO authenticated
  USING (public.can_access_institution(institution_id))
  WITH CHECK (public.can_access_institution(institution_id));

DROP POLICY IF EXISTS "departments tenant all" ON public.departments;
CREATE POLICY "departments tenant all" ON public.departments
  FOR ALL TO authenticated
  USING (public.can_access_institution(institution_id))
  WITH CHECK (public.can_access_institution(institution_id));

DROP POLICY IF EXISTS "specialties tenant all" ON public.specialties;
CREATE POLICY "specialties tenant all" ON public.specialties
  FOR ALL TO authenticated
  USING (public.can_access_institution(institution_id))
  WITH CHECK (public.can_access_institution(institution_id));

DROP POLICY IF EXISTS "cohorts tenant all" ON public.cohorts;
CREATE POLICY "cohorts tenant all" ON public.cohorts
  FOR ALL TO authenticated
  USING (public.can_access_institution(institution_id))
  WITH CHECK (public.can_access_institution(institution_id));

DROP POLICY IF EXISTS "students tenant all" ON public.students;
CREATE POLICY "students tenant all" ON public.students
  FOR ALL TO authenticated
  USING (public.can_access_institution(institution_id))
  WITH CHECK (public.can_access_institution(institution_id));

DROP POLICY IF EXISTS "sessions tenant all" ON public.sessions;
CREATE POLICY "sessions tenant all" ON public.sessions
  FOR ALL TO authenticated
  USING (public.can_access_institution(institution_id))
  WITH CHECK (public.can_access_institution(institution_id));

DROP POLICY IF EXISTS "attendances tenant all" ON public.attendances;
CREATE POLICY "attendances tenant all" ON public.attendances
  FOR ALL TO authenticated
  USING (public.can_access_institution(institution_id))
  WITH CHECK (public.can_access_institution(institution_id));

DROP POLICY IF EXISTS "student_devices tenant all" ON public.student_devices;
CREATE POLICY "student_devices tenant all" ON public.student_devices
  FOR ALL TO authenticated
  USING (public.can_access_institution(institution_id))
  WITH CHECK (public.can_access_institution(institution_id));

DROP POLICY IF EXISTS "Institution admins can view their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Super admins can manage all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions tenant select" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions super manage" ON public.subscriptions;
CREATE POLICY "subscriptions tenant select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.can_access_institution(institution_id));
CREATE POLICY "subscriptions super manage" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
