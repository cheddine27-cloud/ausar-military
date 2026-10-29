-- =====================================================================
-- v2.8.0 — Phase 8 — Hierarchical SELECT on absence_justifications
-- =====================================================================
-- Reason: existing absence_justifications RLS only checks institution-level
-- access via private.can_access_institution(). This means a faculty_admin
-- whose user_scopes points to ONE faculty would see EVERY justification in
-- the institution — inconsistent with the hierarchical model from Phase 2B
-- (cohorts/students/sessions/attendances).
--
-- This migration tightens SELECT only. INSERT/UPDATE/DELETE policies are
-- unchanged (still can_manage_institution). Writes will be hardened in P10.
--
-- Visibility rules:
--   * super_admin -> everything
--   * unrestricted in institution (owner/admin or NULL-unit scope) -> all
--     justifications inside the institution
--   * sub-scope users (faculty_admin / department_admin / viewer with a
--     specific unit_id) -> only justifications for students whose cohort
--     belongs to a unit in their scope subtree
--   * teacher -> justifications tied to sessions they own OR cohorts in
--     teacher_assignments (so the teacher dashboard can reuse this later)
-- =====================================================================

DROP POLICY IF EXISTS "absence_justifications select" ON public.absence_justifications;

CREATE POLICY "absence_justifications select" ON public.absence_justifications
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        (
          private.is_teacher()
          AND (
            EXISTS (
              SELECT 1 FROM public.sessions s
              WHERE s.id = absence_justifications.session_id
                AND s.professor_id = private.current_admin_id()
            )
            OR EXISTS (
              SELECT 1 FROM public.students st
              WHERE st.id = absence_justifications.student_id
                AND st.cohort_id IS NOT NULL
                AND private.is_teacher_assigned_to_cohort(st.cohort_id)
            )
          )
        )
        OR
        (
          NOT private.is_teacher()
          AND (
            private.is_unrestricted_in_institution(institution_id)
            OR EXISTS (
              SELECT 1
              FROM public.students st
              JOIN public.cohorts c ON c.id = st.cohort_id
              WHERE st.id = absence_justifications.student_id
                AND c.unit_id IS NOT NULL
                AND private.user_can_view_unit(c.unit_id)
            )
          )
        )
      )
    )
  );

COMMENT ON POLICY "absence_justifications select" ON public.absence_justifications IS
  'Phase 8: hierarchical visibility via student.cohort.unit_id (matches P2B model).';
