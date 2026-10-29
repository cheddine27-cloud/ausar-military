-- Performance: add covering indexes for all foreign keys flagged by the
-- Supabase performance advisor. These dramatically speed up:
--   - JOIN-style queries from the application layer
--   - Cascading reference checks at INSERT/UPDATE/DELETE time
--   - The Super Admin live stats queries which filter heavily by *_institution_id

-- attendances
CREATE INDEX IF NOT EXISTS idx_attendances_student_id ON public.attendances (student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_institution_id ON public.attendances (institution_id);

-- sessions (heavy: 4 FKs, all unindexed)
CREATE INDEX IF NOT EXISTS idx_sessions_cohort_id ON public.sessions (cohort_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON public.sessions (created_by);
CREATE INDEX IF NOT EXISTS idx_sessions_institution_id ON public.sessions (institution_id);
CREATE INDEX IF NOT EXISTS idx_sessions_professor_id ON public.sessions (professor_id);

-- students
CREATE INDEX IF NOT EXISTS idx_students_cohort_id ON public.students (cohort_id);

-- cohorts / faculties / departments / specialties
CREATE INDEX IF NOT EXISTS idx_cohorts_institution_id ON public.cohorts (institution_id);
CREATE INDEX IF NOT EXISTS idx_faculties_institution_id ON public.faculties (institution_id);
CREATE INDEX IF NOT EXISTS idx_departments_faculty_id ON public.departments (faculty_id);
CREATE INDEX IF NOT EXISTS idx_departments_institution_id ON public.departments (institution_id);
CREATE INDEX IF NOT EXISTS idx_specialties_department_id ON public.specialties (department_id);
CREATE INDEX IF NOT EXISTS idx_specialties_institution_id ON public.specialties (institution_id);

-- student_devices
CREATE INDEX IF NOT EXISTS idx_student_devices_institution_id ON public.student_devices (institution_id);

-- activity / platform / notifications
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_admin_id ON public.activity_logs (actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_admin_id ON public.notifications (actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_platform_settings_updated_by ON public.platform_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_platform_setting_audit_logs_changed_by ON public.platform_setting_audit_logs (changed_by);

-- support
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to_admin_id ON public.support_tickets (assigned_to_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by_admin_id ON public.support_tickets (created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_author_admin_id ON public.support_ticket_replies (author_admin_id);
