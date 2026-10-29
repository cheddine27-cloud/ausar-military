-- =====================================================================
-- v2.12.0 - Permission cleanup after teacher/institution dashboard split
-- =====================================================================
-- Tightens default role capabilities without changing attendance
-- registration, QR flow, Flutter, or core RLS scoping.
-- =====================================================================

BEGIN;

-- 1) Add precise teacher/support permission keys used by the UI.
INSERT INTO public.permission_catalog (permission_key, category, description) VALUES
  ('teacher.dashboard.view', 'teacher',    'Open the dedicated teacher dashboard'),
  ('sessions.view_own',      'attendance', 'View sessions owned by the current teacher'),
  ('sessions.create_own',    'attendance', 'Create sessions owned by the current teacher'),
  ('attendance.view_own',    'attendance', 'View attendance records for sessions owned by the current teacher'),
  ('attendance.manage_own',  'attendance', 'Manage attendance records for sessions owned by the current teacher'),
  ('cohorts.view_assigned',  'groups',     'View cohorts assigned to the current teacher'),
  ('students.view_assigned', 'students',   'View students in cohorts assigned to the current teacher'),
  ('support.create_ticket',  'support',    'Create support tickets for the current institution')
ON CONFLICT (permission_key) DO UPDATE
SET category = EXCLUDED.category,
    description = EXCLUDED.description;

-- 2) Rebuild defaults for roles affected by the cleanup.
DELETE FROM public.role_permission_defaults
WHERE role IN ('teacher', 'staff', 'viewer', 'faculty_admin', 'department_admin');

INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  -- Scoped faculty admin: can administer inside faculty scope, but cannot
  -- delete users or reset passwords by default.
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
  ('faculty_admin', 'support.create_ticket', true),

  -- Scoped department admin: can manage department data, but cannot delete
  -- users or reset passwords by default.
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
  ('department_admin', 'support.create_ticket', true),

  -- Staff: read-only institution workspace + report view + create support ticket.
  ('staff', 'students.read', true),
  ('staff', 'groups.read', true),
  ('staff', 'attendance.read', true),
  ('staff', 'devices.read', true),
  ('staff', 'reports.read', true),
  ('staff', 'support.create_ticket', true),

  -- Teacher: dedicated dashboard only, scoped through teacher_assignments.
  ('teacher', 'teacher.dashboard.view', true),
  ('teacher', 'sessions.view_own', true),
  ('teacher', 'sessions.create_own', true),
  ('teacher', 'attendance.view_own', true),
  ('teacher', 'attendance.manage_own', true),
  ('teacher', 'cohorts.view_assigned', true),
  ('teacher', 'students.view_assigned', true),

  -- Viewer: read-only, no export.
  ('viewer', 'students.read', true),
  ('viewer', 'groups.read', true),
  ('viewer', 'attendance.read', true),
  ('viewer', 'devices.read', true),
  ('viewer', 'reports.read', true)
ON CONFLICT (role, permission_key) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- Ensure sensitive old defaults cannot survive from prior migrations.
DELETE FROM public.role_permission_defaults
WHERE (role = 'teacher' AND permission_key IN (
  'devices.manage',
  'reports.export',
  'attendance.manage',
  'sessions.create',
  'sessions.manage',
  'students.read',
  'groups.read',
  'devices.read',
  'reports.read'
))
OR (role IN ('faculty_admin', 'department_admin') AND permission_key IN (
  'users.delete',
  'users.reset_password'
))
OR (role = 'staff' AND permission_key IN (
  'users.create',
  'users.delete',
  'users.reset_password',
  'devices.manage',
  'structure.manage',
  'students.manage',
  'groups.manage',
  'sessions.create',
  'sessions.manage',
  'attendance.manage',
  'reports.export',
  'support.manage'
))
OR (role = 'viewer' AND permission_key IN (
  'users.create',
  'users.delete',
  'users.reset_password',
  'devices.manage',
  'structure.manage',
  'students.manage',
  'groups.manage',
  'sessions.create',
  'sessions.manage',
  'attendance.manage',
  'reports.export',
  'support.manage',
  'support.create_ticket'
));

-- 3) Support ticket creation is its own capability.
DROP POLICY IF EXISTS "support_tickets insert" ON public.support_tickets;
CREATE POLICY "support_tickets insert" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      institution_id IS NOT NULL
      AND private.can_access_institution(institution_id)
      AND (
        private.current_admin_has_permission('support.create_ticket')
        OR private.current_admin_has_permission('support.manage')
      )
    )
  );

-- 4) Clean the Taher teacher metadata and ensure he is scoped only by
-- teacher_assignments, not user_scopes.
UPDATE public.admins
SET rank = 'أستاذ'
WHERE username = 'taher'
  AND role = 'teacher';

DELETE FROM public.user_scopes
WHERE admin_id IN (
  SELECT id FROM public.admins WHERE username = 'taher' AND role = 'teacher'
);

COMMIT;
