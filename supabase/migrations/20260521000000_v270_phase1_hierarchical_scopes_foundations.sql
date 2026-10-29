-- =====================================================================
-- v2.7.0 — Phase 1 — Hierarchical SaaS foundations
-- =====================================================================
-- ADDITIVE ONLY: this migration creates new tables and helpers for the
-- hierarchical scope model, without changing any existing RLS policy.
-- Existing teacher / institution_admin / super_admin behavior is preserved
-- bit-for-bit. The new helpers are unused by any policy yet — they will be
-- wired in during Phase 2 (RLS evolution).
--
-- Adds:
--   1. CHECK constraint on admins.role (data was already clean)
--   2. Drops sentinel UUID default on admins.institution_id
--   3. Tables: user_scopes, teacher_assignments
--   4. Helpers:
--        private.user_scope_unit_ids()        -> SETOF uuid
--        private.user_scope_descendant_unit_ids() -> SETOF uuid (via recursive CTE)
--        private.user_can_view_unit(uuid)     -> boolean
--        private.user_can_manage_unit(uuid)   -> boolean
--        private.is_teacher_assigned_to_cohort(uuid) -> boolean
--   5. RLS policies on the new tables (NOT on existing ones)
--
-- Does NOT change:
--   - register-attendance edge function (uses service_role anyway)
--   - any existing policy on students/sessions/attendances/etc
--   - any application logic
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tighten admins.role (data verified clean above)
-- ---------------------------------------------------------------------
ALTER TABLE public.admins
  DROP CONSTRAINT IF EXISTS admins_role_check;

ALTER TABLE public.admins
  ADD CONSTRAINT admins_role_check
  CHECK (role IN (
    'super_admin',
    'institution_owner',
    'institution_admin',
    'faculty_admin',
    'department_admin',
    'teacher',
    'viewer'
  ));

-- Drop the sentinel UUID default so new inserts must specify institution_id
-- explicitly (or NULL for super_admin). Existing rows are not touched.
ALTER TABLE public.admins
  ALTER COLUMN institution_id DROP DEFAULT;

-- ---------------------------------------------------------------------
-- 2. user_scopes — per-user, per-unit access grants
-- ---------------------------------------------------------------------
-- Each row says: admin X has scope_role Y on institution Z (and optionally
-- a specific unit). NULL unit_id means institution-wide.
CREATE TABLE IF NOT EXISTS public.user_scopes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  unit_id         uuid REFERENCES public.institution_units(id) ON DELETE CASCADE,
  scope_role      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_scopes_role_check CHECK (scope_role IN (
    'institution_owner',
    'institution_admin',
    'faculty_admin',
    'department_admin',
    'viewer'
  ))
);

-- A user may have multiple scopes (different units), but not the same scope
-- twice on the same unit.
CREATE UNIQUE INDEX IF NOT EXISTS user_scopes_unique
  ON public.user_scopes (admin_id, institution_id, COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid), scope_role);

CREATE INDEX IF NOT EXISTS idx_user_scopes_admin_id      ON public.user_scopes (admin_id);
CREATE INDEX IF NOT EXISTS idx_user_scopes_institution   ON public.user_scopes (institution_id);
CREATE INDEX IF NOT EXISTS idx_user_scopes_unit_id       ON public.user_scopes (unit_id);

ALTER TABLE public.user_scopes ENABLE ROW LEVEL SECURITY;

-- Read: super_admin sees all; users see their own scopes; institution managers
-- see scopes within their institution.
CREATE POLICY "user_scopes select" ON public.user_scopes
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR admin_id = private.current_admin_id()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

-- Insert / update / delete: super_admin or institution managers within their
-- own institution only.
CREATE POLICY "user_scopes insert" ON public.user_scopes
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

CREATE POLICY "user_scopes update" ON public.user_scopes
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

CREATE POLICY "user_scopes delete" ON public.user_scopes
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

-- ---------------------------------------------------------------------
-- 3. teacher_assignments — link teachers to specific cohorts/units
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  cohort_id       uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  unit_id         uuid REFERENCES public.institution_units(id) ON DELETE SET NULL,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_assignments_unique
  ON public.teacher_assignments (teacher_id, cohort_id, COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher    ON public.teacher_assignments (teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_cohort     ON public.teacher_assignments (cohort_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_institution ON public.teacher_assignments (institution_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_unit_id    ON public.teacher_assignments (unit_id);

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_assignments select" ON public.teacher_assignments
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR teacher_id = private.current_admin_id()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

CREATE POLICY "teacher_assignments insert" ON public.teacher_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

CREATE POLICY "teacher_assignments update" ON public.teacher_assignments
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

CREATE POLICY "teacher_assignments delete" ON public.teacher_assignments
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.is_institution_manager()
      AND institution_id = private.current_admin_institution_id()
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_teacher_assignments_updated_at ON public.teacher_assignments;
CREATE TRIGGER trg_teacher_assignments_updated_at
  BEFORE UPDATE ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Realtime publication for the new tables
-- ---------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['user_scopes', 'teacher_assignments'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 5. Hierarchical scope helpers (UNUSED by any policy yet — Phase 2 wires)
-- ---------------------------------------------------------------------

-- Returns the set of unit_ids that the current user has DIRECT scope on.
-- super_admin returns nothing here — handled by callers via is_super_admin().
CREATE OR REPLACE FUNCTION private.user_scope_unit_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT us.unit_id
  FROM public.user_scopes us
  WHERE us.admin_id = private.current_admin_id()
    AND us.unit_id IS NOT NULL
$$;

-- Returns the full descendant tree of every unit the user has direct scope on.
-- Used to answer "is target_unit_id within the user's authority?".
-- Recursive CTE handles arbitrary depth (Faculty → Department → Specialty → Group).
CREATE OR REPLACE FUNCTION private.user_scope_descendant_unit_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE roots AS (
    SELECT unit_id FROM private.user_scope_unit_ids() AS unit_id
  ),
  tree AS (
    SELECT u.id, u.parent_id
    FROM public.institution_units u
    WHERE u.id IN (SELECT unit_id FROM roots)
    UNION ALL
    SELECT child.id, child.parent_id
    FROM public.institution_units child
    INNER JOIN tree t ON child.parent_id = t.id
  )
  SELECT DISTINCT id FROM tree
$$;

-- True if the user can VIEW the given unit. Rules:
--   * super_admin → always true
--   * scope with NULL unit_id (institution-wide) → true if same institution
--   * scope on the unit itself OR any of its ancestors → true
CREATE OR REPLACE FUNCTION private.user_can_view_unit(target_unit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE
  target AS (
    SELECT id, parent_id, institution_id
    FROM public.institution_units
    WHERE id = target_unit_id
  ),
  ancestors AS (
    SELECT id, parent_id, institution_id FROM target
    UNION ALL
    SELECT u.id, u.parent_id, u.institution_id
    FROM public.institution_units u
    INNER JOIN ancestors a ON a.parent_id = u.id
  )
  SELECT
    private.is_super_admin()
    OR EXISTS (
      -- institution-wide scope
      SELECT 1 FROM public.user_scopes us
      WHERE us.admin_id = private.current_admin_id()
        AND us.unit_id IS NULL
        AND us.institution_id = (SELECT institution_id FROM target)
    )
    OR EXISTS (
      -- scope on the unit itself or any ancestor
      SELECT 1 FROM public.user_scopes us
      INNER JOIN ancestors a ON a.id = us.unit_id
      WHERE us.admin_id = private.current_admin_id()
    )
$$;

-- True if the user can MANAGE (write) the given unit. Same rules as view but
-- viewer scope is excluded.
CREATE OR REPLACE FUNCTION private.user_can_manage_unit(target_unit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE
  target AS (
    SELECT id, parent_id, institution_id
    FROM public.institution_units
    WHERE id = target_unit_id
  ),
  ancestors AS (
    SELECT id, parent_id, institution_id FROM target
    UNION ALL
    SELECT u.id, u.parent_id, u.institution_id
    FROM public.institution_units u
    INNER JOIN ancestors a ON a.parent_id = u.id
  )
  SELECT
    private.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_scopes us
      WHERE us.admin_id = private.current_admin_id()
        AND us.unit_id IS NULL
        AND us.scope_role <> 'viewer'
        AND us.institution_id = (SELECT institution_id FROM target)
    )
    OR EXISTS (
      SELECT 1 FROM public.user_scopes us
      INNER JOIN ancestors a ON a.id = us.unit_id
      WHERE us.admin_id = private.current_admin_id()
        AND us.scope_role <> 'viewer'
    )
$$;

-- True if the calling user is a teacher and is assigned to the given cohort.
-- Useful for tightening teacher-side RLS on cohorts/students/sessions.
CREATE OR REPLACE FUNCTION private.is_teacher_assigned_to_cohort(target_cohort_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    WHERE ta.teacher_id = private.current_admin_id()
      AND ta.cohort_id = target_cohort_id
  )
$$;

-- ---------------------------------------------------------------------
-- 6. Permissions on helpers
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.user_scope_unit_ids()                    FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_scope_descendant_unit_ids()         FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_can_view_unit(uuid)                 FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_can_manage_unit(uuid)               FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_teacher_assigned_to_cohort(uuid)      FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.user_scope_unit_ids()                 TO authenticated;
GRANT EXECUTE ON FUNCTION private.user_scope_descendant_unit_ids()      TO authenticated;
GRANT EXECUTE ON FUNCTION private.user_can_view_unit(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION private.user_can_manage_unit(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_teacher_assigned_to_cohort(uuid)   TO authenticated;

COMMENT ON TABLE public.user_scopes IS
  'Hierarchical access grants. A user may have multiple scopes, optionally bound to an institution_unit (faculty/department/group/...). NULL unit_id = institution-wide.';

COMMENT ON TABLE public.teacher_assignments IS
  'Links teachers to specific cohorts (and optionally subject/course units). Used by Phase 2 RLS to scope teachers to their assigned cohorts only.';

COMMENT ON FUNCTION private.user_can_view_unit(uuid) IS
  'Phase 1 helper (not yet used by any policy). True if the current admin can view the given unit, considering scope inheritance.';
