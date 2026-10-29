-- =====================================================================
-- v3.5.0 — Q-Hudoor Enterprise Core Platform Engines Database Schema
-- =====================================================================
-- ADDITIVE ONLY: does NOT modify any existing tables or RLS policies.
-- =====================================================================

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  module_id       text NOT NULL,
  action          text NOT NULL,
  actor_id        uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  actor_name      text NOT NULL,
  target_id       uuid,
  target_type     text,
  result          text NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failure', 'warning')),
  remarks         text,
  ip_address      text,
  device_info     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexing for fast search and timeline retrieval
CREATE INDEX IF NOT EXISTS idx_audit_logs_institution_id
  ON public.audit_logs (institution_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);

-- 2. Create automation_history table
CREATE TABLE IF NOT EXISTS public.automation_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  rule_id           text NOT NULL,
  rule_name         text NOT NULL,
  trigger_event     text NOT NULL,
  action_executed   text NOT NULL,
  target_id         uuid,
  status            text NOT NULL CHECK (status IN ('success', 'failed')),
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexing for automation logs
CREATE INDEX IF NOT EXISTS idx_automation_history_institution_id
  ON public.automation_history (institution_id);

CREATE INDEX IF NOT EXISTS idx_automation_history_created_at
  ON public.automation_history (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "audit_logs tenant all" ON public.audit_logs;
CREATE POLICY "audit_logs tenant all" ON public.audit_logs
  FOR ALL TO authenticated USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "automation_history tenant all" ON public.automation_history;
CREATE POLICY "automation_history tenant all" ON public.automation_history
  FOR ALL TO authenticated USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));
