-- =====================================================================
-- v3.3 — Q-Hudoor Guardian Connect Module
-- =====================================================================
-- ADDITIVE ONLY: does NOT modify any existing rows, RLS policies,
-- Edge Functions, or existing constraints.
-- =====================================================================

-- 1. student_parent_contacts (Core)
CREATE TABLE IF NOT EXISTS public.student_parent_contacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id        uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  name              text NOT NULL,
  relationship      text NOT NULL CHECK (relationship IN ('father', 'mother', 'guardian')),
  phone             text,
  email             text,
  preferred_channel text NOT NULL DEFAULT 'sms' CHECK (preferred_channel IN ('sms', 'email', 'whatsapp')),
  receive_sms       boolean NOT NULL DEFAULT true,
  receive_whatsapp  boolean NOT NULL DEFAULT true,
  receive_email     boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for student_parent_contacts filtering
CREATE INDEX IF NOT EXISTS idx_student_parent_contacts_student_id
  ON public.student_parent_contacts (student_id);

CREATE INDEX IF NOT EXISTS idx_student_parent_contacts_institution_id
  ON public.student_parent_contacts (institution_id);

-- 2. notification_templates (Core)
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  key             text NOT NULL CHECK (key IN ('absent', 'late', 'warning', 'meeting')),
  channel         text NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp')),
  subject         text,
  body            text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_institution_key_channel UNIQUE (institution_id, key, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_institution_id
  ON public.notification_templates (institution_id);

-- 3. school_attendance_reports (School Module)
CREATE TABLE IF NOT EXISTS public.school_attendance_reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  teacher_id            uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  teacher_name          text NOT NULL,
  class_id              uuid NOT NULL REFERENCES public.institution_units(id) ON DELETE CASCADE,
  class_name            text NOT NULL,
  session_id            uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  date                  date NOT NULL DEFAULT CURRENT_DATE,
  time                  time NOT NULL DEFAULT CURRENT_TIME,
  present_count         integer NOT NULL DEFAULT 0,
  absent_count          integer NOT NULL DEFAULT 0,
  late_count            integer NOT NULL DEFAULT 0,
  teacher_notes         text,
  status                text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'notifications_sent', 'closed')),
  correction_requested  boolean NOT NULL DEFAULT false,
  correction_reason     text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_attendance_reports_institution_id
  ON public.school_attendance_reports (institution_id);

CREATE INDEX IF NOT EXISTS idx_school_attendance_reports_session_id
  ON public.school_attendance_reports (session_id);

-- 4. communication_queue (Core)
CREATE TABLE IF NOT EXISTS public.communication_queue (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  sender_admin_id   uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  recipient_type    text NOT NULL CHECK (recipient_type IN ('parent', 'student', 'admin', 'professor')),
  recipient_id      uuid NOT NULL, -- polymorphic pointer
  recipient_contact text NOT NULL,
  channel           text NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp')),
  template_id       uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  subject         text,
  message           text NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  retry_count       integer NOT NULL DEFAULT 0,
  provider_response jsonb DEFAULT '{}'::jsonb,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_communication_queue_institution_id
  ON public.communication_queue (institution_id);

CREATE INDEX IF NOT EXISTS idx_communication_queue_status
  ON public.communication_queue (status);

-- 5. school_communication_logs (Audit only)
CREATE TABLE IF NOT EXISTS public.school_communication_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  administrator_id  uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  student_id        uuid REFERENCES public.students(id) ON DELETE CASCADE,
  action            text NOT NULL, -- e.g. 'approved_report', 'sent_notification', 'justified_absence'
  channel           text,
  result            text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_communication_logs_institution_id
  ON public.school_communication_logs (institution_id);

-- RLS Enablement
ALTER TABLE public.student_parent_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_attendance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_communication_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "student_parent_contacts tenant all" ON public.student_parent_contacts;
DROP POLICY IF EXISTS "notification_templates tenant all" ON public.notification_templates;
DROP POLICY IF EXISTS "school_attendance_reports tenant all" ON public.school_attendance_reports;
DROP POLICY IF EXISTS "communication_queue tenant all" ON public.communication_queue;
DROP POLICY IF EXISTS "school_communication_logs tenant all" ON public.school_communication_logs;

-- Policies definition
CREATE POLICY "student_parent_contacts tenant all" ON public.student_parent_contacts
  FOR ALL TO authenticated USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "notification_templates tenant all" ON public.notification_templates
  FOR ALL TO authenticated USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "school_attendance_reports tenant all" ON public.school_attendance_reports
  FOR ALL TO authenticated USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "communication_queue tenant all" ON public.communication_queue
  FOR ALL TO authenticated USING (private.can_access_institution(institution_id))
  WITH CHECK (private.can_access_institution(institution_id));

CREATE POLICY "school_communication_logs tenant select" ON public.school_communication_logs
  FOR SELECT TO authenticated USING (private.can_access_institution(institution_id));

CREATE POLICY "school_communication_logs tenant insert" ON public.school_communication_logs
  FOR INSERT TO authenticated WITH CHECK (private.can_access_institution(institution_id));

-- Pre-seed notification templates for existing institutions
DO $$
DECLARE
  inst RECORD;
BEGIN
  FOR inst IN SELECT id FROM public.institutions LOOP
    -- Absent SMS
    INSERT INTO public.notification_templates (institution_id, key, channel, body)
    VALUES (inst.id, 'absent', 'sms', 'ولي أمر التلميذ(ة) {student}، نعلمكم أن ابنكم(ابنتكم) غاب اليوم {date} عن الحصص. يرجى الاتصال بالإدارة لتبرير الغياب.')
    ON CONFLICT (institution_id, key, channel) DO NOTHING;

    -- Absent WhatsApp
    INSERT INTO public.notification_templates (institution_id, key, channel, body)
    VALUES (inst.id, 'absent', 'whatsapp', 'السلام عليكم،\n\nنعلمكم بتغيب التلميذ(ة) *{student}* اليوم *{date}*. يرجى تبرير الغياب في أقرب وقت.\n\nإدارة المؤسسة.')
    ON CONFLICT (institution_id, key, channel) DO NOTHING;

    -- Absent Email
    INSERT INTO public.notification_templates (institution_id, key, channel, subject, body)
    VALUES (inst.id, 'absent', 'email', 'تنبيه غياب: {student}', 'السلام عليكم ورحمة الله،\n\nنود إعلامكم بتغيب التلميذ(ة) {student} اليوم {date} عن حصص الدراسة.\n\nيرجى التواصل معنا لتزويدنا بالتبرير.\n\nمع التحيات،\nإدارة المؤسسة.')
    ON CONFLICT (institution_id, key, channel) DO NOTHING;

    -- Late SMS
    INSERT INTO public.notification_templates (institution_id, key, channel, body)
    VALUES (inst.id, 'late', 'sms', 'ولي أمر التلميذ(ة) {student}، نعلمكم أن ابنكم(ابنتكم) سجل تأخراً اليوم {date} على الساعة {time}.')
    ON CONFLICT (institution_id, key, channel) DO NOTHING;

    -- Late WhatsApp
    INSERT INTO public.notification_templates (institution_id, key, channel, body)
    VALUES (inst.id, 'late', 'whatsapp', 'السلام عليكم،\n\nتم تسجيل تأخر للتلميذ(ة) *{student}* اليوم *{date}* على الساعة *{time}*.\n\nإدارة المؤسسة.')
    ON CONFLICT (institution_id, key, channel) DO NOTHING;
  END LOOP;
END $$;
