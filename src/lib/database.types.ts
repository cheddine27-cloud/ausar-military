export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Nullable<T> = T | null
type DbTable<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row & Record<string, unknown>
  Insert: Insert & Record<string, unknown>
  Update: Update & Record<string, unknown>
  Relationships: []
}

type AdminRow = {
  id: string
  auth_user_id: Nullable<string>
  username: string
  role: Nullable<string>
  rank: Nullable<string>
  fullName: Nullable<string>
  full_name: Nullable<string>
  email: Nullable<string>
  department: Nullable<string>
  institution_id: Nullable<string>
  created_at: string
  createdAt: Nullable<string>
}

type InstitutionRow = {
  id: string
  name: string
  type: string
  max_students: Nullable<number>
  status: Nullable<string>
  wilaya: Nullable<string>
  city: Nullable<string>
  code: Nullable<string>
  image_url: Nullable<string>
  created_at: string
}

type CohortRow = {
  id: string
  name: string
  description: Nullable<string>
  level: Nullable<string>
  field: Nullable<string>
  subject: Nullable<string>
  specialty: Nullable<string>
  institution_id: Nullable<string>
  createdAt: Nullable<string>
  created_at: string
}

type StudentRow = {
  id: string
  studentNumber: Nullable<string>
  student_number: Nullable<string>
  firstName: Nullable<string>
  first_name: Nullable<string>
  lastName: Nullable<string>
  last_name: Nullable<string>
  cohortId: Nullable<string>
  cohort_id: Nullable<string>
  year: Nullable<string>
  specialty: Nullable<string>
  faculty: Nullable<string>
  gender: Nullable<string>
  gender_snake: Nullable<string>
  status: Nullable<string>
  status_snake: Nullable<string>
  phone: Nullable<string>
  institution_id: Nullable<string>
  createdAt: Nullable<string>
  created_at: string
}

type SessionRow = {
  id: string
  cohortId: Nullable<string>
  cohort_id: Nullable<string>
  title: string
  code: string
  status: string
  createdBy: Nullable<string>
  created_by: Nullable<string>
  professor_id: Nullable<string>
  institution_id: Nullable<string>
  latitude: Nullable<number>
  longitude: Nullable<number>
  radius_meters: Nullable<number>
  createdAt: Nullable<string>
  created_at: string
}

type AttendanceRow = {
  id: string
  sessionId: Nullable<string>
  session_id: Nullable<string>
  studentId: Nullable<string>
  student_id: Nullable<string>
  method: Nullable<string>
  deviceFingerprint: Nullable<string>
  device_fingerprint: Nullable<string>
  institution_id: Nullable<string>
  timestamp: string
  created_at: Nullable<string>
}

type StudentDeviceRow = {
  id: string
  student_id: string
  device_fingerprint: string
  fingerprint: Nullable<string>
  institution_id: Nullable<string>
  is_active: boolean
  registered_at: Nullable<string>
  last_used: Nullable<string>
  created_at: Nullable<string>
}

type FacultyRow = {
  id: string
  name: string
  institution_id: Nullable<string>
  created_at: string
}

type DepartmentRow = {
  id: string
  faculty_id: Nullable<string>
  name: string
  institution_id: Nullable<string>
  created_at: string
}

type SpecialtyRow = {
  id: string
  department_id: Nullable<string>
  name: string
  institution_id: Nullable<string>
  created_at: string
}

type SubscriptionRow = {
  id: string
  institution_id: string
  plan_type: string
  plan_name: Nullable<string>
  status: string
  billing_cycle: Nullable<string>
  start_date: Nullable<string>
  end_date: Nullable<string>
  current_period_end: Nullable<string>
  student_limit: number
  session_limit: number
  max_users: Nullable<number>
  max_teachers: Nullable<number>
  price: Nullable<number>
  currency: Nullable<string>
  payment_status: Nullable<string>
  payment_method: Nullable<string>
  last_invoice_number: Nullable<string>
  notes: Nullable<string>
  created_at: string
  updated_at: Nullable<string>
}

type SubscriptionPaymentRow = {
  id: string
  subscription_id: Nullable<string>
  institution_id: Nullable<string>
  invoice_number: Nullable<string>
  amount: number
  currency: string
  payment_status: string
  payment_method: Nullable<string>
  payment_date: Nullable<string>
  due_date: Nullable<string>
  created_at: string
}

type ActivityLogRow = {
  id: string
  source_key: Nullable<string>
  institution_id: Nullable<string>
  actor_admin_id: Nullable<string>
  category: string
  type: string
  title: string
  description: string
  outcome_status: string
  review_status: string
  priority: string
  metadata: Json
  ip_address: Nullable<string>
  user_agent: Nullable<string>
  created_at: string
  updated_at: Nullable<string>
}

type SupportTicketRow = {
  id: string
  ticket_number: string
  institution_id: Nullable<string>
  created_by_admin_id: Nullable<string>
  assigned_to_admin_id: Nullable<string>
  category: string
  priority: string
  status: string
  title: string
  description: string
  internal_notes: Nullable<string>
  metadata: Json
  created_at: string
  updated_at: string
  closed_at: Nullable<string>
}

type SupportTicketReplyRow = {
  id: string
  ticket_id: string
  author_admin_id: Nullable<string>
  reply_type: string
  message: string
  created_at: string
}

type SupportSettingsRow = {
  id: string
  support_email: Nullable<string>
  support_phone: Nullable<string>
  whatsapp_number: Nullable<string>
  help_center_url: Nullable<string>
  demo_request_url: Nullable<string>
  created_at: Nullable<string>
  updated_at: Nullable<string>
}

type NotificationRow = {
  id: string
  institution_id: Nullable<string>
  actor_admin_id: Nullable<string>
  type: string
  category: string
  priority: string
  title: string
  message: string
  metadata: Json
  status: string
  read_at: Nullable<string>
  archived_at: Nullable<string>
  created_at: string
  updated_at: Nullable<string>
}

type PlatformSettingsRow = {
  key: string
  value: Json
  description: Nullable<string>
  updated_by: Nullable<string>
  created_at: string
  updated_at: string
}

type PlatformSettingAuditLogRow = {
  id: string
  setting_key: string
  action: string
  old_value: Json
  new_value: Json
  changed_by: Nullable<string>
  created_at: string
}

type TrialRequestRow = {
  id: number
  institution_name: Nullable<string>
  contact_phone: Nullable<string>
  institution_type: Nullable<string>
  user_count: Nullable<string>
  source: Nullable<string>
  status: Nullable<string>
  created_at: Nullable<string>
}

export type Database = {
  public: {
    Tables: {
      admins: DbTable<AdminRow, Partial<AdminRow>>
      institutions: DbTable<InstitutionRow, Partial<InstitutionRow>>
      cohorts: DbTable<CohortRow, Partial<CohortRow>>
      students: DbTable<StudentRow, Partial<StudentRow>>
      sessions: DbTable<SessionRow, Partial<SessionRow>>
      attendances: DbTable<AttendanceRow, Partial<AttendanceRow>>
      student_devices: DbTable<StudentDeviceRow, Partial<StudentDeviceRow>>
      faculties: DbTable<FacultyRow, Partial<FacultyRow>>
      departments: DbTable<DepartmentRow, Partial<DepartmentRow>>
      specialties: DbTable<SpecialtyRow, Partial<SpecialtyRow>>
      subscriptions: DbTable<SubscriptionRow, Partial<SubscriptionRow>>
      subscription_payments: DbTable<SubscriptionPaymentRow, Partial<SubscriptionPaymentRow>>
      activity_logs: DbTable<ActivityLogRow, Partial<ActivityLogRow>>
      support_tickets: DbTable<SupportTicketRow, Partial<SupportTicketRow>>
      support_ticket_replies: DbTable<SupportTicketReplyRow, Partial<SupportTicketReplyRow>>
      support_settings: DbTable<SupportSettingsRow, Partial<SupportSettingsRow>>
      notifications: DbTable<NotificationRow, Partial<NotificationRow>>
      platform_settings: DbTable<PlatformSettingsRow, Partial<PlatformSettingsRow>>
      platform_setting_audit_logs: DbTable<PlatformSettingAuditLogRow, Partial<PlatformSettingAuditLogRow>>
      trial_requests: DbTable<TrialRequestRow, Partial<TrialRequestRow>>
    }
    Views: Record<string, never>
    Functions: {
      resolve_admin_login_email: {
        Args: { login_identifier: string }
        Returns: string | null
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
