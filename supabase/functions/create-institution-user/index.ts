// Edge Function: create-institution-user (v2 — Phase 5: scope picker)
// =============================================================================
// Allows an institution manager (owner/admin) — or a super_admin — to create
// downstream users (teachers, faculty/department admins, staff, viewers) tied to the
// caller's institution. Service role is used server-side; the frontend never
// sees it. Tenant isolation: the new user's institution_id is forced to match
// the caller's institution_id (super_admin can override).
//
// Phase 5 additions:
//   - Optional `unitId` to bind the new user to a specific institution_unit
//     (faculty/department/specialty/group). When set, we also insert a
//     user_scopes row so RLS narrows that user to the chosen subtree.
//   - When `unitId` is null and the role is faculty_admin/department_admin/
//     staff/viewer, we insert an institution-wide user_scopes row (NULL unit_id)
//     so the user is treated as institution-wide explicitly.
//   - role 'teacher' is unaffected (uses teacher_assignments instead).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

interface CreateUserRequest {
  email: string;
  password?: string;
  username: string;
  fullName?: string | null;
  phone?: string | null;
  role: 'teacher' | 'faculty_admin' | 'department_admin' | 'staff' | 'viewer';
  rank?: string | null;
  department?: string | null;
  institutionId?: string | null; // super_admin override
  unitId?: string | null;        // Phase 5: scope binding
}

const MANAGER_ROLES = new Set(['institution_owner', 'institution_admin']);
const CREATABLE_ROLES = new Set(['teacher', 'faculty_admin', 'department_admin', 'staff', 'viewer']);
// Roles that get a user_scopes row (teacher uses teacher_assignments instead)
const SCOPED_ROLES = new Set(['faculty_admin', 'department_admin', 'staff', 'viewer']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function fail(status: number, code: string, message: string) {
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const buf = crypto.getRandomValues(new Uint8Array(12));
  let out = '';
  for (let i = 0; i < buf.length; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'طريقة الطلب غير مدعومة');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail(401, 'AUTH_REQUIRED', 'غير مصرّح بالوصول');

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerAuth, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerAuth.user) return fail(401, 'AUTH_INVALID', 'جلسة غير صالحة');

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerAdmin, error: callerAdminErr } = await adminClient
    .from('admins')
    .select('id, role, institution_id')
    .eq('auth_user_id', callerAuth.user.id)
    .maybeSingle();

  if (callerAdminErr || !callerAdmin) return fail(403, 'FORBIDDEN', 'الحساب غير معتمد');

  const isSuper = callerAdmin.role === 'super_admin';
  const isManager = MANAGER_ROLES.has(callerAdmin.role);
  if (!isSuper && !isManager) return fail(403, 'FORBIDDEN', 'لا تملك صلاحية إنشاء حسابات');

  let input: CreateUserRequest;
  try {
    input = (await req.json()) as CreateUserRequest;
  } catch {
    return fail(400, 'INVALID_BODY', 'جسم الطلب غير صحيح');
  }

  const email = String(input.email ?? '').trim().toLowerCase();
  const username = String(input.username ?? '').trim();
  const fullName = input.fullName ? String(input.fullName).trim() : null;
  const phone = input.phone ? String(input.phone).trim() : null;
  const rank = input.rank ? String(input.rank).trim() : null;
  const department = input.department ? String(input.department).trim() : null;
  const role = input.role;
  const unitIdRaw = input.unitId ? String(input.unitId).trim() : null;
  const tempPassword = input.password && input.password.length >= 8 ? input.password : generatePassword();

  if (!email || !email.includes('@')) return fail(400, 'INVALID_EMAIL', 'البريد الإلكتروني غير صحيح');
  if (!username || username.length < 3) return fail(400, 'INVALID_USERNAME', 'اسم المستخدم غير صحيح');
  if (!CREATABLE_ROLES.has(role)) return fail(400, 'INVALID_ROLE', 'الدور المطلوب غير مسموح');

  const targetInstitutionId = isSuper
    ? (input.institutionId ? String(input.institutionId).trim() : callerAdmin.institution_id)
    : callerAdmin.institution_id;

  if (!targetInstitutionId) return fail(400, 'MISSING_INSTITUTION', 'المؤسسة غير محددة');

  const { data: institution, error: instErr } = await adminClient
    .from('institutions')
    .select('id, name, type')
    .eq('id', targetInstitutionId)
    .maybeSingle();
  if (instErr || !institution) return fail(404, 'INSTITUTION_NOT_FOUND', 'المؤسسة غير موجودة');

  // If a unitId was supplied, verify it belongs to the same institution.
  let validatedUnitId: string | null = null;
  if (unitIdRaw) {
    const { data: unit, error: unitErr } = await adminClient
      .from('institution_units')
      .select('id, institution_id')
      .eq('id', unitIdRaw)
      .maybeSingle();
    if (unitErr || !unit) return fail(404, 'UNIT_NOT_FOUND', 'الوحدة المختارة غير موجودة');
    if (unit.institution_id !== targetInstitutionId) {
      return fail(403, 'UNIT_INSTITUTION_MISMATCH', 'الوحدة المختارة لا تنتمي لهذه المؤسسة');
    }
    validatedUnitId = unit.id;
  }

  // Refuse duplicates
  const { data: existingByUsername } = await adminClient
    .from('admins').select('id').eq('username', username).maybeSingle();
  if (existingByUsername) return fail(409, 'USERNAME_TAKEN', 'اسم المستخدم محجوز');

  const { data: existingByEmail } = await adminClient
    .from('admins').select('id').eq('email', email).maybeSingle();
  if (existingByEmail) return fail(409, 'EMAIL_TAKEN', 'البريد الإلكتروني مستخدم مسبقاً');

  // Create auth user
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { username, full_name: fullName, role },
  });
  if (createErr || !created.user) return fail(500, 'AUTH_CREATE_FAILED', createErr?.message ?? 'تعذر إنشاء حساب الدخول');

  // Insert admin profile
  const { data: adminRow, error: profileErr } = await adminClient
    .from('admins')
    .insert({
      auth_user_id: created.user.id,
      username,
      role,
      full_name: fullName,
      email,
      rank,
      department,
      institution_id: targetInstitutionId,
    })
    .select('id, username, role, full_name, email, institution_id, rank, department, created_at')
    .single();

  if (profileErr) {
    await adminClient.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return fail(500, 'PROFILE_CREATE_FAILED', profileErr.message);
  }

  // Phase 5: scope binding
  // For scoped roles (faculty_admin/department_admin/viewer), insert a
  // user_scopes row. unit_id may be NULL (institution-wide) or specific.
  let scopeRow: { id: string; unit_id: string | null; scope_role: string } | null = null;
  if (SCOPED_ROLES.has(role)) {
    const { data: scope, error: scopeErr } = await adminClient
      .from('user_scopes')
      .insert({
        admin_id: adminRow.id,
        institution_id: targetInstitutionId,
        unit_id: validatedUnitId,
        scope_role: role,
      })
      .select('id, unit_id, scope_role')
      .single();

    if (scopeErr) {
      // Rollback: delete admin profile + auth user so we don't leave a
      // half-configured user behind.
      await adminClient.from('admins').delete().eq('id', adminRow.id).catch(() => undefined);
      await adminClient.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      return fail(500, 'SCOPE_CREATE_FAILED', scopeErr.message);
    }
    scopeRow = scope;
  }

  // Best-effort activity log
  try {
    await adminClient.from('activity_logs').insert({
      institution_id: targetInstitutionId,
      actor_admin_id: callerAdmin.id,
      category: 'user',
      type: 'institution_user_created',
      title: 'إنشاء مستخدم جديد',
      description: `${fullName ?? username} (${role}) — ${institution.name}`,
      outcome_status: 'success',
      review_status: 'open',
      priority: 'info',
      metadata: { admin_id: adminRow.id, role, scope_unit_id: validatedUnitId },
    });
  } catch (_) { /* swallow */ }

  return jsonResponse({
    ok: true,
    admin: adminRow,
    scope: scopeRow,
    institution: { id: institution.id, name: institution.name, type: institution.type },
    credentials: {
      email,
      username,
      password: tempPassword,
      loginUrl: '/panel-sk2025x/login',
      phone,
    },
  });
});
