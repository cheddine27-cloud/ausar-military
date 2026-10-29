-- =====================================================================
-- v2.7.0 — Phase 2B — STEP 3: Hierarchical SELECT RLS (cohorts/students/
-- sessions/attendances)
-- =====================================================================
-- New visibility model for SELECT (writes still untouched):
--
--   super_admin                       -> sees everything
--   institution_owner / admin         -> sees their entire institution
--                                        (whether via role or via a NULL
--                                        unit_id user_scopes row, see helper)
--   faculty_admin / department_admin  -> only cohorts whose unit_id is
--                                        within their user_scopes subtree
--                                        (via private.user_can_view_unit)
--   viewer                            -> read-only equivalent of
--                                        institution-wide if scope is NULL,
--                                        else same subtree as faculty_admin
--   teacher                           -> only cohorts in
--                                        teacher_assignments (Phase 2A)
--
-- Cohorts with unit_id = NULL stay visible only to "unrestricted" roles
-- (super_admin, institution_owner, institution_admin, or any user with a
-- NULL-unit_id scope row). Sub-scope users (faculty_admin tied to one
-- specific faculty unit) will NOT see unscoped cohorts. This is intentional:
-- it forces institution_admin to assign new cohorts to a unit, preventing
-- orphan data.
-- =====================================================================

CREATE OR REPLACE FUNCTION private.is_unrestricted_in_institution(target_institution_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    private.is_super_admin()
    OR (
      private.current_admin_role() IN ('institution_owner', 'institution_admin')
      AND private.current_admin_institution_id() = target_institution_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_scopes us
      WHERE us.admin_id = private.current_admin_id()
        AND us.institution_id = target_institution_id
        AND us.unit_id IS NULL
    )
$$;
REVOKE ALL ON FUNCTION private.is_unrestricted_in_institution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_unrestricted_in_institution(uuid) TO authenticated;

COMMENT ON FUNCTION private.is_unrestricted_in_institution(uuid) IS
  'Phase 2B: true if current admin can see ALL units inside the target institution (no sub-scope restriction).';

-- =====================================================================
-- cohorts SELECT — replace Phase 2A
-- =====================================================================
DROP POLICY IF EXISTS "cohorts tenant select" ON public.cohorts;

CREATE POLICY "cohorts tenant select" ON public.cohorts
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        (
          private.is_teacher()
          AND private.is_teacher_assigned_to_cohort(id)
        )
        OR
        (
          NOT private.is_teacher()
          AND (
            private.is_unrestricted_in_institution(institution_id)
            OR (
              unit_id IS NOT NULL
              AND private.user_can_view_unit(unit_id)
            )
          )
        )
      )
    )
  );

-- =====================================================================
-- students SELECT
-- =====================================================================
DROP POLICY IF EXISTS "students tenant select" ON public.students;

CREATE POLICY "students tenant select" ON public.students
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        (
          private.is_teacher()
          AND cohort_id IS NOT NULL
          AND private.is_teacher_assigned_to_cohort(cohort_id)
        )
        OR
        (
          NOT private.is_teacher()
          AND (
            private.is_unrestricted_in_institution(institution_id)
            OR EXISTS (
              SELECT 1 FROM public.cohorts c
              WHERE c.id = students.cohort_id
                AND c.unit_id IS NOT NULL
                AND private.user_can_view_unit(c.unit_id)
            )
          )
        )
      )
    )
  );

-- =====================================================================
-- sessions SELECT
-- =====================================================================
DROP POLICY IF EXISTS "sessions tenant select" ON public.sessions;

CREATE POLICY "sessions tenant select" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        (
          private.is_teacher()
          AND (
            professor_id = private.current_admin_id()
            OR (
              cohort_id IS NOT NULL
              AND private.is_teacher_assigned_to_cohort(cohort_id)
            )
          )
        )
        OR
        (
          NOT private.is_teacher()
          AND (
            private.is_unrestricted_in_institution(institution_id)
            OR EXISTS (
              SELECT 1 FROM public.cohorts c
              WHERE c.id = sessions.cohort_id
                AND c.unit_id IS NOT NULL
                AND private.user_can_view_unit(c.unit_id)
            )
          )
        )
      )
    )
  );

-- =====================================================================
-- attendances SELECT
-- =====================================================================
DROP POLICY IF EXISTS "attendances tenant select" ON public.attendances;

CREATE POLICY "attendances tenant select" ON public.attendances
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        (
          private.is_teacher()
          AND EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.id = attendances.session_id
              AND (
                s.professor_id = private.current_admin_id()
                OR (
                  s.cohort_id IS NOT NULL
                  AND private.is_teacher_assigned_to_cohort(s.cohort_id)
                )
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
              FROM public.sessions s
              JOIN public.cohorts c ON c.id = s.cohort_id
              WHERE s.id = attendances.session_id
                AND c.unit_id IS NOT NULL
                AND private.user_can_view_unit(c.unit_id)
            )
          )
        )
      )
    )
  );

COMMENT ON POLICY "cohorts tenant select" ON public.cohorts IS
  'Phase 2B: hierarchical visibility via unit_id + user_scopes. Teachers gated by teacher_assignments.';
COMMENT ON POLICY "students tenant select" ON public.students IS
  'Phase 2B: students visible if their cohort.unit_id is within current user scope (or teacher assignment).';
COMMENT ON POLICY "sessions tenant select" ON public.sessions IS
  'Phase 2B: sessions visible via cohort.unit_id scope OR teacher ownership/assignment.';
COMMENT ON POLICY "attendances tenant select" ON public.attendances IS
  'Phase 2B: attendances visible via session.cohort.unit_id scope OR teacher ownership/assignment.';
