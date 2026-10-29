-- =====================================================================
-- Q-Hudoor v3.8.8 — Attendance Finalization & Daily Operations
-- =====================================================================

-- 1. Add justification details to attendances table
ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS last_justification_status text DEFAULT 'not_justified' CHECK (last_justification_status IN ('justified', 'pending', 'rejected', 'not_justified')),
  ADD COLUMN IF NOT EXISTS last_justification_reason text,
  ADD COLUMN IF NOT EXISTS last_justification_date date,
  ADD COLUMN IF NOT EXISTS last_justification_reference text,
  ADD COLUMN IF NOT EXISTS teacher_justification_requested boolean DEFAULT false;

-- 2. Seed Permissions Catalog
INSERT INTO public.permission_catalog (permission_key, category, description)
VALUES
  ('attendance.justification.request',  'attendance', 'Request attendance justification from admin'),
  ('attendance.notifications.manual',   'attendance', 'Manually send absence notifications to parents'),
  ('attendance.notifications.resend',   'attendance', 'Resend failed parent notifications'),
  ('attendance.notifications.cancel',   'attendance', 'Cancel pending parent notifications'),
  ('attendance.justification.view',     'attendance', 'View justification details and status badges'),
  ('attendance.operations.dashboard',    'attendance', 'Access the daily attendance operations dashboard')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permission_defaults (role, permission_key, allowed)
VALUES
  ('institution_admin', 'attendance.justification.request',  true),
  ('institution_admin', 'attendance.notifications.manual',   true),
  ('institution_admin', 'attendance.notifications.resend',   true),
  ('institution_admin', 'attendance.notifications.cancel',   true),
  ('institution_admin', 'attendance.justification.view',     true),
  ('institution_admin', 'attendance.operations.dashboard',    true),

  ('manager', 'attendance.justification.view',     true),
  ('manager', 'attendance.notifications.manual',   true),

  ('teacher', 'attendance.justification.request',  true),
  ('teacher', 'attendance.justification.view',     true),
  
  ('viewer',  'attendance.justification.view',     true)
ON CONFLICT (role, permission_key) DO NOTHING;
