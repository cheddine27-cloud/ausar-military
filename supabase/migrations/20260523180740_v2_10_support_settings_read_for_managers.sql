-- v2.10.0 — Allow institution managers to READ platform contact info
-- Safe additive: only adds a SELECT policy. No write access granted.
-- Rationale: Institution Admin "support" page must surface support_email /
-- phone / whatsapp so institutions know how to reach Q-Hudoor.

DROP POLICY IF EXISTS "support_settings tenant select" ON public.support_settings;
CREATE POLICY "support_settings tenant select" ON public.support_settings
  FOR SELECT TO authenticated
  USING (true);

-- Seed a single row of platform contact info if none exists.
INSERT INTO public.support_settings (support_email, support_phone, whatsapp_number, help_center_url, demo_request_url)
SELECT 'support@q-hudoor.com', '+213 770 00 00 00', '+213 770 00 00 00', 'https://q-hudoor.vercel.app', 'https://q-hudoor.vercel.app/download'
WHERE NOT EXISTS (SELECT 1 FROM public.support_settings);
