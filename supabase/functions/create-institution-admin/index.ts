// Edge Function: create-institution-admin
// =============================================================================
// Privilege-elevated, server-side-only flow that lets a Super Admin create the
// first administrative account for an institution (or add additional managers
// later). The frontend MUST NOT carry the service_role key, so this function
// is the single safe path to create users with elevated roles.
//
// Authentication contract:
//   - Caller must provide the standard Supabase auth header.
//   - We resolve the calling user via the user-scoped client, then verify their
//     role in the admins table is 'super_admin'. Any other role is 403.
//
// What it does:
//   1. Creates a Supabase Auth user (server-side admin API).
//   2. Inserts a row in public.admins linking the auth user to the target
//      institution with the requested management role.
//   3. Returns the new admin profile and the temporary password (only echoed
//      back in the response — we never store plaintext passwords anywhere).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

interface CreateInstitutionAdminRequest {
  email: string;
  password?: string;       // optional; we generate one if absent
  username: string;
  fullName?: string | null;
  phone?: string | null;
  role?: 'institution_owner' | 'institution_admin' | 'faculty_admin' | 'department_admin';
  institutionId: string;
}

const ALLOWED_ROLES = new Set([
  'institution_owner',
  'institution_admin',
  'faculty_admin',
  'department_admin',
]);

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

// 12-char alphanumeric password if the caller didn't supply one.
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

  // Caller authentication ----------------------------------------------------
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail(401, 'AUTH_REQUIRED', 'غير مصرّح بالوصول');

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerAuth, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerAuth.user) {
    return fail(401, 'AUTH_INVALID', 'جلسة غير صالحة');
  }

  // Verify the caller is a super_admin
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerAdmin, error: callerAdminErr } = await adminClient
    .from('admins')
    .select('id, role')
    .eq('auth_user_id', callerAuth.user.id)
    .maybeSingle();

  if (callerAdminErr || !callerAdmin || callerAdmin.role !== 'super_admin') {
    return fail(403, 'FORBIDDEN', 'هذه العملية متاحة لمالك المنصة فقط');
  }

  // Parse and validate input -------------------------------------------------
  let input: CreateInstitutionAdminRequest;
  try {
    input = (await req.json()) as CreateInstitutionAdminRequest;
  } catch {
    return fail(400, 'INVALID_BODY', 'جسم الطلب غير صحيح');
  }

  const email = String(input.email ?? '').trim().toLowerCase();
  const username = String(input.username ?? '').trim();
  const fullName = input.fullName ? String(input.fullName).trim() : null;
  const phone = input.phone ? String(input.phone).trim() : null;
  const requestedRole = input.role ?? 'institution_admin';
  const institutionId = String(input.institutionId ?? '').trim();
  const tempPassword = input.password && input.password.length >= 8
    ? input.password
    : generatePassword();

  if (!email || !email.includes('@')) {
    return fail(400, 'INVALID_EMAIL', 'البريد الإلكتروني غير صحيح');
  }
  if (!username || username.length < 3) {
    return fail(400, 'INVALID_USERNAME', 'اسم المستخدم غير صحيح (3 أحرف على الأقل)');
  }
  if (!ALLOWED_ROLES.has(requestedRole)) {
    return fail(400, 'INVALID_ROLE', 'الدور المطلوب غير مسموح');
  }
  if (!institutionId) {
    return fail(400, 'MISSING_INSTITUTION', 'المؤسسة غير محددة');
  }

  // Verify institution exists
  const { data: institution, error: instErr } = await adminClient
    .from('institutions')
    .select('id, name, type')
    .eq('id', institutionId)
    .maybeSingle();
  if (instErr || !institution) {
    return fail(404, 'INSTITUTION_NOT_FOUND', 'المؤسسة غير موجودة');
  }

  // Refuse to create duplicates -------------------------------------------
  const { data: existingByUsername } = await adminClient
    .from('admins')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existingByUsername) {
    return fail(409, 'USERNAME_TAKEN', 'اسم المستخدم محجوز');
  }

  const { data: existingByEmail } = await adminClient
    .from('admins')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingByEmail) {
    return fail(409, 'EMAIL_TAKEN', 'البريد الإلكتروني مستخدم مسبقاً');
  }

  // Create the auth user with admin API ------------------------------------
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: fullName,
      role: requestedRole,
    },
  });

  if (createErr || !created.user) {
    return fail(500, 'AUTH_CREATE_FAILED', createErr?.message ?? 'تعذر إنشاء حساب الدخول');
  }

  // Insert admin profile ---------------------------------------------------
  const { data: adminRow, error: profileErr } = await adminClient
    .from('admins')
    .insert({
      auth_user_id: created.user.id,
      username,
      role: requestedRole,
      full_name: fullName,
      email,
      institution_id: institutionId,
    })
    .select('id, username, role, full_name, email, institution_id, created_at')
    .single();

  if (profileErr) {
    // Rollback the auth user so we don't end up with an orphan account
    await adminClient.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return fail(500, 'PROFILE_CREATE_FAILED', profileErr.message);
  }

  // Optional: log the action in activity_logs (best-effort, don't fail the
  // whole call if logging is unavailable).
  try {
    await adminClient.from('activity_logs').insert({
      institution_id: institutionId,
      actor_admin_id: callerAdmin.id,
      category: 'user',
      type: 'institution_admin_created',
      title: 'إنشاء مدير مؤسسة',
      description: `${fullName ?? username} (${requestedRole}) — ${institution.name}`,
      outcome_status: 'success',
      review_status: 'open',
      priority: 'info',
      metadata: { admin_id: adminRow.id, institution_id: institutionId, role: requestedRole },
    });
  } catch (_) { /* swallow */ }

  return jsonResponse({
    ok: true,
    admin: adminRow,
    institution: { id: institution.id, name: institution.name, type: institution.type },
    // Plaintext password is returned ONLY in this response so the Super Admin
    // can hand it over to the new user. It is never stored in any table and
    // is not retrievable later.
    credentials: {
      email,
      username,
      password: tempPassword,
      loginUrl: '/panel-sk2025x/login',
      phone,
    },
  });
});
