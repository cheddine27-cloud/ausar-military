-- =====================================================================
-- v3.7.5 — Q-Hudoor Classroom Mode Module
-- =====================================================================
-- ADDITIVE ONLY: Adds teacher_notes column to attendances table
-- and registers classroom.enter permission.
-- =====================================================================

-- 1. Additive column to attendances table
ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS teacher_notes text;

-- 2. Register classroom.enter permission
INSERT INTO public.permission_catalog (permission_key, category, description) VALUES
  ('classroom.enter', 'classroom', 'صلاحية دخول فضاء التدريس (Classroom Mode)')
ON CONFLICT (permission_key) DO NOTHING;

-- 3. Assign defaults
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('teacher', 'classroom.enter', true),
  ('staff', 'classroom.enter', true),
  ('admin', 'classroom.enter', true),
  ('owner', 'classroom.enter', true)
ON CONFLICT (role, permission_key) DO NOTHING;
