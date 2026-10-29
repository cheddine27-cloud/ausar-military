-- v2.10.0 — Consolidate the two SELECT policies on support_settings into one
-- to silence the multiple_permissive_policies advisor.
-- Authenticated users (super and tenants) can read; super_admin still has
-- exclusive INSERT/UPDATE/DELETE.

DROP POLICY IF EXISTS "support_settings super select" ON public.support_settings;
DROP POLICY IF EXISTS "support_settings tenant select" ON public.support_settings;

CREATE POLICY "support_settings authenticated select" ON public.support_settings
  FOR SELECT TO authenticated
  USING (true);
