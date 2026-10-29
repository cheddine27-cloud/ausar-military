-- v3.0.3 — Add settings_allowed_modes to institutions and allowed_modes to institution_units
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS settings_allowed_modes text[] 
  DEFAULT ARRAY['qr', 'roll_call', 'hybrid']::text[];

COMMENT ON COLUMN public.institutions.settings_allowed_modes IS
  'Allowed attendance collection modes for this institution. Default permits all (qr, roll_call, hybrid).';

ALTER TABLE public.institution_units
  ADD COLUMN IF NOT EXISTS allowed_modes text[] 
  DEFAULT NULL;

COMMENT ON COLUMN public.institution_units.allowed_modes IS
  'Allowed attendance collection modes for this specific unit. If NULL, inherits from institutions.settings_allowed_modes.';

-- 3. Update policy for institutions to allow managers to edit settings
DROP POLICY IF EXISTS "institutions manager update" ON public.institutions;
CREATE POLICY "institutions manager update" ON public.institutions
  FOR UPDATE TO authenticated USING (private.can_manage_institution(id)) WITH CHECK (private.can_manage_institution(id));
