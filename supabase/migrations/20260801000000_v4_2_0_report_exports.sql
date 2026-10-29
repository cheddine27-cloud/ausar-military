-- =====================================================================
-- v4.2.0 — Add report_exports table to resolve dashboard 404 console error
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.report_exports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'failed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on report_exports
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

-- Add RLS select/write policies
DROP POLICY IF EXISTS "report_exports tenant select" ON public.report_exports;
CREATE POLICY "report_exports tenant select" ON public.report_exports
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "report_exports tenant write" ON public.report_exports;
CREATE POLICY "report_exports tenant write" ON public.report_exports
  FOR ALL TO authenticated
  USING (
    private.is_super_admin() 
    OR (private.is_institution_manager() AND (institution_id = private.current_admin_institution_id()))
  )
  WITH CHECK (
    private.is_super_admin() 
    OR (private.is_institution_manager() AND (institution_id = private.current_admin_institution_id()))
  );
