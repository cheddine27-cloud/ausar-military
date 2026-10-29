import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, FileSpreadsheet, Trash2, CalendarDays, History, FileText, ChevronRight, UserCheck, FilterX, Archive, Fingerprint, Copy, CheckCircle2, MapPin, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getAllAttendance, getAllSessions, getAllCohorts, getAllStudents, getAllDevices } from '@/lib/database';
import { exportAttendanceToExcel } from '@/lib/excelExport';
import { exportAttendanceToPDF } from '@/lib/pdfExportHtml';
import { supabase } from '@/lib/supabase';
import type { Attendance, Session, Cohort, Student } from '@/lib/types';

// v4.6.0 — عتبات المسافة الجغرافية المخصصة لواقع GPS في الجزائر.
// داخل المباني في المدن الجزائرية ينحرف GPS عادةً بين 30 و100 متر،
// لذلك لا يمكن الاعتماد على عتبة صغيرة (مثل 20م). نعتمد ثلاث مناطق:
// - "مؤكد" (أخضر): ≤ CONFIRMED_DISTANCE_M — الطالب داخل القاعة فعلياً
// - "محتمل" (برتقالي): بين CONFIRMED_DISTANCE_M و REVIEW_DISTANCE_M — مراجعة سريعة
// - "مشتبه" (أحمر): > REVIEW_DISTANCE_M — يُعرض في فلتر "المشتبهين" ويمكن حذفه دفعة واحدة
const CONFIRMED_DISTANCE_M = 50;
const REVIEW_DISTANCE_M = 150;

/** العتبة الافتراضية للعتبة التي يضبطها الأستاذ (متر). */
const DEFAULT_SESSION_RADIUS_M = 150;

interface DeviceFingerprintSnapshot {
  student_id: string;
  device_fingerprint?: string | null;
  is_active?: boolean | null;
}

interface AttendanceTabProps {
  readOnly?: boolean;
  title?: string;
  description?: string;
}

export default function AttendanceTab({
  readOnly = false,
  title = 'سجل الحضور العام',
  description = 'عرض وتصدير تقارير الحضور الأكاديمي لجميع الفصول',
}: AttendanceTabProps) {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [deviceFingerprints, setDeviceFingerprints] = useState<Record<string, string>>({});

  const [selectedSession, setSelectedSession] = useState<string>('all');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<'all' | 'suspicious'>('all');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const copyFingerprint = async (fp: string, id: string) => {
    try {
      await navigator.clipboard.writeText(fp);
      setCopiedId(id);
      toast.success('تم نسخ البصمة');
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error('تعذر النسخ');
    }
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [att, sess, coh, st, dev] = await Promise.all([
        getAllAttendance(), getAllSessions(), getAllCohorts(), getAllStudents(), getAllDevices()
      ]);
      const fallbackFingerprints = (dev as DeviceFingerprintSnapshot[]).reduce<Record<string, string>>((acc, device) => {
        if (device.student_id && device.device_fingerprint && device.is_active !== false) {
          acc[device.student_id] = device.device_fingerprint;
        }
        return acc;
      }, {});
      setAttendances(att.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setSessions(sess); setCohorts(coh); setStudents(st);
      setDeviceFingerprints(fallbackFingerprints);
    } finally { setLoading(false); }
  };

  // Helper: تحديد ما إذا كان السجل "مشتبهاً به" (خارج النطاق المتوقع)
  const isSuspicious = (a: Attendance): boolean => {
    const sessId = a.session_id || a.sessionId;
    const sess = sessions.find(s => s.id === sessId);
    const dist = a.distance_meters;
    if (dist === null || dist === undefined) return false;
    // v4.6.0 — مراجعة سريعة حتى REVIEW_DISTANCE_M؛ المشتبه الحقيقي هو من يتجاوز العتبة المحددة
    const threshold = sess?.radius_meters ?? REVIEW_DISTANCE_M;
    return dist > threshold;
  };

  const filteredAttendances = attendances.filter(a => {
    const sId = a.student_id || a.studentId;
    const sessId = a.session_id || a.sessionId;
    const student = students.find(s => s.id === sId);
    const cId = student?.cohort_id || student?.cohortId;
    if (selectedSession !== 'all' && sessId !== selectedSession) return false;
    if (selectedCohort !== 'all' && cId !== selectedCohort) return false;
    if (distanceFilter === 'suspicious' && !isSuspicious(a)) return false;
    return true;
  });

  const suspiciousCount = useMemo(
    () => attendances.filter(a => {
      const sId = a.student_id || a.studentId;
      const sessId = a.session_id || a.sessionId;
      const student = students.find(s => s.id === sId);
      const cId = student?.cohort_id || student?.cohortId;
      if (selectedSession !== 'all' && sessId !== selectedSession) return false;
      if (selectedCohort !== 'all' && cId !== selectedCohort) return false;
      return isSuspicious(a);
    }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attendances, sessions, selectedSession, selectedCohort, students]
  );

  const handleBulkDeleteSuspicious = async () => {
    const ids = attendances
      .filter(a => {
        const sId = a.student_id || a.studentId;
        const sessId = a.session_id || a.sessionId;
        const student = students.find(s => s.id === sId);
        const cId = student?.cohort_id || student?.cohortId;
        if (selectedSession !== 'all' && sessId !== selectedSession) return false;
        if (selectedCohort !== 'all' && cId !== selectedCohort) return false;
        return isSuspicious(a);
      })
      .map(a => a.id);

    if (ids.length === 0) return;

    if (!confirm(`هل تريد حذف ${ids.length} سجل حضور مشتبه به (طلاب خارج النطاق)؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    try {
      setBulkDeleting(true);
      const { error } = await supabase.from('attendances').delete().in('id', ids);
      if (error) throw error;
      toast.success(`تم حذف ${ids.length} سجل بنجاح`);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('تعذر حذف السجلات');
    } finally {
      setBulkDeleting(false);
    }
  };

  if (loading && attendances.length === 0) return <Card><CardContent className="p-12 text-center animate-pulse text-indigo-500 font-medium font-mono">جاري استخراج السجلات...</CardContent></Card>;

  return (
    <TooltipProvider delayDuration={120}>
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 rounded-xl">
             <History className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-slate-500 text-sm">{description}</p>
          </div>
        </div>

        {!readOnly && (
        <div className="flex items-center gap-2">
           <Button variant="outline" className="h-11 border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 gap-2 px-6 rounded-xl shadow-sm" onClick={() => exportAttendanceToExcel({ attendance: filteredAttendances, students, sessions, cohorts })} disabled={filteredAttendances.length === 0}>
              <FileSpreadsheet className="h-4 w-4" /> تصدير Excel
           </Button>
           <Button variant="outline" className="h-11 border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-100 gap-2 px-6 rounded-xl shadow-sm" onClick={() => exportAttendanceToPDF({ attendance: filteredAttendances, students, sessions, cohorts })} disabled={filteredAttendances.length === 0}>
              <Download className="h-4 w-4" /> تصدير PDF
           </Button>
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
         <div className="col-span-1 md:col-span-2 space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">تصفية حسب الجلسة</label>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
               <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-200"><SelectValue placeholder="إختر الجلسة" /></SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">📅 جميع الجلسات</SelectItem>
                  {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
               </SelectContent>
            </Select>
         </div>
         <div className="col-span-1 md:col-span-1 space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">تصفية حسب الفوج</label>
            <Select value={selectedCohort} onValueChange={setSelectedCohort}>
               <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-200"><SelectValue placeholder="إختر الفوج" /></SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">👥 جميع الأفواج</SelectItem>
                  {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
               </SelectContent>
            </Select>
         </div>
         <div className="flex items-end flex-1">
            <Button variant="ghost" className="h-11 w-full text-slate-400 hover:text-indigo-600 gap-2" onClick={() => { setSelectedCohort('all'); setSelectedSession('all'); setDistanceFilter('all'); }}>
               <FilterX className="h-4 w-4" /> إعادة تعيين
            </Button>
         </div>
      </div>

      {/* شريط تنبيه الحضور المشتبه به (خارج النطاق) */}
      {suspiciousCount > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border-2 border-rose-200/50 rounded-3xl p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">{suspiciousCount} حضور مشتبه به</h3>
              <p className="text-[12px] text-slate-600 mt-0.5">
                طلاب سجّلوا الحضور لكنهم بعيدون عن نقطة الجلسة. راجعهم يدوياً أو احذفهم جماعياً.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={distanceFilter === 'suspicious' ? 'default' : 'outline'}
              className={`h-10 gap-2 rounded-xl font-bold ${
                distanceFilter === 'suspicious'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'border-rose-200 text-rose-700 bg-white hover:bg-rose-50'
              }`}
              onClick={() => setDistanceFilter(distanceFilter === 'suspicious' ? 'all' : 'suspicious')}
            >
              {distanceFilter === 'suspicious' ? '✓ يُعرض المشتبه به فقط' : 'عرض المشتبه به فقط'}
            </Button>
            {!readOnly && (
              <Button
                variant="destructive"
                className="h-10 gap-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-700"
                onClick={handleBulkDeleteSuspicious}
                disabled={bulkDeleting}
              >
                <Trash2 className="h-4 w-4" />
                {bulkDeleting ? 'جاري الحذف...' : `حذف الكل (${suspiciousCount})`}
              </Button>
            )}
          </div>
        </div>
      )}

      <Card className="border-slate-100 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-5 text-right font-black text-slate-600 uppercase text-[11px] tracking-wider">الطالب</TableHead>
                  <TableHead className="py-5 text-right font-black text-slate-600 uppercase text-[11px] tracking-wider">الجلسة والفوج</TableHead>
                  <TableHead className="py-5 text-right font-black text-slate-600 uppercase text-[11px] tracking-wider">التوقيت</TableHead>
                  <TableHead className="py-5 text-right font-black text-slate-600 uppercase text-[11px] tracking-wider">بصمة الجهاز</TableHead>
                  <TableHead className="py-5 text-center font-black text-slate-600 uppercase text-[11px] tracking-wider">المسافة</TableHead>
                  <TableHead className="py-5 text-center font-black text-slate-600 uppercase text-[11px] tracking-wider">الحالة</TableHead>
                  {/* v3.0 Source column */}
                  <TableHead className="py-5 text-center font-black text-slate-600 uppercase text-[11px] tracking-wider">المصدر</TableHead>
                  {!readOnly && (
                    <TableHead className="py-5 text-left font-black text-slate-600 uppercase text-[11px] tracking-wider">إجراءات</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttendances.length > 0 ? (
                  filteredAttendances.map((a) => {
                    const sId = a.student_id || a.studentId;
                    const sessId = a.session_id || a.sessionId;
                    const student = students.find(s => s.id === sId);
                    const session = sessions.find(s => s.id === sessId);
                    const cohort = cohorts.find(c => c.id === (student?.cohort_id || student?.cohortId));
                    const date = new Date(a.timestamp);

                    return (
                      <TableRow key={a.id} className="group hover:bg-emerald-50/30 transition-colors border-b border-slate-50 last:border-0">
                        <TableCell className="py-4">
                           <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-black group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                                 {(student?.firstName || student?.first_name)?.charAt(0) || (student?.lastName || student?.last_name)?.charAt(0) || 'S'}
                              </div>
                              <div className="flex flex-col">
                                 <span className="font-bold text-slate-800">{(student?.firstName || student?.first_name) || 'طالب مجهول'} {(student?.lastName || student?.last_name) || ''}</span>
                                 <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 rounded self-start mt-0.5 border border-slate-100">{student?.student_number || student?.studentNumber}</span>
                              </div>
                           </div>
                        </TableCell>
                        <TableCell className="py-4">
                           <div className="flex flex-col gap-1">
                              <span className="text-sm font-bold text-slate-700">{session?.title}</span>
                              <div className="flex items-center gap-1.5 opacity-60">
                                 <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-black border-slate-200 text-slate-500 uppercase">{cohort?.name}</Badge>
                                 <ChevronRight className="h-3 w-3" />
                                 <span className="text-[11px] truncate max-w-[200px] font-medium">{cohort?.field}</span>
                              </div>
                           </div>
                        </TableCell>
                        <TableCell className="py-4">
                           <div className="flex flex-col text-right">
                              <span className="text-sm font-bold text-slate-700">{date.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {date.toLocaleDateString('ar-DZ')}</span>
                           </div>
                        </TableCell>
                        <TableCell className="py-4">
                           {(() => {
                              const fp = a.device_fingerprint || a.deviceFingerprint || deviceFingerprints[sId || ''] || '';
                              if (!fp) {
                                 return (
                                    <div className="flex items-center gap-2 text-slate-300">
                                       <Fingerprint className="h-4 w-4" />
                                       <span className="text-[11px] font-mono">غير متاحة</span>
                                    </div>
                                 );
                              }
                              const fpShort = `${fp.slice(0, 12)}…`;
                              return (
                                 <Tooltip>
                                    <TooltipTrigger asChild>
                                       <button
                                          type="button"
                                          onClick={() => copyFingerprint(fp, a.id)}
                                          className="flex items-center gap-2 group/fp"
                                       >
                                          <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 group-hover/fp:bg-indigo-100 transition-colors">
                                             {copiedId === a.id ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                             ) : (
                                                <Fingerprint className="h-3.5 w-3.5" />
                                             )}
                                          </div>
                                          <div className="flex flex-col items-start">
                                             <code dir="ltr" className="text-[11px] font-mono text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100/50">
                                                {fpShort}
                                             </code>
                                             <span className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1 opacity-0 group-hover/fp:opacity-100 transition-opacity">
                                                <Copy className="h-2.5 w-2.5" /> انقر للنسخ
                                             </span>
                                          </div>
                                       </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-[320px]">
                                       <div className="space-y-1">
                                          <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">بصمة الجهاز الكاملة</div>
                                          <div dir="ltr" className="font-mono text-[11px] break-all">{fp}</div>
                                       </div>
                                    </TooltipContent>
                                 </Tooltip>
                              );
                           })()}
                        </TableCell>
                        <TableCell className="py-4 text-center">
                           {(() => {
                              const sessId = a.session_id || a.sessionId;
                              const sess = sessions.find(s => s.id === sessId);
                              const sessionRadius = (sess?.radius_meters ?? null) as number | null;
                              const dist = a.distance_meters;
                              if (dist === null || dist === undefined) {
                                return (
                                  <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-400 px-2.5 py-1 rounded-full border border-slate-100">
                                    <MapPin className="h-3 w-3" />
                                    <span className="text-[10px] font-bold">—</span>
                                  </div>
                                );
                              }
                              // v4.6.0 — ثلاث مناطق: مؤكد (أخضر) / محتمل (برتقالي) / مشتبه (أحمر)
                              const reviewRadius = sessionRadius ?? REVIEW_DISTANCE_M;
                              const isOutOfRange = dist > reviewRadius;
                              const isLikely = !isOutOfRange && dist > CONFIRMED_DISTANCE_M;
                              const display = dist >= 1000 ? `${(dist / 1000).toFixed(1)} كم` : `${dist} م`;
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                                      isOutOfRange
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : isLikely
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                      <MapPin className="h-3 w-3" />
                                      <span className="text-[10px] font-black tracking-wider">{display}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">
                                    <div className="text-[11px]">
                                      <div className="font-bold">المسافة من نقطة الجلسة</div>
                                      <div>{dist} متر</div>
                                      {dist <= CONFIRMED_DISTANCE_M
                                        ? 'تأكيد GPS قوي — الطالب داخل القاعة ✓'
                                        : isLikely
                                          ? 'داخل المبنى غالباً — GPS داخل المباني أقل دقة'
                                          : `يتجاوز عتبة المراجعة ${reviewRadius}م — يُنصح بالتحقق`}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                           })()}
                        </TableCell>
                        {/* v3.0 — Status cell (present/absent/late) */}
                        <TableCell className="py-4 text-center">
                           <div className="flex justify-center">
                             {(() => {
                               const status = a.attendance_status;
                               if (status === 'absent') {
                                 return (
                                   <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-3 py-1.5 rounded-2xl border border-rose-100">
                                     <span className="text-[11px] font-black uppercase tracking-wider">غائب</span>
                                   </div>
                                 );
                               }
                               if (status === 'late') {
                                 return (
                                   <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-2xl border border-amber-100">
                                     <span className="text-[11px] font-black uppercase tracking-wider">متأخر</span>
                                   </div>
                                 );
                               }
                               // default: present (or legacy null)
                               return (
                                 <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-100">
                                   <UserCheck className="h-3.5 w-3.5" />
                                   <span className="text-[11px] font-black uppercase tracking-wider">حاضر</span>
                                 </div>
                               );
                             })()}
                           </div>
                        </TableCell>
                        {/* v3.0 — Source cell */}
                        <TableCell className="py-4 text-center">
                           {(() => {
                             const src = a.attendance_source;
                             if (src === 'roll_call') {
                               return (
                                 <Badge className="rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-200 text-[10px] font-black">
                                   📋 منادات
                                 </Badge>
                               );
                             }
                             if (src === 'teacher_validation') {
                               return (
                                 <Badge className="rounded-full bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-200 text-[10px] font-black">
                                   ✅ تحقق الأستاذ
                                 </Badge>
                               );
                             }
                             // default: qr or legacy null
                             return (
                               <Badge className="rounded-full bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-black">
                                 📲 QR
                               </Badge>
                             );
                           })()}
                        </TableCell>
                        {!readOnly && (
                          <TableCell className="py-4 text-left">
                             <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" onClick={async () => { if(confirm('حذف هذا السجل؟')) { await supabase.from('attendances').delete().eq('id', a.id); await loadData(); } }}>
                                <Trash2 className="h-4 w-4" />
                             </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={readOnly ? 7 : 8} className="py-32 text-center">
                       <div className="flex flex-col items-center gap-4 opacity-30 group">
                          <Archive className="h-20 w-20 text-slate-200 group-hover:scale-110 transition-transform duration-500" />
                          <div>
                             <p className="text-xl font-black text-slate-400 uppercase tracking-tighter">لا توجد سجلات حضور</p>
                             <p className="text-sm text-slate-300">لم يتم تسجيل أي حضور وفقاً لمعايير البحث الحالية</p>
                          </div>
                       </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl shadow-slate-900/10 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group">
         <div className="absolute right-0 top-0 h-64 w-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
         <div className="flex items-center gap-4 relative z-10">
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center">
               <FileText className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
               <h3 className="text-xl font-bold tracking-tight">إجمالي السجلات المستخرجة</h3>
               <p className="text-white/50 text-sm">يتم تحديث هذه البيانات لحظياً وفقاً للفلاتر النشطة</p>
            </div>
         </div>
         <div className="text-6xl font-black tracking-tighter text-emerald-500 relative z-10 group-hover:scale-110 transition-transform duration-500">
            {filteredAttendances.length}
         </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
