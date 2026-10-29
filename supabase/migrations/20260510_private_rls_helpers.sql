-- Move RLS helper functions out of the exposed public API schema.
-- The public resolve_admin_login_email function remains anon-callable for username login.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_admin_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.admins WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.current_admin_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.admins WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.current_admin_institution_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM public.admins WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(private.current_admin_role() = 'super_admin', false)
$$;

CREATE OR REPLACE FUNCTION private.can_access_institution(target_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_super_admin()
      OR target_institution_id = private.current_admin_institution_id()
$$;

REVOKE ALL ON FUNCTION private.current_admin_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_admin_institution_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_institution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_admin_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_admin_institution_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_institution(UUID) TO authenticated;

DROP POLICY IF EXISTS "institutions tenant select" ON public.institutions;
DROP POLICY IF EXISTS "institutions super manage" ON public.institutions;
DROP POLICY IF EXISTS "institutions super insert" ON public.institutions;
DROP POLICY IF EXISTS "institutions super update" ON public.institutions;
DROP POLICY IF EXISTS "institutions super delete" ON public.institutions;
CREATE POLICY "institutions tenant select" ON public.institutions
  FOR SELECT TO authenticated
  USING (private.can_access_institution(id));
CREATE POLICY "institutions super insert" ON public.institutions
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());
CREATE POLICY "institutions super update" ON public.institutions
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());
CREATE POLICY "institutions super delete" ON public.institutions
  FOR DELETE TO authenticated
  USING (private.is_super_admin());

DROP POLICY IF EXISTS "admins tenant select" ON public.admins;
DROP POLICY IF EXISTS "admins tenant insert" ON public.admins;
DROP POLICY IF EXISTS "admins tenant update" ON public.admins;
DROP POLICY IF EXISTS "admins tenant delete" ON public.admins;
CREATE POLICY "admins tenant select" ON public.admins
  FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()) OR private.can_access_institution(institution_id));
CREATE POLICY "admins tenant insert" ON public.admins
  FOR INSERT TO authenticated
  WITH CHECK (private.can_access_institution(institution_id));
CREATE POLICY "admins tenant update" ON public.admins
  FOR UPDATE TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));
CREATE POLICY "admins tenant delete" ON public.admins
  FOR DELETE TO authenticated
  USING (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "faculties tenant all" ON public.faculties;
CREATE POLICY "faculties tenant all" ON public.faculties
  FOR ALL TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "departments tenant all" ON public.departments;
CREATE POLICY "departments tenant all" ON public.departments
  FOR ALL TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "specialties tenant all" ON public.specialties;
CREATE POLICY "specialties tenant all" ON public.specialties
  FOR ALL TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "cohorts tenant all" ON public.cohorts;
CREATE POLICY "cohorts tenant all" ON public.cohorts
  FOR ALL TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "students tenant all" ON public.students;
CREATE POLICY "students tenant all" ON public.students
  FOR ALL TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "sessions tenant all" ON public.sessions;
CREATE POLICY "sessions tenant all" ON public.sessions
  FOR ALL TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "attendances tenant all" ON public.attendances;
CREATE POLICY "attendances tenant all" ON public.attendances
  FOR ALL TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "student_devices tenant all" ON public.student_devices;
CREATE POLICY "student_devices tenant all" ON public.student_devices
  FOR ALL TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "subscriptions tenant select" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions super manage" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions super insert" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions super update" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions super delete" ON public.subscriptions;
CREATE POLICY "subscriptions tenant select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (private.can_access_institution(institution_id));
CREATE POLICY "subscriptions super insert" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());
CREATE POLICY "subscriptions super update" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());
CREATE POLICY "subscriptions super delete" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (private.is_super_admin());

REVOKE ALL ON FUNCTION public.current_admin_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_admin_institution_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_access_institution(UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.resolve_admin_login_email(TEXT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_admin_login_email(TEXT) TO anon;
