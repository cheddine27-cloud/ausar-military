-- v2.11.1 — Make 'staff' role usable end-to-end.
-- The permission foundation in 4920572 added 'staff' as an AdminRole in
-- TS, in the create-institution-user Edge Function, and in the permission
-- defaults table. But the underlying CHECK constraints on admins.role and
-- user_scopes.scope_role still rejected the new value, so any staff
-- account would fail at INSERT time. Same idempotent fix for both.

-- 1) admins.role
ALTER TABLE public.admins
  DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE public.admins
  ADD CONSTRAINT admins_role_check
  CHECK (role = ANY (ARRAY[
    'super_admin'::text,
    'institution_owner'::text,
    'institution_admin'::text,
    'faculty_admin'::text,
    'department_admin'::text,
    'staff'::text,
    'teacher'::text,
    'viewer'::text
  ]));

-- 2) user_scopes.scope_role
ALTER TABLE public.user_scopes
  DROP CONSTRAINT IF EXISTS user_scopes_role_check;
ALTER TABLE public.user_scopes
  ADD CONSTRAINT user_scopes_role_check
  CHECK (scope_role = ANY (ARRAY[
    'institution_owner'::text,
    'institution_admin'::text,
    'faculty_admin'::text,
    'department_admin'::text,
    'staff'::text,
    'viewer'::text
  ]));
