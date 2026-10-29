-- =====================================================================
-- v3.7.9 — Q-Hudoor Enterprise Communication & Notification Center
-- =====================================================================
-- ADDITIVE ONLY: Creates tables, indexes, and RLS policies for 
-- messages, templates, delivery logs, and user notifications.
-- =====================================================================

-- 1. communication_messages
CREATE TABLE IF NOT EXISTS public.communication_messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  sender_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role           text NOT NULL CHECK (sender_role IN ('admin', 'owner', 'teacher')),
  target_type           text NOT NULL CHECK (target_type IN ('student', 'parent', 'class', 'cohort', 'teachers')),
  target_id             uuid NOT NULL,
  category              text NOT NULL CHECK (category IN ('attendance', 'discipline', 'meeting', 'announcement', 'exam', 'homework', 'general', 'emergency')),
  title                 text NOT NULL,
  body                  text NOT NULL,
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'scheduled', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'paused')),
  priority              text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  scheduled_at          timestamptz,
  sent_at               timestamptz,
  read_at               timestamptz,
  approved_by           uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  approved_at           timestamptz,
  
  -- Seen details (seen receipt)
  seen                  boolean NOT NULL DEFAULT false,
  seen_at               timestamptz,
  read_duration_seconds integer,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_msg_inst ON public.communication_messages (institution_id);
CREATE INDEX IF NOT EXISTS idx_comm_msg_sender ON public.communication_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_comm_msg_status ON public.communication_messages (status);

-- 2. message_templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name           text NOT NULL,
  category       text NOT NULL CHECK (category IN ('attendance', 'discipline', 'meeting', 'announcement', 'exam', 'homework', 'general', 'emergency')),
  title_template text NOT NULL,
  body_template  text NOT NULL,
  created_by     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msg_tmpl_inst ON public.message_templates (institution_id);

-- 3. message_delivery_logs
CREATE TABLE IF NOT EXISTS public.message_delivery_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id     uuid NOT NULL REFERENCES public.communication_messages(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  device         text NOT NULL,
  browser        text NOT NULL,
  channel        text NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'whatsapp', 'push')),
  status         text NOT NULL CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_msg_id ON public.message_delivery_logs (message_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_inst ON public.message_delivery_logs (institution_id);

-- 4. user_inbox_notifications (Notification Bell center)
CREATE TABLE IF NOT EXISTS public.user_inbox_notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text NOT NULL,
  body           text NOT NULL,
  category       text NOT NULL,
  is_read        boolean NOT NULL DEFAULT false,
  is_pinned      boolean NOT NULL DEFAULT false,
  is_archived    boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_inbox_notif_user ON public.user_inbox_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_user_inbox_notif_inst ON public.user_inbox_notifications (institution_id);

-- Enable RLS
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inbox_notifications ENABLE ROW LEVEL SECURITY;

-- communication_messages RLS Policies
CREATE POLICY "communication_messages select" ON public.communication_messages
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner')
        OR sender_id = auth.uid()
        OR target_id = auth.uid() -- if parent / student linked via auth.uid()
      )
    )
  );

CREATE POLICY "communication_messages insert" ON public.communication_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner', 'teacher')
        AND sender_id = auth.uid()
      )
    )
  );

CREATE POLICY "communication_messages update" ON public.communication_messages
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner')
        OR sender_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner')
        OR sender_id = auth.uid()
      )
    )
  );

CREATE POLICY "communication_messages delete" ON public.communication_messages
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner')
        OR (sender_id = auth.uid() AND status = 'draft')
      )
    )
  );

-- message_templates RLS Policies
CREATE POLICY "message_templates select" ON public.message_templates
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR private.can_access_institution(institution_id)
  );

CREATE POLICY "message_templates modify" ON public.message_templates
  FOR ALL TO authenticated
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

-- message_delivery_logs RLS Policies
CREATE POLICY "message_delivery_logs select" ON public.message_delivery_logs
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR private.can_access_institution(institution_id)
  );

CREATE POLICY "message_delivery_logs insert" ON public.message_delivery_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR private.can_access_institution(institution_id)
  );

-- user_inbox_notifications RLS Policies
CREATE POLICY "user_inbox_notifications select" ON public.user_inbox_notifications
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "user_inbox_notifications modify" ON public.user_inbox_notifications
  FOR ALL TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND user_id = auth.uid()
    )
  );

-- 5. Register permissions in catalog
INSERT INTO public.permission_catalog (permission_key, category, description) VALUES
  ('communications.read', 'communications', 'صلاحية قراءة الرسائل والتبليغات'),
  ('communications.create', 'communications', 'صلاحية إنشاء مسودة رسائل تواصل جديدة'),
  ('communications.review', 'communications', 'صلاحية مراجعة واعتماد التبليغات المعلقة'),
  ('communications.send', 'communications', 'صلاحية إرسال التبليغات فورا'),
  ('communications.schedule', 'communications', 'صلاحية جدولة الرسائل للارسال لاحقاً'),
  ('communications.templates', 'communications', 'صلاحية إدارة قوالب الرسائل'),
  ('communications.analytics', 'communications', 'صلاحية عرض تحليلات الاتصالات ونسب القراءة')
ON CONFLICT (permission_key) DO NOTHING;

-- 6. Assign defaults
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('admin', 'communications.read', true),
  ('admin', 'communications.create', true),
  ('admin', 'communications.review', true),
  ('admin', 'communications.send', true),
  ('admin', 'communications.schedule', true),
  ('admin', 'communications.templates', true),
  ('admin', 'communications.analytics', true),
  
  ('owner', 'communications.read', true),
  ('owner', 'communications.create', true),
  ('owner', 'communications.review', true),
  ('owner', 'communications.send', true),
  ('owner', 'communications.schedule', true),
  ('owner', 'communications.templates', true),
  ('owner', 'communications.analytics', true),
  
  ('teacher', 'communications.read', true),
  ('teacher', 'communications.create', true)
ON CONFLICT (role, permission_key) DO NOTHING;
