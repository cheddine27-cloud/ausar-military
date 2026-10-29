import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  UserPlus, Trash2, Key, Copy, CheckCircle, AlertCircle, Eye, 
  Users, UserCheck, ShieldCheck, Mail, Building2, Search, 
  RefreshCw, GraduationCap, School, ChevronRight, Briefcase,
  Pencil
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getFaculties, getDepartments } from '@/lib/database';
import { createAdminAuthUser } from '@/lib/adminAuth';
import type { Admin, Faculty, Department } from '@/lib/types';
import ProfessorDetailsView from './ProfessorDetailsView';
import { toast } from 'sonner';

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

export default function ProfessorsTab() {
  const [professors, setProfessors] = useState<Admin[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProfessor, setSelectedProfessor] = useState<Admin | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');

  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    departmentId: '', // Changed to handle ID
    facultyId: '',    // Added Faculty
    secondaryDept: '', // Keep a text backup if needed
    rank: 'أستاذ',
    password: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);
      
      const [adminsResponse, facData, depData] = await Promise.all([
        supabase.from('admins').select('*').order('created_at', { ascending: false }),
        getFaculties(),
        getDepartments()
      ]);

      if (adminsResponse.error) throw adminsResponse.error;
      
      setProfessors(adminsResponse.data || []);
      setFaculties(facData);
      setDepartments(depData);
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('تم نسخ كلمة المرور!');
  };

  const handleAddProfessor = async () => {
    if (!formData.username || !formData.email || !formData.password) {
      toast.error('اسم المستخدم والبريد الإلكتروني وكلمة المرور مطلوبة');
      return;
    }

    try {
      const selectedDept = departments.find(d => d.id === formData.departmentId)?.name || formData.secondaryDept;
      const authUserId = await createAdminAuthUser({
        email: formData.email,
        password: formData.password,
        username: formData.username,
        fullName: formData.fullName || null,
        role: 'teacher',
      });
      
      const { error } = await supabase
        .from('admins')
        .insert([{
          auth_user_id: authUserId,
          username: formData.username,
          full_name: formData.fullName || null,
          email: formData.email || null,
          department: selectedDept || null,
          rank: formData.rank || 'أستاذ',
          role: 'teacher'
        }]);

      if (error) throw error;

      toast.success('تم إضافة الأستاذ بنجاح!');
      setDialogOpen(false);
      setFormData({ username: '', fullName: '', email: '', departmentId: '', facultyId: '', secondaryDept: '', rank: 'أستاذ', password: '' });
      loadData(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'حدث خطأ أثناء إضافة الأستاذ'));
    }
  };

  const handleDeleteProfessor = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف ${name}؟`)) return;

    try {
      const { error } = await supabase.from('admins').delete().eq('id', id);
      if (error) throw error;
      toast.success('تم حذف الأستاذ بنجاح');
      loadData(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'حدث خطأ أثناء الحذف'));
    }
  };

  const handleViewDetails = (prof: Admin) => {
    setSelectedProfessor(prof);
    setDetailsDialogOpen(true);
  };

  const handleEditClick = (prof: Admin) => {
    setSelectedProfessor(prof);
    const deptId = departments.find(d => d.name === prof.department)?.id || '';
    const facId = departments.find(d => d.name === prof.department)?.faculty_id || '';
    
    setFormData({
      username: prof.username,
      fullName: prof.fullName || prof.full_name || '',
      email: prof.email || '',
      departmentId: deptId,
      facultyId: facId,
      secondaryDept: prof.department || '',
      rank: prof.rank || 'أستاذ',
      password: '' // Keep empty unless changing
    });
    setEditDialogOpen(true);
  };

  const handleUpdateProfessor = async () => {
    if (!selectedProfessor) return;
    
    try {
      const selectedDept = departments.find(d => d.id === formData.departmentId)?.name || formData.secondaryDept;
      
      const updateData = {
        full_name: formData.fullName || null,
        email: formData.email || null,
        department: selectedDept || null,
        rank: formData.rank || 'أستاذ'
      };

      if (formData.password) {
        toast.error('تغيير كلمة المرور يجب أن يتم عبر Supabase Auth وليس جدول admins');
        return;
      }

      const { error } = await supabase
        .from('admins')
        .update(updateData)
        .eq('id', selectedProfessor.id);

      if (error) throw error;

      toast.success('تم تحديث بيانات الأستاذ بنجاح');
      setEditDialogOpen(false);
      loadData(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'حدث خطأ أثناء التحديث'));
    }
  };

  // Filter Logic
  const filteredProfessors = useMemo(() => {
    return professors.filter(p => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const found = (p.username || '').toLowerCase().includes(q) || 
                      (p.fullName || p.full_name || '').toLowerCase().includes(q) || 
                      (p.email || '').toLowerCase().includes(q);
        if (!found) return false;
      }

      // Role filter
      if (selectedRole !== 'all' && p.role !== selectedRole) return false;

      // Department filter (using text match for now as existing data is text-based)
      if (selectedFaculty !== 'all') {
        const faculty = faculties.find(f => f.id === selectedFaculty);
        // This is tricky if existing 'department' column is just text
        // But for new ones, we can try to find matches
      }
      
      if (selectedDepartment !== 'all') {
        const dept = departments.find(d => d.id === selectedDepartment);
        if (dept && p.department !== dept.name) return false;
      }

      // Unified Role/Rank filter
      if (selectedRole !== 'all') {
        if (selectedRole === 'super_admin') {
          if (p.role !== 'super_admin') return false;
        } else if (ranks.includes(selectedRole)) {
          if (p.rank !== selectedRole) return false;
        } else if (selectedRole === 'teacher') {
          if (p.role !== 'teacher') return false;
        }
      }

      return true;
    });
  }, [professors, searchQuery, selectedRole, selectedDepartment, faculties, departments]);

  // KPI
  const kpi = useMemo(() => {
    const total = professors.length;
    const teachers = professors.filter(p => p.role === 'teacher').length;
    const recent = professors.filter(p => {
       const created = new Date(p.createdAt || p.created_at || '').getTime();
       const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
       return created > thirtyDaysAgo;
    }).length;

    // Most active department (by count)
    const depts: Record<string, number> = {};
    professors.forEach(p => {
      if (p.department) depts[p.department] = (depts[p.department] || 0) + 1;
    });
    let topDept = '—';
    let max = 0;
    Object.entries(depts).forEach(([name, count]) => {
      if (count > max) { topDept = name; max = count; }
    });

    return { total, teachers, recent, topDept };
  }, [professors]);

  // UI Helpers
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getRandomGradient = (username: string) => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-purple-500 to-pink-600',
      'from-cyan-500 to-blue-600',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-600'
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const ranks = ['أستاذ محاضر', 'أستاذ TD', 'أستاذ'];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">جاري تحميل بيانات الطاقم...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-indigo-600" />
            إدارة الطاقم الأكاديمي
          </h2>
          <p className="text-sm text-muted-foreground mt-1">إضافة وإدارة حسابات الأساتذة ومدراء النظام</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              loadData(true);
              toast.info('جاري تحديث البيانات...');
            }} 
            disabled={isRefreshing} 
            className="group h-10 px-4 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border border-slate-200 dark:border-slate-800 transition-all active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 ml-2 transition-transform duration-500 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            تحديث البيانات
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <UserPlus className="ml-2 h-4 w-4" />
                إضافة أستاذ جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إضافة أستاذ جديد</DialogTitle>
                <DialogDescription>أدخل بيانات الأستاذ وقم بتوليد كلمة مرور آمنة</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">اسم المستخدم *</Label>
                    <Input id="username" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} placeholder="dr.ahmed" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">الاسم الكامل</Label>
                    <Input id="fullName" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} placeholder="د. أحمد محمد" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="prof@university.dz" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الكلية</Label>
                    <Select value={formData.facultyId} onValueChange={(val) => setFormData({...formData, facultyId: val, departmentId: ''})}>
                      <SelectTrigger><SelectValue placeholder="اختر الكلية" /></SelectTrigger>
                      <SelectContent>
                        {faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>القسم</Label>
                    <Select value={formData.departmentId} onValueChange={(val) => setFormData({...formData, departmentId: val})} disabled={!formData.facultyId}>
                      <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                      <SelectContent>
                        {departments.filter(d => d.faculty_id === formData.facultyId).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">الرتبة الأكاديمية</label>
                  <Select value={formData.rank} onValueChange={(val) => setFormData({...formData, rank: val})}>
                    <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ranks.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور *</Label>
                  <div className="flex gap-2">
                    <Input id="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="كلمة المرور" className="font-mono" />
                    <Button type="button" variant="outline" size="icon" onClick={generatePassword}><Key className="h-4 w-4" /></Button>
                    {formData.password && <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(formData.password)}><Copy className="h-4 w-4" /></Button>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">اضغط على المفتاح لتوليد كلمة مرور قوية</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                <Button onClick={handleAddProfessor} className="bg-indigo-600 hover:bg-indigo-700">إضافة الأستاذ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm dark:bg-slate-900 overflow-hidden">
          <div className="h-1 bg-indigo-500" />
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-medium">إجمالي الطاقم</p>
                <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{kpi.total}</p>
                <p className="text-xs text-muted-foreground mt-1">مدراء وأساتذة</p>
              </div>
              <div className="p-2.5 bg-indigo-500/10 rounded-xl"><Users className="h-5 w-5 text-indigo-500" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm dark:bg-slate-900 overflow-hidden">
          <div className="h-1 bg-blue-500" />
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-medium">الأساتذة</p>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400 mt-1">{kpi.teachers}</p>
                <p className="text-xs text-muted-foreground mt-1">بحساب محدد الصلاحية</p>
              </div>
              <div className="p-2.5 bg-blue-500/10 rounded-xl"><UserCheck className="h-5 w-5 text-blue-500" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm dark:bg-slate-900 overflow-hidden">
          <div className="h-1 bg-emerald-500" />
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-medium">القسم الأكثر نشاطاً</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-2 truncate w-32">{kpi.topDept}</p>
                <p className="text-xs text-muted-foreground mt-1">أعلى عدد من الطاقم</p>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-xl"><Building2 className="h-5 w-5 text-emerald-500" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm dark:bg-slate-900 overflow-hidden">
          <div className="h-1 bg-violet-500" />
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-medium">منضمون حديثاً</p>
                <p className="text-3xl font-black text-violet-600 dark:text-violet-400 mt-1">{kpi.recent}</p>
                <p className="text-xs text-muted-foreground mt-1">خلال آخر 30 يوماً</p>
              </div>
              <div className="p-2.5 bg-violet-500/10 rounded-xl"><RefreshCw className="h-5 w-5 text-violet-500" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTERS */}
      <Card className="border-none shadow-sm dark:bg-slate-900">
        <CardHeader className="pb-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-purple-500" />
            تصفية وبحث شامل
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-4 pb-4">
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">بحث مباشر</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="الاسم، الإيميل، اليوزر..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-9 h-10 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">الرتبة</label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🔁 جميع الفئات</SelectItem>
                <SelectItem value="super_admin">🛡️ مدير نظام</SelectItem>
                <SelectItem value="أستاذ محاضر">👨‍🏫 أستاذ محاضر</SelectItem>
                <SelectItem value="أستاذ TD">📝 أستاذ TD</SelectItem>
                <SelectItem value="أستاذ">👨‍🏫 أستاذ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">الكلية</label>
            <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="اختر الكلية" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🏛️ جميع الكليات</SelectItem>
                {faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">القسم</label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📂 جميع الأقسام</SelectItem>
                {departments.filter(d => selectedFaculty === 'all' || d.faculty_id === selectedFaculty).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* TABLE */}
      <Card className="border-none shadow-sm dark:bg-slate-900">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100 dark:border-slate-800 hover:bg-transparent">
                  <TableHead className="w-12 text-center py-4 text-xs font-bold uppercase text-muted-foreground">#</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">الأستاذ</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">معلومات الدخول</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">القسم</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">الرتبة</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground text-left px-6">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfessors.map((prof, idx) => {
                  const fullName = prof.fullName || prof.full_name || prof.username;
                  const initials = getInitials(fullName);
                  const gradient = getRandomGradient(prof.username);

                  return (
                    <TableRow key={prof.id} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                      <TableCell className="text-xs text-muted-foreground text-center font-mono">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-black shadow-sm shrink-0`}>
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm tracking-tight">{fullName}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {prof.rank && (
                                <Badge variant="outline" className="text-[9px] py-0 h-4 border-blue-200 text-blue-600 bg-blue-50/50">
                                  {prof.rank}
                                </Badge>
                              )}
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {prof.email || 'لا يوجد بريد'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md font-mono w-fit">
                            @{prof.username}
                          </code>
                          <span className="text-[10px] text-muted-foreground mt-1">
                            أنشئ: {new Date(prof.createdAt || prof.created_at || '').toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                          {prof.department || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {prof.role === 'super_admin' ? (
                          <Badge className="bg-purple-500 hover:bg-purple-600 gap-1.5 py-1">
                            <ShieldCheck className="h-3 w-3" /> مدير نظام
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1.5 py-1">
                            <RefreshCw className="h-3 w-3" /> أستاذ
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-left px-6">
                        <div className="flex gap-2 justify-end transition-opacity">
                          {prof.role === 'super_admin' ? (
                            <Button size="icon" variant="ghost" title="تعديل بيانات المدير" onClick={() => handleEditClick(prof)} className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => handleViewDetails(prof)} className="h-8 w-8 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleEditClick(prof)} className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteProfessor(prof.id, fullName)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {filteredProfessors.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center gap-3">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full">
                <Users className="h-8 w-8 text-slate-300" />
              </div>
              <div>
                <p className="font-bold text-slate-500">لا يوجد نتائج تطابق بحثك</p>
                <p className="text-xs text-slate-400">حاول تغيير معايير التصفية أو التأكد من الاسم</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DETAILS DIALOG */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto p-0 border-none bg-slate-950">
          {selectedProfessor && (
            <ProfessorDetailsView 
              professorId={selectedProfessor.id} 
              professorData={selectedProfessor} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الأستاذ</DialogTitle>
            <DialogDescription>تحديث المعلومات الشخصية أو الرتبة الأكاديمية</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم المستخدم</Label>
                <Input value={formData.username} disabled className="bg-slate-50 dark:bg-slate-800/50" />
              </div>
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} placeholder="الاسم الكامل" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="email@example.com" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الكلية</Label>
                <Select value={formData.facultyId} onValueChange={(val) => setFormData({...formData, facultyId: val, departmentId: ''})}>
                  <SelectTrigger><SelectValue placeholder="اختر الكلية" /></SelectTrigger>
                  <SelectContent>
                    {faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select value={formData.departmentId} onValueChange={(val) => setFormData({...formData, departmentId: val})}>
                  <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                  <SelectContent>
                    {departments.filter(d => d.faculty_id === formData.facultyId).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>الرتبة الأكاديمية</Label>
              <Select value={formData.rank} onValueChange={(val) => setFormData({...formData, rank: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ranks.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800/50">
              <Label className="text-blue-700 dark:text-blue-400">تغيير كلمة المرور (اختياري)</Label>
              <div className="flex gap-2 mt-1">
                <Input 
                  value={formData.password} 
                  onChange={(e) => setFormData({...formData, password: e.target.value})} 
                  placeholder="اتركه فارغاً للحفاظ على الكلمة الحالية" 
                  className="bg-white dark:bg-slate-900"
                />
                <Button variant="outline" size="icon" onClick={generatePassword} type="button">
                  <Key className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleUpdateProfessor} className="bg-blue-600 hover:bg-blue-700">حفظ التغييرات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
