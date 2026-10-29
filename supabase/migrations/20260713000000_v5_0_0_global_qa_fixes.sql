-- =====================================================================
-- v4.2.0 — Q-Hudoor Enterprise Multi-Tenant Security & Cleanups
-- =====================================================================

-- Drop the unused and insecure table timetable_periods (replaced by academic_periods)
DROP TABLE IF EXISTS public.timetable_periods CASCADE;
