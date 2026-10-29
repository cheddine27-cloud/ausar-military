-- =====================================================================
-- v3.7.7 — Q-Hudoor Enterprise Institution Settings Center
-- =====================================================================
-- ADDITIVE ONLY: Creates tables, indexes, and RLS policies for 
-- institution settings (Key-Value) and settings history.
-- =====================================================================

-- 1. institution_settings
CREATE TABLE IF NOT EXISTS public.institution_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  category       text NOT NULL,
  key            text NOT NULL,
  value          jsonb NOT NULL,
  version        integer NOT NULL DEFAULT 1,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  CONSTRAINT uq_institution_settings_key UNIQUE (institution_id, key)
);

CREATE INDEX IF NOT EXISTS idx_institution_settings_institution_id
  ON public.institution_settings (institution_id);

CREATE INDEX IF NOT EXISTS idx_institution_settings_category
  ON public.institution_settings (institution_id, category);

-- 2. institution_settings_history
CREATE TABLE IF NOT EXISTS public.institution_settings_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  key            text NOT NULL,
  old_value      jsonb NOT NULL,
  new_value      jsonb NOT NULL,
  version        integer NOT NULL,
  changed_at     timestamptz NOT NULL DEFAULT now(),
  changed_by     uuid REFERENCES public.admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_institution_settings_history_institution_id
  ON public.institution_settings_history (institution_id);

CREATE INDEX IF NOT EXISTS idx_institution_settings_history_key
  ON public.institution_settings_history (institution_id, key);

-- Enable RLS
ALTER TABLE public.institution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_settings_history ENABLE ROW LEVEL SECURITY;

-- Drop policies if exists
DROP POLICY IF EXISTS "institution_settings tenant select" ON public.institution_settings;
DROP POLICY IF EXISTS "institution_settings tenant insert" ON public.institution_settings;
DROP POLICY IF EXISTS "institution_settings tenant update" ON public.institution_settings;
DROP POLICY IF EXISTS "institution_settings tenant delete" ON public.institution_settings;

DROP POLICY IF EXISTS "institution_settings_history tenant select" ON public.institution_settings_history;
DROP POLICY IF EXISTS "institution_settings_history tenant insert" ON public.institution_settings_history;

-- RLS Policies for institution_settings
CREATE POLICY "institution_settings tenant select" ON public.institution_settings
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() IN ('admin', 'owner')
    )
  );

CREATE POLICY "institution_settings tenant insert" ON public.institution_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() IN ('admin', 'owner')
    )
  );

CREATE POLICY "institution_settings tenant update" ON public.institution_settings
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() IN ('admin', 'owner')
    )
  );

CREATE POLICY "institution_settings tenant delete" ON public.institution_settings
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() IN ('admin', 'owner')
    )
  );

-- RLS Policies for institution_settings_history
CREATE POLICY "institution_settings_history tenant select" ON public.institution_settings_history
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() IN ('admin', 'owner')
    )
  );

CREATE POLICY "institution_settings_history tenant insert" ON public.institution_settings_history
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() IN ('admin', 'owner')
    )
  );

-- 3. Register permissions in catalog
INSERT INTO public.permission_catalog (permission_key, category, description) VALUES
  ('settings.read', 'settings', 'صلاحية قراءة إعدادات المؤسسة'),
  ('settings.update', 'settings', 'صلاحية تعديل إعدادات المؤسسة')
ON CONFLICT (permission_key) DO NOTHING;

-- 4. Assign default roles permissions (Only Admin and Owner get these)
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('admin', 'settings.read', true),
  ('admin', 'settings.update', true),
  ('owner', 'settings.read', true),
  ('owner', 'settings.update', true)
ON CONFLICT (role, permission_key) DO NOTHING;
