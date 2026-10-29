-- v3.0.1 — Add UNIQUE constraint to attendances for client-side upsert compatibility
ALTER TABLE public.attendances
  ADD CONSTRAINT attendances_session_student_unique UNIQUE (session_id, student_id);
