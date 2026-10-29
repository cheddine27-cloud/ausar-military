-- Migration: Add session_id and report_id to communication_messages
ALTER TABLE public.communication_messages
ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS report_id uuid REFERENCES public.school_attendance_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comm_msg_session ON public.communication_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_comm_msg_report ON public.communication_messages (report_id);
