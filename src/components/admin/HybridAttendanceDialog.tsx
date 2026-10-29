/**
 * v3.0 — Hybrid Attendance Dialog
 *
 * Phase 1: QR (standard, teacher watches who has already registered)
 * Teacher manually triggers "Compléter l'appel" → Phase 2: Roll Call for remaining students only
 * 
 * Key design decisions:
 * - Manual trigger (not timer-based) for Algerian university context  
 * - Shows QR countdown, live count of who registered via QR
 * - Seamlessly hands off to SmartRollCallDialog for remaining students
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QrCode,
  Users,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { QRCode } from 'react-qr-code';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { generateDynamicQR, encodeQRData } from '@/lib/qrGenerator';
import {
  getSessionAttendances,
  getStudentsForCohort,
  computeRollCallSummary,
} from '@/lib/smartAttendanceApi';
import SmartRollCallDialog from './SmartRollCallDialog';
import type { Session } from '@/lib/types';

interface HybridAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session;
  institutionId: string;
  cohortName?: string;
  onSessionClose?: () => void;
}

type HybridPhase = 'qr' | 'transitioning' | 'rollcall' | 'done';

export default function HybridAttendanceDialog({
  open,
  onOpenChange,
  session,
  institutionId,
  cohortName,
  onSessionClose,
}: HybridAttendanceDialogProps) {
  const [phase, setPhase] = useState<HybridPhase>('qr');
  const [qrData, setQrData] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [qrAttendedIds, setQrAttendedIds] = useState<string[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loadingTransition, setLoadingTransition] = useState(false);
  const [rollCallOpen, setRollCallOpen] = useState(false);

  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const cohortId = session.cohort_id ?? session.cohortId ?? '';

  // ---------------------------------------------------------------------------
  // Load total students count on open
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open || !cohortId) return;
    getStudentsForCohort(cohortId)
      .then((list) => setTotalStudents(list.length))
      .catch(() => setTotalStudents(0));
  }, [open, cohortId]);

  // ---------------------------------------------------------------------------
  // QR rotation (same logic as SessionsTab — 60s)
  // ---------------------------------------------------------------------------
  const updateQR = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase
      .from('sessions')
      .update({ code: newCode })
      .eq('id', s.id);
    if (!error) {
      sessionRef.current = { ...s, code: newCode };
      setQrData(encodeQRData(generateDynamicQR({ ...s, code: newCode })));
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Poll QR attendances every 5s
  // ---------------------------------------------------------------------------
  const refreshAttendances = useCallback(async () => {
    try {
      const rows = await getSessionAttendances(session.id);
      const ids = rows
        .filter((r) => r.student_id && (r.attendance_source === 'qr' || r.attendance_source === null))
        .map((r) => r.student_id as string);
      setQrAttendedIds(ids);
    } catch {
      // silent
    }
  }, [session.id]);

  useEffect(() => {
    if (!open || phase !== 'qr') return;
    void updateQR();
    void refreshAttendances();
    setCountdown(60);

    const qrInterval = setInterval(() => { void updateQR(); setCountdown(60); }, 60000);
    const cdInterval = setInterval(() => setCountdown((p) => (p <= 1 ? 60 : p - 1)), 1000);
    const attInterval = setInterval(() => void refreshAttendances(), 5000);

    return () => {
      clearInterval(qrInterval);
      clearInterval(cdInterval);
      clearInterval(attInterval);
    };
  }, [open, phase, updateQR, refreshAttendances]);

  // ---------------------------------------------------------------------------
  // Transition: end QR phase → start Roll Call
  // ---------------------------------------------------------------------------
  const handleCompleteWithRollCall = async () => {
    setLoadingTransition(true);
    try {
      // Refresh one last time
      await refreshAttendances();
      setPhase('transitioning');
      await new Promise((r) => setTimeout(r, 600)); // brief animation
      setPhase('rollcall');
      setRollCallOpen(true);
    } catch (err) {
      toast.error('تعذر بدء المناداة');
      console.error(err);
    } finally {
      setLoadingTransition(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Roll Call completed
  // ---------------------------------------------------------------------------
  const handleRollCallComplete = (summary: ReturnType<typeof computeRollCallSummary>) => {
    setRollCallOpen(false);
    setPhase('done');
    toast.success(
      `اكتملت المناداة — ${summary.present} حاضر، ${summary.absent} غائب، ${summary.late} متأخر`,
      { duration: 5000 },
    );
    onSessionClose?.();
  };

  const remaining = totalStudents - qrAttendedIds.length;
  const qrPct = totalStudents > 0 ? Math.round((qrAttendedIds.length / totalStudents) * 100) : 0;

  return (
    <>
      <Dialog open={open && phase !== 'rollcall'} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-3xl border-slate-200 bg-white p-0 dark:border-slate-700 dark:bg-slate-900"
          dir="rtl"
        >
          <div className="sr-only">
            <DialogTitle>الحضور المختلط</DialogTitle>
            <DialogDescription>
              مسح رمز QR أو إجراء المنادات للطلاب المتبقيين.
            </DialogDescription>
          </div>
          {/* ---- QR PHASE ---- */}
          {(phase === 'qr' || phase === 'transitioning') && (
            <div className="flex flex-col gap-0">
              {/* Header */}
              <div className="border-b border-slate-200 p-5 dark:border-slate-700">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/50">
                      <QrCode className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">
                        الحضور المختلط
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                        {cohortName ?? 'مرحلة مسح QR نشطة'}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              {/* Live counters */}
              <div className="grid grid-cols-3 gap-3 p-5 pb-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{totalStudents}</p>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">طالب / طالبة</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center dark:border-emerald-900/70 dark:bg-emerald-950/30">
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-200">{qrAttendedIds.length}</p>
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">عبر QR</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-900/70 dark:bg-amber-950/30">
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-200">{remaining}</p>
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">متبقي</p>
                </div>
              </div>

              {/* QR Progress */}
              <div className="px-5 pb-2">
                <div className="mb-1 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400">تقدم QR</span>
                  <span className="text-indigo-600 dark:text-indigo-300">{qrPct}%</span>
                </div>
                <Progress value={qrPct} className="h-2 rounded-full" />
              </div>

              {/* QR Code */}
              {qrData && (
                <div className="flex flex-col items-center gap-3 px-5 py-4">
                  <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                    <QRCode value={qrData} size={180} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <RefreshCcw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                    <span>يتجدد QR خلال {countdown}s</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 font-mono text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Clock className="h-3.5 w-3.5" />
                    {session.code}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-3 p-5 pt-2">
                {/* Complete with Roll Call */}
                <Button
                  size="lg"
                  disabled={loadingTransition || phase === 'transitioning'}
                  onClick={() => void handleCompleteWithRollCall()}
                  className="w-full rounded-2xl bg-indigo-600 py-5 font-black text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {loadingTransition ? (
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowRight className="ml-2 h-5 w-5" />
                  )}
                  استكمال بالمنادات ({remaining} متبقي)
                </Button>

                {/* Close without Roll Call */}
                <Button
                  variant="outline"
                  disabled={loadingTransition}
                  onClick={() => onOpenChange(false)}
                  className="w-full rounded-2xl"
                >
                  إغلاق (QR فقط)
                </Button>
              </div>
            </div>
          )}

          {/* ---- DONE PHASE ---- */}
          {phase === 'done' && (
            <div className="flex flex-col items-center gap-6 p-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-300" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  اكتمل الحضور المختلط!
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  تم تسجيل الحضور عبر QR + المناداة بنجاح
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-200">
                    {qrAttendedIds.length}
                  </p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">عبر QR</p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/70 dark:bg-indigo-950/30">
                  <p className="text-2xl font-black text-indigo-700 dark:text-indigo-200">
                    {remaining}
                  </p>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">عبر المنادات</p>
                </div>
              </div>
              <Button
                className="w-full rounded-2xl bg-slate-900 py-5 font-black text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                onClick={() => onOpenChange(false)}
              >
                <ChevronRight className="ml-2 h-5 w-5" />
                إغلاق
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Roll Call sub-dialog (renders on top) */}
      {phase === 'rollcall' && (
        <SmartRollCallDialog
          open={rollCallOpen}
          onOpenChange={(v) => {
            if (!v) {
              setRollCallOpen(false);
              setPhase('done');
            }
          }}
          sessionId={session.id}
          cohortId={cohortId}
          institutionId={institutionId}
          cohortName={cohortName}
          excludeStudentIds={qrAttendedIds}
          onComplete={handleRollCallComplete}
        />
      )}
    </>
  );
}
