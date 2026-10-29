-- Backfill institution_id for orphan students from their cohort, then
-- enforce NOT NULL to prevent recurrence (super_admin without institution_id
-- creating students inside a tenant cohort).

UPDATE public.students s
SET institution_id = c.institution_id
FROM public.cohorts c
WHERE s.institution_id IS NULL
  AND s.cohort_id = c.id
  AND c.institution_id IS NOT NULL;

ALTER TABLE public.students
  ALTER COLUMN institution_id SET NOT NULL;
