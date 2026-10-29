-- Performance: collapse "super_admin" + "tenant" permissive RLS policies into a single
-- unified policy per (table, command). This eliminates redundant policy
-- evaluation per query while preserving identical access semantics, since
-- private.can_access_institution() already returns true for super_admins.

-- ====================================================================
-- activity_logs
-- ====================================================================
DROP POLICY IF EXISTS "activity_logs super select all" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs super insert" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs super update" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs super delete" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs tenant select own" ON public.activity_logs;

CREATE POLICY "activity_logs select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (institution_id IS NOT NULL AND private.can_access_institution(institution_id))
  );

CREATE POLICY "activity_logs insert" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());

CREATE POLICY "activity_logs update" ON public.activity_logs
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

CREATE POLICY "activity_logs delete" ON public.activity_logs
  FOR DELETE TO authenticated
  USING (private.is_super_admin());

-- ====================================================================
-- notifications
-- ====================================================================
DROP POLICY IF EXISTS "notifications super select all" ON public.notifications;
DROP POLICY IF EXISTS "notifications super insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications super update" ON public.notifications;
DROP POLICY IF EXISTS "notifications super delete" ON public.notifications;
DROP POLICY IF EXISTS "notifications tenant select own" ON public.notifications;

CREATE POLICY "notifications select" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (institution_id IS NOT NULL AND private.can_access_institution(institution_id))
  );

CREATE POLICY "notifications insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());

CREATE POLICY "notifications update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

CREATE POLICY "notifications delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (private.is_super_admin());

-- ====================================================================
-- support_tickets
-- ====================================================================
DROP POLICY IF EXISTS "support_tickets super select all" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets super insert" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets super update" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets super delete" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets tenant select own" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets tenant insert own" ON public.support_tickets;

CREATE POLICY "support_tickets select" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (institution_id IS NOT NULL AND private.can_access_institution(institution_id))
  );

CREATE POLICY "support_tickets insert" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (institution_id IS NOT NULL AND private.can_access_institution(institution_id))
  );

CREATE POLICY "support_tickets update" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

CREATE POLICY "support_tickets delete" ON public.support_tickets
  FOR DELETE TO authenticated
  USING (private.is_super_admin());

-- ====================================================================
-- support_ticket_replies
-- ====================================================================
DROP POLICY IF EXISTS "support_ticket_replies super select all" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "support_ticket_replies super insert" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "support_ticket_replies super update" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "support_ticket_replies super delete" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "support_ticket_replies tenant select own" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "support_ticket_replies tenant insert own" ON public.support_ticket_replies;

CREATE POLICY "support_ticket_replies select" ON public.support_ticket_replies
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_ticket_replies.ticket_id
        AND t.institution_id IS NOT NULL
        AND private.can_access_institution(t.institution_id)
    )
  );

CREATE POLICY "support_ticket_replies insert" ON public.support_ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_ticket_replies.ticket_id
        AND t.institution_id IS NOT NULL
        AND private.can_access_institution(t.institution_id)
    )
  );

CREATE POLICY "support_ticket_replies update" ON public.support_ticket_replies
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

CREATE POLICY "support_ticket_replies delete" ON public.support_ticket_replies
  FOR DELETE TO authenticated
  USING (private.is_super_admin());
