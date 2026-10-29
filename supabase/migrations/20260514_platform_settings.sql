-- Q-Hudoor v2.5.4 - Platform owner settings
-- Safe additive migration: no attendance tables, functions, or flows are changed.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_setting_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_setting_audit_logs_setting_key
  ON public.platform_setting_audit_logs(setting_key);

CREATE INDEX IF NOT EXISTS idx_platform_setting_audit_logs_created_at
  ON public.platform_setting_audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_platform_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER set_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_platform_settings_updated_at();

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_setting_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings super select" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings super insert" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings super update" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings super delete" ON public.platform_settings;

CREATE POLICY "platform_settings super select" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (private.is_super_admin());

CREATE POLICY "platform_settings super insert" ON public.platform_settings
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());

CREATE POLICY "platform_settings super update" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

CREATE POLICY "platform_settings super delete" ON public.platform_settings
  FOR DELETE TO authenticated
  USING (private.is_super_admin());

DROP POLICY IF EXISTS "platform_setting_audit_logs super select" ON public.platform_setting_audit_logs;
DROP POLICY IF EXISTS "platform_setting_audit_logs super insert" ON public.platform_setting_audit_logs;

CREATE POLICY "platform_setting_audit_logs super select" ON public.platform_setting_audit_logs
  FOR SELECT TO authenticated
  USING (private.is_super_admin());

CREATE POLICY "platform_setting_audit_logs super insert" ON public.platform_setting_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());
