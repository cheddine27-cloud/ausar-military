-- =====================================================================
-- v4.1.2 — Secondary School UAT Fixes
-- =====================================================================
-- Corrects foreign key constraints on school_attendance_reports to point
-- class_id to public.cohorts(id) instead of public.institution_units(id)
-- to prevent constraint violations during session submissions.
-- =====================================================================

ALTER TABLE public.school_attendance_reports
  DROP CONSTRAINT IF EXISTS school_attendance_reports_class_id_fkey;

ALTER TABLE public.school_attendance_reports
  ADD CONSTRAINT school_attendance_reports_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES public.cohorts(id) ON DELETE CASCADE;
