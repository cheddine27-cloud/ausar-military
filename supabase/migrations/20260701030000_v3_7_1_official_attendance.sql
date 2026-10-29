-- =====================================================================
-- v3.7.1 — Q-Hudoor Official Attendance Approval Engine
-- =====================================================================
-- ADDITIVE ONLY: does NOT modify any existing rows, RLS policies,
-- or existing constraints. No new tables.
-- =====================================================================

-- 1. Add official attendance columns to public.attendances
--    is_official    → true once the session report is officially approved
--    approved_at    → timestamp of the approval event
--    approved_by_id → admin who performed the official approval
ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS is_official     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at     timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_id  uuid REFERENCES public.admins(id) ON DELETE SET NULL;

-- Index: fast queries for official attendance (e.g. risk calculations)
CREATE INDEX IF NOT EXISTS idx_attendances_is_official
  ON public.attendances (is_official)
  WHERE is_official = true;

-- Index: look up approvals by admin
CREATE INDEX IF NOT EXISTS idx_attendances_approved_by
  ON public.attendances (approved_by_id)
  WHERE approved_by_id IS NOT NULL;

-- Index: official attendance by student (for risk engine)
CREATE INDEX IF NOT EXISTS idx_attendances_official_by_student
  ON public.attendances (student_id, is_official)
  WHERE is_official = true;

-- 2. Add lock column to public.school_attendance_reports
--    is_locked → prevents teacher from reopening or editing this report
ALTER TABLE public.school_attendance_reports
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Index: quickly find locked vs. unlocked reports
CREATE INDEX IF NOT EXISTS idx_school_reports_is_locked
  ON public.school_attendance_reports (is_locked)
  WHERE is_locked = true;
