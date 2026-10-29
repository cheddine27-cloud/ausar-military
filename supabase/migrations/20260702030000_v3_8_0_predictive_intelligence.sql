-- =============================================================
-- Q-Hudoor v3.8.0 — Predictive Intelligence Center
-- Migration: prediction_snapshots, prediction_recommendations,
--            institution_health_history, permissions
-- =============================================================

-- 1. prediction_snapshots — Historical prediction records
CREATE TABLE IF NOT EXISTS public.prediction_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  entity_type      text NOT NULL CHECK (entity_type IN ('student', 'class', 'teacher', 'institution')),
  entity_id        text NOT NULL,
  prediction_type  text NOT NULL,
  prediction_score numeric(5,2) NOT NULL DEFAULT 0,
  confidence       numeric(5,2) NOT NULL DEFAULT 0,
  factors          jsonb NOT NULL DEFAULT '[]'::jsonb,
  trend            text NOT NULL DEFAULT 'stable' CHECK (trend IN ('improving', 'stable', 'declining')),
  prediction_text  text,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_institution
  ON public.prediction_snapshots (institution_id);
CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_entity
  ON public.prediction_snapshots (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_generated
  ON public.prediction_snapshots (generated_at DESC);

-- 2. prediction_recommendations — Actionable recommendations with effectiveness
CREATE TABLE IF NOT EXISTS public.prediction_recommendations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  prediction_id       uuid REFERENCES public.prediction_snapshots(id) ON DELETE SET NULL,
  entity_type         text NOT NULL,
  entity_id           text NOT NULL,
  recommendation_type text NOT NULL,
  priority            text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  reason              text NOT NULL,
  confidence          numeric(5,2) NOT NULL DEFAULT 0,
  expected_impact     text,
  suggested_deadline  timestamptz,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'expired')),
  accepted_by         uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  accepted_at         timestamptz,
  completed_at        timestamptz,
  pre_metric_value    numeric(5,2),
  post_metric_value   numeric(5,2),
  effectiveness       numeric(5,2),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_recommendations_institution
  ON public.prediction_recommendations (institution_id);
CREATE INDEX IF NOT EXISTS idx_prediction_recommendations_entity
  ON public.prediction_recommendations (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_prediction_recommendations_status
  ON public.prediction_recommendations (status);

-- 3. institution_health_history — Daily institution health scores
CREATE TABLE IF NOT EXISTS public.institution_health_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  overall_score       numeric(5,2) NOT NULL DEFAULT 0,
  attendance_score    numeric(5,2) NOT NULL DEFAULT 0,
  discipline_score    numeric(5,2) NOT NULL DEFAULT 0,
  communication_score numeric(5,2) NOT NULL DEFAULT 0,
  teacher_score       numeric(5,2) NOT NULL DEFAULT 0,
  device_score        numeric(5,2) NOT NULL DEFAULT 0,
  workflow_score      numeric(5,2) NOT NULL DEFAULT 0,
  risk_score          numeric(5,2) NOT NULL DEFAULT 0,
  classification      text NOT NULL DEFAULT 'good' CHECK (classification IN ('excellent', 'good', 'warning', 'critical')),
  recorded_at         date NOT NULL DEFAULT CURRENT_DATE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_health_history_institution
  ON public.institution_health_history (institution_id, recorded_at DESC);

-- 4. RLS Policies
ALTER TABLE public.prediction_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_health_history ENABLE ROW LEVEL SECURITY;

-- prediction_snapshots: admin/owner/teacher read
DROP POLICY IF EXISTS "prediction_snapshots tenant read" ON public.prediction_snapshots;
CREATE POLICY "prediction_snapshots tenant read" ON public.prediction_snapshots
  FOR SELECT USING (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "prediction_snapshots tenant write" ON public.prediction_snapshots;
CREATE POLICY "prediction_snapshots tenant write" ON public.prediction_snapshots
  FOR INSERT WITH CHECK (private.can_access_institution(institution_id));

-- prediction_recommendations: admin/owner/teacher read
DROP POLICY IF EXISTS "prediction_recommendations tenant read" ON public.prediction_recommendations;
CREATE POLICY "prediction_recommendations tenant read" ON public.prediction_recommendations
  FOR SELECT USING (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "prediction_recommendations tenant write" ON public.prediction_recommendations;
CREATE POLICY "prediction_recommendations tenant write" ON public.prediction_recommendations
  FOR ALL USING (private.can_access_institution(institution_id));

-- institution_health_history: admin/owner/teacher read
DROP POLICY IF EXISTS "health_history tenant read" ON public.institution_health_history;
CREATE POLICY "health_history tenant read" ON public.institution_health_history
  FOR SELECT USING (private.can_access_institution(institution_id));

DROP POLICY IF EXISTS "health_history tenant write" ON public.institution_health_history;
CREATE POLICY "health_history tenant write" ON public.institution_health_history
  FOR INSERT WITH CHECK (private.can_access_institution(institution_id));

-- 5. Register permissions in permission_catalog and role_permission_defaults
INSERT INTO public.permission_catalog (permission_key, category, description)
VALUES
  ('intelligence.read', 'intelligence', 'قراءة التحليلات الذكية والتنبؤات'),
  ('intelligence.predictions', 'intelligence', 'إدارة توقعات المخاطر والتحليلات'),
  ('intelligence.recommendations', 'intelligence', 'إدارة ومتابعة التوصيات الذكية'),
  ('intelligence.health', 'intelligence', 'عرض لوحة قياس صحة المؤسسة والاتجاهات'),
  ('intelligence.simulation', 'intelligence', 'إجراء محاكاة مخاطر المؤسسة')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_permission_defaults (role, permission_key, allowed)
VALUES
  ('owner', 'intelligence.read', true),
  ('admin', 'intelligence.read', true),
  ('staff', 'intelligence.read', true),
  ('teacher', 'intelligence.read', true),
  ('owner', 'intelligence.predictions', true),
  ('admin', 'intelligence.predictions', true),
  ('owner', 'intelligence.recommendations', true),
  ('admin', 'intelligence.recommendations', true),
  ('owner', 'intelligence.health', true),
  ('admin', 'intelligence.health', true),
  ('owner', 'intelligence.simulation', true),
  ('admin', 'intelligence.simulation', true)
ON CONFLICT (role, permission_key) DO NOTHING;
