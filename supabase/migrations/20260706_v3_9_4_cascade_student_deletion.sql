-- Fix foreign key constraint on attendances to cascade on student deletion
ALTER TABLE public.attendances
  DROP CONSTRAINT IF EXISTS attendances_student_id_fkey,
  ADD CONSTRAINT attendances_student_id_fkey
    FOREIGN KEY (student_id)
    REFERENCES public.students(id)
    ON DELETE CASCADE;
