import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, AlertCircle, Filter, Search, ChevronRight, School, Building2, BookOpen, Users2 } from 'lucide-react';
import { getCohorts, addCohort, updateCohort, deleteCohort, getFaculties, getDepartments, getSpecialties } from '@/lib/database';
import { useInstitutionUI } from '@/config/institutions';
import type { Cohort, Faculty, Department, Specialty } from '@/lib/types';
import { isPrimaryOrMiddle } from '@/lib/schoolHelpers';

const LEVEL_OPTIONS: Array<{ value: Cohort['level']; label: string }> = [
  { value: 'L1', label: 'ليسانس 1' },
  { value: 'L2', label: 'ليسانس 2' },
  { value: 'L3', label: 'ليسانس 3' },
  { value: 'M1', label: 'ماستر 1' },
  { value: 'M2', label: 'ماستر 2' },
];

export default function CohortsTab() {
  const ui = useInstitutionUI();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [filteredCohorts, setFilteredCohorts] = useState<Cohort[]>([]);
  const [dbFaculties, setDbFaculties] = useState<Faculty[]>([]);
  const [dbDepartments, setDbDepartments] = useState<Department[]>([]);
  const [dbSpecialties, setDbSpecialties] = useState<Specialty[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: '' as Cohort['level'] | '',
    facultyId: '',
    departmentId: '',
    specialtyId: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '' });
  const [showFilters, setShowFilters] = useState(false);

  const selectedFacultyName = dbFaculties.find(f => f.id === formData.facultyId)?.name || '';
  const selectedDeptName = dbDepartments.find(d => d.id === formData.departmentId)?.name || '';
  const hideSpecialtyInput = isPrimaryOrMiddle(null, selectedFacultyName) || isPrimaryOrMiddle(null, selectedDeptName);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cohortsData, facs, depts, specs] = await Promise.all([
        getCohorts(), getFaculties(), getDepartments(), getSpecialties()
      ]);
      setCohorts(cohortsData);
      setFilteredCohorts(cohortsData);
      setDbFaculties(facs);
      setDbDepartments(depts);
      setDbSpecialties(specs);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...cohorts];
    if (filters.search) {
      filtered = filtered.filter((cohort) =>
        cohort.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        cohort.field?.toLowerCase().includes(filters.search.toLowerCase()) ||
        cohort.specialty?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    if (selectedFaculty) filtered = filtered.filter((cohort) => cohort.field === selectedFaculty);
    if (selectedDept) filtered = filtered.filter((cohort) => cohort.subject === selectedDept);
    if (selectedSpec) filtered = filtered.filter((cohort) => cohort.specialty === selectedSpec);
    setFilteredCohorts(filtered);
  }, [cohorts, filters, selectedFaculty, selectedDept, selectedSpec]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) return setError('اسم الفوج مطلوب');
    
    const facName = dbFaculties.find(f => f.id === formData.facultyId)?.name || '';
    const deptName = dbDepartments.find(d => d.id === formData.departmentId)?.name || '';
    const specName = dbSpecialties.find(s => s.id === formData.specialtyId)?.name || '';

    try {
      const payload: Omit<Cohort, 'id' | 'createdAt' | 'created_at'> = {
        name: formData.name,
        description: formData.description || null,
        level: formData.level || null,
        field: facName || null,
        subject: deptName || null,
        specialty: specName || null,
      };

      if (editingCohort) {
        await updateCohort(editingCohort.id, payload);
      } else {
        await addCohort(payload);
      }

      setIsDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      setError('حدث خطأ أثناء الحفظ');
    }
  };

  const handleEdit = (cohort: Cohort) => {
    setEditingCohort(cohort);
    const fId = dbFaculties.find(f => f.name === cohort.field)?.id || '';
    const dId = dbDepartments.find(d => d.name === cohort.subject)?.id || '';
    const sId = dbSpecialties.find(s => s.name === cohort.specialty)?.id || '';

    setFormData({
      name: cohort.name,
      description: cohort.description || '',
      level: cohort.level || '',
      facultyId: fId,
      departmentId: dId,
      specialtyId: sId,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الفوج؟')) {
      await deleteCohort(id);
      await loadData();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', level: '', facultyId: '', departmentId: '', specialtyId: '' });
    setEditingCohort(null);
  };

  const getFilteredFormDepartments = () => dbDepartments.filter(d => d.faculty_id === formData.facultyId);
  const getFilteredFormSpecialties = () => dbSpecialties.filter(s => s.department_id === formData.departmentId);

  const facultiesListStrings = Array.from(new Set(cohorts.map(c => c.field).filter(Boolean)));
  const departmentsListStrings = Array.from(new Set(cohorts.filter(c => !selectedFaculty || c.field === selectedFaculty).map(c => c.subject).filter(Boolean)));
  const specialtiesListStrings = Array.from(new Set(cohorts.filter(c => (!selectedFaculty || c.field === selectedFaculty) && (!selectedDept || c.subject === selectedDept)).map(c => c.specialty).filter(Boolean)));

  if (loading && cohorts.length === 0) return <Card><CardContent className="p-12 text-center animate-pulse text-indigo-500 font-medium">جاري مزامنة الأفواج...</CardContent></Card>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
             <Users2 className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة {ui.dictionary.cohorts}</h1>
            <p className="text-slate-500 text-sm">تنظيم المجموعات الطلابية بنظام هيكلي متطور</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={`gap-2 h-11 border-slate-200 ${showFilters ? 'bg-slate-100' : ''}`}>
            <Filter className="h-4 w-4" />
            تصفية
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 gap-2">
                <Plus className="h-5 w-5" />
                إضافة {ui.dictionary.cohort}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">{editingCohort ? `تعديل ${ui.dictionary.cohort}` : `إضافة ${ui.dictionary.cohort} جديد`}</DialogTitle>
                <DialogDescription>أدخل بيانات {ui.dictionary.cohort} بدقة لضمان صحة التقارير الأكاديمية</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5 pt-4">
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{ui.dictionary.faculty} 🏛️</Label>
                  <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.facultyId} onChange={(e) => setFormData({ ...formData, facultyId: e.target.value, departmentId: '', specialtyId: '' })}>
                    <option value="">-- إختر {ui.dictionary.faculty} --</option>
                    {dbFaculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{ui.dictionary.department} 🏢</Label>
                  <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50" value={formData.departmentId} disabled={!formData.facultyId} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value, specialtyId: '' })}>
                    <option value="">-- إختر {ui.dictionary.department} --</option>
                    {getFilteredFormDepartments().map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                {!hideSpecialtyInput && (
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">{ui.dictionary.specialty} 📚</Label>
                    <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50" value={formData.specialtyId} disabled={!formData.departmentId} onChange={(e) => setFormData({ ...formData, specialtyId: e.target.value })}>
                      <option value="">-- إختر {ui.dictionary.specialty} --</option>
                      {getFilteredFormSpecialties().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">المستوى 🎓</Label>
                  <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.level || ''} onChange={(e) => setFormData({ ...formData, level: e.target.value as Cohort['level'] })}>
                    <option value="">-- المستوى --</option>
                    {LEVEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value || ''}>{opt.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700 font-medium">اسم {ui.dictionary.cohort} (مثل: {ui.dictionary.cohort} 01)</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="h-11 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" />
              </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700">{editingCohort ? 'تحديث البيانات' : 'إنشاء وحفظ'}</Button>
                  <Button type="button" variant="outline" className="h-11 px-8" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-slate-100 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="p-4 bg-slate-50/50 border-b border-slate-100">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">تصفية سريعة:</span>
                <Button variant={selectedFaculty ? 'default' : 'outline'} size="sm" onClick={() => { if (selectedFaculty) { setSelectedFaculty(null); setSelectedDept(null); setSelectedSpec(null); } }} className={`h-8 rounded-full ${selectedFaculty ? 'bg-indigo-600' : 'text-slate-600 bg-white'}`}>
                  {selectedFaculty ? `🏛 ${selectedFaculty}` : `كل ${ui.dictionary.faculties}`}
                </Button>
                {selectedFaculty && ( <><ChevronRight className="h-3 w-3 text-slate-300" /> <Button variant={selectedDept ? 'default' : 'outline'} size="sm" onClick={() => { if (selectedDept) { setSelectedDept(null); setSelectedSpec(null); } }} className={`h-8 rounded-full ${selectedDept ? 'bg-blue-600' : 'text-slate-600 bg-white'}`}> {selectedDept ? `🏢 ${selectedDept}` : `كل ${ui.dictionary.departments}`} </Button></> )}
                {selectedFaculty && selectedDept && ( <><ChevronRight className="h-3 w-3 text-slate-300" /> <Button variant={selectedSpec ? 'default' : 'outline'} size="sm" onClick={() => { if (selectedSpec) setSelectedSpec(null); }} className={`h-8 rounded-full ${selectedSpec ? 'bg-emerald-600' : 'text-slate-600 bg-white'}`}> {selectedSpec ? `📚 ${selectedSpec}` : `كل ${ui.dictionary.specialties}`} </Button></> )}
              </div>

              <div className="flex flex-wrap gap-2">
                 {!selectedFaculty && facultiesListStrings.map(f => <Badge key={f} variant="secondary" className="cursor-pointer hover:bg-indigo-100 hover:text-indigo-700 bg-white border border-slate-200 px-3 py-1 transition-colors" onClick={() => setSelectedFaculty(f)}>{f}</Badge>)}
                 {selectedFaculty && !selectedDept && departmentsListStrings.map(d => <Badge key={d} variant="secondary" className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 bg-white border border-slate-200 px-3 py-1 transition-colors" onClick={() => setSelectedDept(d)}>{d}</Badge>)}
                 {selectedFaculty && selectedDept && !selectedSpec && specialtiesListStrings.map(s => <Badge key={s} variant="secondary" className="cursor-pointer hover:bg-emerald-100 hover:text-emerald-700 bg-white border border-slate-200 px-3 py-1 transition-colors" onClick={() => setSelectedSpec(s)}>{s}</Badge>)}
              </div>

              {showFilters && (
                <div className="relative animate-in slide-in-from-top-2 duration-300 pt-2 border-t border-slate-100 mt-2">
                  <Search className="absolute right-3 top-5 h-4 w-4 text-slate-400" />
                  <Input placeholder={`بحث عن اسم ${ui.dictionary.cohort} محدد...`} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="pr-10 h-10 border-slate-200 bg-white" />
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[200px] text-right font-bold text-slate-600 py-4">اسم {ui.dictionary.cohort}</TableHead>
                  <TableHead className="text-right font-bold text-slate-600 py-4">الهيكل التنظيمي</TableHead>
                  <TableHead className="w-[150px] text-center font-bold text-slate-600 py-4">المستوى</TableHead>
                  <TableHead className="w-[120px] text-left font-bold text-slate-600 py-4">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCohorts.length > 0 ? (
                  filteredCohorts.map((cohort) => (
                    <TableRow key={cohort.id} className="group hover:bg-indigo-50/30 transition-colors border-b border-slate-50 last:border-0">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-1 bg-indigo-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="font-bold text-lg text-slate-800">{cohort.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <School className="h-3.5 w-3.5 text-indigo-400" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">{cohort.field || '-'}</span>
                          </div>
                          {(cohort.subject || cohort.specialty) && (
                            <div className="flex items-center gap-3 mr-1">
                               <div className="border-r-2 border-slate-100 h-8 mr-1.5" />
                               <div className="flex flex-col gap-1">
                                  {cohort.subject && (
                                    <div className="flex items-center gap-1.5">
                                      <Building2 className="h-3 w-3 text-blue-400" />
                                      <span className="text-[13px] text-slate-600 font-medium">{cohort.subject}</span>
                                    </div>
                                  )}
                                  {cohort.specialty && (
                                    <div className="flex items-center gap-1.5">
                                      <BookOpen className="h-3 w-3 text-emerald-400" />
                                      <span className="text-[12px] text-slate-400 bg-slate-50 px-2 rounded-full border border-slate-100">{cohort.specialty}</span>
                                    </div>
                                  )}
                               </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        {cohort.level ? (
                          <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-100 px-3 font-bold">
                            {LEVEL_OPTIONS.find((l) => l.value === cohort.level)?.label}
                          </Badge>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex justify-end gap-1 px-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(cohort)} className="h-9 w-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(cohort.id)} className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3 opacity-40">
                         <Filter className="h-12 w-12 text-slate-300" />
                         <p className="text-lg font-medium text-slate-500">لا توجد نتائج تطابق بحثك</p>
                         <Button variant="link" onClick={() => { setSelectedFaculty(null); setSelectedDept(null); setSelectedSpec(null); setFilters({search: ''}); }} className="text-indigo-600">إلغاء جميع الفلاتر</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}