-- =====================================================================
-- v4.1.0 — Q-Hudoor Secondary School Enterprise Module
-- =====================================================================
-- Documents schema additions introduced for the Secondary School sector.
-- All statements use IF NOT EXISTS / DO NOTHING for idempotency.
-- Safe to run on databases where these changes already exist.
-- =====================================================================

-- 1. subjects — add specialty (stream) column
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS specialty text;

COMMENT ON COLUMN public.subjects.specialty IS
  'الشعبة الدراسية التي تختص بها المادة (ثانوي فقط). NULL = مادة مشتركة لجميع الشعب.';

-- 2. student_stream_transfers
CREATE TABLE IF NOT EXISTS public.student_stream_transfers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  institution_id uuid        REFERENCES public.institutions(id) ON DELETE CASCADE,
  old_stream     text,
  new_stream     text        NOT NULL,
  changed_by     uuid        REFERENCES public.admins(id) ON DELETE SET NULL,
  changed_at     timestamptz NOT NULL DEFAULT now(),
  reason         text,
  transfer_reason text
);

COMMENT ON TABLE public.student_stream_transfers IS
  'سجل تغييرات الشعبة الدراسية للتلميذ. يُملأ تلقائياً عند التعيين اليدوي أو الجماعي.';

ALTER TABLE public.student_stream_transfers
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE;

ALTER TABLE public.student_stream_transfers
  ADD COLUMN IF NOT EXISTS transfer_reason text;

CREATE INDEX IF NOT EXISTS idx_stream_transfers_student_id
  ON public.student_stream_transfers (student_id);

CREATE INDEX IF NOT EXISTS idx_stream_transfers_institution_id
  ON public.student_stream_transfers (institution_id);

-- 3. RLS Policies
ALTER TABLE public.student_stream_transfers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'student_stream_transfers'
      AND policyname = 'Allow read access to student stream transfers'
  ) THEN
    CREATE POLICY "Allow read access to student stream transfers"
      ON public.student_stream_transfers
      FOR SELECT
      USING (
        institution_id IN (
          SELECT institution_id FROM public.admins WHERE auth_user_id = auth.uid()
        )
        OR student_id IN (
          SELECT id FROM public.students WHERE institution_id IN (
            SELECT institution_id FROM public.admins WHERE auth_user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'student_stream_transfers'
      AND policyname = 'Allow insert access to student stream transfers for admins'
  ) THEN
    CREATE POLICY "Allow insert access to student stream transfers for admins"
      ON public.student_stream_transfers
      FOR INSERT
      WITH CHECK (
        institution_id IN (
          SELECT institution_id FROM public.admins WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;
