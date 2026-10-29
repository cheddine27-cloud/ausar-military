-- =====================================================================
-- v3.4.0 — Q-Hudoor Workflow Engine & Guardian Connect Enhancements
-- =====================================================================
-- ADDITIVE ONLY: does NOT modify any existing rows, existing RLS,
-- or drop/rename any columns/tables.
-- =====================================================================

-- 1. Additive columns to communication_queue
ALTER TABLE public.communication_queue
  ADD COLUMN IF NOT EXISTS message_snapshot text,
  ADD COLUMN IF NOT EXISTS notification_code text;

-- Create index on notification_code for faster lookup
CREATE INDEX IF NOT EXISTS idx_communication_queue_notification_code
  ON public.communication_queue (notification_code);

-- 2. workflow_instances table
CREATE TABLE IF NOT EXISTS public.workflow_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  module_id       text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  current_state   text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for workflow_instances
CREATE INDEX IF NOT EXISTS idx_workflow_instances_entity
  ON public.workflow_instances (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_institution
  ON public.workflow_instances (institution_id);

-- 3. workflow_events table
CREATE TABLE IF NOT EXISTS public.workflow_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  instance_id     uuid NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  action          text NOT NULL,
  from_state      text NOT NULL,
  to_state        text NOT NULL,
  actor_id        uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  actor_name      text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for workflow_events
CREATE INDEX IF NOT EXISTS idx_workflow_events_instance_id
  ON public.workflow_events (instance_id);

CREATE INDEX IF NOT EXISTS idx_workflow_events_institution
  ON public.workflow_events (institution_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies using private.can_access_institution
DROP POLICY IF EXISTS "workflow_instances tenant all" ON public.workflow_instances;
CREATE POLICY "workflow_instances tenant all" ON public.workflow_instances
  FOR ALL TO authenticated USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "workflow_events tenant all" ON public.workflow_events;
CREATE POLICY "workflow_events tenant all" ON public.workflow_events
  FOR ALL TO authenticated USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));
