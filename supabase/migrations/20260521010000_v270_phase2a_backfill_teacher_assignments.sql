-- =====================================================================
-- v2.7.0 — Phase 2A — STEP 1: Safe backfill before tightening SELECT RLS
-- =====================================================================
-- Backfill teacher_assignments for every existing teacher with their current
-- institution's cohorts, so the upcoming SELECT policy change does NOT
-- regress any working account (taher in particular).
--
-- Backfill user_scopes for every existing institution_owner / institution_admin
-- so they keep their institution-wide read access even when Phase 2B starts
-- relying on user_scopes for sub-institution roles.
--
-- This is data-only. No RLS changes here. Idempotent via ON CONFLICT.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Backfill teacher_assignments
-- ---------------------------------------------------------------------
INSERT INTO public.teacher_assignments (teacher_id, cohort_id, institution_id)
SELECT a.id, c.id, c.institution_id
FROM public.admins a
JOIN public.cohorts c ON c.institution_id = a.institution_id
WHERE a.role = 'teacher'
  AND a.institution_id IS NOT NULL
  AND a.institution_id <> '00000000-0000-0000-0000-000000000000'::uuid
ON CONFLICT (teacher_id, cohort_id, COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;

-- ---------------------------------------------------------------------
-- Backfill user_scopes for institution-level managers
-- ---------------------------------------------------------------------
INSERT INTO public.user_scopes (admin_id, institution_id, unit_id, scope_role)
SELECT a.id, a.institution_id, NULL::uuid, a.role
FROM public.admins a
WHERE a.role IN ('institution_owner', 'institution_admin')
  AND a.institution_id IS NOT NULL
  AND a.institution_id <> '00000000-0000-0000-0000-000000000000'::uuid
ON CONFLICT (admin_id, institution_id, COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid), scope_role) DO NOTHING;
