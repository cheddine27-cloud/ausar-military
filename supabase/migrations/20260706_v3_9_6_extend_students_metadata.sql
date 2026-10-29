-- Extend students table with birth_place and academic_year_id columns
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS birth_place text,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
