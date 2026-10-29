import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

type AttendanceMethod = 'qr' | 'code';

interface RegisterAttendanceRequest {
  sessionId?: string;
  sessionCode?: string;
  sessionToken?: string;
  qrData?: string;
  method?: AttendanceMethod;
  studentNumber?: string;
  firstName?: string;
  lastName?: string;
  deviceFingerprint?: string;
  androidId?: string;
  latitude?: number | null;
  longitude?: number | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function fail(status: number, code: string, message: string) {
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// ── Factory Reset Protection: تسجيل/تحديث معرّف الجهاز في سجل الهوية ─────
// إذا تغيّر Android ID (إعادة ضبط مصنع) مع بقاء البصمة المركّبة مطابقة،
// نُسجّل الحادثة reset_detected=true بدل رفض الحضور — الطالب لا يُعاقب
// على إعادة ضبط جهازه، لكن النظام يحتفظ بسجل كامل لكل معرّف مرتبط بالجهاز.
async function upsertDeviceIdentity(studentId: string, institutionId: string, compositeFingerprint: string, androidId: string) {
  // 1) هل هذا المعرّف المركّب مسجّل للطالب فعلًا؟
  const { data: existing } = await supabase
    .from('student_device_identities')
    .select('id, android_id, reset_detected')
    .eq('student_id', studentId)
    .eq('institution_id', institutionId)
    .eq('device_fingerprint_hash', compositeFingerprint)
    .maybeSingle();

  if (existing) {
    // نفس الجهاز: حدّث Android ID. إن تغيّر فهو Factory Reset مؤكد.
    await supabase
      .from('student_device_identities')
      .update({
        android_id: androidId,
        last_seen_at: new Date().toISOString(),
        reset_detected: existing.android_id !== androidId ? true : existing.reset_detected,
      })
      .eq('id', existing.id);
  } else {
    // معرّف جديد: سجّله. إن كان الطالب يملك معرّفًا قديمًا بنفس البصمة المركّبة
    // في مؤسسة أخرى فهذا مستحيل بفضل UNIQUE — هنا ننشئ صفًا جديدًا لكل مؤسسة.
    await supabase.from('student_device_identities').insert({
      student_id: studentId,
      institution_id: institutionId,
      device_fingerprint_hash: compositeFingerprint,
      android_id: androidId,
      reset_detected: false,
      last_seen_at: new Date().toISOString(),
    }).maybeSingle();
  }
}

function parseQrData(value?: string) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(value);
    if (!decoded || typeof decoded !== 'object') return null;
    return decoded as { sessionId?: string; code?: string; timestamp?: number };
  } catch {
    return null;
  }
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveSession(input: RegisterAttendanceRequest) {
  const qr = parseQrData(input.qrData ?? input.sessionToken);
  const token = qr?.sessionId ?? input.sessionId ?? input.sessionToken ?? input.sessionCode ?? '';
  const code = qr?.code ?? input.sessionCode ?? (!isUuid(token) ? token : '');

  if (input.method === 'qr' && qr?.timestamp) {
    const ageMs = Date.now() - qr.timestamp;
    if (ageMs > 2 * 60 * 1000 || ageMs < -30 * 1000) {
      return { error: fail(400, 'QR_EXPIRED', 'رمز QR منتهي الصلاحية') };
    }
  }

  let query = supabase
    .from('sessions')
    .select('id, code, status, institution_id, latitude, longitude, radius_meters')
    .limit(1);

  query = isUuid(token) ? query.eq('id', token) : query.eq('code', code.toUpperCase());

  const { data, error } = await query.maybeSingle();
  if (error) return { error: fail(500, 'SESSION_LOOKUP_FAILED', 'تعذر التحقق من الجلسة') };
  if (!data) return { error: fail(404, 'SESSION_NOT_FOUND', 'رمز الجلسة غير صحيح') };
  if (data.status !== 'active') return { error: fail(400, 'SESSION_CLOSED', 'هذه الجلسة مغلقة حالياً') };
  if (!data.institution_id) {
    // الجلسة بدون مؤسسة = خطأ تكوين، لا يمكن المضي
    return { error: fail(500, 'SESSION_MISSING_INSTITUTION', 'هذه الجلسة غير مكتملة الإعداد. الرجاء التواصل مع الأستاذ') };
  }
  if (qr?.code && normalize(qr.code) !== normalize(data.code)) {
    return { error: fail(400, 'QR_SESSION_MISMATCH', 'رمز QR لا يتطابق مع الجلسة الحالية') };
  }

  return { session: data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'طريقة الطلب غير مدعومة');

  try {
    const input = (await req.json()) as RegisterAttendanceRequest;
    const method = input.method === 'qr' || input.method === 'code' ? input.method : null;
    const studentNumber = String(input.studentNumber ?? '').trim();
    const firstName = String(input.firstName ?? '').trim();
    const lastName = String(input.lastName ?? '').trim();
    const deviceFingerprint = String(input.deviceFingerprint ?? '').trim();
    const androidId = String(input.androidId ?? '').trim(); // raw Android ID — متغير بعد Factory Reset
    const isAndroid = deviceFingerprint.startsWith('android_');

    if (!method) return fail(400, 'INVALID_METHOD', 'طريقة التسجيل غير صحيحة');
    if (!studentNumber || !firstName || !lastName) return fail(400, 'MISSING_STUDENT_DATA', 'بيانات الطالب غير مكتملة');
    if (!deviceFingerprint) return fail(400, 'MISSING_DEVICE', 'تعذر التعرف على الجهاز');

    const resolved = await resolveSession(input);
    if ('error' in resolved) return resolved.error;
    const session = resolved.session;

    // وضع إرشادي (Advisory): نحسب المسافة ونحفظها فقط — لا نرفض الحضور
    // أبداً بسبب البُعد الجغرافي. السبب: GPS في بعض المناطق غير دقيق
    // داخل المباني (يعطي قراءات بعيدة جداً عن الواقع). يبقى الأستاذ مسؤولاً
    // عن مراجعة المسافة في لوحة التحكم وحذف الحضور المشكوك فيه يدوياً.
    let measuredDistance: number | null = null;

    if (
      session.latitude !== null &&
      session.longitude !== null &&
      typeof input.latitude === 'number' &&
      typeof input.longitude === 'number'
    ) {
      const distance = haversineMeters(session.latitude, session.longitude, input.latitude, input.longitude);
      measuredDistance = Math.round(distance);
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, student_number, first_name, last_name, institution_id')
      .eq('student_number', studentNumber)
      .eq('institution_id', session.institution_id)
      .maybeSingle();

    if (studentError) {
      console.error('STUDENT_LOOKUP_FAILED:', { studentError, studentNumber, institutionId: session.institution_id });
      return fail(500, 'STUDENT_LOOKUP_FAILED', 'تعذر التحقق من الطالب');
    }
    if (!student) return fail(404, 'STUDENT_NOT_FOUND', 'الرقم الجامعي غير موجود في هذه المؤسسة');
    if (normalize(student.first_name) !== normalize(firstName) || normalize(student.last_name) !== normalize(lastName)) {
      return fail(403, 'STUDENT_DATA_MISMATCH', 'البيانات المدخلة لا تتطابق مع السجلات');
    }

    const { data: existingAttendance } = await supabase
      .from('attendances')
      .select('id')
      .eq('session_id', session.id)
      .eq('student_id', student.id)
      .maybeSingle();

    if (existingAttendance) {
      return fail(409, 'ALREADY_ATTENDED', 'لقد سجلت حضورك مسبقاً في هذه الجلسة');
    }

    const { data: currentDevice, error: deviceLookupError } = await supabase
      .from('student_devices')
      .select('id, device_fingerprint, composite_fingerprint, is_active')
      .eq('student_id', student.id)
      .eq('is_active', true)
      .maybeSingle();

    if (deviceLookupError) return fail(500, 'DEVICE_LOOKUP_FAILED', 'تعذر التحقق من الجهاز');

    if (currentDevice) {
      // ── Factory Reset Protection (v5.0.0) ─────────────────────────────
      // الأساس الجديد للتحقق هو composite_fingerprint (خصائص ثابتة لا تتغير
      // مع إعادة ضبط المصنع: brand|model|product|os_version). Android ID
      // أصبح طبقة ثانية: إذا تغيّر مع بقاء البصمة المركّبة مطابقة، النظام
      // يكتشف إعادة الضبط ويحدّث سجل المعرّفات بدل رفض الحضور.
      const fingerprintMatches =
        (currentDevice.composite_fingerprint && currentDevice.composite_fingerprint === deviceFingerprint) ||
        (!currentDevice.composite_fingerprint && currentDevice.device_fingerprint === deviceFingerprint);

      if (!fingerprintMatches) {
        return fail(403, 'DEVICE_MISMATCH', 'لديك جهاز مسجل مسبقاً. لا يمكنك استخدام جهاز جديد دون حذف القديم من الإدارة');
      }

      // تحديث last_used وcomposite fingerprint للجهاز النشط (للترقية من الأجهزة القديمة)
      await supabase
        .from('student_devices')
        .update({ last_used: new Date().toISOString(), composite_fingerprint: isAndroid ? deviceFingerprint : currentDevice.composite_fingerprint })
        .eq('id', currentDevice.id);

      // تتبع Android ID الجديد في سجل المعرّفات — إن تغيّر فهو إشارة Factory Reset
      if (isAndroid && androidId && currentDevice.composite_fingerprint) {
        await upsertDeviceIdentity(student.id, student.institution_id, deviceFingerprint, androidId);
      }
    }

        if (!currentDevice) {
      // ── Factory Reset Protection (v5.0.0): فحص شامل على البصمة المركّبة
      // وسجل معرّفات الجهاز معًا — لا يمكن التحايل بإعادة ضبط المصنع.
      const compositeFingerprint = isAndroid ? deviceFingerprint : null;

      // 1) هل هذه البصمة المركّبة ارتبطت بطالب آخر؟
      const { data: linkedToOther } = await supabase
        .from('student_device_identities')
        .select('student_id')
        .eq('device_fingerprint_hash', deviceFingerprint)
        .neq('student_id', student.id)
        .limit(1);
      if (linkedToOther && linkedToOther.length > 0) {
        return fail(403, 'DEVICE_USED_BY_OTHER_STUDENT', 'هذا الجهاز مرتبط بطالب آخر');
      }

      // 2) هل Android ID الحالي (المتغير) ارتبط بطالب آخر؟ — يحمي من تبديل الهواتف
      let androidUsedByOther = false;
      if (isAndroid && androidId) {
        const { data: androidOther } = await supabase
          .from('student_device_identities')
          .select('student_id')
          .eq('android_id', androidId)
          .neq('student_id', student.id)
          .limit(1);
        androidUsedByOther = !!androidOther && androidOther.length > 0;
      }
      if (androidUsedByOther) {
        return fail(403, 'DEVICE_USED_BY_OTHER_STUDENT', 'هذا الجهاز مرتبط بطالب آخر');
      }

      // 3) قد يوجد سجل قديم بنفس البصمة لنفس الطالب لكن معطّل (is_active=false).
      // نُفعّله بدل إنشاء سجل جديد.
      const { data: existingDeactivated } = await supabase
        .from('student_devices')
        .select('id, is_active, composite_fingerprint')
        .eq('student_id', student.id)
        .eq('device_fingerprint', deviceFingerprint)
        .maybeSingle();
      if (existingDeactivated) {
        await supabase
          .from('student_devices')
          .update({
            is_active: true,
            last_used: new Date().toISOString(),
            composite_fingerprint: compositeFingerprint ?? existingDeactivated.composite_fingerprint,
          })
          .eq('id', existingDeactivated.id);
      } else {
        // 4) فحص أخير على جدول student_devices نفسه (التوافق مع الأجهزة القديمة)
        const { data: linkedToOtherLegacy } = await supabase
          .from('student_devices')
          .select('student_id')
          .eq('device_fingerprint', deviceFingerprint)
          .neq('student_id', student.id)
          .limit(1);
        if (linkedToOtherLegacy && linkedToOtherLegacy.length > 0) {
          return fail(403, 'DEVICE_USED_BY_OTHER_STUDENT', 'هذا الجهاز مرتبط بطالب آخر');
        }
        const { error: insertDeviceError } = await supabase.from('student_devices').insert({
          student_id: student.id,
          device_fingerprint: deviceFingerprint,
          composite_fingerprint: compositeFingerprint,
          is_active: true,
          institution_id: student.institution_id,
        });
        if (insertDeviceError) {
          console.error('DEVICE_REGISTER_FAILED:', insertDeviceError);
          return fail(409, 'DEVICE_REGISTER_FAILED', 'تعذر تسجيل الجهاز');
        }
      }

      // 5) تسجيل المعرّف في سجل الهوية — الأساس لكشف Factory Reset مستقبلًا
      if (isAndroid && androidId) {
        await upsertDeviceIdentity(student.id, student.institution_id, deviceFingerprint, androidId);
      }
    }

    const { data: attendance, error: attendanceError } = await supabase
      .from('attendances')
      .insert({
        session_id: session.id,
        student_id: student.id,
        method,
        device_fingerprint: deviceFingerprint,
        latitude: typeof input.latitude === 'number' ? input.latitude : null,
        longitude: typeof input.longitude === 'number' ? input.longitude : null,
        distance_meters: measuredDistance,
        is_within_range: true,
        institution_id: student.institution_id,
      })
      .select('id, session_id, student_id, timestamp, distance_meters')
      .single();

    if (attendanceError) {
      if (attendanceError.code === '23505') {
        return fail(409, 'ALREADY_ATTENDED', 'لقد سجلت حضورك مسبقاً في هذه الجلسة');
      }
      return fail(500, 'ATTENDANCE_INSERT_FAILED', 'تعذر تسجيل الحضور');
    }

    return jsonResponse({ ok: true, attendance });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    return fail(500, 'UNEXPECTED_ERROR', `UNEXPECTED_ERROR: ${message}`);
  }
});
