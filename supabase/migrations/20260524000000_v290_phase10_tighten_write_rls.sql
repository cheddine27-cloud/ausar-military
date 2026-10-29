-- =====================================================================
-- v2.9.0 — Phase 10 — Tighten WRITE RLS (INSERT/UPDATE/DELETE)
-- =====================================================================
-- Goal: enforce that sub-scope users (faculty_admin / department_admin)
-- can only write rows whose academic ancestry stays inside their scope.
-- Viewers become strictly read-only. Teachers keep their existing write
-- abilities only inside teacher_assignments. service_role still bypasses
-- everything (register-attendance untouched).
--
-- Strategy: add ONE new helper that returns true if the current admin
-- can WRITE on a cohort (or by extension a session/student/justification
-- attached to that cohort). Then re-issue WRITE policies on the affected
-- tables to use it.
--
-- Tables tightened:
--   * cohorts
--   * students
--   * sessions  (special: teacher can still create sessions for their
--                assigned cohorts)
--   * attendances (special: keep teacher able to UPDATE/DELETE only their
--                  own session's attendance rows; service_role bypass)
--   * student_devices (teacher allowed to UPDATE is_active for their
--                       students' devices; INSERT remains via service_role)
--   * absence_justifications (managers within scope only; viewer denied)
--   * institution_units (managers within scope only; viewer denied)
--   * admins  (managers only; teacher/viewer denied)
--
-- SELECT policies are NOT touched here — they were finalized in P2A/P2B/P8.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New helper: can_write_to_cohort(cohort_id)
-- ---------------------------------------------------------------------
-- Returns true when:
--   * super_admin
--   * unrestricted in the cohort's institution (owner/admin role OR
--     user_scopes row with NULL unit_id)
--   * the cohort.unit_id is in the user's manage subtree
--     (user_can_manage_unit excludes viewers automatically)
--   * teacher who has the cohort in their teacher_assignments
CREATE OR REPLACE FUNCTION private.can_write_to_cohort(target_cohort_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    private.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.cohorts c
      WHERE c.id = target_cohort_id
        AND (
          private.is_unrestricted_in_institution(c.institution_id)
          OR (c.unit_id IS NOT NULL AND private.user_can_manage_unit(c.unit_id))
          OR (
            private.is_teacher()
            AND private.is_teacher_assigned_to_cohort(target_cohort_id)
          )
        )
    )
$$;
REVOKE ALL ON FUNCTION private.can_write_to_cohort(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_write_to_cohort(uuid) TO authenticated;

COMMENT ON FUNCTION private.can_write_to_cohort(uuid) IS
  'P10 helper: TRUE if the current admin can INSERT/UPDATE/DELETE rows tied to this cohort. Excludes viewers; respects scope subtree; allows teachers via teacher_assignments.';

-- ---------------------------------------------------------------------
-- 2. cohorts — replace WRITE policies
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "cohorts tenant insert" ON public.cohorts;
DROP POLICY IF EXISTS "cohorts tenant update" ON public.cohorts;
DROP POLICY IF EXISTS "cohorts tenant delete" ON public.cohorts;

CREATE POLICY "cohorts manage insert" ON public.cohorts
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (unit_id IS NOT NULL AND private.user_can_manage_unit(unit_id))
      )
    )
  );

CREATE POLICY "cohorts manage update" ON public.cohorts
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (unit_id IS NOT NULL AND private.user_can_manage_unit(unit_id))
      )
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (unit_id IS NOT NULL AND private.user_can_manage_unit(unit_id))
      )
    )
  );

CREATE POLICY "cohorts manage delete" ON public.cohorts
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (unit_id IS NOT NULL AND private.user_can_manage_unit(unit_id))
      )
    )
  );

-- ---------------------------------------------------------------------
-- 3. students — same model as cohorts (via cohort.unit_id)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "students tenant insert" ON public.students;
DROP POLICY IF EXISTS "students tenant update" ON public.students;
DROP POLICY IF EXISTS "students tenant delete" ON public.students;

CREATE POLICY "students manage insert" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (cohort_id IS NOT NULL AND private.can_write_to_cohort(cohort_id))
      )
    )
  );

CREATE POLICY "students manage update" ON public.students
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (cohort_id IS NOT NULL AND private.can_write_to_cohort(cohort_id))
      )
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (cohort_id IS NOT NULL AND private.can_write_to_cohort(cohort_id))
      )
    )
  );

CREATE POLICY "students manage delete" ON public.students
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (cohort_id IS NOT NULL AND private.can_write_to_cohort(cohort_id))
      )
    )
  );

-- ---------------------------------------------------------------------
-- 4. sessions — TEACHER may create/manage their own sessions
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "sessions tenant insert" ON public.sessions;
DROP POLICY IF EXISTS "sessions tenant update" ON public.sessions;
DROP POLICY IF EXISTS "sessions tenant delete" ON public.sessions;

CREATE POLICY "sessions manage insert" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.is_teacher()
      AND professor_id = private.current_admin_id()
      AND cohort_id IS NOT NULL
      AND private.is_teacher_assigned_to_cohort(cohort_id)
    )
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (cohort_id IS NOT NULL AND private.can_write_to_cohort(cohort_id))
      )
    )
  );

CREATE POLICY "sessions manage update" ON public.sessions
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_teacher()
      AND professor_id = private.current_admin_id()
    )
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (cohort_id IS NOT NULL AND private.can_write_to_cohort(cohort_id))
      )
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.is_teacher()
      AND professor_id = private.current_admin_id()
    )
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (cohort_id IS NOT NULL AND private.can_write_to_cohort(cohort_id))
      )
    )
  );

CREATE POLICY "sessions manage delete" ON public.sessions
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_teacher()
      AND professor_id = private.current_admin_id()
    )
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (cohort_id IS NOT NULL AND private.can_write_to_cohort(cohort_id))
      )
    )
  );

-- ---------------------------------------------------------------------
-- 5. attendances — INSERT through register-attendance only (service_role
--    bypasses RLS). Authenticated callers may delete/update only their
--    own session's attendance (teacher-side cleanup of suspicious rows).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "attendances tenant insert" ON public.attendances;
DROP POLICY IF EXISTS "attendances tenant update" ON public.attendances;
DROP POLICY IF EXISTS "attendances tenant delete" ON public.attendances;

CREATE POLICY "attendances manage insert" ON public.attendances
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR EXISTS (
          SELECT 1 FROM public.sessions s
          WHERE s.id = attendances.session_id
            AND s.cohort_id IS NOT NULL
            AND private.can_write_to_cohort(s.cohort_id)
        )
      )
    )
  );

CREATE POLICY "attendances manage update" ON public.attendances
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_teacher()
      AND EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.id = attendances.session_id
          AND s.professor_id = private.current_admin_id()
      )
    )
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR EXISTS (
          SELECT 1 FROM public.sessions s
          WHERE s.id = attendances.session_id
            AND s.cohort_id IS NOT NULL
            AND private.can_write_to_cohort(s.cohort_id)
        )
      )
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.is_teacher()
      AND EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.id = attendances.session_id
          AND s.professor_id = private.current_admin_id()
      )
    )
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR EXISTS (
          SELECT 1 FROM public.sessions s
          WHERE s.id = attendances.session_id
            AND s.cohort_id IS NOT NULL
            AND private.can_write_to_cohort(s.cohort_id)
        )
      )
    )
  );

CREATE POLICY "attendances manage delete" ON public.attendances
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_teacher()
      AND EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.id = attendances.session_id
          AND s.professor_id = private.current_admin_id()
      )
    )
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR EXISTS (
          SELECT 1 FROM public.sessions s
          WHERE s.id = attendances.session_id
            AND s.cohort_id IS NOT NULL
            AND private.can_write_to_cohort(s.cohort_id)
        )
      )
    )
  );

-- ---------------------------------------------------------------------
-- 6. student_devices — split FOR ALL into 4 explicit policies
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "student_devices tenant all" ON public.student_devices;

CREATE POLICY "student_devices select" ON public.student_devices
  FOR SELECT TO authenticated
  USING (private.can_access_institution(institution_id));

CREATE POLICY "student_devices insert" ON public.student_devices
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND private.is_unrestricted_in_institution(institution_id)
    )
  );

CREATE POLICY "student_devices update" ON public.student_devices
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_teacher()
      AND EXISTS (
        SELECT 1 FROM public.students st
        WHERE st.id = student_devices.student_id
          AND st.cohort_id IS NOT NULL
          AND private.is_teacher_assigned_to_cohort(st.cohort_id)
      )
    )
    OR (
      NOT private.is_teacher()
      AND private.is_unrestricted_in_institution(institution_id)
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.is_teacher()
      AND EXISTS (
        SELECT 1 FROM public.students st
        WHERE st.id = student_devices.student_id
          AND st.cohort_id IS NOT NULL
          AND private.is_teacher_assigned_to_cohort(st.cohort_id)
      )
    )
    OR (
      NOT private.is_teacher()
      AND private.is_unrestricted_in_institution(institution_id)
    )
  );

CREATE POLICY "student_devices delete" ON public.student_devices
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND private.is_unrestricted_in_institution(institution_id)
    )
  );

-- ---------------------------------------------------------------------
-- 7. absence_justifications — managers within scope only; viewers denied
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "absence_justifications insert" ON public.absence_justifications;
DROP POLICY IF EXISTS "absence_justifications update" ON public.absence_justifications;
DROP POLICY IF EXISTS "absence_justifications delete" ON public.absence_justifications;

CREATE POLICY "absence_justifications manage insert" ON public.absence_justifications
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR EXISTS (
          SELECT 1
          FROM public.students st
          WHERE st.id = absence_justifications.student_id
            AND st.cohort_id IS NOT NULL
            AND private.can_write_to_cohort(st.cohort_id)
        )
      )
    )
  );

CREATE POLICY "absence_justifications manage update" ON public.absence_justifications
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR EXISTS (
          SELECT 1
          FROM public.students st
          WHERE st.id = absence_justifications.student_id
            AND st.cohort_id IS NOT NULL
            AND private.can_write_to_cohort(st.cohort_id)
        )
      )
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR EXISTS (
          SELECT 1
          FROM public.students st
          WHERE st.id = absence_justifications.student_id
            AND st.cohort_id IS NOT NULL
            AND private.can_write_to_cohort(st.cohort_id)
        )
      )
    )
  );

CREATE POLICY "absence_justifications manage delete" ON public.absence_justifications
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR EXISTS (
          SELECT 1
          FROM public.students st
          WHERE st.id = absence_justifications.student_id
            AND st.cohort_id IS NOT NULL
            AND private.can_write_to_cohort(st.cohort_id)
        )
      )
    )
  );

-- ---------------------------------------------------------------------
-- 8. institution_units — managers within scope; viewers denied
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "institution_units insert" ON public.institution_units;
DROP POLICY IF EXISTS "institution_units update" ON public.institution_units;
DROP POLICY IF EXISTS "institution_units delete" ON public.institution_units;

CREATE POLICY "institution_units manage insert" ON public.institution_units
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR (parent_id IS NOT NULL AND private.user_can_manage_unit(parent_id))
      )
    )
  );

CREATE POLICY "institution_units manage update" ON public.institution_units
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR private.user_can_manage_unit(id)
      )
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR private.user_can_manage_unit(id)
      )
    )
  );

CREATE POLICY "institution_units manage delete" ON public.institution_units
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND (
        private.is_unrestricted_in_institution(institution_id)
        OR private.user_can_manage_unit(id)
      )
    )
  );

-- ---------------------------------------------------------------------
-- 9. admins — managers only; teachers + viewers denied write
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "admins tenant insert" ON public.admins;
DROP POLICY IF EXISTS "admins tenant update" ON public.admins;
DROP POLICY IF EXISTS "admins tenant delete" ON public.admins;

CREATE POLICY "admins manage insert" ON public.admins
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND private.is_unrestricted_in_institution(institution_id)
    )
  );

CREATE POLICY "admins manage update" ON public.admins
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR auth_user_id = (SELECT auth.uid())   -- self-edit allowed
    OR (
      NOT private.is_teacher()
      AND private.is_unrestricted_in_institution(institution_id)
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR auth_user_id = (SELECT auth.uid())
    OR (
      NOT private.is_teacher()
      AND private.is_unrestricted_in_institution(institution_id)
    )
  );

CREATE POLICY "admins manage delete" ON public.admins
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      NOT private.is_teacher()
      AND private.is_unrestricted_in_institution(institution_id)
    )
  );

-- ---------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------
COMMENT ON POLICY "cohorts manage insert" ON public.cohorts IS
  'P10: only managers can create cohorts; faculty/department admins limited to their unit subtree.';
COMMENT ON POLICY "students manage insert" ON public.students IS
  'P10: only managers can add students; cohort.unit_id must lie in their scope.';
COMMENT ON POLICY "sessions manage insert" ON public.sessions IS
  'P10: teacher may create sessions only for their assigned cohorts; managers via subtree.';
COMMENT ON POLICY "attendances manage insert" ON public.attendances IS
  'P10: frontend INSERT restricted to managers; register-attendance uses service_role and bypasses RLS.';
COMMENT ON POLICY "student_devices update" ON public.student_devices IS
  'P10: teacher can update (e.g. deactivate) devices of their assigned students.';
COMMENT ON POLICY "absence_justifications manage insert" ON public.absence_justifications IS
  'P10: managers within scope only; viewer denied.';
COMMENT ON POLICY "institution_units manage update" ON public.institution_units IS
  'P10: faculty_admin/department_admin limited to their subtree.';
COMMENT ON POLICY "admins manage insert" ON public.admins IS
  'P10: managers only; teacher/viewer cannot create admin rows.';


-- ---------------------------------------------------------------------
-- 10. Performance: cover the only unindexed FK reported by the advisor
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_absence_justifications_reviewed_by
  ON public.absence_justifications (reviewed_by_admin_id)
  WHERE reviewed_by_admin_id IS NOT NULL;
