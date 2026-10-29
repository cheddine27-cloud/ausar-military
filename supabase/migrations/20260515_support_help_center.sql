-- Q-Hudoor v2.5.8 - Super Admin support and help center
-- Safe additive migration: no attendance tables, functions, Edge Functions, or registration flow are changed.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  created_by_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  assigned_to_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  internal_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  CONSTRAINT support_tickets_category_check CHECK (category IN ('technical', 'activation', 'attendance', 'device', 'billing', 'training', 'general')),
  CONSTRAINT support_tickets_priority_check CHECK (priority IN ('high', 'medium', 'low')),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'in_progress', 'waiting_institution', 'resolved', 'closed'))
);

CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  reply_type TEXT NOT NULL DEFAULT 'internal',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_ticket_replies_type_check CHECK (reply_type IN ('internal', 'institution'))
);

CREATE TABLE IF NOT EXISTS public.support_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  support_email TEXT,
  support_phone TEXT,
  whatsapp_number TEXT,
  help_center_url TEXT,
  demo_request_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_institution_id
  ON public.support_tickets(institution_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority
  ON public.support_tickets(status, priority);

CREATE INDEX IF NOT EXISTS idx_support_tickets_updated_at
  ON public.support_tickets(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket_id
  ON public.support_ticket_replies(ticket_id);

CREATE OR REPLACE FUNCTION public.set_support_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER set_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_support_updated_at();

DROP TRIGGER IF EXISTS set_support_settings_updated_at ON public.support_settings;
CREATE TRIGGER set_support_settings_updated_at
BEFORE UPDATE ON public.support_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_support_updated_at();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets super select all" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets tenant select own" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets super insert" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets tenant insert own" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets super update" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets super delete" ON public.support_tickets;

CREATE POLICY "support_tickets super select all" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (private.is_super_admin());

CREATE POLICY "support_tickets tenant select own" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    institution_id IS NOT NULL
    AND private.can_access_institution(institution_id)
  );

CREATE POLICY "support_tickets super insert" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());

CREATE POLICY "support_tickets tenant insert own" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id IS NOT NULL
    AND private.can_access_institution(institution_id)
  );

CREATE POLICY "support_tickets super update" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

CREATE POLICY "support_tickets super delete" ON public.support_tickets
  FOR DELETE TO authenticated
  USING (private.is_super_admin());

DROP POLICY IF EXISTS "support_ticket_replies super select all" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "support_ticket_replies tenant select own" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "support_ticket_replies super insert" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "support_ticket_replies tenant insert own" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "support_ticket_replies super delete" ON public.support_ticket_replies;

CREATE POLICY "support_ticket_replies super select all" ON public.support_ticket_replies
  FOR SELECT TO authenticated
  USING (private.is_super_admin());

CREATE POLICY "support_ticket_replies tenant select own" ON public.support_ticket_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_replies.ticket_id
      AND t.institution_id IS NOT NULL
      AND private.can_access_institution(t.institution_id)
    )
  );

CREATE POLICY "support_ticket_replies super insert" ON public.support_ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());

CREATE POLICY "support_ticket_replies tenant insert own" ON public.support_ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_replies.ticket_id
      AND t.institution_id IS NOT NULL
      AND private.can_access_institution(t.institution_id)
    )
  );

CREATE POLICY "support_ticket_replies super delete" ON public.support_ticket_replies
  FOR DELETE TO authenticated
  USING (private.is_super_admin());

DROP POLICY IF EXISTS "support_ticket_replies super update" ON public.support_ticket_replies;
CREATE POLICY "support_ticket_replies super update" ON public.support_ticket_replies
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

DROP POLICY IF EXISTS "support_settings super select" ON public.support_settings;
DROP POLICY IF EXISTS "support_settings super insert" ON public.support_settings;
DROP POLICY IF EXISTS "support_settings super update" ON public.support_settings;
DROP POLICY IF EXISTS "support_settings super delete" ON public.support_settings;

CREATE POLICY "support_settings super select" ON public.support_settings
  FOR SELECT TO authenticated
  USING (private.is_super_admin());

CREATE POLICY "support_settings super insert" ON public.support_settings
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());

CREATE POLICY "support_settings super update" ON public.support_settings
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

CREATE POLICY "support_settings super delete" ON public.support_settings
  FOR DELETE TO authenticated
  USING (private.is_super_admin());
