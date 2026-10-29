-- =====================================================================
-- v3.7.8 — Q-Hudoor Enterprise Device Management & Security Center
-- =====================================================================
-- ADDITIVE ONLY: Creates tables, indexes, and RLS policies for 
-- device registration, events, security flags, history, and approval workflows.
-- =====================================================================

-- 1. registered_devices
CREATE TABLE IF NOT EXISTS public.registered_devices (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id                   uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id                          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint               text NOT NULL,
  device_name                      text NOT NULL,
  browser                          text NOT NULL,
  browser_version                  text NOT NULL,
  operating_system                 text NOT NULL,
  platform                         text NOT NULL,
  screen_resolution                text NOT NULL,
  timezone                         text NOT NULL,
  language                         text NOT NULL,
  ip_address_last                  text NOT NULL,
  first_login_at                   timestamptz NOT NULL DEFAULT now(),
  last_login_at                    timestamptz NOT NULL DEFAULT now(),
  last_seen_at                     timestamptz NOT NULL DEFAULT now(),
  status                           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'trusted', 'expired', 're_verification', 'blocked')),
  is_trusted                       boolean NOT NULL DEFAULT false,
  approved_by                      uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  approved_at                      timestamptz,
  notes                            text,
  
  -- Session tracking
  current_sessions                 integer NOT NULL DEFAULT 0,
  total_sessions                   integer NOT NULL DEFAULT 0,
  average_session_duration_minutes integer NOT NULL DEFAULT 0,
  
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_institution_device UNIQUE (institution_id, user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON public.registered_devices (device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_institution_id ON public.registered_devices (institution_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.registered_devices (user_id);

-- 2. device_health_history
CREATE TABLE IF NOT EXISTS public.device_health_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id      uuid NOT NULL REFERENCES public.registered_devices(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  security_score integer NOT NULL CHECK (security_score BETWEEN 0 AND 100),
  logged_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_health_history_device_id ON public.device_health_history (device_id);
CREATE INDEX IF NOT EXISTS idx_device_health_history_institution ON public.device_health_history (institution_id);

-- 3. device_events
CREATE TABLE IF NOT EXISTS public.device_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id      uuid NOT NULL REFERENCES public.registered_devices(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  event_type     text NOT NULL,
  event_details  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_events_device_id ON public.device_events (device_id);
CREATE INDEX IF NOT EXISTS idx_device_events_institution ON public.device_events (institution_id);

-- 4. device_security_flags
CREATE TABLE IF NOT EXISTS public.device_security_flags (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id      uuid NOT NULL REFERENCES public.registered_devices(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  flag_type      text NOT NULL CHECK (flag_type IN ('fingerprint_changed', 'browser_changed', 'os_changed', 'ip_rapid_change', 'multiple_active', 'unknown', 'high_risk')),
  severity       text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  description    text NOT NULL,
  resolved       boolean NOT NULL DEFAULT false,
  resolved_by    uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  resolved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_flags_device_id ON public.device_security_flags (device_id);
CREATE INDEX IF NOT EXISTS idx_device_flags_institution ON public.device_security_flags (institution_id);

-- 5. device_approval_workflows
CREATE TABLE IF NOT EXISTS public.device_approval_workflows (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id      uuid NOT NULL REFERENCES public.registered_devices(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  state          text NOT NULL CHECK (state IN ('new_device', 'security_check', 'admin_review', 'approved', 'trusted')),
  actor_id       uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_workflows_device ON public.device_approval_workflows (device_id);
CREATE INDEX IF NOT EXISTS idx_device_workflows_institution ON public.device_approval_workflows (institution_id);

-- Enable RLS
ALTER TABLE public.registered_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_security_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_approval_workflows ENABLE ROW LEVEL SECURITY;

-- Registered Devices RLS
CREATE POLICY "registered_devices select" ON public.registered_devices
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner')
        OR user_id = auth.uid()
      )
    )
  );

CREATE POLICY "registered_devices insert" ON public.registered_devices
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "registered_devices update" ON public.registered_devices
  FOR UPDATE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner')
        OR user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner')
        OR user_id = auth.uid()
      )
    )
  );

CREATE POLICY "registered_devices delete" ON public.registered_devices
  FOR DELETE TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() IN ('admin', 'owner')
    )
  );

-- Health History RLS
CREATE POLICY "device_health_history select" ON public.device_health_history
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() IN ('admin', 'owner')
    )
  );

CREATE POLICY "device_health_history insert" ON public.device_health_history
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND private.current_admin_role() IN ('admin', 'owner')
    )
  );

-- Device Events RLS
CREATE POLICY "device_events select" ON public.device_events
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner')
        OR EXISTS (
          SELECT 1 FROM public.registered_devices d
          WHERE d.id = device_id AND d.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "device_events insert" ON public.device_events
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND EXISTS (
        SELECT 1 FROM public.registered_devices d
        WHERE d.id = device_id AND d.user_id = auth.uid()
      )
    )
  );

-- Security Flags RLS
CREATE POLICY "device_security_flags select" ON public.device_security_flags
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner')
        OR EXISTS (
          SELECT 1 FROM public.registered_devices d
          WHERE d.id = device_id AND d.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "device_security_flags modify" ON public.device_security_flags
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

-- Approval Workflows RLS
CREATE POLICY "device_approval_workflows select" ON public.device_approval_workflows
  FOR SELECT TO authenticated
  USING (
    private.is_super_admin()
    OR (
      private.can_access_institution(institution_id)
      AND (
        private.current_admin_role() IN ('admin', 'owner')
        OR EXISTS (
          SELECT 1 FROM public.registered_devices d
          WHERE d.id = device_id AND d.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "device_approval_workflows modify" ON public.device_approval_workflows
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

-- 6. Register permissions in catalog
INSERT INTO public.permission_catalog (permission_key, category, description) VALUES
  ('devices.read', 'devices', 'صلاحية عرض ومراقبة الأجهزة المسجلة للنظام'),
  ('devices.review', 'devices', 'صلاحية اعتماد ومراجعة طلبات الأجهزة الجديدة المعلقة'),
  ('devices.manage', 'devices', 'صلاحية التحكم الكامل وحظر/فك حظر الأجهزة المسجلة'),
  ('devices.export', 'devices', 'صلاحية تصدير قوائم الأجهزة وإحصائياتها')
ON CONFLICT (permission_key) DO NOTHING;

-- 7. Assign defaults
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('admin', 'devices.read', true),
  ('admin', 'devices.review', true),
  ('admin', 'devices.manage', true),
  ('admin', 'devices.export', true),
  
  ('owner', 'devices.read', true),
  ('owner', 'devices.review', true),
  ('owner', 'devices.manage', true),
  ('owner', 'devices.export', true)
ON CONFLICT (role, permission_key) DO NOTHING;
