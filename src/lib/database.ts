import { supabase } from './supabase';
import { Admin, Cohort, Student, Session, Attendance, Faculty, Department, Specialty, Subscription } from './types';
import { notifyAdminSessionChanged } from './scopedTheme';

const CURRENT_ADMIN_KEY = 'attendance_current_admin';

function saveCurrentAdmin(admin: Admin) {
  sessionStorage.setItem(CURRENT_ADMIN_KEY, JSON.stringify(admin));
  localStorage.removeItem(CURRENT_ADMIN_KEY);
  notifyAdminSessionChanged();
}

function clearCurrentAdmin() {
  sessionStorage.removeItem(CURRENT_ADMIN_KEY);
  localStorage.removeItem(CURRENT_ADMIN_KEY);
  notifyAdminSessionChanged();
}

// ===================== أدمين =====================

// أدوار الإدارة المعتمدة في النظام. الترتيب: من الأعلى صلاحية إلى الأقل.
// كل دور إداري أو قرائي يدخل لوحة المؤسسة. الأستاذ يبقى في لوحته المخصصة.
export const ADMIN_ROLES = [
  'super_admin',
  'institution_owner',
  'institution_admin',
  'faculty_admin',
  'department_admin',
  'staff',
  'teacher',
  'viewer',
] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

const INSTITUTION_MANAGER_ROLES: ReadonlyArray<AdminRole> = [
  'institution_owner',
  'institution_admin',
  'faculty_admin',
  'department_admin',
];

const INSTITUTION_DASHBOARD_ROLES: ReadonlyArray<AdminRole> = [
  ...INSTITUTION_MANAGER_ROLES,
  'staff',
  'viewer',
];

export function isInstitutionManagerRole(role: string | null | undefined): role is AdminRole {
  return INSTITUTION_MANAGER_ROLES.includes(role as AdminRole);
}

export function isInstitutionDashboardRole(role: string | null | undefined): role is AdminRole {
  return INSTITUTION_DASHBOARD_ROLES.includes(role as AdminRole);
}

export function isTeacherRole(role: string | null | undefined): role is AdminRole {
  return role === 'teacher';
}

export function isAllowedAdminRole(role: string | null): role is AdminRole {
  if (!role) return false;
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Decide where the user should land after a successful login.
 * Single source of truth for post-login routing.
 */
export function resolveLandingRoute(role: AdminRole | null | undefined): string {
  switch (role) {
    case 'super_admin':
      return '/panel-sk2025x/super-admin';
    case 'institution_owner':
    case 'institution_admin':
    case 'faculty_admin':
    case 'department_admin':
    case 'staff':
    case 'viewer':
      return '/panel-sk2025x/institution';
    case 'teacher':
      return '/panel-sk2025x/dashboard';
    default:
      return '/panel-sk2025x/access-denied';
  }
}

export async function loginAdmin(username: string, password: string): Promise<Admin | null> {
  const loginIdentifier = username.trim();
  if (!loginIdentifier || !password) return null;

  const email = await resolveAdminLoginEmail(loginIdentifier);
  if (!email) return null;

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) return null;

  const { data: adminProfile, error: profileError } = await supabase
    .from('admins')
    .select('*')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (profileError || !adminProfile || !isAllowedAdminRole(adminProfile.role)) {
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }

  const institutionType = await getInstitutionType(adminProfile.institution_id);
  const processedData: Admin = {
    ...adminProfile,
    role: adminProfile.role as Admin['role'],
    fullName: adminProfile.fullName || adminProfile.full_name || adminProfile.username,
    createdAt: adminProfile.createdAt || adminProfile.created_at,
    institution_type: institutionType,
  };

  saveCurrentAdmin(processedData);
  return processedData;
}

export function logoutAdmin() {
  clearCurrentAdmin();
  void supabase.auth.signOut({ scope: 'local' });
}

export function getCurrentAdmin(): Admin | null {
  const data = sessionStorage.getItem(CURRENT_ADMIN_KEY);
  return data ? JSON.parse(data) : null;
}

export async function getAuthenticatedAdmin(): Promise<Admin | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    clearCurrentAdmin();
    return null;
  }

  const { data: adminProfile, error: profileError } = await supabase
    .from('admins')
    .select('*')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (profileError || !adminProfile || !isAllowedAdminRole(adminProfile.role)) {
    clearCurrentAdmin();
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }

  const institutionType = await getInstitutionType(adminProfile.institution_id);
  const processedData: Admin = {
    ...adminProfile,
    role: adminProfile.role as Admin['role'],
    fullName: adminProfile.fullName || adminProfile.full_name || adminProfile.username,
    createdAt: adminProfile.createdAt || adminProfile.created_at,
    institution_type: institutionType,
  };

  saveCurrentAdmin(processedData);
  return processedData;
}

async function resolveAdminLoginEmail(identifier: string): Promise<string | null> {
  if (identifier.includes('@')) return identifier;

  const { data, error } = await supabase.rpc('resolve_admin_login_email', {
    login_identifier: identifier,
  });

  if (error || !data) return null;
  return String(data);
}

async function getInstitutionType(institutionId?: string | null): Promise<Admin['institution_type']> {
  if (!institutionId) return 'military';

  const { data } = await supabase
    .from('institutions')
    .select('type')
    .eq('id', institutionId)
    .maybeSingle();

  const type = data?.type;
  return type === 'school' || type === 'primary_school' || type === 'secondary_school' || type === 'training' || type === 'company' || type === 'system' ? type : 'military';
}

// ===================== أفواج =====================

export async function getAllCohorts(): Promise<Cohort[]> {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin) return [];

  let query = supabase
    .from('cohorts')
    .select('*')
    .order('created_at', { ascending: false });

  if (currentAdmin.role === 'super_admin') {
    // super_admin يرى كل الأفواج عبر كل المؤسسات
  } else {
    // الأستاذ والمدير يريان كل أفواج مؤسستهم (لاختيار الفوج لأي عملية:
    // إنشاء جلسة، إضافة طالب، استيراد، إلخ). العزل بين المؤسسات محكم
    // عبر RLS على القاعدة.
    query = query.eq('institution_id', currentAdmin.institution_id);
  }

  const { data } = await query;
  if (!data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    level: row.level || undefined,
    field: row.field || undefined,
    subject: row.subject || undefined,
    specialty: row.specialty || undefined,
    createdAt: row.created_at,
  }));
}

export async function getCohorts(): Promise<Cohort[]> {
  return getAllCohorts();
}

export async function getCohortById(id: string): Promise<Cohort | null> {
  const { data } = await supabase
    .from('cohorts')
    .select('*')
    .eq('id', id)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    level: data.level || undefined,
    field: data.field || undefined,
    subject: data.subject || undefined,
    specialty: data.specialty || undefined,
    createdAt: data.created_at,
  };
}

export async function addCohort(cohort: Omit<Cohort, 'id' | 'createdAt'>): Promise<Cohort> {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin) throw new Error('يجب تسجيل الدخول أولاً');

  // SaaS Check: Session Limit
  if (currentAdmin.role !== 'super_admin' && currentAdmin.institution_id) {
    const sub = await getInstitutionSubscription(currentAdmin.institution_id);
    if (sub) {
      const { count } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', currentAdmin.institution_id);
      
      if (count && count >= sub.session_limit) {
        throw new Error('لقد وصلت للحد الأقصى من الجلسات المتاحة في باقتك الحالية. يرجى الترقية.');
      }
    }
  }

  const { data, error } = await supabase
    .from('cohorts')
    .insert([
      {
        name: cohort.name,
        description: cohort.description || null,
        level: cohort.level || null,
        field: cohort.field || null,
        subject: cohort.subject || null,
        specialty: cohort.specialty || null,
        institution_id: currentAdmin.institution_id,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    level: data.level || undefined,
    field: data.field || undefined,
    subject: data.subject || undefined,
    specialty: data.specialty || undefined,
    createdAt: data.created_at,
  };
}

export async function updateCohort(id: string, updates: Partial<Cohort>): Promise<Cohort | null> {
  const { data } = await supabase
    .from('cohorts')
    .update({
      name: updates.name,
      description: updates.description ?? null,
      level: updates.level ?? null,
      field: updates.field ?? null,
      subject: updates.subject ?? null,
      specialty: updates.specialty ?? null,
    })
    .eq('id', id)
    .select()
    .single();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    level: data.level || undefined,
    field: data.field || undefined,
    subject: data.subject || undefined,
    specialty: data.specialty || undefined,
    createdAt: data.created_at,
  };
}

export async function deleteCohort(id: string): Promise<boolean> {
  const { error } = await supabase.from('cohorts').delete().eq('id', id);
  return !error;
}

// ===================== طلاب =====================

export async function getAllStudents(): Promise<Student[]> {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin) return [];

  const cohorts = await getAllCohorts();
  const cohortIds = cohorts.map((c) => c.id);

  if (cohortIds.length === 0) return [];

  const { data } = await supabase
    .from('students')
    .select('*')
    .in('cohort_id', cohortIds)
    .order('created_at', { ascending: false });

  return data || [];
}

export async function getStudents(): Promise<Student[]> {
  return getAllStudents();
}

export async function getStudentsByCohort(cohortId: string): Promise<Student[]> {
  const { data } = await supabase
    .from('students')
    .select('*')
    .eq('cohort_id', cohortId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getStudentByNumber(studentNumber: string): Promise<Student | null> {
  const { data } = await supabase
    .from('students')
    .select('*')
    .eq('student_number', studentNumber)
    .single();
  return data || null;
}

export async function getStudentByRegisterNo(registerNo: string): Promise<Student | null> {
  return getStudentByNumber(registerNo);
}

// إضافة طالب مع السنة / التخصص / الكلية
export async function addStudent(student: {
  studentNumber: string;
  firstName: string;
  lastName: string;
  cohortId: string;
  year?: string | null;
  specialty?: string | null;
  faculty?: string | null;
}): Promise<Student> {
  const currentAdmin = getCurrentAdmin();

  // Defense-in-depth: derive institution_id from current admin OR from the cohort.
  // This ensures students never end up orphaned (e.g. when a super_admin without
  // institution_id creates a student inside a tenant cohort).
  let institutionId = currentAdmin?.institution_id || null;
  if (!institutionId && student.cohortId) {
    const { data: cohort } = await supabase
      .from('cohorts')
      .select('institution_id')
      .eq('id', student.cohortId)
      .maybeSingle();
    institutionId = cohort?.institution_id || null;
  }
  if (!institutionId) {
    throw new Error('تعذر تحديد المؤسسة لهذا الطالب. اختر فوجاً مرتبطاً بمؤسسة.');
  }

  const { data, error } = await supabase
    .from('students')
    .insert([
      {
        student_number: student.studentNumber,
        first_name: student.firstName,
        last_name: student.lastName,
        cohort_id: student.cohortId || null,
        year: student.year ?? null,
        specialty: student.specialty ?? null,
        faculty: student.faculty ?? null,
        institution_id: institutionId,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as Student;
}

// تحديث طالب مع الحقول الجديدة
export async function updateStudent(
  id: string,
  updates: {
    studentNumber: string;
    firstName: string;
    lastName: string;
    cohortId: string;
    year?: string | null;
    specialty?: string | null;
    faculty?: string | null;
  }
): Promise<Student | null> {
  const { data } = await supabase
    .from('students')
    .update({
      student_number: updates.studentNumber,
      first_name: updates.firstName,
      last_name: updates.lastName,
      cohort_id: updates.cohortId,
      year: updates.year ?? null,
      specialty: updates.specialty ?? null,
      faculty: updates.faculty ?? null,
    })
    .eq('id', id)
    .select()
    .single();

  return (data as Student) || null;
}

export async function deleteStudent(id: string): Promise<boolean> {
  const { error } = await supabase.from('students').delete().eq('id', id);
  return !error;
}

// استيراد CSV (لن نستخدم additionalField بعد الآن)
export async function importStudentsFromCSV(
  csvData: string,
  cohortId: string
): Promise<{ success: number; duplicates: number }> {
  const lines = csvData.trim().split('\n');
  let success = 0;
  let duplicates = 0;

  for (let i = 1; i < lines.length; i++) {
    const [studentNumber, firstName, lastName] = lines[i]
      .split(',')
      .map((s) => s.trim());

    if (!studentNumber || !firstName || !lastName) continue;

    const existing = await getStudentByNumber(studentNumber);
    if (existing) {
      duplicates++;
      continue;
    }

    try {
      await addStudent({
        studentNumber,
        firstName,
        lastName,
        cohortId,
      });
      success++;
    } catch (error) {
      duplicates++;
    }
  }

  return { success, duplicates };
}

// ===================== الجلسات =====================

export async function getAllSessions(): Promise<Session[]> {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin) return [];

  let query = supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (currentAdmin.role === 'teacher') {
    query = query.eq('professor_id', currentAdmin.id);
  } else if (currentAdmin.role !== 'super_admin') {
    query = query.eq('institution_id', currentAdmin.institution_id);
  }

  const { data } = await query;
  return data || [];
}

export async function getSessions(): Promise<Session[]> {
  return getAllSessions();
}

export async function getSessionById(id: string): Promise<Session | null> {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();
  return data || null;
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('code', code)
    .eq('status', 'active')
    .single();
  return data || null;
}

export async function createSession(
  cohortId: string,
  title: string,
  createdBy: string,
  location?: { lat: number; lng: number; radius: number },
  subject?: string
): Promise<Session> {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin) throw new Error('يجب تسجيل الدخول أولاً');

  // Defense-in-depth: لا نسمح بجلسة بدون institution_id (NOT NULL في القاعدة).
  // نحاول أولاً institution الأستاذ، ثم institution الفوج كاحتياطي.
  let institutionId = currentAdmin.institution_id || null;
  if (!institutionId) {
    const { data: cohort } = await supabase
      .from('cohorts')
      .select('institution_id')
      .eq('id', cohortId)
      .maybeSingle();
    institutionId = cohort?.institution_id || null;
  }
  if (!institutionId) {
    throw new Error('تعذر تحديد المؤسسة لهذه الجلسة. تأكد من ربط حسابك بمؤسسة.');
  }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  // تأكد من أن المعطيات صالحة لتجنب الـ 409
  const sessionData = {
    cohort_id: cohortId,
    title,
    code,
    status: 'active',
    created_by: createdBy,
    professor_id: currentAdmin.id,
    institution_id: institutionId,
    latitude: location?.lat ? parseFloat(location.lat.toString()) : null,
    longitude: location?.lng ? parseFloat(location.lng.toString()) : null,
    radius_meters: location?.radius ? parseFloat(location.radius.toString()) : 150,
    subject: subject || null,
  };

  const { data, error } = await supabase
    .from('sessions')
    .insert([sessionData])
    .select();

  if (error) {
    console.error('Database Conflict Detail:', error);
    throw error;
  }
  
  if (!data || data.length === 0) throw new Error('لم يتم إنشاء الجلسة بنجاح');
  
  return data[0] as Session;
}

export async function closeSession(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'closed' })
    .eq('id', id);

  return !error;
}

export async function isSessionValid(sessionId: string): Promise<boolean> {
  const session = await getSessionById(sessionId);
  if (!session) return false;
  return session.status === 'active';
}

// ===================== الحضور =====================

export async function getAllAttendance(): Promise<Attendance[]> {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin) return [];

  const sessions = await getAllSessions();
  const sessionIds = sessions.map((s) => s.id);

  if (sessionIds.length === 0) return [];

  const { data } = await supabase
    .from('attendances')
    .select('*')
    .in('session_id', sessionIds)
    .order('timestamp', { ascending: false });

  return data || [];
}

export async function getAttendances(): Promise<Attendance[]> {
  return getAllAttendance();
}

export async function getAttendancesBySession(sessionId: string): Promise<Attendance[]> {
  const { data } = await supabase
    .from('attendances')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: false });
  return data || [];
}

export async function addAttendance(
  sessionId: string,
  studentId: string,
  method: 'qr' | 'code',
  deviceFingerprint?: string
): Promise<Attendance> {
  const { data: existing } = await supabase
    .from('attendances')
    .select('*')
    .eq('session_id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (existing) throw new Error('لقد سجلت حضورك مسبقاً في هذه الجلسة');

  if (deviceFingerprint) {
    const { data: deviceCheck } = await supabase
      .from('attendances')
      .select('*')
      .eq('session_id', sessionId)
      .eq('device_fingerprint', deviceFingerprint)
      .maybeSingle();

    if (deviceCheck) throw new Error('تعذر التسجيل الحضور ');
  }

  // جلب institution_id من بيانات الطالب لضمان عزل البيانات
  const { data: studentRecord } = await supabase
    .from('students')
    .select('institution_id')
    .eq('id', studentId)
    .single();

  const { data, error } = await supabase
    .from('attendances')
    .insert([
      {
        session_id: sessionId,
        student_id: studentId,
        method,
        device_fingerprint: deviceFingerprint || null,
        institution_id: studentRecord?.institution_id || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as Attendance;
}

export async function hasStudentAttended(sessionId: string, studentId: string): Promise<boolean> {
  const { data } = await supabase
    .from('attendances')
    .select('id')
    .eq('session_id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();
  return !!data;
}

// =============== Device Management ===============

export async function registerDevice(studentId: string, fingerprint: string) {
  // جلب institution_id من بيانات الطالب لربط الجهاز بالمؤسسة
  const { data: studentRecord } = await supabase
    .from('students')
    .select('institution_id')
    .eq('id', studentId)
    .single();

  const { data, error } = await supabase
    .from('student_devices')
    .insert({
      student_id: studentId,
      device_fingerprint: fingerprint,
      institution_id: studentRecord?.institution_id || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error registering device:', error);
    throw new Error('فشل في تسجيل الجهاز');
  }

  return data;
}

export async function isDeviceTrusted(studentId: string, fingerprint: string): Promise<boolean> {
  const { data } = await supabase
    .from('student_devices')
    .select('*')
    .eq('student_id', studentId)
    .eq('device_fingerprint', fingerprint)
    .eq('is_active', true)
    .single();

  return !!data;
}

export async function getStudentDevice(studentId: string) {
  const { data, error } = await supabase
    .from('student_devices')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error getting student device:', error);
    return null;
  }

  return data;
}

export async function updateDeviceLastUsed(studentId: string, fingerprint: string) {
  await supabase
    .from('student_devices')
    .update({ last_used: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('device_fingerprint', fingerprint);
}

// =============== Attendance Stats ===============

export async function getStudentAttendanceStats(studentId: string) {
  try {
    const { data: student } = await supabase
      .from('students')
      .select('cohort_id')
      .eq('id', studentId)
      .maybeSingle();

    if (!student) return { attended: 0, total: 0, percentage: 0 };

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('cohort_id', student.cohort_id);

    if (!sessions || sessions.length === 0) return { attended: 0, total: 0, percentage: 0 };

    const sessionIds = sessions.map((s) => s.id);

    const { count: attendedSessions } = await supabase
      .from('attendances')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .in('session_id', sessionIds);

    const total = sessions.length;
    const attended = attendedSessions || 0;
    const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

    return { attended, total, percentage };
  } catch (error) {
    console.error('Error getting attendance stats:', error);
    return { attended: 0, total: 0, percentage: 0 };
  }
}

export async function getAllStudentsWithStats() {
  try {
    const students = await getAllStudents();
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const stats = await getStudentAttendanceStats(student.id);
        return { ...student, stats };
      })
    );
    return studentsWithStats;
  } catch (error) {
    console.error('Error getting students with stats:', error);
    return [];
  }
}

// =============== Excel Import ===============

export async function importStudentsFromExcel(
  data: Array<{
    student_number: string;
    first_name: string;
    last_name: string;
  }>,
  cohortId: string
) {
  const currentAdmin = getCurrentAdmin();
  let success = 0;
  let duplicates = 0;
  let errors = 0;

  // Resolve institution_id once, with cohort fallback (same logic as addStudent)
  let institutionId = currentAdmin?.institution_id || null;
  if (!institutionId && cohortId) {
    const { data: cohort } = await supabase
      .from('cohorts')
      .select('institution_id')
      .eq('id', cohortId)
      .maybeSingle();
    institutionId = cohort?.institution_id || null;
  }
  if (!institutionId) {
    return { success: 0, duplicates: 0, errors: data.length };
  }

  for (const row of data) {
    try {
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('student_number', row.student_number)
        .single();

      if (existing) {
        duplicates++;
        continue;
      }

      const { error } = await supabase.from('students').insert({
        student_number: row.student_number,
        first_name: row.first_name,
        last_name: row.last_name,
        cohort_id: cohortId,
        institution_id: institutionId,
      });

      if (error) {
        errors++;
        console.error('Error inserting student:', error);
      } else {
        success++;
      }
    } catch (error) {
      errors++;
      console.error('Error processing row:', error);
    }
  }

  return { success, duplicates, errors };
}

// =============== Get All Devices (Filtered) ===============

/**
 * يُعيد قائمة أجهزة الطلاب مع بيانات الطلاب المرتبطة (JOIN).
 * - super_admin: يرى أجهزة كل المؤسسات.
 * - teacher / admin: يرى أجهزة كل طلاب مؤسسته (يحتاجها لإدارة الأجهزة المشكوك فيها
 *   عبر كل أفواجه، وليس فقط الفوج الذي يدرّسه حالياً). العزل بين المؤسسات محفوظ
 *   عبر RLS في القاعدة.
 */
export async function getAllDevices() {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin) return [];

  let query = supabase
    .from('student_devices')
    .select(`
      id,
      student_id,
      device_fingerprint,
      last_used,
      is_active,
      institution_id,
      students:students!student_devices_student_id_fkey (
        id,
        first_name,
        last_name,
        student_number,
        cohort_id,
        institution_id
      )
    `)
    .order('last_used', { ascending: false });

  if (currentAdmin.role === 'super_admin') {
    // يرى الكل
  } else {
    query = query.eq('institution_id', currentAdmin.institution_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading devices:', error);
    return [];
  }

  return data || [];
}

/**
 * إلغاء تفعيل جهاز (Soft delete) — يحافظ على سجل التدقيق ويسمح للطالب
 * بربط جهاز جديد لاحقاً عبر عملية تسجيل حضور جديدة.
 */
export async function deactivateDevice(deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('student_devices')
    .update({ is_active: false })
    .eq('id', deviceId);

  if (error) {
    console.error('Error deactivating device:', error);
    return false;
  }
  return true;
}

// ===================== الكليات والأقسام =====================

export async function getFaculties(): Promise<Faculty[]> {
  const currentAdmin = getCurrentAdmin();
  let query = supabase
    .from('faculties')
    .select('*')
    .order('name', { ascending: true });

  if (currentAdmin && currentAdmin.role !== 'super_admin') {
    query = query.eq('institution_id', currentAdmin.institution_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading faculties:', error);
    return [];
  }

  return data || [];
}

export async function addFaculty(name: string): Promise<Faculty | null> {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin) throw new Error('Unauthorized');
  
  const { data, error } = await supabase
    .from('faculties')
    .insert([{ name, institution_id: currentAdmin.institution_id }])
    .select()
    .single();
    
  if (error) { console.error(error); return null; }
  return data;
}

export async function updateFaculty(id: string, name: string): Promise<boolean> {
  const { error } = await supabase.from('faculties').update({ name }).eq('id', id);
  return !error;
}

export async function deleteFaculty(id: string): Promise<boolean> {
  const { error } = await supabase.from('faculties').delete().eq('id', id);
  return !error;
}

// ---------------- Departments ----------------

export async function getDepartments(): Promise<Department[]> {
  const currentAdmin = getCurrentAdmin();
  let query = supabase.from('departments').select('*').order('name', { ascending: true });

  if (currentAdmin && currentAdmin.role !== 'super_admin') {
    query = query.eq('institution_id', currentAdmin.institution_id);
  }

  const { data, error } = await query;
  if (error) { console.error('Error loading departments:', error); return []; }
  return data || [];
}

export async function addDepartment(name: string, faculty_id: string): Promise<Department | null> {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin) throw new Error('Unauthorized');
  
  const { data, error } = await supabase
    .from('departments')
    .insert([{ name, faculty_id, institution_id: currentAdmin.institution_id }])
    .select()
    .single();
    
  if (error) { console.error(error); return null; }
  return data;
}

export async function updateDepartment(id: string, name: string): Promise<boolean> {
  const { error } = await supabase.from('departments').update({ name }).eq('id', id);
  return !error;
}

export async function deleteDepartment(id: string): Promise<boolean> {
  const { error } = await supabase.from('departments').delete().eq('id', id);
  return !error;
}

// =============== SaaS & Subscription ===============

export async function getInstitutionSubscription(institutionId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (error) {
    console.error('Error loading subscription:', error);
    return null;
  }
  return data;
}

export async function createDefaultSubscription(institutionId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert([{
      institution_id: institutionId,
      plan_type: 'free',
      status: 'active',
      student_limit: 100,
      session_limit: 500
    }])
    .select()
    .single();
  return { data, error };
}

export async function updateSubscription(id: string, updates: Partial<Subscription>) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', id);
  return { data, error };
}

// =============== Exclusion Logic ===============

export async function getExcludedStudents(cohortId: string) {
  const students = await getStudentsByCohort(cohortId);
  const stats = await Promise.all(students.map(s => getStudentAttendanceStats(s.id)));
  
  return students.map((s, i) => ({
    ...s,
    absences: stats[i].total - stats[i].attended,
    isExcluded: (stats[i].total - stats[i].attended) >= 5,
    isAtRisk: (stats[i].total - stats[i].attended) >= 3
  }));
}

export async function getSpecialties(): Promise<Specialty[]> {
  const currentAdmin = getCurrentAdmin();
  let query = supabase.from('specialties').select('*').order('name', { ascending: true });

  if (currentAdmin && currentAdmin.role !== 'super_admin') {
    query = query.eq('institution_id', currentAdmin.institution_id);
  }

  const { data, error } = await query;
  if (error) { console.error('Error loading specialties:', error); return []; }
  return data || [];
}

export async function addSpecialty(name: string, department_id: string): Promise<Specialty | null> {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin) throw new Error('Unauthorized');
  
  const { data, error } = await supabase
    .from('specialties')
    .insert([{ name, department_id, institution_id: currentAdmin.institution_id }])
    .select()
    .single();
    
  if (error) { console.error(error); return null; }
  return data;
}

export async function updateSpecialty(id: string, name: string): Promise<boolean> {
  const { error } = await supabase.from('specialties').update({ name }).eq('id', id);
  return !error;
}

export async function deleteSpecialty(id: string): Promise<boolean> {
  const { error } = await supabase.from('specialties').delete().eq('id', id);
  return !error;
}


// ===================== المؤسسات (SaaS) =====================

export async function getAllInstitutions() {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin || currentAdmin.role !== 'super_admin') return [];

  const { data, error } = await supabase
    .from('institutions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading institutions:', error);
    return [];
  }
  return data || [];
}

export async function createInstitution(name: string, type: string, max_students: number) {
  const currentAdmin = getCurrentAdmin();
  if (!currentAdmin || currentAdmin.role !== 'super_admin') throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('institutions')
    .insert([{ name, type, max_students, status: 'active' }])
    .select()
    .single();

  if (error) throw error;
  return data;
}
