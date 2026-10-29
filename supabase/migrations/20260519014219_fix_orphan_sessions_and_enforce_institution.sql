-- Fix orphan sessions and prevent future occurrences.
--
-- (1) The buggy session created during testing has institution_id=NULL but its
--     creator is the teacher 'taher' whose institution is known. Fix it so the
--     student can register attendance against it.
--
-- (2) Add a backfill: any session with NULL institution_id but a known creator
--     gets fixed via the creator's institution.
--
-- (3) After backfill, mark institution_id as NOT NULL going forward to prevent
--     future orphans.

UPDATE public.sessions s
SET institution_id = a.institution_id
FROM public.admins a
WHERE s.institution_id IS NULL
  AND s.created_by = a.id
  AND a.institution_id IS NOT NULL;

UPDATE public.sessions s
SET institution_id = a.institution_id
FROM public.admins a
WHERE s.institution_id IS NULL
  AND s.professor_id = a.id
  AND a.institution_id IS NOT NULL;

UPDATE public.sessions s
SET institution_id = c.institution_id
FROM public.cohorts c
WHERE s.institution_id IS NULL
  AND s.cohort_id = c.id
  AND c.institution_id IS NOT NULL;

ALTER TABLE public.sessions
  ALTER COLUMN institution_id SET NOT NULL;

UPDATE public.attendances a
SET institution_id = s.institution_id
FROM public.sessions s
WHERE a.institution_id IS NULL
  AND a.session_id = s.id;

ALTER TABLE public.attendances
  ALTER COLUMN institution_id SET NOT NULL;

UPDATE public.student_devices d
SET institution_id = st.institution_id
FROM public.students st
WHERE d.institution_id IS NULL
  AND d.student_id = st.id;

ALTER TABLE public.student_devices
  ALTER COLUMN institution_id SET NOT NULL;
