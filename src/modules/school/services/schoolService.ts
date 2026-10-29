import { supabase } from '@/lib/supabase';
import { getParentContacts } from '@/core/students/services/parentContactsService';
import { WorkflowEngine } from '@/core/workflow/WorkflowEngine';
import { AuditService } from '@/core/audit/AuditService';

export interface AttendanceReport {
  id: string;
  institution_id: string;
  teacher_id: string;
  teacher_name: string;
  class_id: string;
  class_name: string;
  session_id: string;
  date: string;
  time: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  teacher_notes: string | null;
  status: 'submitted' | 'approved' | 'notifications_sent' | 'closed';
  correction_requested: boolean;
  correction_reason: string | null;
  created_at: string;
}

export interface CommunicationQueueItem {
  id: string;
  institution_id: string;
  sender_admin_id: string | null;
  recipient_type: 'parent' | 'student' | 'admin' | 'professor';
  recipient_id: string;
  recipient_contact: string;
  channel: 'sms' | 'email' | 'whatsapp';
  template_id: string | null;
  subject: string | null;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  retry_count: number;
  provider_response: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface NotificationTemplate {
  id: string;
  institution_id: string;
  key: 'absent' | 'late' | 'warning' | 'meeting';
  channel: 'sms' | 'email' | 'whatsapp';
  subject: string | null;
  body: string;
  is_active: boolean;
}

export interface SchoolAuditLog {
  id: string;
  institution_id: string;
  administrator_id: string | null;
  administrator_name?: string;
  student_id: string | null;
  student_name?: string;
  action: string;
  channel: string | null;
  result: string | null;
  created_at: string;
}

// ─── 1. Attendance Reports ───────────────────────────────────────

export async function submitAttendanceReport(report: Omit<AttendanceReport, 'id' | 'created_at' | 'status' | 'correction_requested' | 'correction_reason' | 'date' | 'time'>): Promise<boolean> {
  const { data, error } = await supabase
    .from('school_attendance_reports')
    .insert({
      institution_id: report.institution_id,
      teacher_id: report.teacher_id,
      teacher_name: report.teacher_name,
      class_id: report.class_id,
      class_name: report.class_name,
      session_id: report.session_id,
      present_count: report.present_count,
      absent_count: report.absent_count,
      late_count: report.late_count,
      teacher_notes: report.teacher_notes || null,
      status: 'submitted',
      correction_requested: false,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('submitAttendanceReport failed:', error);
    return false;
  }

  // Initialize workflow instance
  await WorkflowEngine.getOrStartInstance(
    report.institution_id,
    'school',
    'attendance_report',
    data.id,
    report.teacher_id,
    report.teacher_name
  );

  // Log action
  await logCommunication(report.institution_id, report.teacher_id, null, 'submitted_report', null, `أرسل الأستاذ تقرير حضور قسم ${report.class_name}`);
  return true;
}

export async function getAttendanceReports(institutionId: string): Promise<AttendanceReport[]> {
  const { data, error } = await supabase
    .from('school_attendance_reports')
    .select('*')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getAttendanceReports failed:', error);
    return [];
  }
  return (data || []) as AttendanceReport[];
}

export async function getSessionReport(sessionId: string): Promise<AttendanceReport | null> {
  const { data, error } = await supabase
    .from('school_attendance_reports')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('getSessionReport failed:', error);
    return null;
  }
  return data as AttendanceReport | null;
}

export async function reviewReport(reportId: string, status: 'approved' | 'rejected', adminId: string, notes?: string): Promise<boolean> {
  const { data: report } = await supabase
    .from('school_attendance_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (!report) return false;

  const { error } = await supabase
    .from('school_attendance_reports')
    .update({
      status: status === 'approved' ? 'approved' : 'submitted', // if rejected we keep submitted or allow edit
      correction_requested: false,
      correction_reason: null,
      teacher_notes: notes || report.teacher_notes,
    })
    .eq('id', reportId);

  if (error) {
    console.error('reviewReport failed:', error);
    return false;
  }

  await logCommunication(
    report.institution_id,
    adminId,
    null,
    status === 'approved' ? 'approved_report' : 'rejected_report',
    null,
    status === 'approved' ? `تم اعتماد تقرير قسم ${report.class_name}` : `تم رفض تقرير قسم ${report.class_name}`
  );

  // Transition workflow instance
  await WorkflowEngine.transition(
    report.institution_id,
    'school',
    'attendance_report',
    reportId,
    status === 'approved' ? 'approve' : 'reject',
    adminId,
    null,
    status === 'approved' ? 'اعتماد التقرير كحضور رسمي' : 'رفض وإرجاع للتعديل'
  );

  return true;
}

export async function requestCorrection(reportId: string, reason: string): Promise<boolean> {
  const { error } = await supabase
    .from('school_attendance_reports')
    .update({
      correction_requested: true,
      correction_reason: reason,
    })
    .eq('id', reportId);

  if (error) {
    console.error('requestCorrection failed:', error);
    return false;
  }
  return true;
}

export async function resubmitAttendanceReport(
  reportId: string,
  updates: {
    present_count: number;
    absent_count: number;
    late_count: number;
    teacher_notes: string | null;
    institution_id: string;
    teacher_id: string;
    teacher_name: string;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('school_attendance_reports')
    .update({
      present_count: updates.present_count,
      absent_count: updates.absent_count,
      late_count: updates.late_count,
      teacher_notes: updates.teacher_notes,
      status: 'submitted',
      correction_requested: false,
      correction_reason: null,
    })
    .eq('id', reportId);

  if (error) {
    console.error('resubmitAttendanceReport failed:', error);
    return false;
  }

  // Transition workflow
  await WorkflowEngine.transition(
    updates.institution_id,
    'school',
    'attendance_report',
    reportId,
    'resubmit',
    updates.teacher_id,
    updates.teacher_name,
    'إعادة إرسال التقرير للمراجعة بعد التعديل'
  );

  // Log Audit Log
  await AuditService.log({
    institutionId: updates.institution_id,
    moduleId: 'school',
    action: 'report_resubmitted',
    actorId: updates.teacher_id,
    actorName: updates.teacher_name,
    targetId: reportId,
    targetType: 'attendance_report',
    result: 'success',
    remarks: 'Teacher resubmitted report after correction',
  });

  return true;
}

export async function approveCorrectionRequest(reportId: string, adminId: string): Promise<boolean> {
  const { data: report } = await supabase
    .from('school_attendance_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (!report) return false;

  const { error } = await supabase
    .from('school_attendance_reports')
    .delete()
    .eq('id', reportId); // deleting the report effectively unlocks the session for the teacher!

  if (error) {
    console.error('approveCorrectionRequest failed:', error);
    return false;
  }

  await logCommunication(
    report.institution_id,
    adminId,
    null,
    'approved_correction',
    null,
    `سمح الإدري بتعديل تقرير حضور قسم ${report.class_name}`
  );
  return true;
}

// ─── 2. Communication Queue & Templates ─────────────────────────

/**
 * Generates automated localized messages for parents.
 */
export function buildParentNotification(
  type: 'absent' | 'late' | 'early_leave' | 'medical' | 'discipline',
  studentName: string,
  date: string,
  time?: string,
  lang: 'ar' | 'fr' = 'ar'
): string {
  if (lang === 'ar') {
    switch (type) {
      case 'absent':
        return `ولي أمر التلميذ(ة) ${studentName}، نعلمكم أن ابنكم(ابنتكم) غاب اليوم ${date} عن الحصص. يرجى الاتصال بالإدارة لتبرير الغياب.`;
      case 'late':
        return `ولي أمر التلميذ(ة) ${studentName}، نعلمكم أن ابنكم(ابنتكم) سجل تأخراً اليوم ${date}${time ? ` على الساعة ${time}` : ''}.`;
      case 'early_leave':
        return `ولي أمر التلميذ(ة) ${studentName}، نعلمكم أن ابنكم(ابنتكم) غادر المؤسسة مبكراً اليوم ${date}.`;
      case 'medical':
        return `ولي أمر التلميذ(ة) ${studentName}، نعلمكم بتواجد ابنكم(ابنتكم) في العيادة الطبية للمؤسسة اليوم ${date}.`;
      case 'discipline':
        return `تنبيه انضباطي: ولي أمر التلميذ(ة) ${studentName}، يرجى التواصل مع إدارة المؤسسة في أقرب وقت.`;
      default:
        return `تنبيه من إدارة المؤسسة بخصوص التلميذ(ة) ${studentName}.`;
    }
  } else {
    switch (type) {
      case 'absent':
        return `Parent de ${studentName}, nous vous informons que votre enfant était absent aujourd'hui (${date}). Veuillez contacter l'administration pour justifier cette absence.`;
      case 'late':
        return `Parent de ${studentName}, nous vous informons que votre enfant a enregistré un retard aujourd'hui (${date})${time ? ` à ${time}` : ''}.`;
      case 'early_leave':
        return `Parent de ${studentName}, nous vous informons que votre enfant a quitté l'établissement plus tôt aujourd'hui (${date}).`;
      case 'medical':
        return `Parent de ${studentName}, nous vous informons que votre enfant a été admis à l'infirmerie aujourd'hui (${date}).`;
      case 'discipline':
        return `Alerte disciplinaire: Parent de ${studentName}, veuillez contacter l'administration de l'établissement dès que possible.`;
      default:
        return `Notification de l'administration concernant l'élève ${studentName}.`;
    }
  }
}


export async function queueNotification(queueItem: Omit<CommunicationQueueItem, 'id' | 'created_at' | 'status' | 'retry_count' | 'provider_response' | 'processed_at'>): Promise<boolean> {
  const { error } = await supabase
    .from('communication_queue')
    .insert({
      institution_id: queueItem.institution_id,
      sender_admin_id: queueItem.sender_admin_id,
      recipient_type: queueItem.recipient_type,
      recipient_id: queueItem.recipient_id,
      recipient_contact: queueItem.recipient_contact,
      channel: queueItem.channel,
      template_id: queueItem.template_id,
      subject: queueItem.subject || null,
      message: queueItem.message,
      status: 'pending',
    });

  if (error) {
    console.error('queueNotification failed:', error);
    return false;
  }
  return true;
}

export async function getCommunicationQueue(institutionId: string): Promise<CommunicationQueueItem[]> {
  const { data, error } = await supabase
    .from('communication_queue')
    .select('*')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getCommunicationQueue failed:', error);
    return [];
  }
  return (data || []) as CommunicationQueueItem[];
}

/**
 * Simulate processing a queued message (pending -> sent -> delivered/failed)
 */
export async function processQueueItem(id: string): Promise<boolean> {
  // Simulate network latency
  const statusOutcome = Math.random() > 0.05 ? 'delivered' : 'failed';
  const { error } = await supabase
    .from('communication_queue')
    .update({
      status: statusOutcome,
      processed_at: new Date().toISOString(),
      provider_response: { gateway: 'QH-Connect-Sim', messageId: `msg_${Math.random().toString(36).substr(2, 9)}` },
    })
    .eq('id', id);

  if (error) return false;
  return true;
}

// ─── 3. Log Audit ────────────────────────────────────────────────

export async function logCommunication(
  institutionId: string,
  adminId: string | null,
  studentId: string | null,
  action: string,
  channel: string | null,
  result: string | null
): Promise<void> {
  await supabase.from('school_communication_logs').insert({
    institution_id: institutionId,
    administrator_id: adminId,
    student_id: studentId,
    action,
    channel,
    result,
  });
}

export async function getCommunicationLogs(institutionId: string): Promise<SchoolAuditLog[]> {
  const { data, error } = await supabase
    .from('school_communication_logs')
    .select('*')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getCommunicationLogs failed:', error);
    return [];
  }

  // Hydrate admin names and student names in batch
  const adminIds = Array.from(new Set(data.map((l) => l.administrator_id).filter(Boolean) as string[]));
  const studentIds = Array.from(new Set(data.map((l) => l.student_id).filter(Boolean) as string[]));

  const [adminsRes, studentsRes] = await Promise.all([
    adminIds.length ? supabase.from('admins').select('id, full_name, username').in('id', adminIds) : { data: [] },
    studentIds.length ? supabase.from('students').select('id, first_name, last_name').in('id', studentIds) : { data: [] },
  ]);

  const adminMap = new Map((adminsRes.data || []).map((a) => [a.id, a.full_name || a.username]));
  const studentMap = new Map((studentsRes.data || []).map((s) => [s.id, `${s.first_name || ''} ${s.last_name || ''}`.trim()]));

  return (data || []).map((l) => ({
    ...l,
    administrator_name: l.administrator_id ? adminMap.get(l.administrator_id) || 'مستخدم غير معروف' : undefined,
    student_name: l.student_id ? studentMap.get(l.student_id) || 'تلميذ/ة غير معروف' : undefined,
  })) as SchoolAuditLog[];
}

// ─── 4. Risk Analysis ────────────────────────────────────────────

export interface StudentRiskProfile {
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  absenceRate: number;
  consecutiveAbsences: number;
  lateCount: number;
  level: 'normal' | 'attention' | 'danger';
}

export async function getCohortRiskProfiles(institutionId: string, cohortId: string): Promise<StudentRiskProfile[]> {
  // Get students in cohort
  const { data: students, error: stdError } = await supabase
    .from('students')
    .select('id, first_name, last_name, student_number')
    .eq('cohort_id', cohortId);

  if (stdError || !students) return [];

  // Get sessions and attendances
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('cohort_id', cohortId);

  if (!sessions || sessions.length === 0) {
    return students.map((s) => ({
      studentId: s.id,
      studentName: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      studentNumber: s.student_number,
      absenceRate: 0,
      consecutiveAbsences: 0,
      lateCount: 0,
      level: 'normal',
    }));
  }

  const sessionIds = sessions.map((s) => s.id);
  const { data: attendances } = await supabase
    .from('attendances')
    .select('student_id, attendance_status, timestamp')
    .in('session_id', sessionIds)
    .order('timestamp', { ascending: true });

  const attMap = new Map<string, { status: string; date: string }[]>();
  (attendances || []).forEach((a) => {
    if (!a.student_id) return;
    const list = attMap.get(a.student_id) || [];
    list.push({ status: a.attendance_status || 'present', date: a.timestamp });
    attMap.set(a.student_id, list);
  });

  return students.map((s) => {
    const history = attMap.get(s.id) || [];
    const total = history.length;
    const absences = history.filter((h) => h.status === 'absent').length;
    const lates = history.filter((h) => h.status === 'late').length;
    const rate = total > 0 ? Math.round((absences / total) * 100) : 0;

    // Calculate consecutive absences
    let consecutive = 0;
    let maxConsecutive = 0;
    for (const h of history) {
      if (h.status === 'absent') {
        consecutive += 1;
        if (consecutive > maxConsecutive) maxConsecutive = consecutive;
      } else {
        consecutive = 0;
      }
    }

    // Risk classification rules
    let level: 'normal' | 'attention' | 'danger' = 'normal';
    if (rate >= 25 || maxConsecutive >= 5 || lates >= 7) {
      level = 'danger';
    } else if (rate >= 15 || maxConsecutive >= 3 || lates >= 4) {
      level = 'attention';
    }

    return {
      studentId: s.id,
      studentName: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      studentNumber: s.student_number,
      absenceRate: rate,
      consecutiveAbsences: maxConsecutive,
      lateCount: lates,
      level,
    };
  });
}
