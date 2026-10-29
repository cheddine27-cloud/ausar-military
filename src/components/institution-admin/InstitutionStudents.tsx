// =============================================================================
// Institution Admin — Students tab
// =============================================================================
// Full CRUD for students within the institution + Excel bulk import.
// Excel parsing is done client-side with ExcelJS, header-based column mapping
// (supports Arabic headers: رقم التسجيل / الاسم / اللقب / الهاتف).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Pencil, Upload, FileSpreadsheet, Users, GraduationCap, Building2, AlertCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getInstitutionStudents,
  createInstitutionStudent,
  updateInstitutionStudent,
  deleteInstitutionStudent,
  importInstitutionStudents,
  getInstitutionCohorts,
  type InstitutionStudentRow,
} from '@/lib/institutionAdminApi';
import { PERMISSIONS, can, type PermissionMap } from '@/lib/permissions';
import { getSectorLabels, type SectorType } from '@/lib/sectorLabels';
import type ExcelJS from 'exceljs';
import StudentProfilePage from '../../modules/school/components/Student360/StudentProfilePage';
import { isPrimaryOrMiddle } from '@/lib/schoolHelpers';

interface Props {
  institutionId: string;
  institutionName: string;
  institutionType?: SectorType;
  permissions?: PermissionMap | null;
}

interface CohortOption {
  id: string;
  name: string;
  level: string | null;
}

// -----------------------------------------------------------------------------
// Excel helpers (mirrors the pattern used in the legacy StudentsTab)
// -----------------------------------------------------------------------------
type ExcelCellValue = ExcelJS.CellValue;

function excelCellToText(value: ExcelCellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text.trim();
    if (typeof obj.result === 'string' || typeof obj.result === 'number') return String(obj.result).trim();
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r: { text?: string }) => r.text ?? '').join('').trim();
    }
  }
  return '';
}

function readField(row: ExcelJS.Row, headerMap: Map<string, number>, names: string[]): string {
  for (const name of names) {
    const col = headerMap.get(name.toLowerCase());
    if (col) {
      const value = excelCellToText(row.getCell(col).value);
      if (value) return value;
    }
  }
  return '';
}

// -----------------------------------------------------------------------------

export default function InstitutionStudents({ institutionId, institutionName, institutionType, permissions }: Props) {
  const labels = getSectorLabels(institutionType);
  const canManageStudents = can(permissions, PERMISSIONS.studentsManage);
  const [students, setStudents] = useState<InstitutionStudentRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cohortFilter, setCohortFilter] = useState('all');

  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStream, setBulkStream] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [form, setForm] = useState({
    studentNumber: '',
    firstName: '',
    lastName: '',
    cohortId: '',
    year: '',
    specialty: '',
    faculty: '',
    phone: '',
  });

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InstitutionStudentRow | null>(null);
  const [editForm, setEditForm] = useState({
    studentNumber: '',
    firstName: '',
    lastName: '',
    cohortId: '',
    phone: '',
    specialty: '',
  });

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importCohort, setImportCohort] = useState('');
  const [importResult, setImportResult] = useState<{ success: number; duplicates: number; errors: number; errorDetails: string[] } | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        getInstitutionStudents(institutionId),
        getInstitutionCohorts(institutionId),
      ]);
      setStudents(s);
      setCohorts(c);
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
    return students.filter((s) => {
      if (cohortFilter !== 'all' && s.cohort_id !== cohortFilter) return false;
      if (!q) return true;
      const fullName = `${s.first_name ?? ''} ${s.last_name ?? ''}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (s.student_number ?? '').toLowerCase().includes(q) ||
        (s.phone ?? '').toLowerCase().includes(q) ||
        (s.specialty ?? '').toLowerCase().includes(q)
      );
    });
  }, [students, search, cohortFilter]);

  const totals = useMemo(() => ({
    students: students.length,
    cohorts: cohorts.length,
    active: students.filter((s) => s.status !== 'suspended' && s.status !== 'graduated').length,
    suspended: students.filter((s) => s.status === 'suspended').length,
  }), [students, cohorts]);

  const handleCreate = async () => {
    if (!canManageStudents) {
      toast.error('ليست لديك صلاحية إدارة الطلاب');
      return;
    }
    if (!form.studentNumber.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.cohortId) {
      toast.error('الرقم الجامعي، الاسم، اللقب والفوج مطلوبة');
      return;
    }
    setCreateBusy(true);
    try {
      await createInstitutionStudent({
        studentNumber: form.studentNumber,
        firstName: form.firstName,
        lastName: form.lastName,
        cohortId: form.cohortId,
        year: form.year || null,
        specialty: form.specialty || null,
        faculty: form.faculty || null,
        phone: form.phone || null,
        institutionId,
      });
      toast.success(`تم إضافة ${labels.learner}`);
      setCreateOpen(false);
      setForm({ studentNumber: '', firstName: '', lastName: '', cohortId: '', year: '', specialty: '', faculty: '', phone: '' });
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `تعذر إضافة ${labels.learner}`);
    } finally {
      setCreateBusy(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((s) => s.id));
    });
  };

  const handleBulkStreamUpdate = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const selectedArray = Array.from(selectedIds);
      for (const studentId of selectedArray) {
        const student = students.find((std) => std.id === studentId);
        const oldStream = student?.specialty || null;
        const newStream = bulkStream.trim() || null;
        if (oldStream !== newStream) {
          // 1. Update student
          await supabase
            .from('students')
            .update({ specialty: newStream })
            .eq('id', studentId);
          // 2. Log transfer
          await supabase.from('student_stream_transfers').insert({
            student_id: studentId,
            institution_id: institutionId,
            old_stream: oldStream,
            new_stream: newStream,
            transfer_reason: 'تحديث جماعي من لوحة الإدارة',
          });
        }
      }
      toast.success('تم تحديث الشعبة/التخصص لجميع الطلاب المحددين');
      setSelectedIds(new Set());
      setBulkStream('');
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء التحديث الجماعي');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} طالب نهائياً؟`)) return;
    setBulkBusy(true);
    try {
      const selectedArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', selectedArray);
      if (error) throw error;
      toast.success('تم حذف الطلاب المحددين بنجاح');
      setSelectedIds(new Set());
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الحذف الجماعي');
    } finally {
      setBulkBusy(false);
    }
  };

  const openEdit = (s: InstitutionStudentRow) => {
    if (!canManageStudents) {
      toast.error('ليست لديك صلاحية تعديل الطلاب');
      return;
    }
    setEditTarget(s);
    setEditForm({
      studentNumber: s.student_number ?? '',
      firstName: s.first_name ?? '',
      lastName: s.last_name ?? '',
      cohortId: s.cohort_id ?? '',
      phone: s.phone ?? '',
      specialty: s.specialty ?? '',
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!canManageStudents) {
      toast.error('ليست لديك صلاحية تعديل الطلاب');
      return;
    }

    const newSpecialty = editForm.specialty.trim() || null;
    const ok = await updateInstitutionStudent(editTarget.id, {
      student_number: editForm.studentNumber.trim(),
      first_name: editForm.firstName.trim(),
      last_name: editForm.lastName.trim(),
      cohort_id: editForm.cohortId || null,
      phone: editForm.phone.trim() || null,
      specialty: newSpecialty,
    });

    if (ok) {
      // Log transfer if stream/specialty has changed
      const oldSpecialty = editTarget.specialty || null;
      if (oldSpecialty !== newSpecialty) {
        try {
          await supabase.from('student_stream_transfers').insert({
            student_id: editTarget.id,
            institution_id: institutionId,
            old_stream: oldSpecialty,
            new_stream: newSpecialty,
            transfer_reason: 'تعديل يدوي من لوحة الإدارة',
          });
        } catch (logErr) {
          console.error('Failed to log student stream transfer:', logErr);
        }
      }

      toast.success('تم التعديل');
      setEditOpen(false);
      setEditTarget(null);
      await loadAll();
    } else {
      toast.error('تعذر التعديل');
    }
  };

  const handleDelete = async (s: InstitutionStudentRow) => {
    if (!canManageStudents) {
      toast.error('ليست لديك صلاحية حذف الطلاب');
      return;
    }
    const ok = window.confirm(`هل أنت متأكد من حذف ${labels.learner} ${s.first_name} ${s.last_name}؟`);
    if (!ok) return;
    const success = await deleteInstitutionStudent(s.id);
    if (success) {
      toast.success('تم الحذف');
      await loadAll();
    } else {
      toast.error('تعذر الحذف');
    }
  };

  const handleImport = async () => {
    if (!canManageStudents) {
      toast.error('ليست لديك صلاحية استيراد الطلاب');
      return;
    }
    if (!importFile || !importCohort) {
      toast.error('اختر ملف Excel والفوج المستهدف');
      return;
    }
    setImportBusy(true);
    setImportResult(null);
    try {
      const buffer = await importFile.arrayBuffer();
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        toast.error('الملف فارغ');
        return;
      }

      // Build header map from first row
      const headerMap = new Map<string, number>();
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, col) => {
        const text = excelCellToText(cell.value).toLowerCase();
        if (text) headerMap.set(text, col);
      });

      const rows: { student_number: string; first_name: string; last_name: string; phone?: string | null; specialty?: string | null }[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const studentNumber = readField(row, headerMap, ['رقم التسجيل', 'الرقم الجامعي', 'studentNumber', 'matricule', 'id']);
        const firstName     = readField(row, headerMap, ['الاسم', 'firstName', 'prenom']);
        const lastName      = readField(row, headerMap, ['اللقب', 'lastName', 'nom']);
        const phone         = readField(row, headerMap, ['الهاتف', 'phone', 'telephone']);
        const specialty     = readField(row, headerMap, ['الشعبة', 'التخصص', 'stream', 'specialty']);
        if (studentNumber && firstName && lastName) {
          rows.push({
            student_number: studentNumber,
            first_name: firstName,
            last_name: lastName,
            phone: phone || null,
            specialty: specialty || null,
          });
        }
      });

      if (rows.length === 0) {
        toast.error('لم يتم العثور على بيانات صالحة. تأكد من الأعمدة: رقم التسجيل، الاسم، اللقب');
        return;
      }

      const result = await importInstitutionStudents(rows, importCohort, institutionId);
      setImportResult(result);
      if (result.success > 0) {
        toast.success(`تم استيراد ${result.success} طالب`);
        await loadAll();
      } else {
        toast.error('لم يتم استيراد أي طالب');
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء قراءة الملف');
    } finally {
      setImportBusy(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`قالب ${labels.learners}`);
      worksheet.addRow(['رقم التسجيل', 'الاسم', 'اللقب', 'الهاتف']);
      worksheet.addRow(['202100001', 'محمد', 'بن علي', '0555 00 00 00']);
      worksheet.addRow(['202100002', 'فاطمة', 'بن صالح', '']);
      worksheet.columns.forEach((col) => { col.width = 22; });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'qhudoor-students-template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('تم تنزيل القالب');
    } catch (err) {
      console.error(err);
      toast.error('تعذر إنشاء القالب');
    }
  };

  const [selectedStudentId360, setSelectedStudentId360] = useState<string | null>(null);

  if ((institutionType === 'school' || institutionType === 'primary_school' || institutionType === 'secondary_school') && selectedStudentId360) {
    return (
      <StudentProfilePage
        studentId={selectedStudentId360}
        institutionId={institutionId}
        onBack={() => setSelectedStudentId360(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + KPIs */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              {labels.learners}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              إدارة قاعدة {labels.learners} الخاصة بـ {institutionName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={downloadTemplate} className="gap-2 rounded-xl">
              <FileSpreadsheet className="h-4 w-4" /> قالب Excel
            </Button>
            {canManageStudents && (
              <>
                <Button variant="outline" onClick={() => { setImportOpen(true); setImportResult(null); }} className="gap-2 rounded-xl">
                  <Upload className="h-4 w-4" /> استيراد Excel
                </Button>
                <Button onClick={() => setCreateOpen(true)} className="gap-2 rounded-xl bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4" /> إضافة طالب
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            { label: `إجمالي ${labels.learners}`, value: totals.students,  icon: Users,         tone: 'bg-purple-50 text-purple-700' },
            { label: `${labels.learners} نشطون`,       value: totals.active,    icon: GraduationCap, tone: 'bg-emerald-50 text-emerald-700' },
            { label: labels.groups,                     value: totals.cohorts,   icon: Building2,     tone: 'bg-indigo-50 text-indigo-700' },
            { label: 'موقوفون/متخرجون', value: totals.suspended, icon: AlertCircle,   tone: 'bg-amber-50 text-amber-700' },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="border border-slate-100 rounded-xl p-3">
                <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${k.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">{k.value}</p>
                <p className="text-[11px] text-slate-500 font-medium">{k.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ابحث برقم التسجيل، الاسم، التخصص..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 h-10 rounded-lg"
            />
          </div>
          <Select value={cohortFilter} onValueChange={setCohortFilter}>
            <SelectTrigger className="w-56 h-10 rounded-lg">
              <SelectValue placeholder="كل الأفواج" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأفواج</SelectItem>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-500 ms-auto">{filtered.length} / {students.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              {canManageStudents && (
                <TableHead className="w-12 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-350 accent-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="text-right">الرقم الجامعي</TableHead>
              <TableHead className="text-right">الاسم الكامل</TableHead>
              <TableHead className="text-right">الفوج</TableHead>
              {!isPrimaryOrMiddle(institutionName, null, institutionType) && <TableHead className="text-right">التخصص</TableHead>}
              <TableHead className="text-right">الهاتف</TableHead>
              <TableHead className="text-center">الحالة</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={isPrimaryOrMiddle(institutionName, null, institutionType) ? 7 : 8} className="text-center text-slate-500 py-10">جاري التحميل...</TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isPrimaryOrMiddle(institutionName, null, institutionType) ? 7 : 8} className="text-center text-slate-500 py-10">لا يوجد طلاب بعد</TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((s) => (
              <TableRow key={s.id} className="hover:bg-slate-50/60">
                {canManageStudents && (
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-350 accent-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs font-bold text-slate-900">{s.student_number}</TableCell>
                <TableCell className="font-bold text-slate-900">
                  {s.first_name} {s.last_name}
                </TableCell>
                <TableCell className="text-xs text-slate-600">{s.cohort_name || '—'}</TableCell>
                {!isPrimaryOrMiddle(institutionName, null, institutionType) && <TableCell className="text-xs text-slate-600">{s.specialty || '—'}</TableCell>}
                <TableCell className="text-xs text-slate-600 font-mono">{s.phone || '—'}</TableCell>
                <TableCell className="text-center">
                  {s.status === 'suspended' ? (
                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">موقوف</Badge>
                  ) : s.status === 'graduated' ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">متخرج</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">نشط</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {(institutionType === 'school' || institutionType === 'primary_school' || institutionType === 'secondary_school') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-emerald-650 hover:bg-emerald-50/50"
                        onClick={() => setSelectedStudentId360(s.id)}
                        title="ملف التلميذ 360°"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canManageStudents ? (
                      <>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(s)} title="تعديل">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(s)} title="حذف">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      institutionType !== 'school' && institutionType !== 'primary_school' && <span className="text-xs font-bold text-slate-400">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>إضافة {labels.learner} جديد</DialogTitle>
            <DialogDescription>سيتم ربط {labels.learner} بـ{labels.group} المختار داخل {institutionName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الرقم الجامعي *</Label>
                <Input value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">الفوج *</Label>
                <Select value={form.cohortId} onValueChange={(v) => setForm({ ...form, cohortId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الفوج" /></SelectTrigger>
                  <SelectContent>
                    {cohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الاسم *</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">اللقب *</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            {isPrimaryOrMiddle(institutionName, null, institutionType) ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">السنة</Label>
                  <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="مثال: 1 متوسط" />
                </div>
                <div>
                  <Label className="text-xs">الهاتف</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">السنة</Label>
                    <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder={institutionType === 'secondary_school' ? 'مثال: السنة 1 ثانوي' : 'مثال: L2'} />
                  </div>
                  <div>
                    <Label className="text-xs">{institutionType === 'secondary_school' ? 'الشعبة' : 'التخصص'}</Label>
                    {institutionType === 'secondary_school' ? (
                      <select
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold mt-1"
                        value={form.specialty}
                        onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                      >
                        <option value="">-- اختر الشعبة --</option>
                        <option value="علوم تجريبية">علوم تجريبية</option>
                        <option value="رياضيات">رياضيات</option>
                        <option value="تقني رياضي">تقني رياضي</option>
                        <option value="تسيير واقتصاد">تسيير واقتصاد</option>
                        <option value="آداب وفلسفة">آداب وفلسفة</option>
                        <option value="لغات أجنبية">لغات أجنبية</option>
                      </select>
                    ) : (
                      <Input className="mt-1" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{institutionType === 'secondary_school' ? 'المؤسسة' : 'الكلية'}</Label>
                    <Input value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} placeholder={institutionType === 'secondary_school' ? 'اختياري' : ''} />
                  </div>
                  <div>
                    <Label className="text-xs">الهاتف</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createBusy}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={createBusy} className="bg-purple-600 hover:bg-purple-700">
              {createBusy ? 'جاري الحفظ...' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل بيانات {labels.learner}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">الرقم الجامعي</Label>
              <Input value={editForm.studentNumber} onChange={(e) => setEditForm({ ...editForm, studentNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الاسم</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">اللقب</Label>
                <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </div>
            </div>
             <div>
              <Label className="text-xs">الفوج</Label>
              <Select value={editForm.cohortId} onValueChange={(v) => setEditForm({ ...editForm, cohortId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الفوج" /></SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isPrimaryOrMiddle(institutionName, null, institutionType) && (
              <div>
                <Label className="text-xs">{institutionType === 'secondary_school' ? 'الشعبة' : 'التخصص'}</Label>
                {institutionType === 'secondary_school' ? (
                  <select
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold mt-1"
                    value={editForm.specialty}
                    onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                  >
                    <option value="">-- اختر الشعبة --</option>
                    <option value="علوم تجريبية">علوم تجريبية</option>
                    <option value="رياضيات">رياضيات</option>
                    <option value="تقني رياضي">تقني رياضي</option>
                    <option value="تسيير واقتصاد">تسيير واقتصاد</option>
                    <option value="آداب وفلسفة">آداب وفلسفة</option>
                    <option value="لغات أجنبية">لغات أجنبية</option>
                  </select>
                ) : (
                  <Input
                    className="mt-1"
                    value={editForm.specialty}
                    onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                  />
                )}
              </div>
            )}
            <div>
              <Label className="text-xs">الهاتف</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleEdit}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              استيراد طلاب من Excel
            </DialogTitle>
            <DialogDescription>
              يجب أن يحتوي الملف على الأعمدة: <strong>رقم التسجيل</strong>، <strong>الاسم</strong>، <strong>اللقب</strong> (و اختياري: الهاتف).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">الفوج المستهدف *</Label>
              <Select value={importCohort} onValueChange={setImportCohort}>
                <SelectTrigger><SelectValue placeholder="اختر الفوج" /></SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">ملف Excel *</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>
            {importResult && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span>تم الاستيراد:</span><strong className="text-emerald-700">{importResult.success}</strong></div>
                <div className="flex justify-between"><span>مكررون (تم تجاهلهم):</span><strong className="text-amber-700">{importResult.duplicates}</strong></div>
                <div className="flex justify-between"><span>أخطاء:</span><strong className="text-rose-700">{importResult.errors}</strong></div>
                {importResult.errorDetails.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-rose-700">تفاصيل الأخطاء</summary>
                    <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                      {importResult.errorDetails.slice(0, 20).map((d, i) => (
                        <li key={i} className="font-mono text-[10px]">{d}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importBusy}>
              {importResult ? 'إغلاق' : 'إلغاء'}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile || !importCohort || importBusy}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {importBusy ? 'جاري الاستيراد...' : 'بدء الاستيراد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Floating Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="bg-purple-600 text-white text-xs font-black px-2.5 py-1 rounded-full">
                {selectedIds.size}
              </span>
              <p className="text-xs font-bold">تم اختيارهم لإجراء دفعة واحدة</p>
            </div>

            <div className="flex items-center gap-2">
              {institutionType === 'secondary_school' ? (
                <>
                  <select
                    className="h-9 px-3 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={bulkStream}
                    onChange={(e) => setBulkStream(e.target.value)}
                  >
                    <option value="">-- تعيين الشعبة --</option>
                    <option value="علوم تجريبية">علوم تجريبية</option>
                    <option value="رياضيات">رياضيات</option>
                    <option value="تقني رياضي">تقني رياضي</option>
                    <option value="تسيير واقتصاد">تسيير واقتصاد</option>
                    <option value="آداب وفلسفة">آداب وفلسفة</option>
                    <option value="لغات أجنبية">لغات أجنبية</option>
                  </select>
                  <Button
                    onClick={handleBulkStreamUpdate}
                    disabled={!bulkStream || bulkBusy}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-xs font-bold rounded-lg h-9"
                  >
                    {bulkBusy ? 'جاري التحديث...' : 'تحديث الشعبة'}
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    placeholder="التخصص الجديد..."
                    className="h-9 w-40 text-xs bg-slate-800 border-slate-700 text-white rounded-lg placeholder-slate-400"
                    value={bulkStream}
                    onChange={(e) => setBulkStream(e.target.value)}
                  />
                  <Button
                    onClick={handleBulkStreamUpdate}
                    disabled={!bulkStream.trim() || bulkBusy}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-xs font-bold rounded-lg h-9"
                  >
                    {bulkBusy ? 'جاري التحديث...' : 'تحديث التخصص'}
                  </Button>
                </>
              )}

              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkBusy}
                className="text-xs font-bold rounded-lg h-9"
              >
                حذف المحدد
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
