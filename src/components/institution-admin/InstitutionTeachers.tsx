// =============================================================================
// Institution Admin — Teachers tab
// =============================================================================
// Focused view of teachers inside the institution, with per-teacher metrics
// (sessions count, students reached, attendance count). Reuses the same
// secure create-institution-user flow, locked to role='teacher'.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Pencil, Copy, Check, KeyRound, GraduationCap, Activity, Users, Calendar, Layers, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import {
  getInstitutionUsers,
  createInstitutionUser,
  updateInstitutionUser,
  deleteInstitutionUser,
  getAssignmentsCountByTeacher,
  type InstitutionUserRow,
} from '@/lib/institutionAdminApi';
import { PERMISSIONS, can, type PermissionMap } from '@/lib/permissions';
import TeacherAssignmentsDialog from './TeacherAssignmentsDialog';

interface Props {
  institutionId: string;
  institutionName: string;
  permissions?: PermissionMap | null;
}

interface TeacherWithStats extends InstitutionUserRow {
  sessionsCount: number;
  attendancesCount: number;
  assignmentsCount: number;
}

export default function InstitutionTeachers({ institutionId, institutionName, permissions }: Props) {
  const canCreateUsers = can(permissions, PERMISSIONS.usersCreate);
  const canAssignTeachers = can(permissions, PERMISSIONS.teachersAssign);

  const [teachers, setTeachers] = useState<TeacherWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    status: 'active' as 'active' | 'suspended',
  });

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm(prev => ({ ...prev, password: pass }));
  };

  const [credentials, setCredentials] = useState<{
    email: string;
    username: string;
    password: string;
    fullName: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InstitutionUserRow | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', status: 'active' });

  // Phase 6: assignments dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<TeacherWithStats | null>(null);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const allUsers = await getInstitutionUsers(institutionId);
      const teacherRows = allUsers.filter((u) => u.role === 'teacher');
      const teacherIds = teacherRows.map((t) => t.id);

      // Fetch all sessions + attendance counts grouped by professor in 2 queries
      const sessionCounts = new Map<string, number>();
      const attendanceCounts = new Map<string, number>();
      let assignmentsByTeacher: Record<string, number> = {};
      if (teacherIds.length > 0) {
        const [{ data: sessions }, { data: attendances }, asn] = await Promise.all([
          supabase
            .from('sessions')
            .select('id, professor_id')
            .eq('institution_id', institutionId)
            .in('professor_id', teacherIds),
          supabase
            .from('attendances')
            .select('session_id')
            .eq('institution_id', institutionId),
          getAssignmentsCountByTeacher(teacherIds, institutionId),
        ]);
        assignmentsByTeacher = asn;

        const sessionToTeacher = new Map<string, string>();
        (sessions ?? []).forEach((s: { id: string; professor_id: string | null }) => {
          if (!s.professor_id) return;
          sessionToTeacher.set(s.id, s.professor_id);
          sessionCounts.set(s.professor_id, (sessionCounts.get(s.professor_id) ?? 0) + 1);
        });

        (attendances ?? []).forEach((a: { session_id: string | null }) => {
          if (!a.session_id) return;
          const teacherId = sessionToTeacher.get(a.session_id);
          if (!teacherId) return;
          attendanceCounts.set(teacherId, (attendanceCounts.get(teacherId) ?? 0) + 1);
        });
      }

      setTeachers(
        teacherRows.map((t) => ({
          ...t,
          sessionsCount: sessionCounts.get(t.id) ?? 0,
          attendancesCount: attendanceCounts.get(t.id) ?? 0,
          assignmentsCount: assignmentsByTeacher[t.id] ?? 0,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      return (
        (t.full_name ?? '').toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q) ||
        (t.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [teachers, search]);

  const totals = useMemo(() => ({
    teachers: teachers.length,
    sessions: teachers.reduce((sum, t) => sum + t.sessionsCount, 0),
    attendances: teachers.reduce((sum, t) => sum + t.attendancesCount, 0),
    active: teachers.filter((t) => t.sessionsCount > 0).length,
    unassigned: teachers.filter((t) => t.assignmentsCount === 0).length,
  }), [teachers]);

  const handleCreate = async () => {
    if (!canCreateUsers) {
      toast.error('ليست لديك صلاحية إنشاء الأساتذة');
      return;
    }
    if (!form.fullName.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error('الاسم، اسم المستخدم، وكلمة المرور حقول إجبارية');
      return;
    }
    if (form.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setCreateBusy(true);
    try {
      // Check username uniqueness
      const { data: existing } = await supabase
        .from('admins')
        .select('id')
        .eq('username', form.username.trim())
        .maybeSingle();

      if (existing) {
        toast.error('اسم المستخدم مستعمل بالفعل');
        setCreateBusy(false);
        return;
      }

      const result = await createInstitutionUser({
        username: form.username.trim(),
        email: form.email.trim() || `${form.username.trim()}@Ausar Military.local`,
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || null,
        password: form.password,
        role: 'teacher',
        institutionId,
      });

      if (!result.ok || !result.credentials || !result.admin) {
        toast.error(result.error?.message ?? 'تعذر إنشاء حساب الأستاذ');
        return;
      }

      // Update status if suspended
      if (form.status === 'suspended') {
        await supabase.from('admins').update({ status: 'suspended' }).eq('id', result.admin.id);
      }

      toast.success('تم إنشاء الأستاذ بنجاح');
      setCredentials({
        email: result.credentials.email,
        username: result.credentials.username,
        password: result.credentials.password,
        fullName: result.admin.full_name ?? result.admin.username,
      });
      setCreateOpen(false);
      setForm({ fullName: '', username: '', email: '', phone: '', password: '', status: 'active' });
      await loadTeachers();
      if (canAssignTeachers) {
        const newTeacherId = result.admin.id;
        const newTeacherName = result.admin.full_name ?? result.admin.username;
        setTimeout(() => {
          setAssignTarget({
            id: newTeacherId,
            username: result.admin!.username,
            email: result.admin!.email,
            full_name: result.admin!.full_name,
            role: result.admin!.role,
            rank: result.admin!.rank,
            department: result.admin!.department,
            institution_id: result.admin!.institution_id,
            created_at: result.admin!.created_at,
            sessionsCount: 0,
            attendancesCount: 0,
            assignmentsCount: 0,
          });
          setAssignOpen(true);
          toast.warning(
            `${newTeacherName} لا يملك أي تعيينات، ولن تظهر له الأفواج حتى يتم ربطه بفوج`,
            { duration: 6000 },
          );
        }, 600);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setCreateBusy(false);
    }
  };

  const openEdit = (user: InstitutionUserRow) => {
    if (!canCreateUsers) {
      toast.error('ليست لديك صلاحية تعديل الأساتذة');
      return;
    }
    setEditTarget(user);
    setEditForm({
      fullName: user.full_name ?? '',
      status: (user as any).status || 'active',
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!canCreateUsers) {
      toast.error('ليست لديك صلاحية تعديل الأساتذة');
      return;
    }
    const ok = await updateInstitutionUser(editTarget.id, {
      full_name: editForm.fullName.trim() || null,
    });
    if (ok) {
      await supabase.from('admins').update({ status: editForm.status }).eq('id', editTarget.id);
      toast.success('تم تعديل بيانات الأستاذ');
      setEditOpen(false);
      setEditTarget(null);
      await loadTeachers();
    } else {
      toast.error('تعذر تحديث الأستاذ');
    }
  };

  const handleDelete = async (teacher: TeacherWithStats) => {
    if (!canCreateUsers) {
      toast.error('ليست لديك صلاحية حذف الأساتذة');
      return;
    }
    if (teacher.sessionsCount > 0) {
      const ok = window.confirm(
        `هذا الأستاذ لديه ${teacher.sessionsCount} جلسة. حذفه قد يؤثر على البيانات التاريخية. هل أنت متأكد؟`,
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(`هل أنت متأكد من حذف الأستاذ ${teacher.full_name || teacher.username}؟`);
      if (!ok) return;
    }
    const success = await deleteInstitutionUser(teacher.id);
    if (success) {
      toast.success('تم حذف الأستاذ');
      await loadTeachers();
    } else {
      toast.error('تعذر حذف الأستاذ');
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('تعذر النسخ');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + KPIs */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-emerald-600" />
              الأساتذة
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              إدارة هيئة التدريس ومتابعة نشاطهم داخل {institutionName}
            </p>
          </div>
          {canCreateUsers && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> إضافة أستاذ
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'إجمالي الأساتذة', value: totals.teachers, icon: GraduationCap, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'أساتذة نشطون',     value: totals.active,    icon: Activity,       tone: 'bg-cyan-50 text-cyan-700' },
            { label: 'إجمالي الجلسات',   value: totals.sessions,  icon: Calendar,       tone: 'bg-indigo-50 text-indigo-700' },
            { label: 'إجمالي الحضورات',  value: totals.attendances, icon: Users,        tone: 'bg-purple-50 text-purple-700' },
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

      {/* Search */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="ابحث بالاسم، اسم المستخدم، البريد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 h-10 rounded-lg"
          />
        </div>
      </div>

      {/* Unassigned warning banner */}
      {!loading && totals.unassigned > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">
              {totals.unassigned} أستاذ بدون تعيين
            </p>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              الأستاذ بدون أفواج مسندة لن يرى أي فوج بعد تسجيل دخوله. اضغط زر "التعيينات" بجانب اسمه لربطه بأفواجه.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-right">الأستاذ</TableHead>
              <TableHead className="text-right">الهاتف</TableHead>
              <TableHead className="text-right">البريد</TableHead>
              <TableHead className="text-center">التعيينات</TableHead>
              <TableHead className="text-center">الجلسات</TableHead>
              <TableHead className="text-center">الحضورات</TableHead>
              <TableHead className="text-center">الحالة</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-10">جاري التحميل...</TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-10">لا يوجد أساتذة بعد</TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((t) => (
              <TableRow key={t.id} className="hover:bg-slate-50/60">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center font-black text-white text-xs">
                      {(t.full_name || t.username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{t.full_name || '—'}</p>
                      <p className="text-[10px] text-slate-500 font-mono">@{t.username}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-700">
                  {t.phone || '—'}
                </TableCell>
                <TableCell className="text-xs text-slate-600">{t.email || '—'}</TableCell>
                <TableCell className="text-center">
                  {t.assignmentsCount === 0 ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold">
                      بدون تعيين
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">
                      {t.assignmentsCount} فوج
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center font-bold text-indigo-700">{t.sessionsCount}</TableCell>
                <TableCell className="text-center font-bold text-purple-700">{t.attendancesCount}</TableCell>
                <TableCell className="text-center">
                  {(t as any).status === 'suspended' ? (
                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">موقوف</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">نشط</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {canAssignTeachers && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-indigo-700 hover:bg-indigo-50 gap-1"
                        onClick={() => { setAssignTarget(t); setAssignOpen(true); }}
                        title="إدارة التعيينات"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold">التعيينات</span>
                      </Button>
                    )}
                    {canCreateUsers && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(t)}
                          title="تعديل"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDelete(t)}
                          title="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Assignments dialog */}
      {assignTarget && (
        <TeacherAssignmentsDialog
          open={assignOpen}
          onOpenChange={(open) => {
            setAssignOpen(open);
            if (!open) setAssignTarget(null);
          }}
          teacherId={assignTarget.id}
          teacherName={assignTarget.full_name || assignTarget.username}
          institutionId={institutionId}
          onSaved={() => { void loadTeachers(); }}
        />
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة أستاذ جديد</DialogTitle>
            <DialogDescription>
              سيدخل الأستاذ إلى لوحة الأستاذ الخاصة بـ {institutionName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">الاسم الكامل *</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="مثال: أحمد بن سالم" />
              </div>
              <div>
                <Label className="text-xs font-bold">اسم المستخدم *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="ahmed" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold">كلمة المرور *</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-2.5 top-2.5 text-xs text-slate-500 font-bold">
                    {showPassword ? '👁 إخفاء' : '👁 إظهار'}
                  </button>
                </div>
                <Button type="button" onClick={generateRandomPassword} variant="outline" className="text-xs font-bold border-indigo-200 text-indigo-700">توليد تلقائي</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">البريد الإلكتروني (اختياري)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ahmed@example.com" />
              </div>
              <div>
                <Label className="text-xs font-bold">رقم الهاتف (اختياري)</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0555 00 00 00" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold">حالة الحساب</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="suspended">موقوف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createBusy}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={createBusy} className="bg-emerald-600 hover:bg-emerald-700">
              {createBusy ? 'جاري الإنشاء...' : 'إضافة الأستاذ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>تعديل بيانات الأستاذ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">الاسم الكامل</Label>
              <Input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs font-bold">حالة الحساب</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="suspended">موقوف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleEdit}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials dialog */}
      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              بيانات الدخول للأستاذ
            </DialogTitle>
            <DialogDescription>
              انسخ هذه البيانات الآن. كلمة المرور لن تظهر مرة أخرى.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-xs text-emerald-700">{credentials.fullName}</p>
              </div>
              {[
                { label: 'البريد الإلكتروني', value: credentials.email, key: 'email' },
                { label: 'اسم المستخدم', value: credentials.username, key: 'username' },
                { label: 'كلمة المرور المؤقتة', value: credentials.password, key: 'password' },
              ].map((field) => (
                <div key={field.key}>
                  <Label className="text-[10px] text-slate-500">{field.label}</Label>
                  <div className="flex items-center gap-2 mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span className="font-mono text-sm flex-1 break-all">{field.value}</span>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copy(field.key, field.value)}>
                      {copied === field.key ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <span>💡 شارك مع الأستاذ بيانات الدخول واطلب منه استعمالها على رابط لوحة التحكم</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-amber-800 hover:bg-amber-100 gap-1"
                  onClick={() => copy('login_url', `${window.location.origin}/panel-sk2025x/login`)}
                >
                  {copied === 'login_url' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span className="text-[10px] font-bold">نسخ رابط الدخول</span>
                </Button>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>تم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
