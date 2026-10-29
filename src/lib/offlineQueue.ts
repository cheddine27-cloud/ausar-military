import { toast } from 'sonner';
import { registerAttendanceSecure } from '@/lib/attendanceApi';

export interface PendingAttendance {
  sessionCode?: string;
  sessionId?: string;
  studentNumber?: string;
  studentId?: string;
  firstName?: string;
  lastName?: string;
  method: 'qr' | 'code';
  deviceFingerprint: string;
  timestamp: number;
  isNewDevice?: boolean;
  qrData?: string;
}

const QUEUE_KEY = 'pending_attendance';
const SYNCING_KEY = 'is_syncing';
const SYNC_LOCK_TIME_KEY = 'sync_lock_time';

export function addToOfflineQueue(attendance: PendingAttendance) {
  const queue = getOfflineQueue();
  const exists = queue.some(
    item => (item.sessionCode === attendance.sessionCode || item.sessionId === attendance.sessionId) &&
            (item.studentNumber === attendance.studentNumber || item.studentId === attendance.studentId)
  );

  if (exists) return;

  queue.push(attendance);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getOfflineQueue(): PendingAttendance[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function removeFromQueue(attendance: PendingAttendance | number) {
  const queue = getOfflineQueue();
  if (typeof attendance === 'number') {
    queue.splice(attendance, 1);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return;
  }

  const filtered = queue.filter(
    item => !((item.sessionCode === attendance.sessionCode || item.sessionId === attendance.sessionId) &&
              (item.studentNumber === attendance.studentNumber || item.studentId === attendance.studentId))
  );
  localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function resetSyncLock() {
  localStorage.removeItem(SYNCING_KEY);
  localStorage.removeItem(SYNC_LOCK_TIME_KEY);
}

function checkAndClearStaleLock() {
  const lockTime = localStorage.getItem(SYNC_LOCK_TIME_KEY);
  if (!lockTime) return;

  const elapsed = Date.now() - parseInt(lockTime, 10);
  if (elapsed > 30000) resetSyncLock();
}

function shouldRemoveFailedItem(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('مسبقا') ||
    message.includes('منتهي') ||
    message.includes('غير صحيح') ||
    message.includes('غير موجود') ||
    message.includes('لا تتطابق')
  );
}

async function syncQueueItem(item: PendingAttendance) {
  if (!item.studentNumber || !item.firstName || !item.lastName) {
    throw new Error('بيانات الطالب غير مكتملة في الحضور المؤجل');
  }

  await registerAttendanceSecure({
    sessionId: item.sessionId,
    sessionCode: item.sessionCode,
    sessionToken: item.sessionId || item.sessionCode,
    qrData: item.qrData,
    method: item.method,
    studentNumber: item.studentNumber,
    firstName: item.firstName,
    lastName: item.lastName,
    deviceFingerprint: item.deviceFingerprint,
  });
}

export async function syncOfflineQueue() {
  if (!navigator.onLine) return;

  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  checkAndClearStaleLock();
  if (localStorage.getItem(SYNCING_KEY) === 'true') return;

  localStorage.setItem(SYNCING_KEY, 'true');
  localStorage.setItem(SYNC_LOCK_TIME_KEY, Date.now().toString());

  let successCount = 0;
  let removedCount = 0;

  try {
    for (const item of queue) {
      try {
        await syncQueueItem(item);
        removeFromQueue(item);
        successCount++;
      } catch (error) {
        console.error('Offline attendance sync failed:', error);
        if (shouldRemoveFailedItem(error)) {
          removeFromQueue(item);
          removedCount++;
        }
      }
    }

    if (successCount > 0) toast.success(`تم إرسال ${successCount} حضور بنجاح`);
    if (removedCount > 0) toast.info(`تم حذف ${removedCount} حضور غير صالح من القائمة`);
    const remaining = getOfflineQueue().length;
    if (remaining > 0) toast.warning(`يوجد ${remaining} حضور معلق`);
  } finally {
    resetSyncLock();
  }
}

export function startAutoSync() {
  window.addEventListener('online', () => {
    setTimeout(syncOfflineQueue, 2000);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine) {
      setTimeout(syncOfflineQueue, 1000);
    }
  });

  if (navigator.onLine) {
    setTimeout(syncOfflineQueue, 2000);
  }
}

export async function manualSync(): Promise<{ success: boolean, message: string, synced: number }> {
  if (!navigator.onLine) {
    return { success: false, message: 'لا يوجد اتصال بالإنترنت', synced: 0 };
  }

  const before = getOfflineQueue().length;
  if (before === 0) {
    return { success: true, message: 'لا توجد حضورات معلقة', synced: 0 };
  }

  resetSyncLock();
  await syncOfflineQueue();

  const after = getOfflineQueue().length;
  const synced = Math.max(0, before - after);
  return synced > 0
    ? { success: true, message: `تم إرسال ${synced} حضور بنجاح`, synced }
    : { success: false, message: 'لم تتم مزامنة أي حضور. راجع الاتصال أو صلاحية الجلسة.', synced: 0 };
}
