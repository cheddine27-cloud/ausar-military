// =============================================================================
// Phase 11 — Devices & Security view
// =============================================================================
// Read student_devices joined with students. Allow institution managers to
// deactivate a device (so the student can register a new phone). Suspicious
// attempts are NOT shown as fake data — there is no security_events table
// today, so the panel says "غير متوفر حالياً" explicitly.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Search,
  Smartphone,
  Loader2,
  AlertCircle,
  PowerOff,
  CheckCircle2,
  Users,
  ChevronLeft,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  getInstitutionDevices,
  deactivateStudentDevice,
  getInstitutionStudents,
  getInstitutionCohorts,
  type InstitutionDeviceRow,
  type InstitutionStudentRow,
} from '@/lib/institutionAdminApi';
import { PERMISSIONS, can, type PermissionMap } from '@/lib/permissions';
import { getSectorLabels, type SectorType } from '@/lib/sectorLabels';

interface Props {
  institutionId: string;
  institutionName: string;
  institutionType?: SectorType;
  permissions?: PermissionMap | null;
}

const PAGE_SIZE = 20;

export default function InstitutionDevicesView({ institutionId, institutionType, permissions }: Props) {
  const labels = getSectorLabels(institutionType);
  const canManageDevices = can(permissions, PERMISSIONS.devicesManage);

  const [devices, setDevices] = useState<InstitutionDeviceRow[]>([]);
  const [students, setStudents] = useState<InstitutionStudentRow[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  const [confirmTarget, setConfirmTarget] = useState<InstitutionDeviceRow | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, s, c] = await Promise.all([
        getInstitutionDevices(institutionId),
        getInstitutionStudents(institutionId),
        getInstitutionCohorts(institutionId),
      ]);
      setDevices(d);
      setStudents(s);
      setCohorts(c.map((x) => ({ id: x.id, name: x.name })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return devices
      .filter((d) => (term ? `${d.student_name ?? ''} ${d.student_number ?? ''} ${d.device_fingerprint}`.toLowerCase().includes(term) : true))
      .filter((d) => (statusFilter === 'all' ? true : statusFilter === 'active' ? d.is_active : !d.is_active))
      .filter((d) => (cohortFilter === 'all' ? true : d.cohort_id === cohortFilter));
  }, [devices, search, statusFilter, cohortFilter]);

  const studentsWithDevice = useMemo(() => new Set(devices.map((d) => d.student_id)), [devices]);
  const kpi = useMemo(() => {
    const total = devices.length;
    const active = devices.filter((d) => d.is_active).length;
    const studentsWithout = students.filter((s) => !studentsWithDevice.has(s.id)).length;
    return { total, active, studentsWithout };
  }, [devices, students, studentsWithDevice]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [filtered, page]);

  const handleDeactivate = async () => {
    if (!confirmTarget) return;
    if (!canManageDevices) {
      toast.error('ليست لديك صلاحية إدارة الأجهزة');
      return;
    }
    setBusy(true);
    try {
      const ok = await deactivateStudentDevice(confirmTarget.id);
      if (ok) {
        toast.success('تم إلغاء ربط الجهاز. يمكن للطالب الآن تسجيل جهاز جديد عند أول حضور.');
        setConfirmTarget(null);
        await loadAll();
      } else {
        toast.error('تعذر إلغاء ربط الجهاز. تحقق من الصلاحيات.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          الأجهزة والأمان
        </h2>
        <p className="text-xs text-slate-500 mt-1">إدارة الأجهزة المربوطة بالطلاب ومنع الغش عبر بصمة الجهاز</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="إجمالي الأجهزة" value={kpi.total} icon={Smartphone} tone="from-indigo-500 to-indigo-700" />
        <KpiTile label="أجهزة نشطة" value={kpi.active} icon={CheckCircle2} tone="from-emerald-500 to-emerald-700" />
        <KpiTile label={`${labels.learners} بدون جهاز`} value={kpi.studentsWithout} icon={Users} tone="from-amber-500 to-amber-700" />
        <KpiTileUnavailable label="محاولات مشبوهة" hint="غير متوفر حالياً" />
      </div>

      {/* Notice about security events */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-[12px] text-amber-900">
          <strong className="font-bold">ملاحظة أمنية: </strong>
          سجل الأحداث الأمنية المتقدمة (محاولات الغش، محاولات الاتصال غير المعتاد، تكرار الفينجر برينت) سيتم تفعيله في إصدار قادم. الحالة الراهنة:
          المنصة ترفض تسجيل حضور من جهاز ثاني لنفس الطالب تلقائياً عبر <code className="bg-white/60 px-1 rounded text-[10px]">register-attendance</code>.
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label className="text-[11px] text-slate-600 mb-1 block">بحث</Label>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="h-9 pr-10"
                placeholder="اسم الطالب، رقم التسجيل، بصمة الجهاز..."
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 mb-1 block">الحالة</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'all' | 'active' | 'inactive'); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">معطّل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 mb-1 block">{labels.group}</Label>
            <Select value={cohortFilter} onValueChange={(v) => { setCohortFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل {labels.groups}</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Smartphone className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-black text-slate-900">لا توجد أجهزة مسجلة</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              عند تسجيل أول حضور لأحد {labels.learners} عبر تطبيق Ausar Military، سيتم ربط جهازه تلقائياً ويظهر هنا.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">{labels.learner}</TableHead>
                    <TableHead className="text-right">{labels.group}</TableHead>
                    <TableHead className="text-right">بصمة الجهاز</TableHead>
                    <TableHead className="text-right">آخر استعمال</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((d) => (
                    <TableRow key={d.id} className="hover:bg-slate-50/60">
                      <TableCell>
                        <div className="font-bold text-slate-900 text-[13px]">{d.student_name ?? '—'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{d.student_number ?? '—'}</div>
                      </TableCell>
                      <TableCell className="text-[12px] text-slate-700">{d.cohort_name ?? '—'}</TableCell>
                      <TableCell>
                        <code className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                          {d.device_fingerprint.slice(0, 12)}…
                        </code>
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-600">
                        {d.last_used ? new Date(d.last_used).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </TableCell>
                      <TableCell>
                        {d.is_active ? (
                          <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">نشط</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">معطّل</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {d.is_active && canManageDevices && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => setConfirmTarget(d)}
                          >
                            <PowerOff className="h-3 w-3" />
                            إلغاء الربط
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
              <p className="text-[11px] text-slate-500">
                عرض {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} من {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-8 gap-1 text-[11px]">السابق</Button>
                <span className="text-[11px] text-slate-600">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="h-8 gap-1 text-[11px]">
                  التالي <ChevronLeft className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <AlertCircle className="h-5 w-5" />
              تأكيد إلغاء الربط
            </DialogTitle>
            <DialogDescription>
              سيتم إلغاء ربط جهاز {confirmTarget?.student_name ?? '—'}. عند أول حضور قادم سيرتبط الطالب بجهاز جديد. لا يمكن التراجع عن هذه العملية.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)} disabled={busy}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center text-white shadow-md`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] text-slate-500 font-bold uppercase">{label}</p>
        <p className="text-xl font-black text-slate-900">{value.toLocaleString('ar-DZ')}</p>
      </div>
    </div>
  );
}

function KpiTileUnavailable({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] text-slate-500 font-bold uppercase">{label}</p>
        <p className="text-[12px] font-bold text-slate-500">{hint}</p>
      </div>
    </div>
  );
}
