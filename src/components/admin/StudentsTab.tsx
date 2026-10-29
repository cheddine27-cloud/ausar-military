import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Upload, AlertCircle, GraduationCap, ChevronRight, School, Building2, BookOpen, UserCircle, Search, UserMinus, ShieldAlert } from 'lucide-react';
import { getCohorts, addStudent, updateStudent, deleteStudent, getAllStudentsWithStats, importStudentsFromExcel, getFaculties, getDepartments, getSpecialties } from '@/lib/database';
import { useInstitutionUI } from '@/config/institutions';
import type { Student, Cohort, Faculty, Department, Specialty } from '@/lib/types';
import type ExcelJS from 'exceljs';

interface StudentWithStats extends Student {
  stats?: { attended: number; total: number; percentage: number; };
}

interface StudentFormData {
  studentNumber: string;
  firstName: string;
  lastName: string;
  cohortId: string;
}

type ExcelCellValue = ExcelJS.CellValue;

function excelCellToText(value: ExcelCellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value).trim();

  if ('text' in value && value.text !== undefined) return String(value.text).trim();
  if ('result' in value) return excelCellToText(value.result as ExcelCellValue);
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join('').trim();
  }

  return String(value).trim();
}

function readExcelField(row: ExcelJS.Row, headerMap: Map<string, number>, names: string[]): string {
  for (const name of names) {
    const column = headerMap.get(name);
    if (column) return excelCellToText(row.getCell(column).value);
  }
  return '';
}

export default function StudentsTab() {
  const ui = useInstitutionUI();
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [dbFaculties, setDbFaculties] = useState<Faculty[]>([]);
  const [dbDepartments, setDbDepartments] = useState<Department[]>([]);
  const [dbSpecialties, setDbSpecialties] = useState<Specialty[]>([]);

  const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null);

  const [formFacultyId, setFormFacultyId] = useState<string>('');
  const [formDeptId, setFormDeptId] = useState<string>('');
  const [formSpecId, setFormSpecId] = useState<string>('');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState<StudentFormData>({ studentNumber: '', firstName: '', lastName: '', cohortId: '' });
  const [error, setError] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importCohortId, setImportCohortId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [studentsData, cohortsData, facs, depts, specs] = await Promise.all([
        getAllStudentsWithStats(), getCohorts(), getFaculties(), getDepartments(), getSpecialties()
      ]);
      setStudents(studentsData);
      setCohorts(cohortsData);
      setDbFaculties(facs);
      setDbDepartments(depts);
      setDbSpecialties(specs);
    } catch (error) {
      console.error('Data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const cohortId = s.cohortId || s.cohort_id;
    const cohort = cohorts.find((c) => c.id === cohortId);
    
    // Primary Filters
    if (selectedFaculty && cohort?.field !== selectedFaculty) return false;
    if (selectedDept && cohort?.subject !== selectedDept) return false;
    if (selectedSpec && cohort?.specialty !== selectedSpec) return false;
    if (selectedCohort && cohort?.id !== selectedCohort) return false;

    // Search Filter
    if (searchQuery) {
       const fn = (s.firstName || s.first_name || '').toLowerCase();
       const ln = (s.lastName || s.last_name || '').toLowerCase();
       const fullName = `${fn} ${ln}`.trim();
       const sn = (s.studentNumber || s.student_number || '').toLowerCase();
       const query = searchQuery.toLowerCase();
       return fullName.includes(query) || sn.includes(query);
    }

    return true;
  });

  const facultiesListStrings = Array.from(new Set(cohorts.map(c => c.field).filter(Boolean)));
  const departmentsListStrings = Array.from(new Set(cohorts.filter(c => !selectedFaculty || c.field === selectedFaculty).map(c => c.subject).filter(Boolean)));
  const specialtiesListStrings = Array.from(new Set(cohorts.filter(c => (!selectedFaculty || c.field === selectedFaculty) && (!selectedDept || c.subject === selectedDept)).map(c => c.specialty).filter(Boolean)));
  const cohortsForTabs = cohorts.filter(c => (!selectedFaculty || c.field === selectedFaculty) && (!selectedDept || c.subject === selectedDept) && (!selectedSpec || c.specialty === selectedSpec));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentNumber?.trim() || !formData.firstName?.trim() || !formData.lastName?.trim() || !formData.cohortId) {
      return setError('جميع الحقول الأساسية مطلوبة');
    }
    try {
      const payload: StudentFormData = { studentNumber: formData.studentNumber, firstName: formData.firstName, lastName: formData.lastName, cohortId: formData.cohortId };
      if (editingStudent) await updateStudent(editingStudent.id, payload);
      else await addStudent(payload);
      setIsDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) { setError('حدث خطأ أثناء حفظ الطالب'); }
  };

  const resetForm = () => {
    setFormData({ studentNumber: '', firstName: '', lastName: '', cohortId: '' });
    setFormFacultyId(''); setFormDeptId(''); setFormSpecId('');
    setEditingStudent(null); setError('');
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    const cId = student.cohortId || student.cohort_id || '';
    const cohort = cohorts.find(c => c.id === cId);
    if (cohort) {
      setFormFacultyId(dbFaculties.find(f => f.name === cohort.field)?.id || '');
      setFormDeptId(dbDepartments.find(d => d.name === cohort.subject)?.id || '');
      setFormSpecId(dbSpecialties.find(s => s.name === cohort.specialty)?.id || '');
    }
    setFormData({
      studentNumber: student.studentNumber || student.student_number || '',
      firstName: student.firstName || student.first_name || '',
      lastName: student.lastName || student.last_name || '',
      cohortId: cId,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('حذف هذا الطالب نهائياً؟')) {
      await deleteStudent(id);
      await loadData();
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile || !importCohortId) return;
    try {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!(e.target?.result instanceof ArrayBuffer)) return;

        const { default: ExcelJS } = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(e.target.result);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) return;

        const headerMap = new Map<string, number>();
        worksheet.getRow(1).eachCell((cell, columnNumber) => {
          const header = excelCellToText(cell.value);
          if (header) headerMap.set(header, columnNumber);
        });

        const imported: Array<{ studentNumber: string; firstName: string; lastName: string }> = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;

          const studentNumber = readExcelField(row, headerMap, ['رقم التسجيل', 'studentNumber', 'ID']);
          const firstName = readExcelField(row, headerMap, ['الاسم', 'firstName']);
          const lastName = readExcelField(row, headerMap, ['اللقب', 'lastName']);

          if (studentNumber && firstName) {
            imported.push({ studentNumber, firstName, lastName });
          }
        });

        if (imported.length > 0) {
          await importStudentsFromExcel(
            imported.map((student) => ({
              student_number: student.studentNumber,
              first_name: student.firstName,
              last_name: student.lastName,
            })),
            importCohortId
          );
        }
        setIsImportDialogOpen(false);
        setExcelFile(null);
        await loadData();
      };
      reader.readAsArrayBuffer(excelFile);
    } finally { setLoading(false); }
  };

  if (loading && students.length === 0) return <Card><CardContent className="p-12 text-center animate-pulse text-indigo-500 font-medium">جاري تحديث بيانات الطلاب...</CardContent></Card>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl">
             <GraduationCap className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة {ui.dictionary.students}</h1>
            <p className="text-slate-500 text-sm">متابعة سجلات الطلاب ونسب حضورهم الأكاديمي</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-11 px-4 border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2">
                  <Upload className="h-4 w-4" /> استيراد Excel
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined}>
                <DialogHeader><DialogTitle>استيراد جماعي للطلاب</DialogTitle></DialogHeader>
                <form onSubmit={handleImport} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>الفوج المستهدف</Label>
                    <Select value={importCohortId} onValueChange={setImportCohortId}>
                      <SelectTrigger><SelectValue placeholder="اختر الفوج" /></SelectTrigger>
                      <SelectContent>{cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ملف Excel</Label>
                    <Input type="file" accept=".xlsx, .xls" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} />
                  </div>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!excelFile || !importCohortId}>بدء الاستيراد</Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 px-6 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100 gap-2">
                  <Plus className="h-5 w-5" /> إضافة طالب
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined} className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingStudent ? `تعديل الطالب` : `إضافة طالب جديد`}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 pt-4">
                  {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                  
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase">المسار الأكاديمي للطالب</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <select className="flex h-9 text-sm border rounded-md px-2 focus:ring-2 focus:ring-blue-500 outline-none" value={formFacultyId} onChange={(e) => { setFormFacultyId(e.target.value); setFormDeptId(''); setFormSpecId(''); setFormData({ ...formData, cohortId: '' }); }}>
                         <option value="">إختر الكلية</option>
                         {dbFaculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <select className="flex h-9 text-sm border rounded-md px-2 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" value={formDeptId} disabled={!formFacultyId} onChange={(e) => { setFormDeptId(e.target.value); setFormSpecId(''); setFormData({ ...formData, cohortId: '' }); }}>
                         <option value="">إختر القسم</option>
                         {dbDepartments.filter(d => d.faculty_id === formFacultyId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <select className="flex h-9 text-sm border rounded-md px-2 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" value={formSpecId} disabled={!formDeptId} onChange={(e) => { setFormSpecId(e.target.value); setFormData({ ...formData, cohortId: '' }); }}>
                         <option value="">إختر التخصص</option>
                         {dbSpecialties.filter(s => s.department_id === formDeptId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select className="flex h-9 text-sm border-2 border-blue-400 rounded-md px-2 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.cohortId} onChange={(e) => setFormData({ ...formData, cohortId: e.target.value })}>
                         <option value="">-- الفوج النهائي * --</option>
                         {cohorts.filter(c => (!formFacultyId || (dbFaculties.find(f => f.id === formFacultyId)?.name === c.field)) && (!formDeptId || (dbDepartments.find(d => d.id === formDeptId)?.name === c.subject)) && (!formSpecId || (dbSpecialties.find(s => s.id === formSpecId)?.name === c.specialty))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label>الرقم الجامعي</Label>
                       <Input value={formData.studentNumber} onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })} placeholder="رقم التسجيل" />
                    </div>
                    <div className="space-y-2">
                       <Label>الاسم</Label>
                       <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                    </div>
                    <div className="space-y-2 col-span-2">
                       <Label>اللقب</Label>
                       <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t mt-4">
                    <Button type="submit" className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">{editingStudent ? 'تحديث الطالب' : 'إيداع البيانات'}</Button>
                    <Button type="button" variant="outline" className="h-11" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      <Card className="border-slate-100 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">فرز الطلاب:</span>
                <Button variant={selectedFaculty ? 'default' : 'outline'} size="sm" onClick={() => { if (selectedFaculty) { setSelectedFaculty(null); setSelectedDept(null); setSelectedSpec(null); setSelectedCohort(null); } }} className={`h-8 rounded-full ${selectedFaculty ? 'bg-blue-600' : 'text-slate-600 bg-white'}`}> {selectedFaculty ? `🏛 ${selectedFaculty}` : 'كل الكليات'} </Button>
                {selectedFaculty && ( <><ChevronRight className="h-3 w-3 text-slate-300" /> <Button variant={selectedDept ? 'default' : 'outline'} size="sm" onClick={() => { if (selectedDept) { setSelectedDept(null); setSelectedSpec(null); setSelectedCohort(null); } }} className={`h-8 rounded-full ${selectedDept ? 'bg-indigo-600' : 'text-slate-600 bg-white'}`}> {selectedDept ? `🏢 ${selectedDept}` : 'كل الأقسام'} </Button></> )}
                {selectedDept && ( <><ChevronRight className="h-3 w-3 text-slate-300" /> <Button variant={selectedSpec ? 'default' : 'outline'} size="sm" onClick={() => { if (selectedSpec) { setSelectedSpec(null); setSelectedCohort(null); } }} className={`h-8 rounded-full ${selectedSpec ? 'bg-purple-600' : 'text-slate-600 bg-white'}`}> {selectedSpec ? `📚 ${selectedSpec}` : 'كل التخصصات'} </Button></> )}
                {selectedSpec && ( <><ChevronRight className="h-3 w-3 text-slate-300" /> <Button variant={selectedCohort ? 'default' : 'outline'} size="sm" onClick={() => { if (selectedCohort) setSelectedCohort(null); }} className={`h-8 rounded-full ${selectedCohort ? 'bg-emerald-600' : 'text-slate-600 bg-white'}`}> {selectedCohort ? `👥 ${cohorts.find(c => c.id === selectedCohort)?.name}` : 'كل الأفواج'} </Button></> )}
            </div>

            <div className="flex flex-col md:flex-row gap-3">
               <div className="relative flex-1">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                  <Input placeholder="بحث بالاسم أو الرقم الجامعي..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-10 border-slate-200 bg-white focus:ring-blue-500" />
               </div>
               <div className="flex flex-wrap gap-2">
                  {!selectedFaculty && facultiesListStrings.map(f => <Badge key={f} variant="secondary" className="cursor-pointer hover:bg-blue-100 bg-white border border-slate-200" onClick={() => setSelectedFaculty(f)}>{f}</Badge>)}
                  {selectedFaculty && !selectedDept && departmentsListStrings.map(d => <Badge key={d} variant="secondary" className="cursor-pointer hover:bg-indigo-100 bg-white border border-slate-200" onClick={() => setSelectedDept(d)}>{d}</Badge>)}
                  {selectedDept && !selectedSpec && specialtiesListStrings.map(s => <Badge key={s} variant="secondary" className="cursor-pointer hover:bg-purple-100 bg-white border border-slate-200" onClick={() => setSelectedSpec(s)}>{s}</Badge>)}
                  {selectedSpec && !selectedCohort && cohortsForTabs.map(c => <Badge key={c.id} variant="secondary" className="cursor-pointer hover:bg-emerald-100 bg-white border border-emerald-200 text-emerald-700" onClick={() => setSelectedCohort(c.id)}>{c.name}</Badge>)}
               </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-[180px] text-right font-bold text-slate-600">الرقم الجامعي</TableHead>
                  <TableHead className="text-right font-bold text-slate-600">الاسم الكامل</TableHead>
                  <TableHead className="text-right font-bold text-slate-600">المسار الأكاديمي</TableHead>
                  <TableHead className="w-[120px] text-center font-bold text-slate-600">الحضور</TableHead>
                  <TableHead className="w-[100px] text-left font-bold text-slate-600">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((s) => {
                    const cId = s.cohortId || s.cohort_id;
                    const c = cohorts.find(ch => ch.id === cId);
                    
                    const absences = (s.stats?.total || 0) - (s.stats?.attended || 0);
                    const isExcluded = absences >= 5;
                    const isAtRisk = absences >= 3 && absences < 5;
                    const isLow = (s.stats?.percentage || 0) < 50;

                    return (
                      <TableRow key={s.id} className={`group hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-0 text-slate-700 ${isExcluded ? 'bg-rose-50/30' : ''}`}>
                        <TableCell className="font-mono text-[13px]">{s.student_number || s.studentNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                             <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isExcluded ? 'bg-rose-100 text-rose-600' : isAtRisk ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                {isExcluded ? <UserMinus className="h-4 w-4" /> : isAtRisk ? <ShieldAlert className="h-4 w-4" /> : <UserCircle className="h-5 w-5" />}
                             </div>
                             <div className="flex flex-col">
                                <span className={`font-bold ${isExcluded ? 'text-rose-700' : ''}`}>{(s.firstName || s.first_name) || '—'} {(s.lastName || s.last_name) || ''}</span>
                                {isExcluded && <span className="text-[9px] font-black text-rose-500 uppercase">مقصى (Excluded) ❌</span>}
                                {isAtRisk && <span className="text-[9px] font-black text-amber-500 uppercase">تحذير: {absences} غيابات ⚠️</span>}
                             </div>
                          </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                 <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-100">{c?.name || 'فوج غير معروف'}</Badge>
                                 <span className="text-[11px] text-slate-400 font-medium">/ {c?.field}</span>
                              </div>
                              <div className="flex items-center gap-1 pr-1.5 opacity-60">
                                 <ChevronRight className="h-3 w-3 text-slate-300" />
                                 <span className="text-[11px] truncate max-w-[150px]">{c?.subject} {c?.specialty && `↳ ${c.specialty}`}</span>
                              </div>
                           </div>
                        </TableCell>
                        <TableCell className="text-center">
                           {s.stats ? (
                             <div className="flex flex-col items-center gap-1">
                                <Badge variant={isLow ? 'destructive' : 'default'} className={`text-[11px] px-2 ${!isLow ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}>
                                   {s.stats.percentage}%
                                </Badge>
                                <span className="text-[10px] text-slate-400">{s.stats.attended}/{s.stats.total} حصة</span>
                             </div>
                           ) : <span className="text-slate-300">-</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(s)} className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Edit className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">لا يوجد طلاب يطابقون معايير التصفية</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
