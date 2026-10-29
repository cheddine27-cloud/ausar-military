import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Plus, QrCode, X, AlertCircle, Trash2, Calendar, Clock, MonitorPlay, ChevronRight, UserCheck, ShieldCheck, RefreshCcw, MapPin, Navigation, ListChecks, Layers } from 'lucide-react';
import { getAllSessions, getAllCohorts, createSession, closeSession, getFaculties, getDepartments, getSpecialties } from '@/lib/database';
import { useInstitutionUI } from '@/config/institutions';
import { supabase } from '@/lib/supabase';
import { generateDynamicQR, encodeQRData } from '@/lib/qrGenerator';
import { updateSessionAttendanceMode } from '@/lib/smartAttendanceApi';
import type { Session, Cohort, Faculty, Department, Specialty, AttendanceMode } from '@/lib/types';
import { QRCode } from 'react-qr-code';
import { isPrimaryOrMiddle } from '@/lib/schoolHelpers';
import SmartRollCallDialog from './SmartRollCallDialog';
import HybridAttendanceDialog from './HybridAttendanceDialog';

interface SessionsTabProps {
  adminId: string;
  canCreate?: boolean;
  canManage?: boolean;
}

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

export default function SessionsTab({ adminId, canCreate = true, canManage = true }: SessionsTabProps) {
  const ui = useInstitutionUI();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [dbFaculties, setDbFaculties] = useState<Faculty[]>([]);
  const [dbDepartments, setDbDepartments] = useState<Department[]>([]);
  const [dbSpecialties, setDbSpecialties] = useState<Specialty[]>([]);
  const [dbSubjects, setDbSubjects] = useState<Array<{ id: string, name: string }>>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [qrData, setQrData] = useState<string>('');
  
  const [formData, setFormData] = useState({
    facultyId: '',
    departmentId: '',
    specialtyId: '',
    cohortId: '',
    title: '',
    sessionType: '',
    attendanceMode: 'qr' as AttendanceMode,
    lat: '',
    lng: '',
    radius: '150',
    subject: '',
  });

  const [isLocating, setIsLocating] = useState(false);

  // Smart Attendance dialogs
  const [smartRollCallSession, setSmartRollCallSession] = useState<Session | null>(null);
  const [hybridSession, setHybridSession] = useState<Session | null>(null);
  const [adminInstitutionId, setAdminInstitutionId] = useState<string>('');
  const [institutionType, setInstitutionType] = useState<string>('military');
  const [institutionName, setInstitutionName] = useState<string>('');
  const [allowedModes, setAllowedModes] = useState<string[]>(['qr', 'roll_call', 'hybrid']);

  // Load institution id once
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from('admins')
          .select('institution_id')
          .eq('auth_user_id', data.user.id)
          .single()
          .then(async ({ data: ad }) => {
            if (ad?.institution_id) {
              setAdminInstitutionId(ad.institution_id as string);
              const { data: inst } = await supabase
                .from('institutions')
                .select('type, name')
                .eq('id', ad.institution_id)
                .single();
              if (inst?.type) setInstitutionType(inst.type);
              if (inst?.name) setInstitutionName(inst.name);

              // Fetch subjects
              supabase
                .from('institution_units')
                .select('id, name')
                .eq('institution_id', ad.institution_id)
                .eq('type', 'subject')
                .eq('status', 'active')
                .then(({ data: subs }) => {
                  if (subs) setDbSubjects(subs);
                });
            }
          });
      }
    });
  }, []);

  // Fetch allowed modes based on institution/unit hierarchy
  useEffect(() => {
    if (!adminInstitutionId) return;

    (async () => {
      try {
        let modes: string[] | null = null;

        // 1. Check department if selected
        if (formData.departmentId) {
          const { data } = await supabase
            .from('institution_units')
            .select('allowed_modes')
            .eq('id', formData.departmentId)
            .maybeSingle();
          if (data?.allowed_modes) {
            modes = data.allowed_modes;
          }
        }

        // 2. Check faculty if selected and no department setting
        if (!modes && formData.facultyId) {
          const { data } = await supabase
            .from('institution_units')
            .select('allowed_modes')
            .eq('id', formData.facultyId)
            .maybeSingle();
          if (data?.allowed_modes) {
            modes = data.allowed_modes;
          }
        }

        // 3. Fall back to institution settings
        if (!modes) {
          const { data } = await supabase
            .from('institutions')
            .select('settings_allowed_modes')
            .eq('id', adminInstitutionId)
            .maybeSingle();
          if (data?.settings_allowed_modes) {
            modes = data.settings_allowed_modes;
          }
        }

        const resolved = modes ?? ['qr', 'roll_call', 'hybrid'];
        setAllowedModes(resolved);

        // Ensure current selected mode is allowed, otherwise default to first allowed
        if (!resolved.includes(formData.attendanceMode)) {
          setFormData((prev) => ({
            ...prev,
            attendanceMode: resolved[0] as AttendanceMode,
          }));
        }
      } catch (err) {
        console.error('Failed to load allowed attendance modes:', err);
      }
    })();
  }, [adminInstitutionId, formData.facultyId, formData.departmentId]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => { sessionRef.current = selectedSession; }, [selectedSession]);

  const updateQR = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('sessions').update({ code: newCode }).eq('id', s.id);
    if (!error) {
      const updated = { ...s, code: newCode };
      sessionRef.current = updated;
      setSelectedSession(updated);
      setQrData(encodeQRData(generateDynamicQR(updated)));
    }
  }, []);

  const updateAttendanceCount = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    const { data: att } = await supabase.from('attendances').select('id').eq('session_id', s.id);
    const { data: std } = await supabase.from('students').select('id').eq('cohort_id', s.cohortId || s.cohort_id);
    setAttendanceCount(att?.length || 0);
    setTotalStudents(std?.length || 0);
  }, []);

  useEffect(() => {
    if (!isQRDialogOpen) return;
    updateQR(); updateAttendanceCount(); setCountdown(60);
    const qrv = setInterval(() => { updateQR(); setCountdown(60); }, 60000);
    const cdv = setInterval(() => setCountdown(p => (p <= 1 ? 60 : p - 1)), 1000);
    const acv = setInterval(() => updateAttendanceCount(), 5000);
    return () => { clearInterval(qrv); clearInterval(cdv); clearInterval(acv); };
  }, [isQRDialogOpen, updateQR, updateAttendanceCount]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sess, coh, facs, depts, specs] = await Promise.all([
        getAllSessions(), getAllCohorts(), getFaculties(), getDepartments(), getSpecialties()
      ]);
      setSessions(sess.sort((a,b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime()));
      setCohorts(coh); setDbFaculties(facs); setDbDepartments(depts); setDbSpecialties(specs);
    } finally { setLoading(false); }
  };

  const handleGetLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({ ...prev, lat: pos.coords.latitude.toString(), lng: pos.coords.longitude.toString() }));
        setIsLocating(false);
      },
      (err) => {
        setError('تعذر جلب الموقع: ' + err.message);
        setIsLocating(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) {
      setError('ليست لديك صلاحية إنشاء جلسة');
      return;
    }
    if (!formData.cohortId || !formData.title.trim()) return setError('يرجى ملء الحقول المطلوبة');
    try {
      const location = formData.lat && formData.lng ? {
        lat: parseFloat(formData.lat),
        lng: parseFloat(formData.lng),
        radius: parseInt(formData.radius) || 150
      } : undefined;

      await createSession(formData.cohortId, formData.title, adminId, location, formData.subject);

      // Set attendance mode on newly created session
      const latestSessions = await getAllSessions();
      const newest = latestSessions
        .filter((s) => (s.created_by === adminId || s.professor_id === adminId) && s.cohort_id === formData.cohortId)
        .sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime())[0];
      if (newest && formData.attendanceMode !== 'qr') {
        await updateSessionAttendanceMode(newest.id, formData.attendanceMode);
      }

      setIsDialogOpen(false);
      setFormData({ facultyId: '', departmentId: '', specialtyId: '', cohortId: '', title: '', sessionType: '', attendanceMode: 'qr', lat: '', lng: '', radius: '150', subject: '' });
      setError('');
      await loadData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'خطأ في إنشاء الجلسة'));
    }
  };

  const selectedFacultyName = dbFaculties.find(f => f.id === formData.facultyId)?.name || '';
  const selectedDeptName = dbDepartments.find(d => d.id === formData.departmentId)?.name || '';
  const hideSpecialty = isPrimaryOrMiddle(institutionName) || isPrimaryOrMiddle(null, selectedFacultyName) || isPrimaryOrMiddle(null, selectedDeptName);

  const showFacultySelect = ui.layout.faculty;
  const showDepartmentSelect = ui.layout.department;
  const showSpecialtySelect = !hideSpecialty && (ui.layout.specialty || dbSpecialties.length > 0);

  if (loading && sessions.length === 0) return <Card><CardContent className="p-12 text-center animate-pulse text-indigo-500 font-medium">جاري فحص حالة الجلسات...</CardContent></Card>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
             <MonitorPlay className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة الجلسات</h1>
            <p className="text-slate-500 text-sm">متابعة الحضور المباشر وتوليد رموز الاستجابة السريعة</p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {canCreate && (
          <DialogTrigger asChild>
              <Button className="h-11 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 gap-2">
                <Plus className="h-5 w-5" /> بدء جلسة جديدة
              </Button>
          </DialogTrigger>
          )}
          <DialogContent className="max-h-[90vh] w-[min(95vw,650px)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إنشاء جلسة حضور مباشرة</DialogTitle>
              <DialogDescription>سيتم توليد كود QR يتجدد تلقائياً لتأمين الحضور.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 pt-4">
               {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
               
               <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">تحديد {ui.dictionary.cohort}</h4>
                  <div className={`grid gap-3 ${
                      [showFacultySelect, showDepartmentSelect, showSpecialtySelect].filter(Boolean).length + 1 > 2 
                        ? 'grid-cols-1 sm:grid-cols-2' 
                        : 'grid-cols-1 md:grid-cols-2'
                   }`}>
                      {showFacultySelect && (
                          <select className="flex h-10 text-sm border-slate-200 rounded-xl px-3 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.facultyId} onChange={(e) => setFormData({...formData, facultyId: e.target.value, departmentId: '', specialtyId: '', cohortId: ''})}>
                             <option value="">إختر {ui.dictionary.faculty}</option>
                             {dbFaculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                      )}
                      {showDepartmentSelect && (
                          <select className="flex h-10 text-sm border-slate-200 rounded-xl px-3 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" value={formData.departmentId} disabled={showFacultySelect && !formData.facultyId} onChange={(e) => setFormData({...formData, departmentId: e.target.value, specialtyId: '', cohortId: ''})}>
                             <option value="">إختر {ui.dictionary.department}</option>
                             {dbDepartments.filter(d => !formData.facultyId || d.faculty_id === formData.facultyId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                      )}
                      {showSpecialtySelect && (
                          <select className="flex h-10 text-sm border-slate-200 rounded-xl px-3 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" value={formData.specialtyId} disabled={showDepartmentSelect && !formData.departmentId} onChange={(e) => setFormData({...formData, specialtyId: e.target.value, cohortId: ''})}>
                             <option value="">إختر {ui.dictionary.specialty}</option>
                             {dbSpecialties.filter(s => !formData.departmentId || s.department_id === formData.departmentId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                      )}
                      <select className="flex h-10 text-sm border-2 border-indigo-300 rounded-xl px-3 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900" value={formData.cohortId} onChange={(e) => setFormData({...formData, cohortId: e.target.value})}>
                         <option value="">-- {ui.dictionary.cohort} * --</option>
                         {cohorts.filter(c => (!formData.facultyId || dbFaculties.find(f => f.id === formData.facultyId)?.name === c.field) && (!formData.departmentId || dbDepartments.find(d => d.id === formData.departmentId)?.name === c.subject) && (!formData.specialtyId || dbSpecialties.find(s => s.id === formData.specialtyId)?.name === c.specialty)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                  </div>
               </div>

               <div className="space-y-4">
                  {(institutionType === 'school' || institutionType === 'primary_school' || institutionType === 'secondary_school') && dbSubjects.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-bold">المادة *</Label>
                      <select 
                        className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold" 
                        value={formData.subject} 
                        onChange={(e) => setFormData({...formData, subject: e.target.value, title: e.target.value})}
                      >
                        <option value="">-- اختر المادة --</option>
                        {dbSubjects.map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-bold">عنوان الجلسة (الموضوع) *</Label>
                    <Input className="h-12 text-lg border-slate-200 focus:border-indigo-500 font-bold" placeholder="مثال: رياضيات - هندسة مستوية" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-bold">نوع الجلسة</Label>
                    <Select value={formData.sessionType} onValueChange={(v) => setFormData({...formData, sessionType: v})}>
                      <SelectTrigger className="h-12 border-slate-200"><SelectValue placeholder={ui.sessionTypes.map(t => t.label_ar).join(' / ')} /></SelectTrigger>
                       <SelectContent>
                         {ui.sessionTypes.map((t) => (
                           <SelectItem key={t.id} value={t.id}>{t.icon} {t.label_ar}</SelectItem>
                         ))}
                       </SelectContent>
                    </Select>
                  </div>
                  {/* v3.0 — Attendance Method */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-bold flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-indigo-600" />
                      طريقة تسجيل الحضور
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { value: 'qr', label: '📲 QR Attendance', desc: 'الطلاب يمسحون QR' },
                        { value: 'roll_call', label: '📋 المنادات الذكية', desc: 'مناداة واحد بواحد' },
                        { value: 'hybrid', label: '⚡ هجين', desc: 'QR ثم مناداة' },
                      ].filter((m) => allowedModes.includes(m.value)).map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, attendanceMode: mode.value as AttendanceMode })}
                          className={`rounded-xl border-2 p-3 text-right transition-all ${
                            formData.attendanceMode === mode.value
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-800 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <p className="text-xs font-black">{mode.label}</p>
                          <p className="mt-1 text-[10px] opacity-70">{mode.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
               </div>

                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                   <div className="flex items-center justify-between">
                      <Label className="text-indigo-900 font-bold flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> الموقع الجغرافي للقاعة (اختياري) 📍
                      </Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={isLocating} className="h-8 text-[10px] gap-1.5 border-indigo-200 text-indigo-700 bg-white">
                        {isLocating ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
                        جلب موقعي الحالي
                      </Button>
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 pr-1">خط العرض</Label>
                        <Input value={formData.lat} onChange={(e) => setFormData({...formData, lat: e.target.value})} placeholder="0.000" className="h-9 text-xs bg-white" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 pr-1">خط الطول</Label>
                        <Input value={formData.lng} onChange={(e) => setFormData({...formData, lng: e.target.value})} placeholder="0.000" className="h-9 text-xs bg-white" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 pr-1">عتبة المراجعة (م)</Label>
                        <Input type="number" value={formData.radius} onChange={(e) => setFormData({...formData, radius: e.target.value})} placeholder="150" className="h-9 text-xs bg-white" />
                      </div>
                   </div>
                   <p className="text-[10px] text-slate-500 leading-relaxed">
                      ℹ️ <strong>وضع إرشادي:</strong> الحضور لن يُرفض بسبب البُعد. ستظهر مسافة كل طالب في تبويب "الحضور" مع تنبيه لمن تجاوز العتبة لتراجعه يدوياً. ننصح بـ<strong>150م على الأقل</strong> لأن GPS داخل المباني في الجزائر ينحرف عادةً 30-100م.
                   </p>
                </div>

               <Button type="submit" className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100" disabled={!formData.cohortId || !formData.title.trim()}>بدء البث المباشر (بدء الجلسة)</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
             <div className="flex flex-col items-center gap-3 opacity-30">
                <Calendar className="h-16 w-16" />
                <p className="text-xl font-medium">لا توجد جلسات مسجلة حالياً</p>
             </div>
          </div>
        ) : (
          sessions.map((s) => {
             const c = cohorts.find(ch => ch.id === (s.cohortId || s.cohort_id));
             const active = s.status === 'active';
             return (
               <Card key={s.id} className={`group border-none shadow-sm hover:shadow-md transition-all rounded-3xl overflow-hidden ${active ? 'ring-2 ring-indigo-500/10' : 'opacity-80'}`}>
                 <CardHeader className={`pb-4 ${active ? 'bg-indigo-50/50' : 'bg-slate-50'}`}>
                    <div className="flex justify-between items-start">
                       <Badge className={`rounded-lg px-2.5 py-1 ${active ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200' : 'bg-slate-200 text-slate-600'}`}>
                          {active ? '🟢 نشطة الآن' : '⚪ مغلقة'}
                       </Badge>
                       <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-100">{s.code}</span>
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-800 pt-3 line-clamp-1">{s.title}</CardTitle>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                       <span className="bg-white px-2 py-0.5 rounded border border-slate-100">{c?.name || 'فوج غير معروف'}</span>
                       <ChevronRight className="h-3 w-3 opacity-30" />
                       <span className="truncate">{c?.field}</span>
                    </div>
                 </CardHeader>
                 <CardContent className="pt-4 space-y-4">
                    {/* v3.0 — Attendance mode badge */}
                    {s.attendance_mode && s.attendance_mode !== 'qr' && (
                      <div className="mb-1">
                        <Badge variant="outline" className={`rounded-full text-[10px] font-bold ${
                          s.attendance_mode === 'hybrid'
                            ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300'
                            : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                        }`}>
                          {s.attendance_mode === 'hybrid' ? '⚡ هجين' : '📋 منادات'}
                        </Badge>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                       {/* QR button — always available */}
                       {(s.attendance_mode === 'qr' || !s.attendance_mode) && (
                         <Button variant={active ? 'default' : 'secondary'} className={`flex-1 rounded-xl h-10 ${active ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`} onClick={() => { setSelectedSession(s); setIsQRDialogOpen(true); }}>
                           <QrCode className="ml-2 h-4 w-4" /> عرض الـ QR
                         </Button>
                       )}
                       {/* Smart Roll Call button */}
                       {s.attendance_mode === 'roll_call' && active && adminInstitutionId && (
                         <Button
                           className="flex-1 rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white"
                           onClick={() => setSmartRollCallSession(s)}
                         >
                           <ListChecks className="ml-2 h-4 w-4" /> بدء المنادات
                         </Button>
                       )}
                       {/* Hybrid button */}
                       {s.attendance_mode === 'hybrid' && active && adminInstitutionId && (
                         <Button
                           className="flex-1 rounded-xl h-10 bg-violet-600 hover:bg-violet-700 text-white"
                           onClick={() => setHybridSession(s)}
                         >
                           <Layers className="ml-2 h-4 w-4" /> هجين
                         </Button>
                       )}
                       {/* QR also available as secondary for roll_call/hybrid */}
                       {s.attendance_mode && s.attendance_mode !== 'qr' && (
                         <Button variant="outline" className="w-10 h-10 p-0 rounded-xl" title="عرض QR" onClick={() => { setSelectedSession(s); setIsQRDialogOpen(true); }}>
                           <QrCode className="h-4 w-4" />
                         </Button>
                       )}
                       {canManage && active ? (
                         <Button variant="outline" className="w-10 h-10 p-0 rounded-xl border-rose-100 text-rose-600 hover:bg-rose-50" onClick={async () => { if(confirm('إغلاق الجلسة؟')) { await closeSession(s.id); await loadData(); } }}>
                           <X className="h-4 w-4" />
                         </Button>
                       ) : canManage ? (
                         <Button variant="ghost" className="w-10 h-10 p-0 rounded-xl text-slate-300 hover:text-red-500" onClick={async () => { if(confirm('حذف نهائي؟')) { await supabase.from('sessions').delete().eq('id', s.id); await loadData(); } }}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       ) : null}
                    </div>
                 </CardContent>
               </Card>
             );
          })
        )}
      </div>

      <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
        <DialogContent className="max-h-[95vh] w-[min(95vw,700px)] overflow-y-auto border-none p-0 bg-white shadow-2xl">
           <DialogHeader className="p-8 pb-4 text-center">
             <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">نظام الحضور المباشر</DialogTitle>
             <DialogDescription className="text-slate-500 text-sm font-medium">يرجى توجيه كاميرا تطبيق الطالب نحو الرمز التالي</DialogDescription>
           </DialogHeader>
           {selectedSession && qrData && (
             <div className="animate-in fade-in zoom-in-95 duration-500">

               <div className="px-6 pb-6 flex flex-col items-center">
                 <div className="bg-slate-50 rounded-[32px] shadow-inner border-[6px] border-white p-4 sm:p-6 relative group">
                   <QRCode value={qrData} size={220} className="h-auto w-full max-w-[220px]" fgColor="#0f172a" />
                   <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <ShieldCheck className="h-16 w-16 text-indigo-500/20" />
                   </div>
                 </div>

                 <div className="mt-6 w-full max-w-sm grid grid-cols-2 gap-3">
                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">عدد الحاضرين</p>
                       <div className="flex items-center justify-center gap-1 font-black">
                          <span className="text-3xl text-emerald-600">{attendanceCount}</span>
                          <span className="text-xl text-slate-200">/</span>
                          <span className="text-xl text-slate-400">{totalStudents}</span>
                       </div>
                    </div>
                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 text-center relative overflow-hidden">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الرمز السري</p>
                       <span className="text-2xl font-mono font-black text-indigo-900 tracking-widest">{selectedSession.code}</span>
                       <div className="absolute bottom-0 left-0 h-1.5 bg-indigo-500 transition-all duration-1000" style={{ width: `${(countdown/60)*100}%` }} />
                    </div>
                 </div>

                 <div className="mt-6 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-6 py-2 rounded-full border border-indigo-100 shadow-inner">
                       <RefreshCcw className={`h-4 w-4 ${countdown < 5 ? 'animate-spin' : ''}`} />
                       <span className="text-sm font-black font-mono">تحديث تلقائي خلال: {countdown < 10 ? `0${countdown}` : countdown} ثانية</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">🔒 أمان الجلسة: مفعل بالـ QR الديناميكي</p>
                 </div>
               </div>
               
               <div className="bg-gradient-to-r from-indigo-600 to-blue-700 p-4 text-center">
                  <p className="text-white/90 text-xs font-bold font-mono tracking-widest">{selectedSession.title} - {cohorts.find(c => c.id === (selectedSession.cohortId || selectedSession.cohort_id))?.name}</p>
               </div>
             </div>
           )}
        </DialogContent>
      </Dialog>

      {/* v3.0 — Smart Roll Call Dialog */}
      {smartRollCallSession && adminInstitutionId && (
        <SmartRollCallDialog
          open={!!smartRollCallSession}
          onOpenChange={(v) => { if (!v) setSmartRollCallSession(null); }}
          sessionId={smartRollCallSession.id}
          cohortId={smartRollCallSession.cohort_id ?? smartRollCallSession.cohortId ?? ''}
          institutionId={adminInstitutionId}
          cohortName={cohorts.find((c) => c.id === (smartRollCallSession.cohort_id ?? smartRollCallSession.cohortId))?.name}
          onComplete={() => { setSmartRollCallSession(null); void loadData(); }}
        />
      )}

      {/* v3.0 — Hybrid Attendance Dialog */}
      {hybridSession && adminInstitutionId && (
        <HybridAttendanceDialog
          open={!!hybridSession}
          onOpenChange={(v) => { if (!v) setHybridSession(null); }}
          session={hybridSession}
          institutionId={adminInstitutionId}
          cohortName={cohorts.find((c) => c.id === (hybridSession.cohort_id ?? hybridSession.cohortId))?.name}
          onSessionClose={() => { setHybridSession(null); void loadData(); }}
        />
      )}
    </div>
  );
}
