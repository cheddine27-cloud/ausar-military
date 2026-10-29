-- =====================================================================
-- v2.7.0 — Phase 2A — STEP 2: Tighten SELECT RLS (read-only changes)
-- =====================================================================
-- Strategy: keep all WRITE behavior identical. Only the SELECT visibility
-- of (cohorts, students, sessions, attendances) is narrowed for the
-- 'teacher' role: a teacher will only see cohorts they're assigned to and
-- the students/sessions/attendances tied to those cohorts.
--
-- For all OTHER roles (super_admin, institution_*, faculty/department_admin,
-- viewer), behavior is unchanged: institution-wide visibility within their
-- own institution. Sub-institution scoping (faculty_admin → only their
-- faculty's cohorts) is deferred to Phase 2B once cohorts.unit_id exists.
--
-- Mechanism: the existing FOR ALL "tenant all" policies cover all four
-- commands. We split each into:
--   * a NEW SELECT policy that adds the teacher gate
--   * an unchanged INSERT/UPDATE/DELETE policy with identical USING/CHECK
--
-- This way INSERT/UPDATE/DELETE semantics are byte-for-byte identical.
-- =====================================================================

-- A small helper to keep policy code DRY: returns true if current admin is
-- a teacher (so we know to apply the assignment gate).
CREATE OR REPLACE FUNCTION private.is_teacher()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT private.current_admin_role() = 'teacher'
$$;
REVOKE ALL ON FUNCTION private.is_teacher() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_teacher() TO authenticated;

-- ============================================================
-- cohorts
-- ============================================================
DROP POLICY IF EXISTS "cohorts tenant all" ON public.cohorts;

-- SELECT: tighter — teacher must be assigned
CREATE POLICY "cohorts tenant select" ON public.cohorts
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        NOT private.is_teacher()
        OR private.is_teacher_assigned_to_cohort(id)
      )
    )
  );

-- INSERT/UPDATE/DELETE: identical to the previous "tenant all" semantics.
CREATE POLICY "cohorts tenant insert" ON public.cohorts
  FOR INSERT TO authenticated
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "cohorts tenant update" ON public.cohorts
  FOR UPDATE TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "cohorts tenant delete" ON public.cohorts
  FOR DELETE TO authenticated
  USING (private.can_access_institution(institution_id));

-- ============================================================
-- students
-- ============================================================
DROP POLICY IF EXISTS "students tenant all" ON public.students;

CREATE POLICY "students tenant select" ON public.students
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        NOT private.is_teacher()
        OR (
          cohort_id IS NOT NULL
          AND private.is_teacher_assigned_to_cohort(cohort_id)
        )
      )
    )
  );

CREATE POLICY "students tenant insert" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "students tenant update" ON public.students
  FOR UPDATE TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "students tenant delete" ON public.students
  FOR DELETE TO authenticated
  USING (private.can_access_institution(institution_id));

-- ============================================================
-- sessions
-- ============================================================
DROP POLICY IF EXISTS "sessions tenant all" ON public.sessions;

-- For sessions, a teacher should see (a) sessions they own as professor_id,
-- AND (b) sessions for cohorts they're assigned to. Both grant visibility.
CREATE POLICY "sessions tenant select" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        NOT private.is_teacher()
        OR professor_id = private.current_admin_id()
        OR (
          cohort_id IS NOT NULL
          AND private.is_teacher_assigned_to_cohort(cohort_id)
        )
      )
    )
  );

CREATE POLICY "sessions tenant insert" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "sessions tenant update" ON public.sessions
  FOR UPDATE TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "sessions tenant delete" ON public.sessions
  FOR DELETE TO authenticated
  USING (private.can_access_institution(institution_id));

-- ============================================================
-- attendances
-- ============================================================
DROP POLICY IF EXISTS "attendances tenant all" ON public.attendances;

-- Attendance is institution-scoped + (for teachers) restricted to sessions
-- of their assigned cohorts (or sessions they own).
CREATE POLICY "attendances tenant select" ON public.attendances
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        NOT private.is_teacher()
        OR EXISTS (
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
    )
  );

CREATE POLICY "attendances tenant insert" ON public.attendances
  FOR INSERT TO authenticated
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "attendances tenant update" ON public.attendances
  FOR UPDATE TO authenticated
  USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "attendances tenant delete" ON public.attendances
  FOR DELETE TO authenticated
  USING (private.can_access_institution(institution_id));

COMMENT ON POLICY "cohorts tenant select" ON public.cohorts IS
  'Phase 2A: tighter SELECT for teachers (assignment-gated). Other roles unchanged.';
COMMENT ON POLICY "students tenant select" ON public.students IS
  'Phase 2A: teachers only see students whose cohort is in their teacher_assignments.';
COMMENT ON POLICY "sessions tenant select" ON public.sessions IS
  'Phase 2A: teachers see their own sessions OR sessions for assigned cohorts.';
COMMENT ON POLICY "attendances tenant select" ON public.attendances IS
  'Phase 2A: teachers see attendances tied to their assigned cohorts/sessions.';
