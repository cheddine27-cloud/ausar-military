// =============================================================================
// Institution Admin Dashboard — typed data layer
// =============================================================================
// Every function here is institution-scoped: queries only ever touch the
// institution that the calling admin belongs to. Defense-in-depth — Supabase
// RLS already enforces this at the database level (see migration
// 20260520000000_v260_institution_admin_roles_and_tables.sql), but we also
// pass the institution_id explicitly so the queries are efficient and obvious.
//
// Super admins can pass an explicit institutionId override (e.g. when they
// preview another institution's dashboard).
// =============================================================================

import { supabase } from './supabase';
import { getCurrentAdmin } from './database';
import type { PermissionKey, PermissionMap } from './permissions';

export type InstitutionType = 'military';

export interface InstitutionUnitRow {
  id: string;
  institution_id: string;
  parent_id: string | null;
  type: string;
  name: string;
  code: string | null;
  description: string | null;
  status: 'active' | 'archived' | string;
  metadata: Record<string, unknown>;
  allowed_modes?: string[] | null;
  created_at: string;
  updated_at: string;
}


export interface InstitutionOverview {
  // الناس
  studentsCount: number;
  teachersCount: number;
  // الهيكل
  faculties: number;
  departments: number;
  specialties: number;
  groups: number;
  // التشغيل
  sessionsToday: number;
  activeSessions: number;
  attendancesToday: number;
  attendancesThisWeek: number;
  totalSessions: number;
  totalAttendances: number;
  // الأمن
  devices: number;
  activeDevices: number;
  // التبريرات
  pendingJustifications: number;
  // الاشتراك
  subscription: {
    planName: string | null;
    status: string | null;
    endDate: string | null;
    studentLimit: number | null;
    sessionLimit: number | null;
  } | null;
  // النشاط الأخير
  lastActivityAt: string | null;
}

export interface InstitutionRecentSession {
  id: string;
  title: string;
  code: string;
  status: string;
  cohortName: string | null;
  professorName: string | null;
  attendanceCount: number;
  totalStudentsInCohort: number;
  attendanceRate: number; // 0..100
  createdAt: string;
}

export interface InstitutionRecentActivity {
  id: string;
  category: string;
  type: string;
  title: string;
  description: string | null;
  outcomeStatus: string;
  priority: string;
  actorName: string | null;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Resolve which institution we should query for. */
function resolveInstitutionId(override?: string | null): string | null {
  if (override) return override;
  const current = getCurrentAdmin();
  return current?.institution_id ?? null;
}

function startOfTodayIso(): string {
  return new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
}

function startOfWeekIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function isRoleScopedByUnit(role: string | null | undefined): boolean {
  return role === 'faculty_admin' || role === 'department_admin' || role === 'staff' || role === 'viewer';
}

function collectScopedUnitIds(units: InstitutionUnitRow[], scopeUnitIds: string[]): Set<string> {
  const allowed = new Set<string>();
  const scopeIds = new Set(scopeUnitIds);
  const byId = new Map(units.map((unit) => [unit.id, unit]));

  const addAncestors = (unitId: string) => {
    let current = byId.get(unitId);
    while (current) {
      allowed.add(current.id);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
  };

  for (const unit of units) {
    let current: InstitutionUnitRow | undefined = unit;
    while (current) {
      if (scopeIds.has(current.id)) {
        allowed.add(unit.id);
        addAncestors(current.id);
        break;
      }
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
  }

  return allowed;
}

async function filterUnitsForCurrentAdminScope(
  units: InstitutionUnitRow[],
  institutionId: string,
): Promise<InstitutionUnitRow[]> {
  const admin = getCurrentAdmin();
  if (!admin || !isRoleScopedByUnit(admin.role)) return units;

  const { data, error } = await supabase
    .from('user_scopes')
    .select('unit_id')
    .eq('admin_id', admin.id)
    .eq('institution_id', institutionId);

  if (error) {
    console.error('filterUnitsForCurrentAdminScope failed:', error);
    return [];
  }

  const scopes = data ?? [];
  if (scopes.some((scope: { unit_id: string | null }) => scope.unit_id === null)) return units;

  const scopeUnitIds = scopes
    .map((scope: { unit_id: string | null }) => scope.unit_id)
    .filter((unitId): unitId is string => Boolean(unitId));

  if (scopeUnitIds.length === 0) return [];

  const allowed = collectScopedUnitIds(units, scopeUnitIds);
  return units.filter((unit) => allowed.has(unit.id));
}

// -----------------------------------------------------------------------------
// Overview (KPIs)
// -----------------------------------------------------------------------------

export async function getInstitutionOverview(institutionId?: string | null): Promise<InstitutionOverview | null> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return null;

  const todayIso = startOfTodayIso();
  const weekIso = startOfWeekIso();

  // Run all counts in parallel for speed.
  const [
    studentsRes,
    teachersRes,
    facultiesRes,
    departmentsRes,
    specialtiesRes,
    cohortsRes,
    sessionsTotalRes,
    activeSessionsRes,
    sessionsTodayRes,
    attendancesTotalRes,
    attendancesTodayRes,
    attendancesWeekRes,
    devicesRes,
    activeDevicesRes,
    pendingJustRes,
    subscriptionRes,
    lastSessionRes,
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', id),
    supabase.from('admins').select('*', { count: 'exact', head: true }).eq('institution_id', id).eq('role', 'teacher'),
    supabase.from('faculties').select('*', { count: 'exact', head: true }).eq('institution_id', id),
    supabase.from('departments').select('*', { count: 'exact', head: true }).eq('institution_id', id),
    supabase.from('specialties').select('*', { count: 'exact', head: true }).eq('institution_id', id),
    supabase.from('cohorts').select('*', { count: 'exact', head: true }).eq('institution_id', id),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('institution_id', id),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('institution_id', id).eq('status', 'active'),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('institution_id', id).gte('created_at', todayIso),
    supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('institution_id', id),
    supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('institution_id', id).gte('timestamp', todayIso),
    supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('institution_id', id).gte('timestamp', weekIso),
    supabase.from('student_devices').select('*', { count: 'exact', head: true }).eq('institution_id', id),
    supabase.from('student_devices').select('*', { count: 'exact', head: true }).eq('institution_id', id).eq('is_active', true),
    // pending justifications: graceful if table doesn't exist yet on a fresh DB
    supabase.from('absence_justifications').select('*', { count: 'exact', head: true }).eq('institution_id', id).eq('status', 'pending'),
    supabase
      .from('subscriptions')
      .select('plan_name, plan_type, status, end_date, current_period_end, student_limit, session_limit')
      .eq('institution_id', id)
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('created_at')
      .eq('institution_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    studentsCount: studentsRes.count ?? 0,
    teachersCount: teachersRes.count ?? 0,
    faculties: facultiesRes.count ?? 0,
    departments: departmentsRes.count ?? 0,
    specialties: specialtiesRes.count ?? 0,
    groups: cohortsRes.count ?? 0,
    sessionsToday: sessionsTodayRes.count ?? 0,
    activeSessions: activeSessionsRes.count ?? 0,
    attendancesToday: attendancesTodayRes.count ?? 0,
    attendancesThisWeek: attendancesWeekRes.count ?? 0,
    totalSessions: sessionsTotalRes.count ?? 0,
    totalAttendances: attendancesTotalRes.count ?? 0,
    devices: devicesRes.count ?? 0,
    activeDevices: activeDevicesRes.count ?? 0,
    pendingJustifications: pendingJustRes.count ?? 0,
    subscription: subscriptionRes.data
      ? {
          planName:
            (subscriptionRes.data as { plan_name?: string | null; plan_type?: string | null }).plan_name ??
            (subscriptionRes.data as { plan_type?: string | null }).plan_type ??
            null,
          status: subscriptionRes.data.status ?? null,
          endDate:
            (subscriptionRes.data as { end_date?: string | null; current_period_end?: string | null }).end_date ??
            (subscriptionRes.data as { current_period_end?: string | null }).current_period_end ??
            null,
          studentLimit: subscriptionRes.data.student_limit ?? null,
          sessionLimit: subscriptionRes.data.session_limit ?? null,
        }
      : null,
    lastActivityAt: lastSessionRes.data?.created_at ?? null,
  };
}

// -----------------------------------------------------------------------------
// Recent sessions (for the home table)
// -----------------------------------------------------------------------------

export async function getInstitutionRecentSessions(
  institutionId?: string | null,
  limit = 5,
): Promise<InstitutionRecentSession[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, title, code, status, cohort_id, professor_id, created_at')
    .eq('institution_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !sessions || sessions.length === 0) return [];

  // Resolve cohorts and professors and attendance counts.
  const cohortIds = Array.from(new Set(sessions.map((s) => s.cohort_id).filter(Boolean) as string[]));
  const professorIds = Array.from(new Set(sessions.map((s) => s.professor_id).filter(Boolean) as string[]));
  const sessionIds = sessions.map((s) => s.id);

  const [cohortsRes, professorsRes, studentCountsRes, attendanceCountsRes] = await Promise.all([
    cohortIds.length
      ? supabase.from('cohorts').select('id, name').in('id', cohortIds)
      : Promise.resolve({ data: [], error: null }),
    professorIds.length
      ? supabase.from('admins').select('id, full_name, username').in('id', professorIds)
      : Promise.resolve({ data: [], error: null }),
    cohortIds.length
      ? supabase.from('students').select('cohort_id').in('cohort_id', cohortIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('attendances').select('session_id').in('session_id', sessionIds),
  ]);

  const cohortById = new Map<string, string>();
  (cohortsRes.data ?? []).forEach((c: { id: string; name: string }) => cohortById.set(c.id, c.name));

  const professorById = new Map<string, string>();
  (professorsRes.data ?? []).forEach((p: { id: string; full_name: string | null; username: string }) =>
    professorById.set(p.id, p.full_name || p.username),
  );

  const studentsByCohort = new Map<string, number>();
  (studentCountsRes.data ?? []).forEach((s: { cohort_id: string | null }) => {
    if (!s.cohort_id) return;
    studentsByCohort.set(s.cohort_id, (studentsByCohort.get(s.cohort_id) ?? 0) + 1);
  });

  const attendancesBySession = new Map<string, number>();
  (attendanceCountsRes.data ?? []).forEach((a: { session_id: string | null }) => {
    if (!a.session_id) return;
    attendancesBySession.set(a.session_id, (attendancesBySession.get(a.session_id) ?? 0) + 1);
  });

  return sessions.map((s) => {
    const cohortName = s.cohort_id ? cohortById.get(s.cohort_id) ?? null : null;
    const professorName = s.professor_id ? professorById.get(s.professor_id) ?? null : null;
    const totalInCohort = s.cohort_id ? studentsByCohort.get(s.cohort_id) ?? 0 : 0;
    const attendanceCount = attendancesBySession.get(s.id) ?? 0;
    const attendanceRate = totalInCohort > 0 ? Math.round((attendanceCount / totalInCohort) * 100) : 0;
    return {
      id: s.id,
      title: s.title,
      code: s.code,
      status: s.status,
      cohortName,
      professorName,
      attendanceCount,
      totalStudentsInCohort: totalInCohort,
      attendanceRate,
      createdAt: s.created_at,
    };
  });
}

// -----------------------------------------------------------------------------
// Recent activity stream
// -----------------------------------------------------------------------------

export async function getInstitutionRecentActivity(
  institutionId?: string | null,
  limit = 8,
): Promise<InstitutionRecentActivity[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, category, type, title, description, outcome_status, priority, actor_admin_id, created_at')
    .eq('institution_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // Resolve actor names in a single round-trip
  const actorIds = Array.from(
    new Set(data.map((row) => row.actor_admin_id).filter(Boolean) as string[]),
  );
  const actorById = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from('admins')
      .select('id, full_name, username')
      .in('id', actorIds);
    (actors ?? []).forEach((a: { id: string; full_name: string | null; username: string }) =>
      actorById.set(a.id, a.full_name || a.username),
    );
  }

  return data.map((row) => ({
    id: row.id,
    category: row.category,
    type: row.type,
    title: row.title,
    description: row.description,
    outcomeStatus: row.outcome_status,
    priority: row.priority,
    actorName: row.actor_admin_id ? actorById.get(row.actor_admin_id) ?? null : null,
    createdAt: row.created_at,
  }));
}

// -----------------------------------------------------------------------------
// Weekly attendance trend (for the line chart on the home page)
// Returns 7 daily values: [day -6, day -5, ..., day 0 (today)].
// -----------------------------------------------------------------------------

export async function getInstitutionWeeklyAttendance(
  institutionId?: string | null,
): Promise<{ label: string; count: number }[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('attendances')
    .select('timestamp')
    .eq('institution_id', id)
    .gte('timestamp', since);

  // Bucket per day-of-week (last 7 days)
  const buckets: { label: string; count: number; key: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.push({
      label: d.toLocaleDateString('ar-DZ', { weekday: 'short' }),
      count: 0,
      key: d.toISOString().slice(0, 10),
    });
  }

  (data ?? []).forEach((row: { timestamp: string }) => {
    const dayKey = new Date(row.timestamp).toISOString().slice(0, 10);
    const bucket = buckets.find((b) => b.key === dayKey);
    if (bucket) bucket.count += 1;
  });

  return buckets.map(({ label, count }) => ({ label, count }));
}

// -----------------------------------------------------------------------------
// Institution units (organizational structure)
// -----------------------------------------------------------------------------

export async function getInstitutionUnits(
  institutionId?: string | null,
): Promise<InstitutionUnitRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data, error } = await supabase
    .from('institution_units')
    .select('*')
    .eq('institution_id', id)
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('getInstitutionUnits failed:', error);
    return [];
  }
  return filterUnitsForCurrentAdminScope((data ?? []) as InstitutionUnitRow[], id);
}

export async function createInstitutionUnit(input: {
  type: string;
  name: string;
  parentId?: string | null;
  code?: string | null;
  description?: string | null;
  institutionId?: string | null;
  allowedModes?: string[] | null;
}): Promise<InstitutionUnitRow> {
  const id = resolveInstitutionId(input.institutionId);
  if (!id) throw new Error('تعذر تحديد المؤسسة');

  const { data, error } = await supabase
    .from('institution_units')
    .insert({
      institution_id: id,
      parent_id: input.parentId ?? null,
      type: input.type,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      description: input.description?.trim() || null,
      allowed_modes: input.allowedModes ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as InstitutionUnitRow;
}

export async function updateInstitutionUnit(
  unitId: string,
  patch: Partial<{
    name: string;
    code: string | null;
    description: string | null;
    parentId: string | null;
    status: 'active' | 'archived';
    allowedModes: string[] | null;
  }>,
): Promise<InstitutionUnitRow> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.code !== undefined) payload.code = patch.code ? patch.code.trim() : null;
  if (patch.description !== undefined) payload.description = patch.description ? patch.description.trim() : null;
  if (patch.parentId !== undefined) payload.parent_id = patch.parentId;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.allowedModes !== undefined) payload.allowed_modes = patch.allowedModes;

  const { data, error } = await supabase
    .from('institution_units')
    .update(payload)
    .eq('id', unitId)
    .select('*')
    .single();

  if (error) throw error;
  return data as InstitutionUnitRow;
}

export async function deleteInstitutionUnit(unitId: string): Promise<void> {
  const { error } = await supabase.from('institution_units').delete().eq('id', unitId);
  if (error) throw error;
}

// =============================================================================
// Phase 3 — Users / Teachers / Students management
// =============================================================================

export type CreatableUserRole = 'teacher' | 'faculty_admin' | 'department_admin' | 'staff' | 'viewer';

export interface InstitutionUserRow {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  role: string;
  rank: string | null;
  department: string | null;
  institution_id: string | null;
  created_at: string;
}

export interface CreateUserResult {
  ok: boolean;
  admin?: InstitutionUserRow;
  scope?: { id: string; unit_id: string | null; scope_role: string } | null;
  credentials?: {
    email: string;
    username: string;
    password: string;
    loginUrl: string;
    phone: string | null;
  };
  error?: { code: string; message: string };
}

export async function getCurrentAdminPermissionMap(): Promise<PermissionMap> {
  const admin = getCurrentAdmin();
  if (!admin?.role) return {};

  const [{ data: catalog }, { data: defaults }, { data: overrides }] = await Promise.all([
    supabase.from('permission_catalog').select('permission_key'),
    supabase
      .from('role_permission_defaults')
      .select('permission_key, allowed')
      .eq('role', admin.role),
    supabase
      .from('admin_permission_overrides')
      .select('permission_key, allowed')
      .eq('admin_id', admin.id),
  ]);

  if (admin.role === 'super_admin') {
    return Object.fromEntries(
      (catalog ?? []).map((row: { permission_key: string }) => [row.permission_key as PermissionKey, true]),
    ) as PermissionMap;
  }

  const permissions: PermissionMap = {};
  (defaults ?? []).forEach((row: { permission_key: string; allowed: boolean }) => {
    permissions[row.permission_key as PermissionKey] = row.allowed;
  });
  (overrides ?? []).forEach((row: { permission_key: string; allowed: boolean }) => {
    permissions[row.permission_key as PermissionKey] = row.allowed;
  });
  return permissions;
}

export interface InstitutionStudentRow {
  id: string;
  student_number: string | null;
  first_name: string | null;
  last_name: string | null;
  cohort_id: string | null;
  cohort_name?: string | null;
  year: string | null;
  specialty: string | null;
  faculty: string | null;
  status: string | null;
  phone: string | null;
  institution_id: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Users (admins inside the institution)
// -----------------------------------------------------------------------------

/** Fetch all admin/teacher/viewer accounts inside the institution. */
export async function getInstitutionUsers(
  institutionId?: string | null,
): Promise<InstitutionUserRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data, error } = await supabase
    .from('admins')
    .select('id, username, email, full_name, role, rank, department, institution_id, created_at')
    .eq('institution_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getInstitutionUsers failed:', error);
    return [];
  }
  return (data ?? []) as InstitutionUserRow[];
}

/**
 * Create a downstream user (teacher / faculty_admin / department_admin / staff / viewer)
 * via the secure server-side Edge Function.
 *
 * Phase 5: when `unitId` is provided AND the role is faculty_admin /
 * department_admin / staff / viewer, the edge function also creates a user_scopes
 * row binding the user to that institution_unit subtree.
 */
export async function createInstitutionUser(input: {
  email: string;
  username: string;
  fullName?: string | null;
  phone?: string | null;
  password?: string;
  role: CreatableUserRole;
  rank?: string | null;
  department?: string | null;
  institutionId?: string | null;
  unitId?: string | null; // Phase 5
}): Promise<CreateUserResult> {
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session.session?.access_token;
  if (!accessToken) {
    return { ok: false, error: { code: 'NO_SESSION', message: 'يرجى تسجيل الدخول مرة أخرى' } };
  }

  const { data, error } = await supabase.functions.invoke('create-institution-user', {
    body: {
      email: input.email,
      username: input.username,
      fullName: input.fullName ?? null,
      phone: input.phone ?? null,
      password: input.password,
      role: input.role,
      rank: input.rank ?? null,
      department: input.department ?? null,
      institutionId: input.institutionId ?? null,
      unitId: input.unitId ?? null,
    },
  });

  if (error) {
    return { ok: false, error: { code: 'INVOKE_FAILED', message: error.message } };
  }
  return data as CreateUserResult;
}

/**
 * Reset password for a user inside the institution. Returns the new
 * temporary password ONCE — never persisted as plaintext (Supabase Auth
 * bcrypt-hashes it server-side).
 */
export interface ResetPasswordResult {
  ok: boolean;
  admin?: { id: string; username: string; email: string | null; full_name: string | null; role: string };
  credentials?: { email: string | null; username: string; password: string; loginUrl: string };
  error?: { code: string; message: string };
}

export async function resetInstitutionUserPassword(adminId: string): Promise<ResetPasswordResult> {
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session.session?.access_token;
  if (!accessToken) {
    return { ok: false, error: { code: 'NO_SESSION', message: 'يرجى تسجيل الدخول مرة أخرى' } };
  }

  const { data, error } = await supabase.functions.invoke('reset-institution-user-password', {
    body: { adminId },
  });

  if (error) {
    return { ok: false, error: { code: 'INVOKE_FAILED', message: error.message } };
  }
  return data as ResetPasswordResult;
}

/** Update non-credential profile fields of an institution user. */
export async function updateInstitutionUser(
  userId: string,
  patch: Partial<{ full_name: string | null; rank: string | null; department: string | null; role: CreatableUserRole }>,
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (patch.full_name !== undefined) payload.full_name = patch.full_name;
  if (patch.rank !== undefined) payload.rank = patch.rank;
  if (patch.department !== undefined) payload.department = patch.department;
  if (patch.role !== undefined) payload.role = patch.role;

  const { error } = await supabase.from('admins').update(payload).eq('id', userId);
  if (error) {
    console.error('updateInstitutionUser failed:', error);
    return false;
  }
  return true;
}

/**
 * Soft-disable: we don't currently have an `is_active` flag on admins, so
 * deletion removes both the auth user and the admin row. RLS prevents managers
 * from deleting outside their tenant. We do this client-side because the
 * admins table has ON DELETE CASCADE on auth.users.
 *
 * NOTE: For now we only delete the admin profile row. The auth user remains
 * dormant on the auth side (cannot log in because the role check fails). A
 * future enhancement could call a delete-institution-user edge function.
 */
export async function deleteInstitutionUser(userId: string): Promise<boolean> {
  const { error } = await supabase.from('admins').delete().eq('id', userId);
  if (error) {
    console.error('deleteInstitutionUser failed:', error);
    return false;
  }
  return true;
}

// -----------------------------------------------------------------------------
// Students (institution-scoped)
// -----------------------------------------------------------------------------

export async function getInstitutionStudents(
  institutionId?: string | null,
): Promise<InstitutionStudentRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      student_number,
      first_name,
      last_name,
      cohort_id,
      year,
      specialty,
      faculty,
      status,
      phone,
      institution_id,
      created_at,
      cohorts:cohort_id ( id, name )
    `)
    .eq('institution_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getInstitutionStudents failed:', error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const cohortRel = row.cohorts as { name?: string | null } | { name?: string | null }[] | null | undefined;
    const cohortName = Array.isArray(cohortRel)
      ? cohortRel[0]?.name ?? null
      : cohortRel?.name ?? null;
    return {
      id: row.id as string,
      student_number: (row.student_number as string | null) ?? null,
      first_name: (row.first_name as string | null) ?? null,
      last_name: (row.last_name as string | null) ?? null,
      cohort_id: (row.cohort_id as string | null) ?? null,
      cohort_name: cohortName,
      year: (row.year as string | null) ?? null,
      specialty: (row.specialty as string | null) ?? null,
      faculty: (row.faculty as string | null) ?? null,
      status: (row.status as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      institution_id: (row.institution_id as string | null) ?? null,
      created_at: row.created_at as string,
    };
  });
}

export async function createInstitutionStudent(input: {
  studentNumber: string;
  firstName: string;
  lastName: string;
  cohortId: string;
  year?: string | null;
  specialty?: string | null;
  faculty?: string | null;
  phone?: string | null;
  gender?: 'male' | 'female' | null;
  institutionId?: string | null;
}): Promise<InstitutionStudentRow> {
  const id = resolveInstitutionId(input.institutionId);
  if (!id) throw new Error('تعذر تحديد المؤسسة');

  const { data, error } = await supabase
    .from('students')
    .insert({
      student_number: input.studentNumber.trim(),
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      cohort_id: input.cohortId,
      year: input.year ?? null,
      specialty: input.specialty ?? null,
      faculty: input.faculty ?? null,
      phone: input.phone ?? null,
      gender: input.gender ?? null,
      institution_id: id,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as InstitutionStudentRow;
}

export async function updateInstitutionStudent(
  studentId: string,
  patch: Partial<{
    student_number: string;
    first_name: string;
    last_name: string;
    cohort_id: string | null;
    year: string | null;
    specialty: string | null;
    faculty: string | null;
    phone: string | null;
    status: string;
  }>,
): Promise<boolean> {
  const { error } = await supabase.from('students').update(patch).eq('id', studentId);
  if (error) {
    console.error('updateInstitutionStudent failed:', error);
    return false;
  }
  return true;
}

export async function deleteInstitutionStudent(studentId: string): Promise<boolean> {
  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) {
    console.error('deleteInstitutionStudent failed:', error);
    return false;
  }
  return true;
}

/**
 * Bulk import students. Accepts pre-parsed rows; the UI is responsible for
 * Excel/CSV parsing (we use ExcelJS in the browser). We chunk inserts to keep
 * each request reasonable in size.
 */
export async function importInstitutionStudents(
  rows: Array<{
    student_number: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
    specialty?: string | null;
  }>,
  cohortId: string,
  institutionId?: string | null,
): Promise<{ success: number; duplicates: number; errors: number; errorDetails: string[] }> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return { success: 0, duplicates: 0, errors: rows.length, errorDetails: ['institution_id غير محدد'] };

  let success = 0;
  let duplicates = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  // Pre-fetch existing student numbers to avoid N round trips
  const { data: existing } = await supabase
    .from('students')
    .select('student_number')
    .eq('institution_id', id);
  const existingNumbers = new Set((existing ?? []).map((r: { student_number: string | null }) => r.student_number ?? ''));

  for (const row of rows) {
    const number = row.student_number?.toString().trim();
    const first = row.first_name?.toString().trim();
    const last = row.last_name?.toString().trim();

    if (!number || !first || !last) {
      errors++;
      errorDetails.push(`سطر ناقص: ${number || '(بلا رقم)'}`);
      continue;
    }
    if (existingNumbers.has(number)) {
      duplicates++;
      continue;
    }

    const { error } = await supabase.from('students').insert({
      student_number: number,
      first_name: first,
      last_name: last,
      phone: row.phone ?? null,
      specialty: row.specialty ?? null,
      cohort_id: cohortId,
      institution_id: id,
    });

    if (error) {
      errors++;
      errorDetails.push(`${number}: ${error.message}`);
    } else {
      success++;
      existingNumbers.add(number);
    }
  }

  return { success, duplicates, errors, errorDetails };
}

// -----------------------------------------------------------------------------
// Cohorts (institution-scoped, for the cohort picker in students forms)
// -----------------------------------------------------------------------------

export async function getInstitutionCohorts(
  institutionId?: string | null,
): Promise<{ id: string; name: string; level: string | null }[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data, error } = await supabase
    .from('cohorts')
    .select('id, name, level')
    .eq('institution_id', id)
    .order('name', { ascending: true });

  if (error) {
    console.error('getInstitutionCohorts failed:', error);
    return [];
  }
  return (data ?? []) as { id: string; name: string; level: string | null }[];
}


// =============================================================================
// Phase 6 — Teacher Assignments
// =============================================================================
// teacher_assignments link a teacher (admins.id where role='teacher') to a
// specific cohort, optionally narrowed by an institution_unit (e.g. a subject
// or a course within that cohort). RLS on the table:
//   * super_admin: full
//   * institution managers: full within their own institution_id
//   * teacher: SELECT-only on their own rows (not surfaced in this UI)
// =============================================================================

export interface TeacherAssignmentRow {
  id: string;
  teacher_id: string;
  cohort_id: string;
  unit_id: string | null;
  institution_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields (best-effort, populated by getTeacherAssignments)
  cohort_name?: string | null;
  unit_name?: string | null;
  unit_type?: string | null;
}

/** All assignments for one teacher inside the institution. */
export async function getTeacherAssignments(
  teacherId: string,
  institutionId?: string | null,
): Promise<TeacherAssignmentRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data, error } = await supabase
    .from('teacher_assignments')
    .select(`
      id,
      teacher_id,
      cohort_id,
      unit_id,
      institution_id,
      notes,
      created_at,
      updated_at,
      cohorts:cohort_id ( id, name ),
      institution_units:unit_id ( id, name, type )
    `)
    .eq('teacher_id', teacherId)
    .eq('institution_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getTeacherAssignments failed:', error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const cohortRel = row.cohorts as { name?: string | null } | { name?: string | null }[] | null | undefined;
    const unitRel = row.institution_units as { name?: string | null; type?: string | null } | { name?: string | null; type?: string | null }[] | null | undefined;
    const cohortName = Array.isArray(cohortRel) ? cohortRel[0]?.name ?? null : cohortRel?.name ?? null;
    const unitName = Array.isArray(unitRel) ? unitRel[0]?.name ?? null : unitRel?.name ?? null;
    const unitType = Array.isArray(unitRel) ? unitRel[0]?.type ?? null : unitRel?.type ?? null;
    return {
      id: row.id as string,
      teacher_id: row.teacher_id as string,
      cohort_id: row.cohort_id as string,
      unit_id: (row.unit_id as string | null) ?? null,
      institution_id: row.institution_id as string,
      notes: (row.notes as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      cohort_name: cohortName,
      unit_name: unitName,
      unit_type: unitType,
    };
  });
}

/** Bulk count of assignments per teacher (for the teacher list badge). */
export async function getAssignmentsCountByTeacher(
  teacherIds: string[],
  institutionId?: string | null,
): Promise<Record<string, number>> {
  const id = resolveInstitutionId(institutionId);
  if (!id || teacherIds.length === 0) return {};

  const { data, error } = await supabase
    .from('teacher_assignments')
    .select('teacher_id')
    .eq('institution_id', id)
    .in('teacher_id', teacherIds);

  if (error) {
    console.error('getAssignmentsCountByTeacher failed:', error);
    return {};
  }

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { teacher_id: string }) => {
    counts[row.teacher_id] = (counts[row.teacher_id] ?? 0) + 1;
  });
  return counts;
}

/** Add a single (cohort, optional unit) assignment to a teacher. */
export async function createTeacherAssignment(input: {
  teacherId: string;
  cohortId: string;
  unitId?: string | null;
  notes?: string | null;
  institutionId?: string | null;
}): Promise<TeacherAssignmentRow> {
  const id = resolveInstitutionId(input.institutionId);
  if (!id) throw new Error('تعذر تحديد المؤسسة');

  // Pre-flight check to prevent 409 Conflict in browser console
  const preflightQuery = supabase
    .from('teacher_assignments')
    .select('id')
    .eq('teacher_id', input.teacherId)
    .eq('cohort_id', input.cohortId)
    .eq('institution_id', id);

  if (input.unitId) {
    preflightQuery.eq('unit_id', input.unitId);
  } else {
    preflightQuery.is('unit_id', null);
  }

  const { data: existing } = await preflightQuery.maybeSingle();
  if (existing) {
    throw new Error('هذا التعيين للأستاذ موجود بالفعل في النظام.');
  }

  const { data, error } = await supabase
    .from('teacher_assignments')
    .insert({
      teacher_id: input.teacherId,
      cohort_id: input.cohortId,
      unit_id: input.unitId ?? null,
      institution_id: id,
      notes: input.notes?.trim() || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as TeacherAssignmentRow;
}

/**
 * Replace all assignments for a teacher with the given list of cohort IDs.
 * This is the most ergonomic API for the "checkbox grid" UI: you pass the
 * full set of selected cohort IDs and we sync the DB to match. We do this
 * in a transaction-like sequence (best-effort: Supabase JS does not expose
 * transactions, so we run delete-then-insert; RLS ensures atomicity at the
 * tenant level).
 */
export async function replaceTeacherAssignments(input: {
  teacherId: string;
  cohortIds: string[];
  institutionId?: string | null;
}): Promise<{ added: number; removed: number; kept: number }> {
  const id = resolveInstitutionId(input.institutionId);
  if (!id) throw new Error('تعذر تحديد المؤسسة');

  // Current state (we only handle assignments without unit_id here — those
  // are the "default cohort scope" assignments. Subject-level assignments
  // (with unit_id) are managed individually via createTeacherAssignment /
  // deleteTeacherAssignment so they're not silently wiped.)
  const { data: existing, error: existErr } = await supabase
    .from('teacher_assignments')
    .select('id, cohort_id, unit_id')
    .eq('teacher_id', input.teacherId)
    .eq('institution_id', id)
    .is('unit_id', null);

  if (existErr) throw existErr;

  const existingIds = new Set((existing ?? []).map((r: { cohort_id: string }) => r.cohort_id));
  const targetIds = new Set(input.cohortIds);

  const toRemove = (existing ?? [])
    .filter((r: { cohort_id: string }) => !targetIds.has(r.cohort_id))
    .map((r: { id: string }) => r.id);
  const toAdd = input.cohortIds.filter((cid) => !existingIds.has(cid));
  const kept = input.cohortIds.filter((cid) => existingIds.has(cid)).length;

  // Removals first
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('teacher_assignments')
      .delete()
      .in('id', toRemove);
    if (error) throw error;
  }

  // Additions
  if (toAdd.length > 0) {
    const rows = toAdd.map((cohortId) => ({
      teacher_id: input.teacherId,
      cohort_id: cohortId,
      unit_id: null as string | null,
      institution_id: id,
    }));
    const { error } = await supabase.from('teacher_assignments').insert(rows);
    if (error) throw error;
  }

  return { added: toAdd.length, removed: toRemove.length, kept };
}

/** Delete a single assignment. */
export async function deleteTeacherAssignment(assignmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('teacher_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) {
    console.error('deleteTeacherAssignment failed:', error);
    return false;
  }
  return true;
}


// =============================================================================
// Phase 5 — User Scopes
// =============================================================================
// user_scopes binds a user (admins.id) to a specific unit_id within an
// institution. Multiple scopes per user are allowed (e.g. faculty_admin on
// two different faculties) but the unique index prevents exact duplicates.
// NULL unit_id = institution-wide.
// =============================================================================

export interface UserScopeRow {
  id: string;
  admin_id: string;
  institution_id: string;
  unit_id: string | null;
  scope_role: string;
  created_at: string;
  // Joined
  unit_name?: string | null;
  unit_type?: string | null;
}

/** All user_scopes for a single admin user. */
export async function getUserScopes(
  adminId: string,
  institutionId?: string | null,
): Promise<UserScopeRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data, error } = await supabase
    .from('user_scopes')
    .select(`
      id,
      admin_id,
      institution_id,
      unit_id,
      scope_role,
      created_at,
      institution_units:unit_id ( id, name, type )
    `)
    .eq('admin_id', adminId)
    .eq('institution_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getUserScopes failed:', error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const unitRel = row.institution_units as { name?: string | null; type?: string | null } | { name?: string | null; type?: string | null }[] | null | undefined;
    const unitName = Array.isArray(unitRel) ? unitRel[0]?.name ?? null : unitRel?.name ?? null;
    const unitType = Array.isArray(unitRel) ? unitRel[0]?.type ?? null : unitRel?.type ?? null;
    return {
      id: row.id as string,
      admin_id: row.admin_id as string,
      institution_id: row.institution_id as string,
      unit_id: (row.unit_id as string | null) ?? null,
      scope_role: row.scope_role as string,
      created_at: row.created_at as string,
      unit_name: unitName,
      unit_type: unitType,
    };
  });
}

/** Bulk: scopes summary keyed by admin_id (for the users table badge). */
export async function getScopesByAdminIds(
  adminIds: string[],
  institutionId?: string | null,
): Promise<Record<string, UserScopeRow[]>> {
  const id = resolveInstitutionId(institutionId);
  if (!id || adminIds.length === 0) return {};

  const { data, error } = await supabase
    .from('user_scopes')
    .select(`
      id,
      admin_id,
      institution_id,
      unit_id,
      scope_role,
      created_at,
      institution_units:unit_id ( id, name, type )
    `)
    .eq('institution_id', id)
    .in('admin_id', adminIds);

  if (error) {
    console.error('getScopesByAdminIds failed:', error);
    return {};
  }

  const grouped: Record<string, UserScopeRow[]> = {};
  (data ?? []).forEach((row: Record<string, unknown>) => {
    const unitRel = row.institution_units as { name?: string | null; type?: string | null } | { name?: string | null; type?: string | null }[] | null | undefined;
    const unitName = Array.isArray(unitRel) ? unitRel[0]?.name ?? null : unitRel?.name ?? null;
    const unitType = Array.isArray(unitRel) ? unitRel[0]?.type ?? null : unitRel?.type ?? null;
    const scope: UserScopeRow = {
      id: row.id as string,
      admin_id: row.admin_id as string,
      institution_id: row.institution_id as string,
      unit_id: (row.unit_id as string | null) ?? null,
      scope_role: row.scope_role as string,
      created_at: row.created_at as string,
      unit_name: unitName,
      unit_type: unitType,
    };
    const key = scope.admin_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(scope);
  });
  return grouped;
}

/** Replace ALL scopes for one admin with the given list (single-scope simplification). */
export async function replaceUserScope(input: {
  adminId: string;
  unitId: string | null;
  scopeRole: 'faculty_admin' | 'department_admin' | 'staff' | 'viewer';
  institutionId?: string | null;
}): Promise<UserScopeRow> {
  const id = resolveInstitutionId(input.institutionId);
  if (!id) throw new Error('تعذر تحديد المؤسسة');

  // Remove existing scopes for this admin first (single-scope model from UI)
  const { error: delErr } = await supabase
    .from('user_scopes')
    .delete()
    .eq('admin_id', input.adminId)
    .eq('institution_id', id);
  if (delErr) throw delErr;

  // Insert the new one
  const { data, error } = await supabase
    .from('user_scopes')
    .insert({
      admin_id: input.adminId,
      institution_id: id,
      unit_id: input.unitId,
      scope_role: input.scopeRole,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as UserScopeRow;
}


// =============================================================================
// Phase 4 — Cohorts CRUD with academic-unit binding (cohorts.unit_id)
// =============================================================================
// Cohorts (الأفواج) live in their own table but each one optionally belongs
// to a single institution_unit (faculty/department/specialty/group). The
// hierarchical RLS in Phase 2B uses cohorts.unit_id to gate sub-scope users.
// =============================================================================

export interface InstitutionCohortRow {
  id: string;
  name: string;
  description: string | null;
  level: string | null;
  field: string | null;
  subject: string | null;
  specialty: string | null;
  unit_id: string | null;
  institution_id: string;
  created_at: string;
  main_teacher_id?: string | null;
  monitor_id?: string | null;
  deputy_monitor_id?: string | null;
  deputy_monitor_2_id?: string | null;
  primary_room_id?: string | null;
  // Joined / derived
  unit_name?: string | null;
  unit_type?: string | null;
  /** Top-down path: ['كلية العلوم', 'قسم الإعلام', 'ISIL'] (without the cohort name itself) */
  unit_path?: string[];
  /** Number of students currently in the cohort */
  studentsCount?: number;
}

/**
 * Build the top-down path of a unit by walking parent_id pointers.
 * Returns names from root to the unit itself (inclusive).
 */
function buildUnitPath(unitId: string, unitsMap: Map<string, InstitutionUnitRow>): string[] {
  const path: string[] = [];
  let cursor: string | null = unitId;
  // Guard against cycles
  let safety = 0;
  while (cursor && safety < 20) {
    const u = unitsMap.get(cursor);
    if (!u) break;
    path.unshift(u.name);
    cursor = u.parent_id;
    safety += 1;
  }
  return path;
}

/**
 * List every cohort in the institution + resolved unit + path + student count.
 * Joins are resolved client-side from cached units to avoid N+1.
 */
export async function getInstitutionCohortsDetailed(
  institutionId?: string | null,
): Promise<InstitutionCohortRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  // Fetch cohorts + units + student counts in parallel
  const [cohortsRes, unitsRes, studentsRes] = await Promise.all([
    supabase
      .from('cohorts')
      .select('id, name, description, level, field, subject, specialty, unit_id, institution_id, created_at, main_teacher_id, monitor_id, deputy_monitor_id, deputy_monitor_2_id, primary_room_id')
      .eq('institution_id', id)
      .order('created_at', { ascending: false }),
    getInstitutionUnits(id),
    supabase.from('students').select('cohort_id').eq('institution_id', id),
  ]);

  if (cohortsRes.error) {
    console.error('getInstitutionCohortsDetailed failed:', cohortsRes.error);
    return [];
  }

  const unitsMap = new Map<string, InstitutionUnitRow>();
  unitsRes.forEach((u) => unitsMap.set(u.id, u));

  const studentsByCohort = new Map<string, number>();
  (studentsRes.data ?? []).forEach((s: { cohort_id: string | null }) => {
    if (!s.cohort_id) return;
    studentsByCohort.set(s.cohort_id, (studentsByCohort.get(s.cohort_id) ?? 0) + 1);
  });

  return (cohortsRes.data ?? []).map((c) => {
    const unit = c.unit_id ? unitsMap.get(c.unit_id) ?? null : null;
    return {
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      level: c.level ?? null,
      field: c.field ?? null,
      subject: c.subject ?? null,
      specialty: c.specialty ?? null,
      unit_id: c.unit_id ?? null,
      institution_id: c.institution_id,
      created_at: c.created_at,
      main_teacher_id: c.main_teacher_id ?? null,
      monitor_id: c.monitor_id ?? null,
      deputy_monitor_id: c.deputy_monitor_id ?? null,
      deputy_monitor_2_id: c.deputy_monitor_2_id ?? null,
      primary_room_id: c.primary_room_id ?? null,
      unit_name: unit?.name ?? null,
      unit_type: unit?.type ?? null,
      unit_path: c.unit_id ? buildUnitPath(c.unit_id, unitsMap) : [],
      studentsCount: studentsByCohort.get(c.id) ?? 0,
    };
  });
}

export async function createInstitutionCohort(input: {
  name: string;
  description?: string | null;
  level?: string | null;
  field?: string | null;
  unitId?: string | null;
  institutionId?: string | null;
  mainTeacherId?: string | null;
  monitorId?: string | null;
  deputyMonitorId?: string | null;
  deputyMonitor2Id?: string | null;
  primaryRoomId?: string | null;
}): Promise<InstitutionCohortRow> {
  const id = resolveInstitutionId(input.institutionId);
  if (!id) throw new Error('تعذر تحديد المؤسسة');

  const { data, error } = await supabase
    .from('cohorts')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      level: input.level?.trim() || null,
      field: input.field?.trim() || null,
      unit_id: input.unitId ?? null,
      institution_id: id,
      main_teacher_id: input.mainTeacherId ?? null,
      monitor_id: input.monitorId ?? null,
      deputy_monitor_id: input.deputyMonitorId ?? null,
      deputy_monitor_2_id: input.deputyMonitor2Id ?? null,
      primary_room_id: input.primaryRoomId ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as InstitutionCohortRow;
}

export async function updateInstitutionCohort(
  cohortId: string,
  patch: Partial<{
    name: string;
    description: string | null;
    level: string | null;
    field: string | null;
    unit_id: string | null;
    main_teacher_id: string | null;
    monitor_id: string | null;
    deputy_monitor_id: string | null;
    deputy_monitor_2_id: string | null;
    primary_room_id: string | null;
  }>,
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.description !== undefined) payload.description = patch.description?.trim() || null;
  if (patch.level !== undefined) payload.level = patch.level?.trim() || null;
  if (patch.field !== undefined) payload.field = patch.field?.trim() || null;
  if (patch.unit_id !== undefined) payload.unit_id = patch.unit_id;
  if (patch.main_teacher_id !== undefined) payload.main_teacher_id = patch.main_teacher_id;
  if (patch.monitor_id !== undefined) payload.monitor_id = patch.monitor_id;
  if (patch.deputy_monitor_id !== undefined) payload.deputy_monitor_id = patch.deputy_monitor_id;
  if (patch.deputy_monitor_2_id !== undefined) payload.deputy_monitor_2_id = patch.deputy_monitor_2_id;
  if (patch.primary_room_id !== undefined) payload.primary_room_id = patch.primary_room_id;

  const { error } = await supabase.from('cohorts').update(payload).eq('id', cohortId);
  if (error) {
    console.error('updateInstitutionCohort failed:', error);
    return false;
  }
  return true;
}

export async function deleteInstitutionCohort(cohortId: string): Promise<boolean> {
  const { error } = await supabase.from('cohorts').delete().eq('id', cohortId);
  if (error) {
    console.error('deleteInstitutionCohort failed:', error);
    return false;
  }
  return true;
}


// =============================================================================
// Phase 8 — Absence Justifications
// =============================================================================
// All justifications inside the calling user's scope (RLS handles the slicing
// via student.cohort.unit_id, see migration 20260523000000).
//
// LIMITATIONS (documented intentionally — not faked):
//   - attendances.status column does NOT exist; approving a justification
//     changes only absence_justifications.status. There is no automatic
//     "convert absence to excused" anywhere. Future work (P10) may add this.
//   - notifications.insert is restricted to super_admin only by RLS.
//     Institution managers cannot create notifications for the teacher/student
//     from the frontend. We surface a clear UI hint for the manager to inform
//     the teacher manually until a server-side function is added.
//   - activity_logs.insert is also super_admin only. Same TODO.
// =============================================================================

export type JustificationStatus = 'pending' | 'approved' | 'rejected';

export interface JustificationRow {
  id: string;
  institution_id: string;
  student_id: string;
  attendance_id: string | null;
  session_id: string | null;
  reason: string;
  attachment_url: string | null;
  status: JustificationStatus;
  reviewed_by_admin_id: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  // Joined / derived (best-effort, may be null when related rows are missing)
  student_full_name?: string | null;
  student_number?: string | null;
  cohort_id?: string | null;
  cohort_name?: string | null;
  unit_id?: string | null;
  unit_name?: string | null;
  unit_path?: string[];
  session_title?: string | null;
  session_code?: string | null;
  session_created_at?: string | null;
  professor_id?: string | null;
  professor_name?: string | null;
  reviewer_name?: string | null;
}

export interface JustificationStats {
  total: number;
  pending: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  /** Average processing time in hours (null when no reviewed records yet) */
  avgProcessingHours: number | null;
}

/**
 * Fetch every justification in the institution (RLS will narrow further for
 * sub-scope users), then enrich with student/cohort/unit/session/professor
 * data via batched lookups. Returns rows ready to render in a table.
 */
export async function getInstitutionJustifications(
  institutionId?: string | null,
): Promise<JustificationRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data: rawList, error } = await supabase
    .from('absence_justifications')
    .select('*')
    .eq('institution_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getInstitutionJustifications failed:', error);
    return [];
  }
  if (!rawList || rawList.length === 0) return [];

  const studentIds = Array.from(new Set(rawList.map((j) => j.student_id).filter(Boolean) as string[]));
  const sessionIds = Array.from(new Set(rawList.map((j) => j.session_id).filter(Boolean) as string[]));
  const reviewerIds = Array.from(new Set(rawList.map((j) => j.reviewed_by_admin_id).filter(Boolean) as string[]));

  // Run lookups in parallel
  const [studentsRes, sessionsRes, units, reviewersRes] = await Promise.all([
    studentIds.length
      ? supabase
          .from('students')
          .select('id, first_name, last_name, student_number, cohort_id')
          .in('id', studentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; student_number: string | null; cohort_id: string | null }> }),
    sessionIds.length
      ? supabase
          .from('sessions')
          .select('id, title, code, created_at, professor_id, cohort_id')
          .in('id', sessionIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; code: string; created_at: string; professor_id: string | null; cohort_id: string | null }> }),
    getInstitutionUnits(id),
    reviewerIds.length
      ? supabase.from('admins').select('id, full_name, username').in('id', reviewerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; username: string }> }),
  ]);

  // Resolve cohorts referenced by students (or sessions)
  const cohortIds = Array.from(
    new Set(
      [
        ...((studentsRes.data ?? []).map((s) => s.cohort_id).filter(Boolean) as string[]),
        ...((sessionsRes.data ?? []).map((s) => s.cohort_id).filter(Boolean) as string[]),
      ],
    ),
  );
  const cohortsRes = cohortIds.length
    ? await supabase.from('cohorts').select('id, name, unit_id').in('id', cohortIds)
    : { data: [] as Array<{ id: string; name: string; unit_id: string | null }> };

  // Resolve professor names
  const profIds = Array.from(new Set(((sessionsRes.data ?? []).map((s) => s.professor_id).filter(Boolean) as string[])));
  const profsRes = profIds.length
    ? await supabase.from('admins').select('id, full_name, username').in('id', profIds)
    : { data: [] as Array<{ id: string; full_name: string | null; username: string }> };

  // Build lookup maps
  const studentMap = new Map((studentsRes.data ?? []).map((s) => [s.id, s]));
  const sessionMap = new Map((sessionsRes.data ?? []).map((s) => [s.id, s]));
  const cohortMap = new Map((cohortsRes.data ?? []).map((c) => [c.id, c]));
  const unitMap = new Map<string, InstitutionUnitRow>();
  units.forEach((u) => unitMap.set(u.id, u));
  const profMap = new Map((profsRes.data ?? []).map((p) => [p.id, p.full_name || p.username]));
  const reviewerMap = new Map((reviewersRes.data ?? []).map((r) => [r.id, r.full_name || r.username]));

  return rawList.map((j) => {
    const student = j.student_id ? studentMap.get(j.student_id) : null;
    const session = j.session_id ? sessionMap.get(j.session_id) : null;
    // Cohort can come from student or session
    const cohortId = student?.cohort_id ?? session?.cohort_id ?? null;
    const cohort = cohortId ? cohortMap.get(cohortId) : null;
    const unitId = cohort?.unit_id ?? null;
    const unitPath = unitId ? buildUnitPath(unitId, unitMap) : [];

    return {
      id: j.id,
      institution_id: j.institution_id,
      student_id: j.student_id,
      attendance_id: j.attendance_id,
      session_id: j.session_id,
      reason: j.reason,
      attachment_url: j.attachment_url,
      status: j.status as JustificationStatus,
      reviewed_by_admin_id: j.reviewed_by_admin_id,
      reviewed_at: j.reviewed_at,
      admin_note: j.admin_note,
      created_at: j.created_at,
      updated_at: j.updated_at,
      student_full_name: student
        ? [student.first_name, student.last_name].filter(Boolean).join(' ').trim() || null
        : null,
      student_number: student?.student_number ?? null,
      cohort_id: cohortId,
      cohort_name: cohort?.name ?? null,
      unit_id: unitId,
      unit_name: unitId ? unitMap.get(unitId)?.name ?? null : null,
      unit_path: unitPath,
      session_title: session?.title ?? null,
      session_code: session?.code ?? null,
      session_created_at: session?.created_at ?? null,
      professor_id: session?.professor_id ?? null,
      professor_name: session?.professor_id ? profMap.get(session.professor_id) ?? null : null,
      reviewer_name: j.reviewed_by_admin_id ? reviewerMap.get(j.reviewed_by_admin_id) ?? null : null,
    };
  });
}

/** Aggregate KPI numbers from a pre-fetched list (avoid extra round trips). */
export function buildJustificationStats(rows: JustificationRow[]): JustificationStats {
  const now = new Date();
  const thisMonth = (d: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

  let pending = 0;
  let approvedThisMonth = 0;
  let rejectedThisMonth = 0;
  let processingMs = 0;
  let processedCount = 0;

  for (const r of rows) {
    if (r.status === 'pending') pending += 1;
    if (r.reviewed_at) {
      const reviewedAt = new Date(r.reviewed_at);
      if (r.status === 'approved' && thisMonth(reviewedAt)) approvedThisMonth += 1;
      if (r.status === 'rejected' && thisMonth(reviewedAt)) rejectedThisMonth += 1;
      const created = new Date(r.created_at);
      processingMs += reviewedAt.getTime() - created.getTime();
      processedCount += 1;
    }
  }

  return {
    total: rows.length,
    pending,
    approvedThisMonth,
    rejectedThisMonth,
    avgProcessingHours:
      processedCount > 0 ? Math.round((processingMs / processedCount / 36e5) * 10) / 10 : null,
  };
}

/** Approve or reject a justification, optionally with an admin note. */
export async function reviewJustification(input: {
  justificationId: string;
  status: 'approved' | 'rejected';
  adminNote?: string | null;
}): Promise<boolean> {
  const current = getCurrentAdmin();
  const { error } = await supabase
    .from('absence_justifications')
    .update({
      status: input.status,
      admin_note: input.adminNote?.trim() || null,
      reviewed_by_admin_id: current?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', input.justificationId);

  if (error) {
    console.error('reviewJustification failed:', error);
    return false;
  }
  return true;
}

/** Update only the admin note (without changing status). */
export async function updateJustificationNote(
  justificationId: string,
  adminNote: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from('absence_justifications')
    .update({ admin_note: adminNote?.trim() || null })
    .eq('id', justificationId);

  if (error) {
    console.error('updateJustificationNote failed:', error);
    return false;
  }
  return true;
}


// =============================================================================
// Phase 9 — Reports
// =============================================================================
// Aggregation queries for the Institution Reports page. Everything respects
// the same hierarchical RLS established by P2A/P2B/P8 — the queries rely on
// the database to filter rows; we never bypass RLS from the frontend.
//
// Sub-scope users (faculty_admin/department_admin) will see naturally
// filtered results because RLS hides rows outside their subtree.
// =============================================================================

export interface ReportsFilters {
  /** ISO datetime, inclusive */
  dateFrom?: string | null;
  /** ISO datetime, inclusive (end of day already applied by caller) */
  dateTo?: string | null;
  /** Filter to a specific institution_unit (used to narrow at row level) */
  unitId?: string | null;
  /** Filter to one cohort */
  cohortId?: string | null;
  /** Filter to one teacher (admins.id with role=teacher) */
  teacherId?: string | null;
}

export interface ReportSessionRow {
  id: string;
  title: string;
  code: string;
  status: string;
  cohort_id: string | null;
  cohort_name: string | null;
  unit_id: string | null;
  unit_path: string[];
  professor_id: string | null;
  professor_name: string | null;
  created_at: string;
  attendance_count: number;
  enrolled_in_cohort: number;
  attendance_rate: number; // 0..100
}

export interface ReportTeacherRow {
  id: string;
  full_name: string | null;
  username: string;
  rank: string | null;
  department: string | null;
  sessions_count: number;
  attendances_count: number;
  unique_students_reached: number;
  cohorts_assigned: number;
}

export interface ReportCohortRow {
  id: string;
  name: string;
  unit_id: string | null;
  unit_path: string[];
  students_count: number;
  sessions_count: number;
  attendances_count: number;
  attendance_rate: number; // (attendances / (sessions × students)) × 100
}

export interface ReportJustificationRow {
  id: string;
  student_full_name: string | null;
  student_number: string | null;
  cohort_name: string | null;
  unit_path: string[];
  reason: string;
  status: JustificationStatus;
  created_at: string;
  reviewed_at: string | null;
}

export interface ReportsKpis {
  totalSessions: number;
  totalAttendances: number;
  totalAbsences: number;        // (sessions × cohort_students) − attendances, capped at 0
  attendanceRate: number;       // 0..100
  pendingJustifications: number;
  approvedJustifications: number;
  rejectedJustifications: number;
  topAbsentCohort: { cohort_id: string; name: string; absences: number } | null;
  topActiveTeacher: { teacher_id: string; name: string; sessions: number } | null;
}

// -----------------------------------------------------------------------------
// Helpers (pure)
// -----------------------------------------------------------------------------

function within(dateIso: string, from: string | null | undefined, to: string | null | undefined): boolean {
  if (from && new Date(dateIso).getTime() < new Date(from).getTime()) return false;
  if (to && new Date(dateIso).getTime() > new Date(to).getTime()) return false;
  return true;
}

function buildPath(unitId: string | null, unitMap: Map<string, InstitutionUnitRow>): string[] {
  if (!unitId) return [];
  return buildUnitPath(unitId, unitMap);
}

// -----------------------------------------------------------------------------
// Sessions report (used by attendance / absence views too)
// -----------------------------------------------------------------------------

export async function getReportSessions(
  filters: ReportsFilters = {},
  institutionId?: string | null,
): Promise<ReportSessionRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  let q = supabase
    .from('sessions')
    .select('id, title, code, status, cohort_id, professor_id, created_at, institution_id')
    .eq('institution_id', id);
  if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom);
  if (filters.dateTo) q = q.lte('created_at', filters.dateTo);
  if (filters.cohortId) q = q.eq('cohort_id', filters.cohortId);
  if (filters.teacherId) q = q.eq('professor_id', filters.teacherId);

  const { data: sessions, error } = await q.order('created_at', { ascending: false });
  if (error || !sessions) {
    if (error) console.error('getReportSessions failed:', error);
    return [];
  }
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const cohortIds = Array.from(new Set(sessions.map((s) => s.cohort_id).filter(Boolean) as string[]));
  const professorIds = Array.from(new Set(sessions.map((s) => s.professor_id).filter(Boolean) as string[]));

  const [cohortsRes, profsRes, attRes, studentsRes, units] = await Promise.all([
    cohortIds.length
      ? supabase.from('cohorts').select('id, name, unit_id').in('id', cohortIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; unit_id: string | null }> }),
    professorIds.length
      ? supabase.from('admins').select('id, full_name, username').in('id', professorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; username: string }> }),
    supabase.from('attendances').select('session_id').in('session_id', sessionIds),
    cohortIds.length
      ? supabase.from('students').select('cohort_id').in('cohort_id', cohortIds)
      : Promise.resolve({ data: [] as Array<{ cohort_id: string | null }> }),
    getInstitutionUnits(id),
  ]);

  const cohortMap = new Map((cohortsRes.data ?? []).map((c) => [c.id, c]));
  const profMap = new Map((profsRes.data ?? []).map((p) => [p.id, p.full_name || p.username]));
  const unitMap = new Map<string, InstitutionUnitRow>();
  units.forEach((u) => unitMap.set(u.id, u));

  const studentsByCohort = new Map<string, number>();
  (studentsRes.data ?? []).forEach((s) => {
    if (!s.cohort_id) return;
    studentsByCohort.set(s.cohort_id, (studentsByCohort.get(s.cohort_id) ?? 0) + 1);
  });

  const attBySession = new Map<string, number>();
  (attRes.data ?? []).forEach((a: { session_id: string | null }) => {
    if (!a.session_id) return;
    attBySession.set(a.session_id, (attBySession.get(a.session_id) ?? 0) + 1);
  });

  const result: ReportSessionRow[] = sessions.map((s) => {
    const cohort = s.cohort_id ? cohortMap.get(s.cohort_id) : null;
    const enrolled = s.cohort_id ? studentsByCohort.get(s.cohort_id) ?? 0 : 0;
    const attendance = attBySession.get(s.id) ?? 0;
    return {
      id: s.id,
      title: s.title,
      code: s.code,
      status: s.status,
      cohort_id: s.cohort_id ?? null,
      cohort_name: cohort?.name ?? null,
      unit_id: cohort?.unit_id ?? null,
      unit_path: buildPath(cohort?.unit_id ?? null, unitMap),
      professor_id: s.professor_id ?? null,
      professor_name: s.professor_id ? profMap.get(s.professor_id) ?? null : null,
      created_at: s.created_at,
      attendance_count: attendance,
      enrolled_in_cohort: enrolled,
      attendance_rate: enrolled > 0 ? Math.round((attendance / enrolled) * 100) : 0,
    };
  });

  // Optional client-side unit filter (RLS already restricts, but UI may want
  // a tighter manual filter)
  if (filters.unitId) {
    return result.filter((r) => r.unit_id === filters.unitId);
  }
  return result;
}

// -----------------------------------------------------------------------------
// Teachers report
// -----------------------------------------------------------------------------

export async function getReportTeachers(
  filters: ReportsFilters = {},
  institutionId?: string | null,
): Promise<ReportTeacherRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  // Get teachers visible to caller
  const { data: teachers } = await supabase
    .from('admins')
    .select('id, full_name, username, rank, department')
    .eq('institution_id', id)
    .eq('role', 'teacher');

  if (!teachers || teachers.length === 0) return [];

  const teacherIds = teachers.map((t) => t.id);

  // Sessions query with date filter + per-teacher
  let sessQ = supabase
    .from('sessions')
    .select('id, professor_id, cohort_id, created_at')
    .eq('institution_id', id)
    .in('professor_id', teacherIds);
  if (filters.dateFrom) sessQ = sessQ.gte('created_at', filters.dateFrom);
  if (filters.dateTo) sessQ = sessQ.lte('created_at', filters.dateTo);

  const [sessionsRes, attRes, assignRes] = await Promise.all([
    sessQ,
    supabase.from('attendances').select('session_id, student_id').eq('institution_id', id),
    supabase.from('teacher_assignments').select('teacher_id, cohort_id').eq('institution_id', id).in('teacher_id', teacherIds),
  ]);

  const sessions = sessionsRes.data ?? [];
  const sessionToTeacher = new Map<string, string>();
  const sessionsByTeacher = new Map<string, number>();
  sessions.forEach((s: { id: string; professor_id: string | null }) => {
    if (!s.professor_id) return;
    sessionToTeacher.set(s.id, s.professor_id);
    sessionsByTeacher.set(s.professor_id, (sessionsByTeacher.get(s.professor_id) ?? 0) + 1);
  });

  const attendancesByTeacher = new Map<string, number>();
  const studentsByTeacher = new Map<string, Set<string>>();
  (attRes.data ?? []).forEach((a: { session_id: string | null; student_id: string | null }) => {
    if (!a.session_id) return;
    const tid = sessionToTeacher.get(a.session_id);
    if (!tid) return;
    attendancesByTeacher.set(tid, (attendancesByTeacher.get(tid) ?? 0) + 1);
    if (a.student_id) {
      if (!studentsByTeacher.has(tid)) studentsByTeacher.set(tid, new Set());
      studentsByTeacher.get(tid)!.add(a.student_id);
    }
  });

  const cohortsByTeacher = new Map<string, number>();
  (assignRes.data ?? []).forEach((r: { teacher_id: string | null; cohort_id: string | null }) => {
    if (!r.teacher_id) return;
    cohortsByTeacher.set(r.teacher_id, (cohortsByTeacher.get(r.teacher_id) ?? 0) + 1);
  });

  return teachers.map((t) => ({
    id: t.id,
    full_name: t.full_name,
    username: t.username,
    rank: t.rank ?? null,
    department: t.department ?? null,
    sessions_count: sessionsByTeacher.get(t.id) ?? 0,
    attendances_count: attendancesByTeacher.get(t.id) ?? 0,
    unique_students_reached: studentsByTeacher.get(t.id)?.size ?? 0,
    cohorts_assigned: cohortsByTeacher.get(t.id) ?? 0,
  }));
}

// -----------------------------------------------------------------------------
// Cohorts report
// -----------------------------------------------------------------------------

export async function getReportCohorts(
  filters: ReportsFilters = {},
  institutionId?: string | null,
): Promise<ReportCohortRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const [cohortsRes, studentsRes, units] = await Promise.all([
    supabase.from('cohorts').select('id, name, unit_id').eq('institution_id', id),
    supabase.from('students').select('cohort_id').eq('institution_id', id),
    getInstitutionUnits(id),
  ]);

  const cohorts = cohortsRes.data ?? [];
  if (cohorts.length === 0) return [];

  const cohortIds = cohorts.map((c) => c.id);

  let sessQ = supabase
    .from('sessions')
    .select('id, cohort_id, created_at')
    .eq('institution_id', id)
    .in('cohort_id', cohortIds);
  if (filters.dateFrom) sessQ = sessQ.gte('created_at', filters.dateFrom);
  if (filters.dateTo) sessQ = sessQ.lte('created_at', filters.dateTo);

  const sessionsRes = await sessQ;
  const sessions = sessionsRes.data ?? [];
  const sessionIds = sessions.map((s: { id: string }) => s.id);

  const attRes = sessionIds.length
    ? await supabase.from('attendances').select('session_id').in('session_id', sessionIds)
    : { data: [] as Array<{ session_id: string | null }> };

  const studentsByCohort = new Map<string, number>();
  (studentsRes.data ?? []).forEach((s) => {
    if (!s.cohort_id) return;
    studentsByCohort.set(s.cohort_id, (studentsByCohort.get(s.cohort_id) ?? 0) + 1);
  });

  const sessionsByCohort = new Map<string, number>();
  const sessionToCohort = new Map<string, string>();
  sessions.forEach((s: { id: string; cohort_id: string | null }) => {
    if (!s.cohort_id) return;
    sessionToCohort.set(s.id, s.cohort_id);
    sessionsByCohort.set(s.cohort_id, (sessionsByCohort.get(s.cohort_id) ?? 0) + 1);
  });

  const attByCohort = new Map<string, number>();
  (attRes.data ?? []).forEach((a) => {
    if (!a.session_id) return;
    const cid = sessionToCohort.get(a.session_id);
    if (!cid) return;
    attByCohort.set(cid, (attByCohort.get(cid) ?? 0) + 1);
  });

  const unitMap = new Map<string, InstitutionUnitRow>();
  units.forEach((u) => unitMap.set(u.id, u));

  const result: ReportCohortRow[] = cohorts.map((c) => {
    const studentsCount = studentsByCohort.get(c.id) ?? 0;
    const sessionsCount = sessionsByCohort.get(c.id) ?? 0;
    const attendancesCount = attByCohort.get(c.id) ?? 0;
    const expected = sessionsCount * studentsCount;
    return {
      id: c.id,
      name: c.name,
      unit_id: c.unit_id ?? null,
      unit_path: buildPath(c.unit_id ?? null, unitMap),
      students_count: studentsCount,
      sessions_count: sessionsCount,
      attendances_count: attendancesCount,
      attendance_rate: expected > 0 ? Math.round((attendancesCount / expected) * 100) : 0,
    };
  });

  if (filters.unitId) return result.filter((r) => r.unit_id === filters.unitId);
  return result;
}

// -----------------------------------------------------------------------------
// Justifications report (lightweight projection from existing query)
// -----------------------------------------------------------------------------

export async function getReportJustifications(
  filters: ReportsFilters = {},
  institutionId?: string | null,
): Promise<ReportJustificationRow[]> {
  const all = await getInstitutionJustifications(institutionId);
  return all
    .filter((j) => within(j.created_at, filters.dateFrom, filters.dateTo))
    .filter((j) => (filters.cohortId ? j.cohort_id === filters.cohortId : true))
    .filter((j) => (filters.unitId ? j.unit_id === filters.unitId : true))
    .map((j) => ({
      id: j.id,
      student_full_name: j.student_full_name ?? null,
      student_number: j.student_number ?? null,
      cohort_name: j.cohort_name ?? null,
      unit_path: j.unit_path ?? [],
      reason: j.reason,
      status: j.status,
      created_at: j.created_at,
      reviewed_at: j.reviewed_at,
    }));
}

// -----------------------------------------------------------------------------
// KPIs (aggregate from all the above)
// -----------------------------------------------------------------------------

export function buildReportsKpis(input: {
  sessions: ReportSessionRow[];
  cohorts: ReportCohortRow[];
  teachers: ReportTeacherRow[];
  justifications: ReportJustificationRow[];
}): ReportsKpis {
  const totalSessions = input.sessions.length;
  const totalAttendances = input.sessions.reduce((s, x) => s + x.attendance_count, 0);
  const expected = input.sessions.reduce((s, x) => s + x.enrolled_in_cohort, 0);
  const totalAbsences = Math.max(0, expected - totalAttendances);
  const attendanceRate = expected > 0 ? Math.round((totalAttendances / expected) * 100) : 0;

  // Justifications counts
  let pending = 0, approved = 0, rejected = 0;
  for (const j of input.justifications) {
    if (j.status === 'pending') pending += 1;
    else if (j.status === 'approved') approved += 1;
    else if (j.status === 'rejected') rejected += 1;
  }

  // Top absent cohort: highest absences = students × sessions − attendances
  let topAbsent: ReportsKpis['topAbsentCohort'] = null;
  for (const c of input.cohorts) {
    const exp = c.students_count * c.sessions_count;
    const abs = Math.max(0, exp - c.attendances_count);
    if (!topAbsent || abs > topAbsent.absences) {
      topAbsent = { cohort_id: c.id, name: c.name, absences: abs };
    }
  }
  if (topAbsent && topAbsent.absences === 0) topAbsent = null;

  // Top active teacher: most sessions in the period
  let topActive: ReportsKpis['topActiveTeacher'] = null;
  for (const t of input.teachers) {
    if (!topActive || t.sessions_count > topActive.sessions) {
      topActive = { teacher_id: t.id, name: t.full_name || t.username, sessions: t.sessions_count };
    }
  }
  if (topActive && topActive.sessions === 0) topActive = null;

  return {
    totalSessions,
    totalAttendances,
    totalAbsences,
    attendanceRate,
    pendingJustifications: pending,
    approvedJustifications: approved,
    rejectedJustifications: rejected,
    topAbsentCohort: topAbsent,
    topActiveTeacher: topActive,
  };
}


// =============================================================================
// Phase 11 — Activate remaining placeholder tabs
// =============================================================================

// -----------------------------------------------------------------------------
// Subscription details (institutions can READ their own subscription via RLS)
// -----------------------------------------------------------------------------
export interface InstitutionSubscriptionDetail {
  id: string;
  plan_type: string;
  plan_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  current_period_end: string | null;
  billing_cycle: string | null;
  student_limit: number | null;
  session_limit: number | null;
  max_users: number | null;
  max_teachers: number | null;
  price: number | null;
  currency: string | null;
  payment_status: string | null;
  notes: string | null;
}

export async function getInstitutionSubscriptionDetail(
  institutionId?: string | null,
): Promise<InstitutionSubscriptionDetail | null> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('institution_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('getInstitutionSubscriptionDetail failed:', error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    plan_type: data.plan_type,
    plan_name: data.plan_name ?? null,
    status: data.status,
    start_date: data.start_date,
    end_date: data.end_date,
    current_period_end: data.current_period_end,
    billing_cycle: data.billing_cycle,
    student_limit: data.student_limit,
    session_limit: data.session_limit,
    max_users: data.max_users,
    max_teachers: data.max_teachers,
    price: data.price,
    currency: data.currency,
    payment_status: data.payment_status,
    notes: data.notes,
  };
}

// -----------------------------------------------------------------------------
// Devices report (student_devices joined with students)
// -----------------------------------------------------------------------------
export interface InstitutionDeviceRow {
  id: string;
  student_id: string;
  device_fingerprint: string;
  last_used: string | null;
  is_active: boolean;
  institution_id: string | null;
  student_name: string | null;
  student_number: string | null;
  cohort_id: string | null;
  cohort_name: string | null;
}

export async function getInstitutionDevices(
  institutionId?: string | null,
): Promise<InstitutionDeviceRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data, error } = await supabase
    .from('student_devices')
    .select(`
      id, student_id, device_fingerprint, last_used, is_active, institution_id,
      students:students!student_devices_student_id_fkey ( first_name, last_name, student_number, cohort_id )
    `)
    .eq('institution_id', id)
    .order('last_used', { ascending: false });

  if (error) {
    console.error('getInstitutionDevices failed:', error);
    return [];
  }

  // Resolve cohort names in one batch
  const studentRows = (data ?? []).map((r) => {
    const stRel = r.students as
      | { first_name: string | null; last_name: string | null; student_number: string | null; cohort_id: string | null }
      | { first_name: string | null; last_name: string | null; student_number: string | null; cohort_id: string | null }[]
      | null;
    const st = Array.isArray(stRel) ? stRel[0] ?? null : stRel;
    return { row: r, student: st };
  });

  const cohortIds = Array.from(
    new Set(studentRows.map((r) => r.student?.cohort_id).filter(Boolean) as string[]),
  );
  const cohortMap = new Map<string, string>();
  if (cohortIds.length > 0) {
    const { data: cohorts } = await supabase
      .from('cohorts')
      .select('id, name')
      .in('id', cohortIds);
    (cohorts ?? []).forEach((c: { id: string; name: string }) => cohortMap.set(c.id, c.name));
  }

  return studentRows.map(({ row, student }) => ({
    id: row.id as string,
    student_id: row.student_id as string,
    device_fingerprint: row.device_fingerprint as string,
    last_used: (row.last_used as string | null) ?? null,
    is_active: Boolean(row.is_active),
    institution_id: (row.institution_id as string | null) ?? null,
    student_name: student
      ? [student.first_name, student.last_name].filter(Boolean).join(' ').trim() || null
      : null,
    student_number: student?.student_number ?? null,
    cohort_id: student?.cohort_id ?? null,
    cohort_name: student?.cohort_id ? cohortMap.get(student.cohort_id) ?? null : null,
  }));
}

export async function deactivateStudentDevice(deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('student_devices')
    .update({ is_active: false })
    .eq('id', deviceId);
  if (error) {
    console.error('deactivateStudentDevice failed:', error);
    return false;
  }
  return true;
}

// -----------------------------------------------------------------------------
// Attendance dashboard (aggregated per session)
// -----------------------------------------------------------------------------
export interface InstitutionAttendanceSession {
  id: string;
  title: string;
  code: string;
  status: string;
  cohort_id: string | null;
  cohort_name: string | null;
  unit_id: string | null;
  unit_path: string[];
  professor_id: string | null;
  professor_name: string | null;
  created_at: string;
  enrolled_count: number;
  attended_count: number;
  absent_count: number;
  attendance_rate: number;
}

export interface SessionAttendanceDetail {
  session: InstitutionAttendanceSession;
  attended: { student_id: string; student_name: string | null; student_number: string | null; method: string | null; timestamp: string; device_fingerprint: string | null }[];
  absent: { student_id: string; student_name: string | null; student_number: string | null }[];
}

export async function getInstitutionAttendanceSessions(
  institutionId?: string | null,
): Promise<InstitutionAttendanceSession[]> {
  const list = await getReportSessions({}, institutionId);
  return list.map((s) => ({
    id: s.id,
    title: s.title,
    code: s.code,
    status: s.status,
    cohort_id: s.cohort_id,
    cohort_name: s.cohort_name,
    unit_id: s.unit_id,
    unit_path: s.unit_path,
    professor_id: s.professor_id,
    professor_name: s.professor_name,
    created_at: s.created_at,
    enrolled_count: s.enrolled_in_cohort,
    attended_count: s.attendance_count,
    absent_count: Math.max(0, s.enrolled_in_cohort - s.attendance_count),
    attendance_rate: s.attendance_rate,
  }));
}

export async function getSessionAttendanceDetail(
  sessionId: string,
): Promise<SessionAttendanceDetail | null> {
  // Fetch session + cohort + students + attendance rows for that session
  const { data: sess } = await supabase
    .from('sessions')
    .select('id, title, code, status, cohort_id, professor_id, created_at, institution_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (!sess) return null;

  const [{ data: students }, { data: attendances }, { data: cohort }, units] = await Promise.all([
    sess.cohort_id
      ? supabase.from('students').select('id, first_name, last_name, student_number').eq('cohort_id', sess.cohort_id)
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; student_number: string | null }> }),
    supabase.from('attendances').select('student_id, method, timestamp, device_fingerprint').eq('session_id', sessionId),
    sess.cohort_id
      ? supabase.from('cohorts').select('id, name, unit_id').eq('id', sess.cohort_id).maybeSingle()
      : Promise.resolve({ data: null as null | { id: string; name: string; unit_id: string | null } }),
    getInstitutionUnits(sess.institution_id),
  ]);

  const studentList = students ?? [];
  const studentIds = studentList.map((s) => s.id);
  const { data: activeDevices } = studentIds.length > 0
    ? await supabase
      .from('student_devices')
      .select('student_id, device_fingerprint')
      .in('student_id', studentIds)
      .eq('is_active', true)
    : { data: [] as Array<{ student_id: string; device_fingerprint: string | null }> };

  const deviceMap = new Map<string, string>();
  (activeDevices ?? []).forEach((d: { student_id: string | null; device_fingerprint: string | null }) => {
    if (d.student_id && d.device_fingerprint) deviceMap.set(d.student_id, d.device_fingerprint);
  });

  const attendanceMap = new Map<string, { method: string | null; timestamp: string; device_fingerprint: string | null }>();
  (attendances ?? []).forEach((a: { student_id: string | null; method: string | null; timestamp: string; device_fingerprint: string | null }) => {
    if (a.student_id) {
      attendanceMap.set(a.student_id, {
        method: a.method,
        timestamp: a.timestamp,
        device_fingerprint: a.device_fingerprint || deviceMap.get(a.student_id) || null,
      });
    }
  });

  let professorName: string | null = null;
  if (sess.professor_id) {
    const { data: prof } = await supabase
      .from('admins')
      .select('full_name, username')
      .eq('id', sess.professor_id)
      .maybeSingle();
    if (prof) professorName = prof.full_name || prof.username;
  }

  const unitMap = new Map<string, InstitutionUnitRow>();
  units.forEach((u) => unitMap.set(u.id, u));
  const unitPath = cohort?.unit_id ? buildUnitPath(cohort.unit_id, unitMap) : [];

  const attended = studentList
    .filter((s) => attendanceMap.has(s.id))
    .map((s) => ({
      student_id: s.id,
      student_name: [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || null,
      student_number: s.student_number,
      method: attendanceMap.get(s.id)!.method,
      timestamp: attendanceMap.get(s.id)!.timestamp,
      device_fingerprint: attendanceMap.get(s.id)!.device_fingerprint,
    }));
  const absent = studentList
    .filter((s) => !attendanceMap.has(s.id))
    .map((s) => ({
      student_id: s.id,
      student_name: [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || null,
      student_number: s.student_number,
    }));

  return {
    session: {
      id: sess.id,
      title: sess.title,
      code: sess.code,
      status: sess.status,
      cohort_id: sess.cohort_id,
      cohort_name: cohort?.name ?? null,
      unit_id: cohort?.unit_id ?? null,
      unit_path: unitPath,
      professor_id: sess.professor_id,
      professor_name: professorName,
      created_at: sess.created_at,
      enrolled_count: studentList.length,
      attended_count: attended.length,
      absent_count: absent.length,
      attendance_rate: studentList.length > 0 ? Math.round((attended.length / studentList.length) * 100) : 0,
    },
    attended,
    absent,
  };
}

// -----------------------------------------------------------------------------
// Activity log (read-only per institution)
// -----------------------------------------------------------------------------
export interface InstitutionActivityRow {
  id: string;
  category: string;
  type: string;
  title: string;
  description: string | null;
  outcome_status: string;
  priority: string;
  ip_address: string | null;
  actor_name: string | null;
  created_at: string;
}

export async function getInstitutionActivityLog(
  institutionId?: string | null,
  limit = 200,
): Promise<InstitutionActivityRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, category, type, title, description, outcome_status, priority, ip_address, actor_admin_id, created_at')
    .eq('institution_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('getInstitutionActivityLog failed:', error);
    return [];
  }
  if (!data || data.length === 0) return [];

  const actorIds = Array.from(new Set(data.map((r) => r.actor_admin_id).filter(Boolean) as string[]));
  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase.from('admins').select('id, full_name, username').in('id', actorIds);
    (actors ?? []).forEach((a: { id: string; full_name: string | null; username: string }) =>
      actorMap.set(a.id, a.full_name || a.username),
    );
  }

  return data.map((row) => ({
    id: row.id,
    category: row.category,
    type: row.type,
    title: row.title,
    description: row.description,
    outcome_status: row.outcome_status,
    priority: row.priority,
    ip_address: row.ip_address,
    actor_name: row.actor_admin_id ? actorMap.get(row.actor_admin_id) ?? null : null,
    created_at: row.created_at,
  }));
}

// -----------------------------------------------------------------------------
// Support tickets (per institution)
// -----------------------------------------------------------------------------
export interface InstitutionTicketRow {
  id: string;
  ticket_number: string;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  created_at: string;
  closed_at: string | null;
  created_by_name: string | null;
}

export async function getInstitutionTickets(
  institutionId?: string | null,
): Promise<InstitutionTicketRow[]> {
  const id = resolveInstitutionId(institutionId);
  if (!id) return [];

  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, ticket_number, category, priority, status, title, description, created_at, closed_at, created_by_admin_id')
    .eq('institution_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getInstitutionTickets failed:', error);
    return [];
  }

  const creatorIds = Array.from(new Set((data ?? []).map((t) => t.created_by_admin_id).filter(Boolean) as string[]));
  const creatorMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase.from('admins').select('id, full_name, username').in('id', creatorIds);
    (creators ?? []).forEach((a: { id: string; full_name: string | null; username: string }) =>
      creatorMap.set(a.id, a.full_name || a.username),
    );
  }

  return (data ?? []).map((t) => ({
    id: t.id,
    ticket_number: t.ticket_number,
    category: t.category,
    priority: t.priority,
    status: t.status,
    title: t.title,
    description: t.description,
    created_at: t.created_at,
    closed_at: t.closed_at,
    created_by_name: t.created_by_admin_id ? creatorMap.get(t.created_by_admin_id) ?? null : null,
  }));
}

export async function createInstitutionTicket(input: {
  category: 'technical' | 'activation' | 'attendance' | 'device' | 'billing' | 'training' | 'general';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  institutionId?: string | null;
}): Promise<{ ok: boolean; ticketNumber?: string; error?: string }> {
  const id = resolveInstitutionId(input.institutionId);
  if (!id) return { ok: false, error: 'تعذر تحديد المؤسسة' };

  const ticketNumber = `Q-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const current = getCurrentAdmin();

  const { error } = await supabase.from('support_tickets').insert({
    ticket_number: ticketNumber,
    institution_id: id,
    created_by_admin_id: current?.id ?? null,
    category: input.category,
    priority: input.priority,
    status: 'open',
    title: input.title.trim(),
    description: input.description.trim(),
  });
  if (error) {
    console.error('createInstitutionTicket failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, ticketNumber };
}

// -----------------------------------------------------------------------------
// Support settings (platform-wide contact info — readable by all admins)
// -----------------------------------------------------------------------------
export interface SupportSettings {
  support_email: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  help_center_url: string | null;
  demo_request_url: string | null;
}

export async function getSupportSettings(): Promise<SupportSettings | null> {
  const { data } = await supabase.from('support_settings').select('*').limit(1).maybeSingle();
  if (!data) return null;
  return {
    support_email: data.support_email,
    support_phone: data.support_phone,
    whatsapp_number: data.whatsapp_number,
    help_center_url: data.help_center_url,
    demo_request_url: data.demo_request_url,
  };
}
