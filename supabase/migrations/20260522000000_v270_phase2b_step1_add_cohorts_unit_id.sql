-- =====================================================================
-- v2.7.0 — Phase 2B — STEP 1: Add cohorts.unit_id (nullable)
-- =====================================================================
-- Adds a soft FK from cohorts to institution_units. Stays NULLABLE so we
-- never break legacy cohorts that have no academic unit assigned yet.
-- Phase 2C (later, optional) may tighten this to NOT NULL after a full
-- backfill cycle once the Institution Admin Dashboard exposes a UI for
-- editing it.
--
-- ON DELETE SET NULL: deleting a unit must NOT cascade-delete cohorts.
-- The cohort gets demoted to "unassigned" so it remains visible to the
-- institution-wide manager, while losing visibility for sub-scope users.
-- =====================================================================

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS unit_id uuid
  REFERENCES public.institution_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cohorts_unit_id
  ON public.cohorts (unit_id)
  WHERE unit_id IS NOT NULL;

COMMENT ON COLUMN public.cohorts.unit_id IS
  'Optional link to institution_units. Phase 2B uses this for hierarchical RLS. NULL means the cohort is unscoped (visible institution-wide only).';
