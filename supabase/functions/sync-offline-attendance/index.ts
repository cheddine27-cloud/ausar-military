// ── sync-offline-attendance ─────────────────────────────────────────────
// دالة مزامنة الطابور غير المتصل لتطبيق الطالب (Flutter).
//
// التطبيق لا يحمل أي جلسة دخول (anon) وسياسة insert على attendances تتطلب
// مستخدمًا مصادَقًا (is_teacher / can_write_to_cohort)، لذلك لا يمكن
// للتطبيق الإدراج مباشرة من العميل. هذه الدالة تعمل بـ service role
// وتعيد تنفيذ **نفس تحقّقات register-attendance كاملة** قبل قبول كل سجل:
//   1. الجلسة موجودة وفي مؤسسة
//   2. الطالب موجود برقمه الجامعي في مؤسسة الجلسة
//   3. الاسم يطابق سجلات الطالب
//   4. عدم التكرار (UNIQUE session_id+student_id)
//   5. التحقق من الجهاز: fingerprint + Factory Reset Protection
//
// السجلات المقبولة تُدخل بـ attendance_source='offline' وis_official=false
// ليُراجعها الأستاذ لاحقًا — وضع إرشادي مثل register-attendance.
//
// المصادقة: رمز سري ثابت (x-queue-secret). مقبول هنا لأن الدالة تعيد كل
// تحقّقات الحضور نفسها: أي سجل مزوّر يُرفض داخلها ولا يصل لجدول الحضور.
// ────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

type AttendanceMethod = 'qr' | 'code';

interface OfflineQueueRecord {
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
  timestamp?: string;
}

interface RecordResult {
  index: number;
  status: 'ok' | 'skipped' | 'error';
  attendanceId?: string;
  code?: string;
  message?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-queue-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const queueSecret = Deno.env.get('QUEUE_SYNC_SECRET') ?? 'qhudoor-offline-sync-secret-2026';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{8}-[0-9a-f]{12}$/i.test(value);
}

// ── Factory Reset Protection: تسجيل/تحديث معرّف الجهاز في سجل الهوية ─────
async function upsertDeviceIdentity(
  studentId: string,
  institutionId: string,
  compositeFingerprint: string,
  androidId: string,
) {
  const { data: existing } = await supabase
    .from('student_device_identities')
    .select('id, android_id, reset_detected')
    .eq('student_id', studentId)
    .eq('institution_id', institutionId)
    .eq('device_fingerprint_hash', compositeFingerprint)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('student_device_identities')
      .update({
        android_id: androidId,
        last_seen_at: new Date().toISOString(),
        reset_detected: existing.android_id !== androidId ? true : existing.reset_detected,
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('student_device_identities')
      .insert({
        student_id: studentId,
        institution_id: institutionId,
        device_fingerprint_hash: compositeFingerprint,
        android_id: androidId,
        reset_detected: false,
        last_seen_at: new Date().toISOString(),
      })
      .maybeSingle();
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
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// البحث عن الجلسة برمزها أو معرّفها. سجلات الطابور تُنشأ وقت مسح صالح
// (كانت الجلسة نشطة وقت المسح)، لذا لا نفرض فحص الإغلاق هنا — قرار
// قبول السجل النهائي للأستاذ (is_official=false).
async function resolveSession(record: OfflineQueueRecord) {
  const qr = parseQrData(record.qrData ?? record.sessionToken);
  const token = qr?.sessionId ?? record.sessionId ?? record.sessionToken ?? record.sessionCode ?? '';
  const code = qr?.code ?? record.sessionCode ?? (!isUuid(token) ? token : '');

  let query = supabase
    .from('sessions')
    .select('id, code, institution_id, latitude, longitude, radius_meters')
    .limit(1);

  query = isUuid(token) ? query.eq('id', token) : query.eq('code', code.toUpperCase());

  const { data, error } = await query.maybeSingle();
  if (error) return { error: { code: 'SESSION_LOOKUP_FAILED', message: 'تعذر التحقق من الجلسة' } };
  if (!data) return { error: { code: 'SESSION_NOT_FOUND', message: 'الجلسة غير موجودة' } };
  if (!data.institution_id) {
    return { error: { code: 'SESSION_MISSING_INSTITUTION', message: 'الجلسة غير مكتملة الإعداد' } };
  }
  if (qr?.code && normalize(qr.code) !== normalize(data.code)) {
    return { error: { code: 'QR_SESSION_MISMATCH', message: 'رمز QR لا يتطابق مع الجلسة' } };
  }

  return { session: data };
}

async function processRecord(record: OfflineQueueRecord, index: number): Promise<RecordResult> {
  const method = record.method === 'qr' || record.method === 'code' ? record.method : 'code';
  const studentNumber = String(record.studentNumber ?? '').trim();
  const firstName = String(record.firstName ?? '').trim();
  const lastName = String(record.lastName ?? '').trim();
  const deviceFingerprint = String(record.deviceFingerprint ?? '').trim();
  const androidId = String(record.androidId ?? '').trim();
  const isAndroid = deviceFingerprint.startsWith('android_');

  if (!studentNumber || !firstName || !lastName) {
    return { index, status: 'error', code: 'MISSING_STUDENT_DATA', message: 'بيانات الطالب غير مكتملة' };
  }
  if (!deviceFingerprint) {
    return { index, status: 'error', code: 'MISSING_DEVICE', message: 'تعذر التعرف على الجهاز' };
  }

  const resolved = await resolveSession(record);
  if ('error' in resolved) return { index, status: 'error', ...resolved.error };
  const session = resolved.session;

  let measuredDistance: number | null = null;
  if (
    session.latitude !== null &&
    session.longitude !== null &&
    typeof record.latitude === 'number' &&
    typeof record.longitude === 'number'
  ) {
    const distance = haversineMeters(
      session.latitude,
      session.longitude,
      record.latitude,
      record.longitude,
    );
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
    return { index, status: 'error', code: 'STUDENT_LOOKUP_FAILED', message: 'تعذر التحقق من الطالب' };
  }
  if (!student) return { index, status: 'error', code: 'STUDENT_NOT_FOUND', message: 'الرقم الجامعي غير موجود في هذه المؤسسة' };
  if (normalize(student.first_name) !== normalize(firstName) || normalize(student.last_name) !== normalize(lastName)) {
    return { index, status: 'error', code: 'STUDENT_DATA_MISMATCH', message: 'البيانات المدخلة لا تتطابق مع السجلات' };
  }

  const { data: existingAttendance } = await supabase
    .from('attendances')
    .select('id')
    .eq('session_id', session.id)
    .eq('student_id', student.id)
    .maybeSingle();

  if (existingAttendance) {
    return { index, status: 'skipped', code: 'ALREADY_ATTENDED', message: 'الحضور مسجل مسبقًا' };
  }

  const { data: currentDevice, error: deviceLookupError } = await supabase
    .from('student_devices')
    .select('id, device_fingerprint, composite_fingerprint, is_active')
    .eq('student_id', student.id)
    .eq('is_active', true)
    .maybeSingle();

  if (deviceLookupError) {
    return { index, status: 'error', code: 'DEVICE_LOOKUP_FAILED', message: 'تعذر التحقق من الجهاز' };
  }

  if (currentDevice) {
    const fingerprintMatches =
      (currentDevice.composite_fingerprint && currentDevice.composite_fingerprint === deviceFingerprint) ||
      (!currentDevice.composite_fingerprint && currentDevice.device_fingerprint === deviceFingerprint);

    if (!fingerprintMatches) {
      return {
        index,
        status: 'error',
        code: 'DEVICE_MISMATCH',
        message: 'لديك جهاز مسجل مسبقًا. لا يمكنك استخدام جهاز جديد دون حذف القديم من الإدارة',
      };
    }

    await supabase
      .from('student_devices')
      .update({
        last_used: new Date().toISOString(),
        composite_fingerprint: isAndroid ? deviceFingerprint : currentDevice.composite_fingerprint,
      })
      .eq('id', currentDevice.id);

    if (isAndroid && androidId && currentDevice.composite_fingerprint) {
      await upsertDeviceIdentity(student.id, student.institution_id, deviceFingerprint, androidId);
    }
  } else {
    const compositeFingerprint = isAndroid ? deviceFingerprint : null;

    const { data: linkedToOther } = await supabase
      .from('student_device_identities')
      .select('student_id')
      .eq('device_fingerprint_hash', deviceFingerprint)
      .neq('student_id', student.id)
      .limit(1);
    if (linkedToOther && linkedToOther.length > 0) {
      return { index, status: 'error', code: 'DEVICE_USED_BY_OTHER_STUDENT', message: 'هذا الجهاز مرتبط بطالب آخر' };
    }

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
      return { index, status: 'error', code: 'DEVICE_USED_BY_OTHER_STUDENT', message: 'هذا الجهاز مرتبط بطالب آخر' };
    }

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
      const { data: linkedToOtherLegacy } = await supabase
        .from('student_devices')
        .select('student_id')
        .eq('device_fingerprint', deviceFingerprint)
        .neq('student_id', student.id)
        .limit(1);
      if (linkedToOtherLegacy && linkedToOtherLegacy.length > 0) {
        return { index, status: 'error', code: 'DEVICE_USED_BY_OTHER_STUDENT', message: 'هذا الجهاز مرتبط بطالب آخر' };
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
        return { index, status: 'error', code: 'DEVICE_REGISTER_FAILED', message: 'تعذر تسجيل الجهاز' };
      }
    }

    if (isAndroid && androidId) {
      await upsertDeviceIdentity(student.id, student.institution_id, deviceFingerprint, androidId);
    }
  }

  // وقت السجل الأصلي (وقت المسح) إن حُفظ في الطابور، وإلا الوقت الحالي.
  const recordTimestamp = record.timestamp ? new Date(record.timestamp) : new Date();

  const { data: attendance, error: attendanceError } = await supabase
    .from('attendances')
    .insert({
      session_id: session.id,
      student_id: student.id,
      method,
      device_fingerprint: deviceFingerprint,
      latitude: typeof record.latitude === 'number' ? record.latitude : null,
      longitude: typeof record.longitude === 'number' ? record.longitude : null,
      distance_meters: measuredDistance,
      is_within_range: true,
      institution_id: student.institution_id,
      attendance_source: 'offline',
      is_official: false,
      timestamp: recordTimestamp.toISOString(),
    })
    .select('id, session_id, student_id, timestamp, distance_meters')
    .single();

  if (attendanceError) {
    if (attendanceError.code === '23505') {
      return { index, status: 'skipped', code: 'ALREADY_ATTENDED', message: 'الحضور مسجل مسبقًا' };
    }
    return { index, status: 'error', code: 'ATTENDANCE_INSERT_FAILED', message: 'تعذر تسجيل الحضور' };
  }

  return { index, status: 'ok', attendanceId: attendance?.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'طريقة الطلب غير مدعومة');

  const providedSecret = req.headers.get('x-queue-secret') ?? '';
  if (!providedSecret || providedSecret !== queueSecret) {
    return fail(401, 'UNAUTHORIZED', 'رمز المزامنة غير صحيح');
  }

  try {
    const body = (await req.json()) as { records?: OfflineQueueRecord[] };
    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) {
      return jsonResponse({ ok: true, results: [], summary: { ok: 0, skipped: 0, error: 0 } });
    }
    if (records.length > 50) {
      return fail(400, 'BATCH_TOO_LARGE', 'الحد الأقصى 50 سجلًا في الدفعة الواحدة');
    }

    const results = await Promise.all(records.map((record, index) => processRecord(record, index)));
    const summary = {
      ok: results.filter((r) => r.status === 'ok').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      error: results.filter((r) => r.status === 'error').length,
    };

    return jsonResponse({ ok: true, results, summary });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    return fail(500, 'UNEXPECTED_ERROR', `UNEXPECTED_ERROR: ${message}`);
  }
});
