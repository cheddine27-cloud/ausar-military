-- =====================================================================
-- v3.0 — Smart Attendance Module
-- =====================================================================
-- ADDITIVE ONLY: does NOT modify any existing rows, RLS policies,
-- Edge Functions, or existing constraints.
--
-- Adds:
--   1. sessions.attendance_mode        — qr | roll_call | hybrid (default qr)
--   2. attendances.attendance_source   — qr | roll_call | teacher_validation
--   3. attendances.attendance_status   — present | absent | late (default present)
--
-- Existing NULL values in source/status = legacy QR/present records.
-- Reports must treat NULL source as 'qr' and NULL status as 'present'.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. sessions.attendance_mode
-- ---------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS attendance_mode text
  DEFAULT 'qr'
  CHECK (attendance_mode IN ('qr', 'roll_call', 'hybrid'));

COMMENT ON COLUMN public.sessions.attendance_mode IS
  'v3.0: Attendance collection method for this session. qr=QR only, roll_call=Smart Roll Call only, hybrid=QR first then Roll Call for remaining students. Default qr preserves backward compatibility.';

-- Index for filtering sessions by mode
CREATE INDEX IF NOT EXISTS idx_sessions_attendance_mode
  ON public.sessions (attendance_mode)
  WHERE attendance_mode IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. attendances.attendance_source
-- ---------------------------------------------------------------------
ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS attendance_source text
  CHECK (attendance_source IN ('qr', 'roll_call', 'teacher_validation'));

COMMENT ON COLUMN public.attendances.attendance_source IS
  'v3.0: How this attendance record was created. NULL = legacy record (treat as qr). qr=student scanned QR, roll_call=teacher marked during roll call, teacher_validation=teacher manually validated.';

CREATE INDEX IF NOT EXISTS idx_attendances_source
  ON public.attendances (attendance_source)
  WHERE attendance_source IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. attendances.attendance_status
-- ---------------------------------------------------------------------
ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS attendance_status text
  DEFAULT 'present'
  CHECK (attendance_status IN ('present', 'absent', 'late'));

COMMENT ON COLUMN public.attendances.attendance_status IS
  'v3.0: Student attendance status. present=attended, absent=marked absent by teacher (roll call), late=marked late by teacher. NULL legacy records = present.';

CREATE INDEX IF NOT EXISTS idx_attendances_status
  ON public.attendances (attendance_status)
  WHERE attendance_status IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4. Composite index for teacher scope queries
--    (session_id + attendance_source + attendance_status)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attendances_session_source_status
  ON public.attendances (session_id, attendance_source, attendance_status);

-- ---------------------------------------------------------------------
-- 5. Realtime: ensure new columns are published
--    (tables already in supabase_realtime publication — no action needed)
-- ---------------------------------------------------------------------

-- Verify migration completed
DO $$
BEGIN
  -- Check attendance_mode column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'attendance_mode'
  ) THEN
    RAISE EXCEPTION 'Migration failed: sessions.attendance_mode not created';
  END IF;

  -- Check attendance_source column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attendances'
      AND column_name = 'attendance_source'
  ) THEN
    RAISE EXCEPTION 'Migration failed: attendances.attendance_source not created';
  END IF;

  -- Check attendance_status column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attendances'
      AND column_name = 'attendance_status'
  ) THEN
    RAISE EXCEPTION 'Migration failed: attendances.attendance_status not created';
  END IF;

  RAISE NOTICE 'v3.0 Smart Attendance migration completed successfully.';
END $$;
