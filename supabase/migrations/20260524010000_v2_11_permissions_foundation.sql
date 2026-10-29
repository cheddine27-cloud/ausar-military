-- =====================================================================
-- v2.11.0 - Permission foundation for hierarchical institutions
-- =====================================================================
-- Adds a permission layer above roles/scopes so Q-Hudoor can support:
-- institution managers, faculty managers, department managers, staff/
-- secretariat accounts, teachers, and viewers without mixing privileges.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permission catalog and defaults
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.permission_catalog (
  permission_key text PRIMARY KEY,
  category text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permission_catalog read" ON public.permission_catalog;
CREATE POLICY "permission_catalog read" ON public.permission_catalog
  FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.role_permission_defaults (
  role text NOT NULL,
  permission_key text NOT NULL REFERENCES public.permission_catalog(permission_key) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission_key)
);

ALTER TABLE public.role_permission_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permission_defaults read" ON public.role_permission_defaults;
CREATE POLICY "role_permission_defaults read" ON public.role_permission_defaults
  FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.admin_permission_overrides (
  admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permission_catalog(permission_key) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  granted_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_permission_overrides_institution
  ON public.admin_permission_overrides(institution_id);

ALTER TABLE public.admin_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_admin_permission_overrides_updated_at ON public.admin_permission_overrides;
CREATE TRIGGER trg_admin_permission_overrides_updated_at
  BEFORE UPDATE ON public.admin_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.permission_catalog (permission_key, category, description) VALUES
  ('users.create',          'users',       'Create downstream user accounts inside the permitted scope'),
  ('users.manage_scope',    'users',       'Edit user scope and role-related access'),
  ('structure.manage',      'structure',   'Create and edit units such as faculties, departments, specialties, groups'),
  ('students.read',         'students',    'Read learners inside scope'),
  ('students.manage',       'students',    'Create, edit, import, or delete learners inside scope'),
  ('groups.read',           'groups',      'Read groups/cohorts inside scope'),
  ('groups.manage',         'groups',      'Create or edit groups/cohorts inside scope'),
  ('teachers.assign',       'teachers',    'Assign teachers to groups or subjects'),
  ('sessions.create',       'attendance',  'Create attendance sessions'),
  ('sessions.manage',       'attendance',  'Close, edit, or delete attendance sessions'),
  ('attendance.read',       'attendance',  'Read attendance records inside scope'),
  ('attendance.manage',     'attendance',  'Edit or delete attendance records inside scope'),
  ('devices.read',          'devices',     'Read registered devices inside scope'),
  ('devices.manage',        'devices',     'Deactivate or manage registered devices inside scope'),
  ('reports.read',          'reports',     'Read analytics and reports inside scope'),
  ('reports.export',        'reports',     'Export reports to PDF/Excel'),
  ('justifications.manage', 'attendance',  'Review and manage absence justifications'),
  ('settings.manage',       'settings',    'Manage institution settings and branding'),
  ('subscription.manage',   'billing',     'Manage subscription/billing data'),
  ('support.manage',        'support',     'Open and manage support tickets')
ON CONFLICT (permission_key) DO UPDATE
SET category = EXCLUDED.category,
    description = EXCLUDED.description;

-- Defaults are intentionally conservative. RLS remains the final guardrail.
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  -- Full institution managers
  ('institution_owner', 'users.create', true),
  ('institution_owner', 'users.manage_scope', true),
  ('institution_owner', 'structure.manage', true),
  ('institution_owner', 'students.read', true),
  ('institution_owner', 'students.manage', true),
  ('institution_owner', 'groups.read', true),
  ('institution_owner', 'groups.manage', true),
  ('institution_owner', 'teachers.assign', true),
  ('institution_owner', 'sessions.create', true),
  ('institution_owner', 'sessions.manage', true),
  ('institution_owner', 'attendance.read', true),
  ('institution_owner', 'attendance.manage', true),
  ('institution_owner', 'devices.read', true),
  ('institution_owner', 'devices.manage', true),
  ('institution_owner', 'reports.read', true),
  ('institution_owner', 'reports.export', true),
  ('institution_owner', 'justifications.manage', true),
  ('institution_owner', 'settings.manage', true),
  ('institution_owner', 'subscription.manage', true),
  ('institution_owner', 'support.manage', true),
  ('institution_admin', 'users.create', true),
  ('institution_admin', 'users.manage_scope', true),
  ('institution_admin', 'structure.manage', true),
  ('institution_admin', 'students.read', true),
  ('institution_admin', 'students.manage', true),
  ('institution_admin', 'groups.read', true),
  ('institution_admin', 'groups.manage', true),
  ('institution_admin', 'teachers.assign', true),
  ('institution_admin', 'sessions.create', true),
  ('institution_admin', 'sessions.manage', true),
  ('institution_admin', 'attendance.read', true),
  ('institution_admin', 'attendance.manage', true),
  ('institution_admin', 'devices.read', true),
  ('institution_admin', 'devices.manage', true),
  ('institution_admin', 'reports.read', true),
  ('institution_admin', 'reports.export', true),
  ('institution_admin', 'justifications.manage', true),
  ('institution_admin', 'settings.manage', true),
  ('institution_admin', 'subscription.manage', true),
  ('institution_admin', 'support.manage', true),

  -- Scoped managers: dean / head of department
  ('faculty_admin', 'users.create', true),
  ('faculty_admin', 'users.manage_scope', true),
  ('faculty_admin', 'structure.manage', true),
  ('faculty_admin', 'students.read', true),
  ('faculty_admin', 'students.manage', true),
  ('faculty_admin', 'groups.read', true),
  ('faculty_admin', 'groups.manage', true),
  ('faculty_admin', 'teachers.assign', true),
  ('faculty_admin', 'sessions.create', true),
  ('faculty_admin', 'sessions.manage', true),
  ('faculty_admin', 'attendance.read', true),
  ('faculty_admin', 'attendance.manage', true),
  ('faculty_admin', 'devices.read', true),
  ('faculty_admin', 'devices.manage', true),
  ('faculty_admin', 'reports.read', true),
  ('faculty_admin', 'reports.export', true),
  ('faculty_admin', 'justifications.manage', true),
  ('faculty_admin', 'support.manage', true),
  ('department_admin', 'users.create', true),
  ('department_admin', 'users.manage_scope', true),
  ('department_admin', 'students.read', true),
  ('department_admin', 'students.manage', true),
  ('department_admin', 'groups.read', true),
  ('department_admin', 'groups.manage', true),
  ('department_admin', 'teachers.assign', true),
  ('department_admin', 'sessions.create', true),
  ('department_admin', 'sessions.manage', true),
  ('department_admin', 'attendance.read', true),
  ('department_admin', 'attendance.manage', true),
  ('department_admin', 'devices.read', true),
  ('department_admin', 'devices.manage', true),
  ('department_admin', 'reports.read', true),
  ('department_admin', 'reports.export', true),
  ('department_admin', 'justifications.manage', true),
  ('department_admin', 'support.manage', true),

  -- Staff / secretariat: read and export, no session creation or destructive writes.
  ('staff', 'students.read', true),
  ('staff', 'groups.read', true),
  ('staff', 'attendance.read', true),
  ('staff', 'devices.read', true),
  ('staff', 'reports.read', true),
  ('staff', 'reports.export', true),
  ('staff', 'support.manage', true),

  -- Teachers: operational within teacher_assignments.
  ('teacher', 'students.read', true),
  ('teacher', 'groups.read', true),
  ('teacher', 'sessions.create', true),
  ('teacher', 'sessions.manage', true),
  ('teacher', 'attendance.read', true),
  ('teacher', 'attendance.manage', true),
  ('teacher', 'devices.read', true),
  ('teacher', 'devices.manage', true),
  ('teacher', 'reports.read', true),
  ('teacher', 'reports.export', true),

  -- Viewers: read-only.
  ('viewer', 'students.read', true),
  ('viewer', 'groups.read', true),
  ('viewer', 'attendance.read', true),
  ('viewer', 'devices.read', true),
  ('viewer', 'reports.read', true),
  ('viewer', 'reports.export', true)
ON CONFLICT (role, permission_key) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- ---------------------------------------------------------------------
-- 2. Helper functions
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.scope_role_can_manage(scope_role text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT scope_role IN ('institution_owner', 'institution_admin', 'faculty_admin', 'department_admin')
$$;

REVOKE ALL ON FUNCTION private.scope_role_can_manage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.scope_role_can_manage(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.current_admin_has_permission(target_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, institution_id
    FROM public.admins
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  ),
  override_value AS (
    SELECT apo.allowed
    FROM public.admin_permission_overrides apo
    JOIN me ON me.id = apo.admin_id
    WHERE apo.permission_key = target_permission
    LIMIT 1
  ),
  default_value AS (
    SELECT rpd.allowed
    FROM public.role_permission_defaults rpd
    JOIN me ON me.role = rpd.role
    WHERE rpd.permission_key = target_permission
    LIMIT 1
  )
  SELECT
    private.is_super_admin()
    OR COALESCE(
      (SELECT allowed FROM override_value),
      (SELECT allowed FROM default_value),
      false
    )
$$;

REVOKE ALL ON FUNCTION private.current_admin_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_admin_has_permission(text) TO authenticated;

COMMENT ON FUNCTION private.current_admin_has_permission(text) IS
  'v2.11: permission helper combining role defaults and per-admin overrides. Super admin always allowed.';

-- user_can_manage_unit previously excluded only viewer. Staff/secretariat must
-- be view-capable but not write-capable, so management scopes are explicit.
CREATE OR REPLACE FUNCTION private.user_can_manage_unit(target_unit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE
  target AS (
    SELECT id, parent_id, institution_id
    FROM public.institution_units
    WHERE id = target_unit_id
  ),
  ancestors AS (
    SELECT id, parent_id, institution_id FROM target
    UNION ALL
    SELECT u.id, u.parent_id, u.institution_id
    FROM public.institution_units u
    INNER JOIN ancestors a ON a.parent_id = u.id
  )
  SELECT
    private.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_scopes us
      WHERE us.admin_id = private.current_admin_id()
        AND us.unit_id IS NULL
        AND private.scope_role_can_manage(us.scope_role)
        AND us.institution_id = (SELECT institution_id FROM target)
    )
    OR EXISTS (
      SELECT 1 FROM public.user_scopes us
      INNER JOIN ancestors a ON a.id = us.unit_id
      WHERE us.admin_id = private.current_admin_id()
        AND private.scope_role_can_manage(us.scope_role)
    )
$$;

REVOKE ALL ON FUNCTION private.user_can_manage_unit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.user_can_manage_unit(uuid) TO authenticated;

-- Split "unrestricted" to manager semantics. View-only institution-wide staff
-- should use view helpers, not write helpers.
CREATE OR REPLACE FUNCTION private.is_unrestricted_in_institution(target_institution_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    private.is_super_admin()
    OR (
      private.current_admin_role() IN ('institution_owner', 'institution_admin')
      AND private.current_admin_institution_id() = target_institution_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_scopes us
      WHERE us.admin_id = private.current_admin_id()
        AND us.institution_id = target_institution_id
        AND us.unit_id IS NULL
        AND private.scope_role_can_manage(us.scope_role)
    )
$$;

REVOKE ALL ON FUNCTION private.is_unrestricted_in_institution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_unrestricted_in_institution(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. RLS for per-admin overrides
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_permission_overrides select" ON public.admin_permission_overrides;
CREATE POLICY "admin_permission_overrides select" ON public.admin_permission_overrides
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR admin_id = private.current_admin_id()
    OR private.is_unrestricted_in_institution(institution_id)
  );

DROP POLICY IF EXISTS "admin_permission_overrides insert" ON public.admin_permission_overrides;
CREATE POLICY "admin_permission_overrides insert" ON public.admin_permission_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR private.is_unrestricted_in_institution(institution_id)
  );

DROP POLICY IF EXISTS "admin_permission_overrides update" ON public.admin_permission_overrides;
CREATE POLICY "admin_permission_overrides update" ON public.admin_permission_overrides
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR private.is_unrestricted_in_institution(institution_id)
  )
  WITH CHECK (
    private.is_super_admin()
    OR private.is_unrestricted_in_institution(institution_id)
  );

DROP POLICY IF EXISTS "admin_permission_overrides delete" ON public.admin_permission_overrides;
CREATE POLICY "admin_permission_overrides delete" ON public.admin_permission_overrides
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR private.is_unrestricted_in_institution(institution_id)
  );

COMMENT ON TABLE public.permission_catalog IS
  'v2.11 permission keys used to drive UI capabilities and future RLS checks.';
COMMENT ON TABLE public.role_permission_defaults IS
  'v2.11 default permissions per role; can be overridden per admin.';
COMMENT ON TABLE public.admin_permission_overrides IS
  'v2.11 per-admin permission overrides for scoped delegation.';
