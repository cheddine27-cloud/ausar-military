// أنواع البيانات المستخدمة في النظام

export interface Admin {
  id: string;
  auth_user_id?: string | null;
  username: string;
  role?:
    | 'super_admin'
    | 'institution_owner'
    | 'institution_admin'
    | 'faculty_admin'
    | 'department_admin'
    | 'staff'
    | 'teacher'
    | 'viewer';
  rank?: string;
  fullName?: string | null;
  full_name?: string | null;
  email?: string | null;
  department?: string | null;
  institution_id?: string | null;
  institution_type?: 'military' | 'system';
  createdAt?: string | null;
  created_at?: string | null;
}

export interface Cohort {
  id: string;
  name: string;
  description?: string | null;
  level?: 'L1' | 'L2' | 'L3' | 'M1' | 'M2' | string | null;
  field?: string | null;
  subject?: string | null;
  specialty?: string | null;
  institution_id?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
}

export interface Student {
  id: string;
  studentNumber?: string | null;
  student_number?: string | null;
  firstName?: string | null;
  first_name?: string | null;
  lastName?: string | null;
  last_name?: string | null;
  cohortId?: string | null;
  cohort_id?: string | null;
  year?: string | null;
  specialty?: string | null;
  faculty?: string | null;
  gender?: 'male' | 'female' | null;
  status?: 'active' | 'suspended' | 'graduated' | 'archived' | null;
  gender_snake?: string | null;
  status_snake?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  photoUrl?: string | null;
  birth_date?: string | null;
  birthDate?: string | null;
  institution_id?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
}

// v3.0: Smart Attendance types
export type AttendanceMode = 'qr' | 'roll_call' | 'hybrid';
export type AttendanceSource = 'qr' | 'roll_call' | 'teacher_validation';
export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface Session {
  id: string;
  cohortId?: string | null;
  cohort_id?: string | null;
  title: string;
  code: string;
  status: 'active' | 'closed' | string;
  createdAt?: string | null;
  created_at?: string | null;
  createdBy?: string | null;
  created_by?: string | null;
  professor_id?: string | null;
  professor_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
  institution_id?: string | null;
  admins?: { full_name: string };
  // v3.0 Smart Attendance
  attendance_mode?: AttendanceMode | null;
  subject?: string | null;
}

export interface Attendance {
  id: string;
  sessionId?: string | null;
  session_id?: string | null;
  studentId?: string | null;
  student_id?: string | null;
  method: 'qr' | 'code' | string | null;
  timestamp: string;
  deviceFingerprint?: string | null;
  device_fingerprint?: string | null;
  distance_meters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  institution_id?: string | null;
  // v3.0 Smart Attendance
  attendance_source?: AttendanceSource | null;
  attendance_status?: AttendanceStatus | null;
}

export interface StudentDevice {
  id: string;
  student_id: string;
  device_fingerprint: string;
  last_used: string | null;
  is_active: boolean | null;
  institution_id: string | null;
  // Joined student fields (when selected via select with relation)
  students?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    student_number?: string | null;
    cohort_id?: string | null;
    institution_id?: string | null;
  } | null;
}

export interface Faculty {
  id: string;
  name: string;
  institution_id?: string;
  created_at: string;
}

export interface Department {
  id: string;
  faculty_id: string | null;
  name: string;
  institution_id?: string;
  created_at: string;
}

export interface Specialty {
  id: string;
  department_id: string | null;
  name: string;
  institution_id?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  institution_id: string;
  plan_type: 'free' | 'pro' | 'enterprise' | string;
  status: 'active' | 'expired' | 'canceled' | string;
  start_date: string | null;
  end_date: string | null;
  current_period_end?: string | null;
  student_limit: number;
  session_limit: number;
  created_at: string;
}

export interface QRPayload {
  sessionId: string;
  timestamp: number;
  code: string;
}

// v3.0 — Smart Roll Call state types
export type RollCallMark = 'present' | 'absent' | 'late' | null;

export interface RollCallStudentRow {
  studentId: string;
  studentNumber: string;
  fullName: string;
  mark: RollCallMark;
}

export interface RollCallSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  unmarked: number;
  presentRate: number;
}
