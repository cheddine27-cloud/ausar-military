import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFaculties, getDepartments, getSpecialties, addFaculty, deleteFaculty, addDepartment, deleteDepartment, addSpecialty, deleteSpecialty } from '@/lib/database';
import type { Faculty, Department, Specialty } from '@/lib/types';
import { Trash2, Plus, Building2, GraduationCap, BookOpen, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function FacultyTab() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  
  const [loading, setLoading] = useState(true);

  // States for new items
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [selectedFacultyForDept, setSelectedFacultyForDept] = useState('');
  const [newSpecName, setNewSpecName] = useState('');
  const [selectedDeptForSpec, setSelectedDeptForSpec] = useState('');

  useEffect(() => {
    loadStructure();
  }, []);

  const loadStructure = async () => {
    setLoading(true);
    try {
      const [facs, depts, specs] = await Promise.all([
        getFaculties(),
        getDepartments(),
        getSpecialties()
      ]);
      setFaculties(facs);
      setDepartments(depts);
      setSpecialties(specs);
    } catch (e) {
      toast.error('حدث خطأ أثناء جلب الهيكل الأكاديمي');
    } finally {
      setLoading(false);
    }
  };

  // ---- Handlers ----
  const handleAddFaculty = async () => {
    if (!newFacultyName.trim()) return toast.error('أدخل اسم الكلية');
    const res = await addFaculty(newFacultyName);
    if (res) {
      toast.success('تمت إضافة الكلية بنجاح');
      setNewFacultyName('');
      loadStructure();
    }
  };

  const handleDeleteFaculty = async (id: string) => {
    if (!confirm('هل أنت متأكد؟ سيتم حذف جميع الأقسام المرتبطة بها!')) return;
    if (await deleteFaculty(id)) {
      toast.success('تم الحذف بنجاح');
      loadStructure();
    }
  };

  const handleAddDept = async () => {
    if (!newDeptName.trim() || !selectedFacultyForDept) return toast.error('تأكد من إدخال القسم واختيار الكلية');
    const res = await addDepartment(newDeptName, selectedFacultyForDept);
    if (res) {
      toast.success('تمت إضافة القسم بنجاح');
      setNewDeptName('');
      loadStructure();
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا القسم وكل تخصصاته؟')) return;
    if (await deleteDepartment(id)) {
      toast.success('تم الحذف بنجاح');
      loadStructure();
    }
  };

  const handleAddSpec = async () => {
    if (!newSpecName.trim() || !selectedDeptForSpec) return toast.error('تأكد من إدخال التخصص واختيار القسم');
    const res = await addSpecialty(newSpecName, selectedDeptForSpec);
    if (res) {
      toast.success('تمت إضافة التخصص بنجاح');
      setNewSpecName('');
      loadStructure();
    }
  };

  const handleDeleteSpec = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف التخصص؟')) return;
    if (await deleteSpecialty(id)) {
      toast.success('تم الحذف بنجاح');
      loadStructure();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">الهيكل الأكاديمي</h1>
        <p className="text-muted-foreground">قم بإدارة كليات وأقسام وتخصصات مؤسستك لبناء أفواج احترافية.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* الكليات */}
        <Card className="border-blue-100 shadow-sm">
          <CardHeader className="bg-blue-50/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
              <Building2 className="w-5 h-5" /> الكليات
            </CardTitle>
            <CardDescription>أضف الكليات المركزية لجامعتك</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="اسم الكلية (مثال: كلية الطب)" 
                value={newFacultyName} 
                onChange={(e) => setNewFacultyName(e.target.value)}
              />
              <Button onClick={handleAddFaculty} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {faculties.length === 0 && !loading && (
                <div className="text-sm text-center text-gray-400 py-4">لا توجد كليات مضافة</div>
              )}
              {faculties.map(faculty => (
                <div key={faculty.id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/20 hover:bg-blue-50 transition-colors">
                  <span className="font-medium text-sm">{faculty.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteFaculty(faculty.id)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* الأقسام */}
        <Card className="border-indigo-100 shadow-sm relative">
          <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-1 border shadow-sm">
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </div>
          <CardHeader className="bg-indigo-50/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-indigo-800">
              <GraduationCap className="w-5 h-5" /> الأقسام
            </CardTitle>
            <CardDescription>التي تندرج تحت كل كلية</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={selectedFacultyForDept}
                onChange={(e) => setSelectedFacultyForDept(e.target.value)}
              >
                <option value="">-- اختر الكلية الأم --</option>
                {faculties.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input 
                  placeholder="اسم القسم (مثال: قسم الجراحة)" 
                  value={newDeptName} 
                  onChange={(e) => setNewDeptName(e.target.value)}
                />
                <Button onClick={handleAddDept} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {departments.length === 0 && !loading && (
                <div className="text-sm text-center text-gray-400 py-4">لا توجد أقسام مضافة</div>
              )}
              {departments.map(dept => {
                const fac = faculties.find(f => f.id === dept.faculty_id);
                return (
                  <div key={dept.id} className="flex items-center justify-between p-3 border rounded-lg bg-indigo-50/20 hover:bg-indigo-50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{dept.name}</span>
                      <span className="text-xs text-indigo-500 font-mono bg-indigo-50 px-1 rounded w-fit mt-1">{fac?.name || 'بدون كلية'}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteDept(dept.id)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* التخصصات */}
        <Card className="border-purple-100 shadow-sm relative">
          <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-1 border shadow-sm">
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </div>
          <CardHeader className="bg-purple-50/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-purple-800">
              <BookOpen className="w-5 h-5" /> التخصصات
            </CardTitle>
            <CardDescription>التي تندرج تحت كل قسم</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={selectedDeptForSpec}
                onChange={(e) => setSelectedDeptForSpec(e.target.value)}
              >
                <option value="">-- اختر القسم الأم --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input 
                  placeholder="اسم التخصص (مثال: جراحة أعصاب)" 
                  value={newSpecName} 
                  onChange={(e) => setNewSpecName(e.target.value)}
                />
                <Button onClick={handleAddSpec} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {specialties.length === 0 && !loading && (
                <div className="text-sm text-center text-gray-400 py-4">لا توجد تخصصات مضافة</div>
              )}
              {specialties.map(spec => {
                const dept = departments.find(d => d.id === spec.department_id);
                return (
                  <div key={spec.id} className="flex items-center justify-between p-3 border rounded-lg bg-purple-50/20 hover:bg-purple-50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{spec.name}</span>
                      <span className="text-xs text-purple-500 font-mono bg-purple-50 px-1 rounded w-fit mt-1">{dept?.name || 'بدون قسم'}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSpec(spec.id)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
