/**
 * v3.0 — Smart Roll Call Dialog
 *
 * One student at a time. Large buttons. No table. No reload.
 * Keyboard shortcuts: P = حاضر, A = غائب, L = متأخر
 * Undo: go back one student
 * Quick Jump: skip student (return at end)
 * Progress Bar throughout the session.
 * Summary screen at the end.
 *
 * Security: writes go through smartAttendanceApi which includes institution_id.
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Undo2,
  ChevronsRight,
  Users,
  BarChart3,
  Loader2,
  AlertCircle,
  Keyboard,
  List,
  LayoutGrid,
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
import { toast } from 'sonner';
import {
  getStudentsForCohort,
  buildRollCallList,
  saveRollCallMark,
  computeRollCallSummary,
  getSessionAttendances,
} from '@/lib/smartAttendanceApi';
import type { RollCallStudentRow } from '@/lib/types';
import { getActiveModule } from '@/config/modules';
import { getSessionReport, submitAttendanceReport, requestCorrection, resubmitAttendanceReport, type AttendanceReport } from '@/modules/school/services/schoolService';
import { getCurrentAdmin } from '@/lib/database';

interface SmartRollCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  cohortId: string;
  institutionId: string;
  cohortName?: string;
  /** In Hybrid mode, pass already-attended student IDs to exclude them */
  excludeStudentIds?: string[];
  onComplete?: (summary: ReturnType<typeof computeRollCallSummary>) => void;
  initialPhase?: 'loading' | 'calling' | 'summary';
}

type PhaseType = 'loading' | 'ready' | 'calling' | 'summary' | 'error';

export default function SmartRollCallDialog({
  open,
  onOpenChange,
  sessionId,
  cohortId,
  institutionId,
  cohortName,
  excludeStudentIds = [],
  onComplete,
  initialPhase,
}: SmartRollCallDialogProps) {
  const [phase, setPhase] = useState<PhaseType>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Roll Call state
  const [rows, setRows] = useState<RollCallStudentRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Skipped students to process at the end
  const [skipped, setSkipped] = useState<number[]>([]);
  const [processingSkipped, setProcessingSkipped] = useState(false);

  // Keyboard shortcuts
  const savingRef = useRef(false);

  // Ausar Military Guardian Connect states
  const [existingReport, setExistingReport] = useState<AttendanceReport | null>(null);
  const [teacherNotes, setTeacherNotes] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [sendingCorrectionRequest, setSendingCorrectionRequest] = useState(false);
  const [isEditingCorrection, setIsEditingCorrection] = useState(false);

  const excludeKey = excludeStudentIds.join(',');

  // ---------------------------------------------------------------------------
  // Load students on open
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    setPhase('loading');
    setErrorMsg('');
    setRows([]);
    setCurrentIndex(0);
    setSkipped([]);
    setProcessingSkipped(false);
    setExistingReport(null);
    setTeacherNotes('');
    setCorrectionReason('');
    setIsEditingCorrection(false);

    (async () => {
      try {
        const activeModule = getActiveModule();
        if (activeModule.id === 'school') {
          const report = await getSessionReport(sessionId);
          if (report) {
            setExistingReport(report);
            setPhase('summary');
            return;
          }
        }

        const students = await getStudentsForCohort(cohortId);
        
        if (initialPhase === 'summary') {
          const existingAtts = await getSessionAttendances(sessionId);
          const list = students.map((s) => {
            const matched = existingAtts.find((a) => a.student_id === s.id);
            return {
              studentId: s.id,
              studentNumber: s.student_number ?? '—',
              fullName: [s.last_name, s.first_name].filter(Boolean).join(' ') || 'طالب',
              mark: (matched?.attendance_status || null) as RollCallMark,
            };
          });
          setRows(list);
          setPhase('summary');
        } else {
          // Build list, excluding already-attended (Hybrid mode)
          const mockExisting = excludeStudentIds.map((id) => ({
            student_id: id,
            attendance_source: 'qr',
            attendance_status: 'present',
          }));
          const list = buildRollCallList(students, mockExisting);
          if (list.length === 0) {
            setPhase('summary');
            setRows([]);
          } else {
            setRows(list);
            setPhase('ready');
          }
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'خطأ في تحميل الطلاب');
        setPhase('error');
      }
    })();
  }, [open, cohortId, excludeKey, sessionId, initialPhase]);

  // ---------------------------------------------------------------------------
  // Find next unmarked index (skips processed students)
  // ---------------------------------------------------------------------------
  const findNextIndex = useCallback(
    (from: number, list: RollCallStudentRow[]): number => {
      for (let i = from; i < list.length; i++) {
        if (list[i].mark === null && !skipped.includes(i)) return i;
      }
      return -1;
    },
    [skipped],
  );

  // ---------------------------------------------------------------------------
  // Mark current student
  // ---------------------------------------------------------------------------
  const markStudent = useCallback(
    async (mark: 'present' | 'absent' | 'late') => {
      if (savingRef.current || phase !== 'calling') return;
      savingRef.current = true;
      setSaving(true);

      const student = rows[currentIndex];
      if (!student) {
        savingRef.current = false;
        setSaving(false);
        return;
      }

      // Update local state immediately (optimistic)
      const updatedRows = rows.map((r, i) =>
        i === currentIndex ? { ...r, mark } : r,
      );
      setRows(updatedRows);

      // Play a subtle audio cue
      playTick();

      // Persist to DB
      const result = await saveRollCallMark({
        sessionId,
        studentId: student.studentId,
        institutionId,
        mark,
      });

      if (!result.ok) {
        toast.error(`تعذر حفظ ${student.fullName}: ${result.error ?? ''}`, {
          duration: 3000,
        });
      }

      savingRef.current = false;
      setSaving(false);

      // Advance to next
      const next = findNextIndex(currentIndex + 1, updatedRows);
      if (next === -1) {
        // Check if there are skipped students to process
        if (skipped.length > 0 && !processingSkipped) {
          setProcessingSkipped(true);
          const firstSkipped = skipped[0];
          setSkipped((prev) => prev.slice(1));
          setCurrentIndex(firstSkipped);
        } else {
          setPhase('summary');
          const summary = computeRollCallSummary(updatedRows);
          onComplete?.(summary);
        }
      } else {
        setCurrentIndex(next);
      }
    },
    [
      currentIndex,
      findNextIndex,
      institutionId,
      onComplete,
      phase,
      processingSkipped,
      rows,
      sessionId,
      skipped,
    ],
  );

  // ---------------------------------------------------------------------------
  // Mark student at a specific index (used in List View)
  // ---------------------------------------------------------------------------
  const markStudentAtIndex = useCallback(
    async (index: number, mark: 'present' | 'absent' | 'late') => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);

      const student = rows[index];
      if (!student) {
        savingRef.current = false;
        setSaving(false);
        return;
      }

      // Update local state immediately (optimistic)
      const updatedRows = rows.map((r, i) =>
        i === index ? { ...r, mark } : r,
      );
      setRows(updatedRows);

      // Play audio feedback
      playTick();

      // Keep currentIndex in sync
      setCurrentIndex(index);

      // Persist to DB
      const result = await saveRollCallMark({
        sessionId,
        studentId: student.studentId,
        institutionId,
        mark,
      });

      if (!result.ok) {
        toast.error(`تعذر حفظ ${student.fullName}: ${result.error ?? ''}`, {
          duration: 3000,
        });
      }

      savingRef.current = false;
      setSaving(false);

      // Check if all are marked to finish
      const summary = computeRollCallSummary(updatedRows);
      if (summary.unmarked === 0) {
        setPhase('summary');
        onComplete?.(summary);
      }
    },
    [rows, sessionId, institutionId, onComplete],
  );

  // ---------------------------------------------------------------------------
  // Undo — go back to previous student
  // ---------------------------------------------------------------------------
  const handleUndo = useCallback(() => {
    if (phase !== 'calling' || saving) return;
    // Find previous marked student
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (rows[i].mark !== null) {
        const updatedRows = rows.map((r, idx) =>
          idx === i ? { ...r, mark: null } : r,
        );
        setRows(updatedRows);
        setCurrentIndex(i);
        toast.info(`تراجع: ${rows[i].fullName}`, { duration: 1500 });
        return;
      }
    }
  }, [currentIndex, phase, rows, saving]);

  // ---------------------------------------------------------------------------
  // Quick Jump (skip) — come back later
  // ---------------------------------------------------------------------------
  const handleSkip = useCallback(() => {
    if (phase !== 'calling' || saving) return;
    setSkipped((prev) => [...prev, currentIndex]);
    const next = findNextIndex(currentIndex + 1, rows);
    if (next === -1) {
      if (skipped.length > 0) {
        const firstSkipped = skipped[0];
        setSkipped((prev) => prev.slice(1));
        setCurrentIndex(firstSkipped);
      } else {
        setPhase('summary');
        onComplete?.(computeRollCallSummary(rows));
      }
    } else {
      setCurrentIndex(next);
    }
  }, [currentIndex, findNextIndex, onComplete, phase, rows, saving, skipped]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open || phase !== 'calling') return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key.toLowerCase()) {
        case 'p':
          void markStudent('present');
          break;
        case 'a':
          void markStudent('absent');
          break;
        case 'l':
          void markStudent('late');
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) handleUndo();
          break;
        case 's':
          handleSkip();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, phase, markStudent, handleUndo, handleSkip]);

  // ---------------------------------------------------------------------------
  // Compute stats for header
  // ---------------------------------------------------------------------------
  const summary = computeRollCallSummary(rows);
  const markedCount = summary.present + summary.absent + summary.late;
  const progressPct = rows.length > 0 ? Math.round((markedCount / rows.length) * 100) : 0;

  const currentStudent = rows[currentIndex] ?? null;

  const activeModule = getActiveModule();
  const isSchool = activeModule.id === 'school';

  const handleSendToAdmin = async () => {
    setSubmittingReport(true);
    try {
      const admin = getCurrentAdmin();
      if (!admin) {
        toast.error('لم يتم العثور على معلومات الحساب');
        return;
      }
      const success = await submitAttendanceReport({
        institution_id: institutionId,
        teacher_id: admin.id,
        teacher_name: admin.fullName || admin.full_name || admin.username || 'الأستاذ',
        class_id: cohortId,
        class_name: cohortName || 'قسم غير محدد',
        session_id: sessionId,
        present_count: summary.present,
        absent_count: summary.absent,
        late_count: summary.late,
        teacher_notes: teacherNotes,
      });

      if (success) {
        toast.success('تم إرسال تقرير حضور الحصة للإدارة بنجاح');
        onOpenChange(false);
      } else {
        toast.error('حدث خطأ أثناء إرسال التقرير للإدارة');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleResubmitReport = async () => {
    if (!existingReport) return;
    setSubmittingReport(true);
    try {
      const admin = getCurrentAdmin();
      if (!admin) {
        toast.error('لم يتم العثور على معلومات الحساب');
        return;
      }
      const success = await resubmitAttendanceReport(existingReport.id, {
        institution_id: institutionId,
        teacher_id: admin.id,
        teacher_name: admin.fullName || admin.full_name || admin.username || 'الأستاذ',
        present_count: summary.present,
        absent_count: summary.absent,
        late_count: summary.late,
        teacher_notes: teacherNotes,
      });

      if (success) {
        toast.success('تم إعادة إرسال تقرير الحضور المعدل للإدارة بنجاح');
        setIsEditingCorrection(false);
        onOpenChange(false);
      } else {
        toast.error('حدث خطأ أثناء إعادة إرسال التقرير المعدل');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleReopenForCorrection = async () => {
    setPhase('loading');
    try {
      const students = await getStudentsForCohort(cohortId);
      const mockExisting = excludeStudentIds.map((id) => ({
        student_id: id,
        attendance_source: 'qr',
        attendance_status: 'present',
      }));
      const list = buildRollCallList(students, mockExisting);
      setRows(list);
      setIsEditingCorrection(true);
      setTeacherNotes(existingReport?.teacher_notes || '');
      setPhase('calling');
      setCurrentIndex(0);
    } catch (err) {
      toast.error('فشل إعادة فتح التقرير للتعديل');
      setPhase('summary');
    }
  };

  const handleRequestCorrection = async () => {
    if (!existingReport || !correctionReason.trim()) {
      toast.error('يرجى تحديد سبب طلب التعديل');
      return;
    }
    setSendingCorrectionRequest(true);
    try {
      const success = await requestCorrection(existingReport.id, correctionReason);
      if (success) {
        toast.success('تم إرسال طلب التعديل للإدارة');
        setExistingReport({
          ...existingReport,
          correction_requested: true,
          correction_reason: correctionReason,
        });
      } else {
        toast.error('فشل إرسال طلب التعديل');
      }
    } finally {
      setSendingCorrectionRequest(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-3xl border-slate-200 bg-white p-0 dark:border-slate-700 dark:bg-slate-900"
        dir="rtl"
      >
        <div className="sr-only">
          <DialogTitle>المنادات الذكية</DialogTitle>
          <DialogDescription>
            تسجيل حضور الطلاب يدوياً واحداً تلو الآخر.
          </DialogDescription>
        </div>
        {/* ---- LOADING ---- */}
        {phase === 'loading' && (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 dark:text-indigo-300" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              جاري تحميل قائمة الطلاب...
            </p>
          </div>
        )}

        {/* ---- ERROR ---- */}
        {phase === 'error' && (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-rose-500" />
            <p className="text-sm font-bold text-rose-600 dark:text-rose-300">{errorMsg}</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إغلاق
            </Button>
          </div>
        )}

        {/* ---- READY (before starting) ---- */}
        {phase === 'ready' && (
          <div className="flex flex-col gap-6 p-8 text-center">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white">
                المنادات الذكية
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                {cohortName && <span className="font-bold">{cohortName}</span>}
              </DialogDescription>
            </DialogHeader>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <StatPill label="الطلاب" value={rows.length} color="indigo" />
              <StatPill label="المحددين" value={markedCount} color="emerald" />
              <StatPill label="المتبقين" value={rows.length - markedCount} color="amber" />
            </div>

            {/* Keyboard hint */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-right text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <div className="mb-2 flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                <Keyboard className="h-3.5 w-3.5" />
                اختصارات لوحة المفاتيح
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span><kbd className="rounded bg-white px-1 py-0.5 font-mono ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600">P</kbd> حاضر</span>
                <span><kbd className="rounded bg-white px-1 py-0.5 font-mono ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600">A</kbd> غائب</span>
                <span><kbd className="rounded bg-white px-1 py-0.5 font-mono ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600">L</kbd> متأخر</span>
                <span><kbd className="rounded bg-white px-1 py-0.5 font-mono ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600">S</kbd> تخطي</span>
              </div>
            </div>

            <Button
              size="lg"
              className="rounded-2xl bg-indigo-600 py-6 text-lg font-black text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              onClick={() => { setPhase('calling'); setCurrentIndex(0); }}
            >
              بدء المنادات
              <ChevronRight className="mr-2 h-5 w-5" />
            </Button>
          </div>
        )}

        {/* ---- CALLING ---- */}
        {phase === 'calling' && currentStudent && (
          <div className="flex flex-col gap-0">
            {/* Header with progress */}
            <div className="border-b border-slate-200 p-5 dark:border-slate-700">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                    {markedCount + 1} / {rows.length}
                  </span>
                </div>

                {/* Card / List Toggle */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2.5 text-xs font-bold rounded-lg transition-all ${
                      viewMode === 'card'
                        ? 'bg-white shadow-sm text-slate-900 dark:bg-slate-700 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                    onClick={() => setViewMode('card')}
                  >
                    <LayoutGrid className="ml-1 h-3.5 w-3.5" />
                    بطاقة
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2.5 text-xs font-bold rounded-lg transition-all ${
                      viewMode === 'list'
                        ? 'bg-white shadow-sm text-slate-900 dark:bg-slate-700 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                    onClick={() => setViewMode('list')}
                  >
                    <List className="ml-1 h-3.5 w-3.5" />
                    قائمة
                  </Button>
                </div>

                <span className="text-sm font-black text-indigo-600 dark:text-indigo-300">
                  {progressPct}%
                </span>
              </div>
              <Progress value={progressPct} className="h-2.5 rounded-full" />

              {/* Live counters */}
              <div className="mt-3 flex gap-2 text-xs">
                <Badge className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                  ✅ {summary.present}
                </Badge>
                <Badge className="rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                  ❌ {summary.absent}
                </Badge>
                <Badge className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  ⏰ {summary.late}
                </Badge>
                {skipped.length > 0 && (
                  <Badge variant="outline" className="rounded-full">
                    ↩ {skipped.length} متخطى
                  </Badge>
                )}
              </div>
            </div>

            {viewMode === 'list' ? (
              <>
                {/* Scrollable list of students */}
                <div className="max-h-[50vh] min-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800" dir="rtl">
                  {rows.map((row, idx) => {
                    const isCurrent = idx === currentIndex;
                    return (
                      <div
                        key={row.studentId}
                        className={`flex items-center justify-between p-3.5 transition-colors ${
                          isCurrent ? 'bg-indigo-50/30 dark:bg-indigo-950/10' : ''
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 text-right">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {row.fullName}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                            {row.studentNumber}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5" dir="ltr">
                          <button
                            disabled={saving}
                            onClick={() => void markStudentAtIndex(idx, 'present')}
                            className={`h-8 px-2.5 text-xs font-bold rounded-lg border transition-all ${
                              row.mark === 'present'
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : 'text-emerald-600 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/50'
                            }`}
                          >
                            حاضر
                          </button>
                          <button
                            disabled={saving}
                            onClick={() => void markStudentAtIndex(idx, 'absent')}
                            className={`h-8 px-2.5 text-xs font-bold rounded-lg border transition-all ${
                              row.mark === 'absent'
                                ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                                : 'text-rose-600 border-rose-200 bg-rose-50/50 hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/50'
                            }`}
                          >
                            غائب
                          </button>
                          <button
                            disabled={saving}
                            onClick={() => void markStudentAtIndex(idx, 'late')}
                            className={`h-8 px-2.5 text-xs font-bold rounded-lg border transition-all ${
                              row.mark === 'late'
                                ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                : 'text-amber-600 border-amber-200 bg-amber-50/50 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/50'
                            }`}
                          >
                            متأخر
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Complete Roll Call early button */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                  <Button
                    className="w-full rounded-2xl bg-indigo-600 py-5 text-sm font-bold text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    onClick={() => {
                      const summary = computeRollCallSummary(rows);
                      setPhase('summary');
                      onComplete?.(summary);
                    }}
                  >
                    إنهاء وحفظ الحضور ({summary.unmarked} متبقي)
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Student card */}
                <div className="flex flex-col items-center gap-2 px-6 py-8">
                  {/* Student number */}
                  <span className="rounded-full bg-slate-100 px-4 py-1 font-mono text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {currentStudent.studentNumber}
                  </span>

                  {/* Student name */}
                  <h2 className="mt-2 text-4xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                    {currentStudent.fullName}
                  </h2>

                  {saving && (
                    <Loader2 className="mt-1 h-5 w-5 animate-spin text-indigo-400" />
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-6 pb-4">
                  <button
                    disabled={saving}
                    onClick={() => void markStudent('present')}
                    className="flex flex-col items-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 py-5 font-black text-emerald-700 transition-all duration-150 hover:scale-105 hover:border-emerald-400 hover:bg-emerald-100 active:scale-95 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70"
                  >
                    <CheckCircle2 className="h-8 w-8" />
                    <span className="text-sm">حاضر</span>
                    <kbd className="rounded bg-white/60 px-1.5 py-0.5 font-mono text-[10px] dark:bg-black/30">P</kbd>
                  </button>

                  <button
                    disabled={saving}
                    onClick={() => void markStudent('absent')}
                    className="flex flex-col items-center gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 py-5 font-black text-rose-700 transition-all duration-150 hover:scale-105 hover:border-rose-400 hover:bg-rose-100 active:scale-95 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/70"
                  >
                    <XCircle className="h-8 w-8" />
                    <span className="text-sm">غائب</span>
                    <kbd className="rounded bg-white/60 px-1.5 py-0.5 font-mono text-[10px] dark:bg-black/30">A</kbd>
                  </button>

                  <button
                    disabled={saving}
                    onClick={() => void markStudent('late')}
                    className="flex flex-col items-center gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 py-5 font-black text-amber-700 transition-all duration-150 hover:scale-105 hover:border-amber-400 hover:bg-amber-100 active:scale-95 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70"
                  >
                    <Clock className="h-8 w-8" />
                    <span className="text-sm">متأخر</span>
                    <kbd className="rounded bg-white/60 px-1.5 py-0.5 font-mono text-[10px] dark:bg-black/30">L</kbd>
                  </button>
                </div>

                {/* Undo & Skip */}
                <div className="flex gap-2 px-6 pb-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving || markedCount === 0}
                    onClick={handleUndo}
                    className="flex-1 gap-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    <Undo2 className="h-4 w-4" />
                    تراجع
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={handleSkip}
                    className="flex-1 gap-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    <ChevronsRight className="h-4 w-4" />
                    تخطي
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowShortcuts((s) => !s)}
                    className="rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <Keyboard className="h-4 w-4" />
                  </Button>
                </div>

                {/* Shortcuts panel */}
                {showShortcuts && (
                  <div className="mx-6 mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800">
                    <div className="grid grid-cols-2 gap-1 text-slate-600 dark:text-slate-300">
                      <span><kbd className="rounded px-1 ring-1 ring-slate-300 dark:ring-slate-600">P</kbd> حاضر</span>
                      <span><kbd className="rounded px-1 ring-1 ring-slate-300 dark:ring-slate-600">A</kbd> غائب</span>
                      <span><kbd className="rounded px-1 ring-1 ring-slate-300 dark:ring-slate-600">L</kbd> متأخر</span>
                      <span><kbd className="rounded px-1 ring-1 ring-slate-300 dark:ring-slate-600">S</kbd> تخطي</span>
                      <span className="col-span-2"><kbd className="rounded px-1 ring-1 ring-slate-300 dark:ring-slate-600">Ctrl+Z</kbd> تراجع</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}        {/* ---- SUMMARY ---- */}
        {phase === 'summary' && (
          <div className="flex flex-col gap-6 p-8 text-right">
            <DialogHeader className="space-y-1 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/50">
                <BarChart3 className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
              </div>
              <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white">
                {isSchool ? 'ملخص إرسال حضور القسم' : "ملخص المنادات"}
              </DialogTitle>
              {cohortName && (
                <DialogDescription className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  {cohortName}
                </DialogDescription>
              )}
            </DialogHeader>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard
                label="حاضرون"
                value={existingReport && !isEditingCorrection ? existingReport.present_count : summary.present}
                color="emerald"
                icon="✅"
              />
              <SummaryCard
                label="غائبون"
                value={existingReport && !isEditingCorrection ? existingReport.absent_count : summary.absent}
                color="rose"
                icon="❌"
              />
              <SummaryCard
                label="متأخرون"
                value={existingReport && !isEditingCorrection ? existingReport.late_count : summary.late}
                color="amber"
                icon="⏰"
              />
              <SummaryCard
                label="غير مسجلين"
                value={existingReport && !isEditingCorrection ? 0 : summary.unmarked}
                color="slate"
                icon="—"
              />
            </div>

            {/* School Workflow Summary Check */}
            {isSchool ? (
              <div className="space-y-4">
                {existingReport && !isEditingCorrection ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-right text-xs">
                    <p className="font-bold text-slate-800">حالة تقرير الحضور لدى الإدارة:</p>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-slate-500">حالة التقرير</span>
                      <Badge className="font-black">
                        {existingReport.status === 'submitted' && 'بانتظار مراجعة الإدارة'}
                        {existingReport.status === 'approved' && 'تم الاعتماد (حضور رسمي)'}
                        {existingReport.status === 'notifications_sent' && 'تم إرسال الإشعارات للأولياء'}
                        {existingReport.status === 'closed' && 'مغلق'}
                      </Badge>
                    </div>

                    {/* LOCKED: Officially approved — no actions allowed */}
                    {existingReport.is_locked ? (
                      <div className="space-y-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <p className="text-xs font-black text-emerald-800">🔒 حضور رسمي مُقفَل نهائياً</p>
                        </div>
                        <p className="text-[10px] text-emerald-600">
                          اعتمدت الإدارة هذا التقرير رسمياً. لا يمكن تعديله أو إعادة إرساله.
                        </p>
                      </div>
                    ) : existingReport.correction_requested ? (
                      <div className="space-y-3 bg-amber-50 border border-amber-100 rounded-xl p-3 text-amber-800 text-right">
                        <p className="font-bold">⚠️ طلبت الإدارة تعديل تقرير الحضور هذا.</p>
                        <p className="font-semibold text-[10px]">السبب: {existingReport.correction_reason}</p>
                        <Button
                          className="w-full text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl mt-2 py-4"
                          onClick={handleReopenForCorrection}
                        >
                          تعديل الحضور وإعادة الإرسال
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-slate-100/50 border border-slate-200 rounded-xl p-3 text-slate-600 text-center font-bold">
                          بانتظار مراجعة الإدارة
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1 text-right">
                      <label className="text-xs font-bold text-slate-600">ملاحظات الأستاذ للإدارة (اختياري):</label>
                      <textarea
                        value={teacherNotes}
                        onChange={(e) => setTeacherNotes(e.target.value)}
                        placeholder="مثال: تأخر بسبب الحافلة المدرسية، أو أي ملاحظة أخرى..."
                        className="flex min-h-[60px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <Button
                      className="w-full rounded-2xl bg-emerald-600 py-5 font-black text-white hover:bg-emerald-700 gap-2"
                      disabled={submittingReport}
                      onClick={isEditingCorrection ? handleResubmitReport : handleSendToAdmin}
                    >
                      {submittingReport ? 'جاري الإرسال للإدارة...' : isEditingCorrection ? 'إرسال التقرير المعدل للإدارة' : 'إرسال الحضور للإدارة (Ausar Military Guardian Connect)'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Attendance rate */}
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-center dark:border-indigo-900/70 dark:bg-indigo-950/30">
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-300">
                    نسبة الحضور
                  </p>
                  <p className="mt-1 text-5xl font-black text-indigo-800 dark:text-indigo-100">
                    {summary.presentRate}%
                  </p>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/60 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-700"
                      style={{ width: `${summary.presentRate}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-indigo-500 dark:text-indigo-400">
                    {summary.total} طالب / طالبة في المجموع
                  </p>
                </div>

                <Button
                  className="w-full rounded-2xl bg-slate-900 py-5 font-black text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                  onClick={() => onOpenChange(false)}
                >
                  إنهاء وإغلاق
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-200 dark:border-indigo-900/70',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/70',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/70',
  };
  return (
    <div className={`rounded-2xl border p-3 text-center ${colors[color] ?? ''}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-bold opacity-80">{label}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100',
    slate: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color] ?? ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-2xl font-black">{value}</p>
          <p className="text-xs font-bold opacity-70">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subtle audio feedback (Web Audio API, no external dep)
// ---------------------------------------------------------------------------
function playTick() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Audio not supported — silent fallback
  }
}
