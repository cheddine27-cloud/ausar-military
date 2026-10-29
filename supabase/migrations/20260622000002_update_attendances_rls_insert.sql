-- v3.0.2 — Update RLS insert policy for attendances table to allow teachers to insert records for their sessions
DROP POLICY IF EXISTS "attendances manage insert" ON public.attendances;

CREATE POLICY "attendances manage insert" ON public.attendances
FOR INSERT WITH CHECK (
  private.is_super_admin() OR
  (private.is_teacher() AND (EXISTS ( SELECT 1 FROM sessions s WHERE s.id = attendances.session_id AND s.professor_id = private.current_admin_id() ))) OR
  ((NOT private.is_teacher()) AND (private.is_unrestricted_in_institution(institution_id) OR (EXISTS ( SELECT 1 FROM sessions s WHERE ((s.id = attendances.session_id) AND (s.cohort_id IS NOT NULL) AND private.can_write_to_cohort(s.cohort_id))))))
);
