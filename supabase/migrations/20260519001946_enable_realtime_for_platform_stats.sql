-- Enable Realtime publication for tables that drive the live platform stats bar.
-- This makes the Super Admin dashboard reflect teacher actions instantly,
-- instead of relying only on the 20s polling fallback.

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'attendances',
    'sessions',
    'students',
    'student_devices',
    'cohorts',
    'admins',
    'faculties',
    'departments',
    'specialties'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END
$$;
