import { supabase } from './supabase';

export interface RegisterAttendanceInput {
  sessionId?: string | null;
  sessionCode?: string | null;
  sessionToken?: string | null;
  qrData?: string | null;
  method: 'qr' | 'code';
  studentNumber: string;
  firstName: string;
  lastName: string;
  deviceFingerprint: string;
  latitude?: number | null;
  longitude?: number | null;
}

const errorMessages: Record<string, string> = {
  QR_EXPIRED: 'رمز QR منتهي الصلاحية',
  QR_SESSION_MISMATCH: 'رمز QR لا يتطابق مع الجلسة الحالية',
  SESSION_NOT_FOUND: 'رمز الجلسة غير صحيح',
  SESSION_CLOSED: 'هذه الجلسة مغلقة حاليا',
  STUDENT_NOT_FOUND: 'الرقم الجامعي غير موجود في هذه المؤسسة',
  STUDENT_DATA_MISMATCH: 'البيانات المدخلة لا تتطابق مع السجلات',
  ALREADY_ATTENDED: 'لقد سجلت حضورك مسبقا في هذه الجلسة',
  DEVICE_MISMATCH: 'لديك جهاز مسجل مسبقا. لا يمكنك استخدام جهاز جديد دون حذف القديم من الإدارة',
  DEVICE_USED_BY_OTHER_STUDENT: 'هذا الجهاز مرتبط بطالب آخر',
  LOCATION_REQUIRED: 'هذه الجلسة تتطلب تفعيل الموقع الجغرافي',
  OUT_OF_RANGE: 'أنت خارج النطاق المسموح به لهذه القاعة',
};

export class AttendanceRegistrationError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'AttendanceRegistrationError';
  }
}

export async function registerAttendanceSecure(input: RegisterAttendanceInput) {
  const { data, error } = await supabase.functions.invoke('register-attendance', {
    body: input,
  });

  if (error) {
    const maybeDetails = (error as { details?: unknown; status?: number }).details;
    const maybeStatus = (error as { status?: number }).status;

    let code = 'FUNCTION_ERROR';
    let message = error.message || 'تعذر الاتصال بخدمة تسجيل الحضور';

    let detailsObj: { error?: { code?: string; message?: string } } | null = null;
    if (maybeDetails && typeof maybeDetails === 'object') {
      detailsObj = maybeDetails as { error?: { code?: string; message?: string } };
    } else if (typeof maybeDetails === 'string') {
      try {
        const parsed = JSON.parse(maybeDetails);
        if (parsed && typeof parsed === 'object') {
          detailsObj = parsed as { error?: { code?: string; message?: string } };
        }
      } catch {
        // Ignore malformed string details and keep default message.
      }
    }

    if (detailsObj) {
      const details = detailsObj;
      const detailCode = details.error?.code;
      const detailMessage = details.error?.message;
      if (detailCode) code = detailCode;
      if (detailMessage) {
        message = errorMessages[detailCode || ''] || detailMessage;
      }
    }

    if (code === 'FUNCTION_ERROR' && maybeStatus === 428) {
      code = 'LOCATION_REQUIRED';
      message = errorMessages.LOCATION_REQUIRED;
    }

    throw new AttendanceRegistrationError(code, message, maybeStatus);
  }

  if (!data?.ok) {
    const code = data?.error?.code || 'ATTENDANCE_FAILED';
    throw new AttendanceRegistrationError(
      code,
      errorMessages[code] || data?.error?.message || 'تعذر تسجيل الحضور',
      data?.status
    );
  }

  return data.attendance;
}
