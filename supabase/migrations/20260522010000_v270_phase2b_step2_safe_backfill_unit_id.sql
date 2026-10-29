-- =====================================================================
-- v2.7.0 — Phase 2B — STEP 2: Safe backfill cohorts.unit_id
-- =====================================================================
-- Strategy: for any institution that owns at least one cohort with NULL
-- unit_id, ensure a "default academic unit" exists at the root level and
-- attach all unscoped cohorts to it. This keeps every existing cohort
-- visible under hierarchical RLS while preserving the institution_admin's
-- ability to reorganize them later.
--
-- Why a default unit per institution (not a single platform-wide one):
--   * unit_id has FK to institution_units(institution_id), each unit
--     belongs to ONE institution. Cross-institution sharing is forbidden.
--
-- The unit type is chosen by institution.type so the dashboard renders
-- it with the correct sector terminology:
--   university       -> 'faculty'           (الكلية الافتراضية)
--   school           -> 'school_year'       (السنة الدراسية الافتراضية)
--   training         -> 'branch'            (الفرع التدريبي الافتراضي)
--   company          -> 'team'              (الفريق الافتراضي)
--   anything else    -> 'faculty'           (fallback, sector-agnostic)
-- =====================================================================

DO $$
DECLARE
  inst RECORD;
  default_unit_id uuid;
  default_unit_type text;
  default_unit_name text;
BEGIN
  FOR inst IN
    SELECT DISTINCT i.id, i.type
    FROM public.institutions i
    JOIN public.cohorts c ON c.institution_id = i.id
    WHERE c.unit_id IS NULL
  LOOP
    CASE inst.type
      WHEN 'school'   THEN default_unit_type := 'school_year'; default_unit_name := 'السنة الدراسية الافتراضية';
      WHEN 'training' THEN default_unit_type := 'branch';      default_unit_name := 'الفرع التدريبي الافتراضي';
      WHEN 'company'  THEN default_unit_type := 'team';        default_unit_name := 'الفريق الافتراضي';
      ELSE                  default_unit_type := 'faculty';    default_unit_name := 'الوحدة الأكاديمية الافتراضية';
    END CASE;

    SELECT id INTO default_unit_id
    FROM public.institution_units
    WHERE institution_id = inst.id
      AND (metadata ->> 'is_default') = 'true'
    LIMIT 1;

    IF default_unit_id IS NULL THEN
      INSERT INTO public.institution_units (
        institution_id, parent_id, type, name, code, description, status, metadata
      ) VALUES (
        inst.id,
        NULL,
        default_unit_type,
        default_unit_name,
        'DEFAULT',
        'وحدة افتراضية أُنشئت تلقائياً في Phase 2B لربط الأفواج القديمة. يمكنك إعادة تنظيم الأفواج بعد إنشاء الكليات/الأقسام الحقيقية.',
        'active',
        jsonb_build_object('is_default', true, 'created_by', 'phase_2b_backfill')
      )
      RETURNING id INTO default_unit_id;
    END IF;

    UPDATE public.cohorts
    SET unit_id = default_unit_id
    WHERE institution_id = inst.id
      AND unit_id IS NULL;
  END LOOP;
END $$;
