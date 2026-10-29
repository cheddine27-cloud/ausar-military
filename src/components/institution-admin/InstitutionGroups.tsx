// =============================================================================
// Phase 4 — Institution Groups (cohorts) tab
// =============================================================================
// Full CRUD for cohorts, with each cohort optionally bound to an
// institution_unit (faculty/department/specialty). The breadcrumb path is
// rendered top-down so users can read the academic context at a glance.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Pencil, Users, Building2, ChevronLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getInstitutionCohortsDetailed,
  createInstitutionCohort,
  updateInstitutionCohort,
  deleteInstitutionCohort,
  getInstitutionUnits,
  type InstitutionCohortRow,
  type InstitutionUnitRow,
} from '@/lib/institutionAdminApi';
import { PERMISSIONS, can, type PermissionMap } from '@/lib/permissions';
import ScopePicker from './ScopePicker';
import { isPrimaryOrMiddle } from '@/lib/schoolHelpers';
import { supabase } from '@/lib/supabase';

type SectorType = 'military';

interface Props {
  institutionId: string;
  institutionName: string;
  institutionType: SectorType;
  permissions?: PermissionMap | null;
}

const SECTOR_LABELS: Record<SectorType, { groupSingular: string; groupPlural: string; placeholder: string }> = {
  university:       { groupSingular: 'فوج',  groupPlural: 'الأفواج', placeholder: 'مثال: فوج 01 — ISIL' },
  school:           { groupSingular: 'قسم',  groupPlural: 'الأقسام', placeholder: 'مثال: 1 متوسط أ' },
  primary_school:   { groupSingular: 'فوج',  groupPlural: 'الأفواج', placeholder: 'مثال: السنة الأولى - فوج أ' },
  secondary_school: { groupSingular: 'قسم',  groupPlural: 'الأقسام', placeholder: 'مثال: 3 ثانوي علوم أ' },
  training:         { groupSingular: 'دورة', groupPlural: 'الدورات', placeholder: 'مثال: دورة الويب 2026/1' },
  company:          { groupSingular: 'فريق', groupPlural: 'الفرق',   placeholder: 'مثال: فريق المبيعات' },
};

export default function InstitutionGroups({ institutionId, institutionName, institutionType, permissions }: Props) {
  const labels = SECTOR_LABELS[institutionType];
  const canManageGroups = can(permissions, PERMISSIONS.groupsManage);

  const [cohorts, setCohorts] = useState<InstitutionCohortRow[]>([]);
  const [units, setUnits] = useState<InstitutionUnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');

  const [teachers, setTeachers] = useState<Array<{ id: string, name: string }>>([]);
  const [classrooms, setClassrooms] = useState<Array<{ id: string, name: string }>>([]);
  const [cohortStudents, setCohortStudents] = useState<Array<{ id: string, name: string }>>([]);

  // Create / edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<InstitutionCohortRow | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    level: '',
    field: '',
    unitId: null as string | null,
    mainTeacherId: '',
    monitorId: '',
    deputyMonitorId: '',
    deputyMonitor2Id: '',
    primaryRoomId: '',
  });
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, u, teachRes, roomsRes] = await Promise.all([
        getInstitutionCohortsDetailed(institutionId),
        getInstitutionUnits(institutionId),
        supabase
          .from('admins')
          .select('id, full_name, username')
          .eq('institution_id', institutionId)
          .eq('role', 'teacher'),
        supabase
          .from('classrooms')
          .select('id, name')
          .eq('institution_id', institutionId)
          .eq('status', 'active')
          .order('name'),
      ]);
      setCohorts(c);
      setUnits(u);
      if (teachRes.data) {
        setTeachers(
          teachRes.data.map((t) => ({
            id: t.id,
            name: t.full_name || t.username,
          }))
        );
      }
      if (roomsRes.data) {
        setClassrooms(roomsRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cohorts.filter((c) => {
      if (unitFilter !== 'all') {
        if (unitFilter === 'unscoped' && c.unit_id !== null) return false;
        if (unitFilter !== 'unscoped' && c.unit_id !== unitFilter) return false;
      }
      if (!q) return true;
      const hay = [
        c.name,
        c.level ?? '',
        c.field ?? '',
        c.unit_name ?? '',
        ...(c.unit_path ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [cohorts, search, unitFilter]);

  const totals = useMemo(() => ({
    total: cohorts.length,
    scoped: cohorts.filter((c) => c.unit_id !== null).length,
    unscoped: cohorts.filter((c) => c.unit_id === null).length,
    students: cohorts.reduce((sum, c) => sum + (c.studentsCount ?? 0), 0),
  }), [cohorts]);

  const openCreate = () => {
    if (!canManageGroups) {
      toast.error('ليست لديك صلاحية إدارة الأفواج');
      return;
    }
    setDialogMode('create');
    setEditTarget(null);
    setForm({
      name: '',
      description: '',
      level: '',
      field: '',
      unitId: null,
      mainTeacherId: '',
      monitorId: '',
      deputyMonitorId: '',
      deputyMonitor2Id: '',
      primaryRoomId: '',
    });
    setCohortStudents([]);
    setDialogOpen(true);
  };

  const openEdit = (c: InstitutionCohortRow) => {
    if (!canManageGroups) {
      toast.error('ليست لديك صلاحية تعديل الأفواج');
      return;
    }
    setDialogMode('edit');
    setEditTarget(c);
    setForm({
      name: c.name,
      description: c.description ?? '',
      level: c.level ?? '',
      field: c.field ?? '',
      unitId: c.unit_id,
      mainTeacherId: c.main_teacher_id || '',
      monitorId: c.monitor_id || '',
      deputyMonitorId: c.deputy_monitor_id || '',
      deputyMonitor2Id: c.deputy_monitor_2_id || '',
      primaryRoomId: c.primary_room_id || '',
    });

    // Fetch cohort students to select monitor/deputy
    supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', c.id)
      .then(({ data }) => {
        if (data) {
          setCohortStudents(
            data.map((s) => ({
              id: s.id,
              name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
            }))
          );
        } else {
          setCohortStudents([]);
        }
      });

    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!canManageGroups) {
      toast.error('ليست لديك صلاحية إدارة الأفواج');
      return;
    }
    if (!form.name.trim()) {
      toast.error('اسم ' + labels.groupSingular + ' مطلوب');
      return;
    }
    setBusy(true);
    try {
      if (dialogMode === 'create') {
        await createInstitutionCohort({
          name: form.name,
          description: form.description || null,
          level: form.level || null,
          field: form.field || null,
          unitId: form.unitId,
          institutionId,
          mainTeacherId: form.mainTeacherId || null,
          monitorId: form.monitorId || null,
          deputyMonitorId: form.deputyMonitorId || null,
          deputyMonitor2Id: form.deputyMonitor2Id || null,
          primaryRoomId: form.primaryRoomId || null,
        });
        toast.success('تم الإنشاء');
      } else if (editTarget) {
        const ok = await updateInstitutionCohort(editTarget.id, {
          name: form.name,
          description: form.description || null,
          level: form.level || null,
          field: form.field || null,
          unit_id: form.unitId,
          main_teacher_id: form.mainTeacherId || null,
          monitor_id: form.monitorId || null,
          deputy_monitor_id: form.deputyMonitorId || null,
          deputy_monitor_2_id: form.deputyMonitor2Id || null,
          primary_room_id: form.primaryRoomId || null,
        });
        if (!ok) throw new Error('تعذر التحديث');
        toast.success('تم التحديث');
      }
      setDialogOpen(false);
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (c: InstitutionCohortRow) => {
    if (!canManageGroups) {
      toast.error('ليست لديك صلاحية حذف الأفواج');
      return;
    }
    if ((c.studentsCount ?? 0) > 0) {
      const ok = window.confirm(
        `هذا ${labels.groupSingular} يحتوي على ${c.studentsCount} طالب. حذفه قد يؤثر على البيانات. هل أنت متأكد؟`,
      );
      if (!ok) return;
    } else {
      if (!window.confirm(`هل أنت متأكد من حذف ${c.name}؟`)) return;
    }
    const success = await deleteInstitutionCohort(c.id);
    if (success) {
      toast.success('تم الحذف');
      await loadAll();
    } else {
      toast.error('تعذر الحذف');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + KPIs */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              {labels.groupPlural}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              إدارة {labels.groupPlural} وربطها بالهيكل الأكاديمي داخل {institutionName}
            </p>
          </div>
          {canManageGroups && (
            <Button onClick={openCreate} className="gap-2 rounded-xl bg-amber-600 hover:bg-amber-700">
              <Plus className="h-4 w-4" /> إضافة {labels.groupSingular}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'الإجمالي',         value: totals.total,    tone: 'bg-amber-50 text-amber-700' },
            { label: 'مرتبطة بوحدة',     value: totals.scoped,   tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'غير مرتبطة',       value: totals.unscoped, tone: 'bg-rose-50 text-rose-700' },
            { label: 'إجمالي الطلاب',    value: totals.students, tone: 'bg-indigo-50 text-indigo-700' },
          ].map((k) => (
            <div key={k.label} className="border border-slate-100 rounded-xl p-3">
              <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${k.tone}`}>
                <Users className="h-4 w-4" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">{k.value}</p>
              <p className="text-[11px] text-slate-500 font-medium">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Unscoped warning */}
      {!loading && totals.unscoped > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">
              {totals.unscoped} {labels.groupSingular}{totals.unscoped === 1 ? '' : ' / ' + labels.groupPlural} بدون ربط بالهيكل الأكاديمي
            </p>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              {labels.groupPlural} غير المرتبطة بكلية أو قسم لن تظهر لمدراء الكليات والأقسام (faculty_admin / department_admin). 
              اضغط زر التعديل بجانب اسم {labels.groupSingular} لربطه بوحدة في الهيكل.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder={`ابحث بالاسم، الكلية، القسم...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 h-10 rounded-lg"
            />
          </div>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700"
          >
            <option value="all">كل الوحدات</option>
            <option value="unscoped">غير مرتبطة</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <span className="text-xs text-slate-500 ms-auto">
            {filtered.length} / {cohorts.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">المسار الأكاديمي</TableHead>
              <TableHead className="text-right">المستوى</TableHead>
              <TableHead className="text-center">الطلاب</TableHead>
              <TableHead className="text-right">تاريخ الإنشاء</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-10">جاري التحميل...</TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-10">
                  {cohorts.length === 0 ? `لا توجد ${labels.groupPlural} بعد` : 'لا نتائج مطابقة'}
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((c) => (
              <TableRow key={c.id} className="hover:bg-slate-50/60">
                <TableCell>
                  <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                  {c.description && (
                    <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">{c.description}</div>
                  )}
                </TableCell>
                <TableCell>
                  {c.unit_path && c.unit_path.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap text-[11px]">
                      {c.unit_path.map((seg, idx) => (
                        <span key={idx} className="flex items-center gap-1">
                          {idx > 0 && <ChevronLeft className="h-3 w-3 text-slate-300 shrink-0" />}
                          <span className={idx === c.unit_path!.length - 1 ? 'font-bold text-indigo-700' : 'text-slate-600'}>
                            {seg}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px]">
                      غير مرتبطة
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-slate-700">
                  {c.level || '—'}
                  {c.field ? <span className="block text-[10px] text-slate-500 font-bold mt-0.5">{c.field}</span> : null}
                </TableCell>
                <TableCell className="text-center font-bold text-purple-700">{c.studentsCount ?? 0}</TableCell>
                <TableCell className="text-xs text-slate-500 font-mono">
                  {new Date(c.created_at).toLocaleDateString('ar-DZ')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {canManageGroups ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(c)}
                          title="تعديل"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDelete(c)}
                          title="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              {dialogMode === 'create' ? `إضافة ${labels.groupSingular} جديد` : `تعديل ${labels.groupSingular}`}
            </DialogTitle>
            <DialogDescription>
              ربط {labels.groupSingular} بوحدة في الهيكل الأكاديمي يسمح لمدير الكلية أو القسم برؤيته.
            </DialogDescription>
          </DialogHeader>

          {institutionType === 'school' || institutionType === 'primary_school' || institutionType === 'secondary_school' ? (
            <div className="space-y-4">
              {/* Field 1: Level */}
              <div>
                <Label className="text-xs font-bold text-slate-700">المستوى *</Label>
                {institutionType === 'secondary_school' ? (
                  <select
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all mt-1 font-bold"
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                  >
                    <option value="">-- اختر المستوى الدراسي --</option>
                    <option value="السنة الأولى ثانوي">السنة الأولى ثانوي</option>
                    <option value="السنة الثانية ثانوي">السنة الثانية ثانوي</option>
                    <option value="السنة الثالثة ثانوي">السنة الثالثة ثانوي</option>
                  </select>
                ) : institutionType === 'primary_school' ? (
                  <select
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all mt-1 font-bold"
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                  >
                    <option value="">-- اختر المستوى الدراسي --</option>
                    <option value="السنة الأولى ابتدائي">السنة الأولى ابتدائي</option>
                    <option value="السنة الثانية ابتدائي">السنة الثانية ابتدائي</option>
                    <option value="السنة الثالثة ابتدائي">السنة الثالثة ابتدائي</option>
                    <option value="السنة الرابعة ابتدائي">السنة الرابعة ابتدائي</option>
                    <option value="السنة الخامسة ابتدائي">السنة الخامسة ابتدائي</option>
                  </select>
                ) : (
                  <Input
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    placeholder="مثال: السنة 1 متوسط"
                    className="h-10 rounded-lg mt-1"
                  />
                )}
              </div>

              {/* Field 1.5: Stream / الشعبة (Only for Secondary School) */}
              {institutionType === 'secondary_school' && (
                <div>
                  <Label className="text-xs font-bold text-slate-700">الشعبة *</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all mt-1 font-bold"
                    value={form.field}
                    onChange={(e) => setForm({ ...form, field: e.target.value })}
                  >
                    <option value="">-- اختر الشعبة --</option>
                    <option value="علوم تجريبية">علوم تجريبية</option>
                    <option value="رياضيات">رياضيات</option>
                    <option value="تقني رياضي">تقني رياضي</option>
                    <option value="تسيير واقتصاد">تسيير واقتصاد</option>
                    <option value="آداب وفلسفة">آداب وفلسفة</option>
                    <option value="لغات أجنبية">لغات أجنبية</option>
                  </select>
                </div>
              )}

              {/* Field 2: Group */}
              <div>
                <Label className="text-xs font-bold text-slate-700">الفوج *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: فوج 1"
                  className="h-10 rounded-lg mt-1"
                />
              </div>

              {/* Field 3: Principal Teacher */}
              <div>
                <Label className="text-xs font-bold text-slate-700">الأستاذ الرئيسي (اختياري)</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all mt-1 font-bold"
                  value={form.mainTeacherId}
                  onChange={(e) => setForm({ ...form, mainTeacherId: e.target.value })}
                >
                  <option value="">-- اختر الأستاذ الرئيسي --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Field 3.5: Default Classroom */}
              <div>
                <Label className="text-xs font-bold text-slate-700">القاعة الافتراضية (اختياري)</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all mt-1 font-bold"
                  value={form.primaryRoomId}
                  onChange={(e) => setForm({ ...form, primaryRoomId: e.target.value })}
                >
                  <option value="">-- اختر القاعة الافتراضية --</option>
                  {classrooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Field 4: Monitor and Deputies */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <Label className="text-xs font-bold text-slate-800">التلاميذ المسؤولون عن القسم</Label>
                {dialogMode === 'create' ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 leading-relaxed">
                    ⚠️ مسؤول القسم ونوابه يتم تعيينهم عند تعديل القسم لاحقاً، وذلك بعد تسجيل التلاميذ داخل القسم.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500 font-bold">المسؤول عن القسم</Label>
                      <select
                        className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                        value={form.monitorId}
                        onChange={(e) => setForm({ ...form, monitorId: e.target.value })}
                      >
                        <option value="">-- اختر المسؤول --</option>
                        {cohortStudents.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500 font-bold">النائب الأول</Label>
                      <select
                        className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                        value={form.deputyMonitorId}
                        onChange={(e) => setForm({ ...form, deputyMonitorId: e.target.value })}
                      >
                        <option value="">-- اختر النائب الأول --</option>
                        {cohortStudents.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500 font-bold">النائب الثاني</Label>
                      <select
                        className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                        value={form.deputyMonitor2Id}
                        onChange={(e) => setForm({ ...form, deputyMonitor2Id: e.target.value })}
                      >
                        <option value="">-- اختر النائب الثاني --</option>
                        {cohortStudents.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">الاسم *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={labels.placeholder}
                />
              </div>

              <div className={isPrimaryOrMiddle(institutionName, null, institutionType) ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
                <div>
                  <Label className="text-xs">المستوى</Label>
                  <Input
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    placeholder="مثال: L2 / M1"
                  />
                </div>
                {!isPrimaryOrMiddle(institutionName, null, institutionType) && (
                  <div>
                    <Label className="text-xs">الميدان</Label>
                    <Input
                      value={form.field}
                      onChange={(e) => setForm({ ...form, field: e.target.value })}
                      placeholder="مثال: Mathématiques et Informatique"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs">الوصف</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="ملاحظات اختيارية"
                />
              </div>

              {/* Phase 4 — Hierarchical scope picker for unit_id */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-xs font-bold text-slate-900">الوحدة الأكاديمية</Label>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      اختر الكلية / القسم / التخصص الذي ينتمي إليه هذا {labels.groupSingular}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    <Building2 className="h-3 w-3 ms-1" />
                    هرمية
                  </Badge>
                </div>
                {units.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
                    لا توجد كليات أو أقسام بعد في الهيكل الأكاديمي. يمكنك إنشاء {labels.groupSingular} الآن
                    وربطه لاحقاً بعد إنشاء الهيكل من تبويب "الهيكل".
                  </div>
                ) : (
                  <>
                    <ScopePicker
                      units={units}
                      value={form.unitId}
                      onChange={(unitId) => setForm({ ...form, unitId })}
                      institutionName={institutionName}
                      allowInstitutionWide={false}
                    />
                    {form.unitId !== null && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, unitId: null })}
                        className="text-[11px] text-amber-700 hover:underline mt-2"
                      >
                        إزالة الربط (يصبح غير مرتبط بأي وحدة)
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={busy} className="bg-amber-600 hover:bg-amber-700">
              {busy ? 'جاري الحفظ...' : dialogMode === 'create' ? 'إنشاء' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
