// =============================================================================
// Institution Admin — Users tab (managers + viewers + teachers)
// =============================================================================
// Generic user manager for the institution. Listing covers all admin roles in
// the institution_id scope. Creation goes through the secure
// `create-institution-user` Edge Function (service_role server-side).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Pencil, Copy, Check, KeyRound, ShieldCheck, GraduationCap, Eye, Building2, UserCog, Globe, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getInstitutionUsers,
  createInstitutionUser,
  updateInstitutionUser,
  deleteInstitutionUser,
  resetInstitutionUserPassword,
  getInstitutionUnits,
  getScopesByAdminIds,
  replaceUserScope,
  type InstitutionUserRow,
  type InstitutionUnitRow,
  type UserScopeRow,
  type CreatableUserRole,
} from '@/lib/institutionAdminApi';
import { PERMISSIONS, can, type PermissionMap } from '@/lib/permissions';
import ScopePicker from './ScopePicker';

interface Props {
  institutionId: string;
  institutionName: string;
  permissions: PermissionMap | null;
}

const ROLE_META: Record<string, { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }> = {
  institution_owner:   { label: 'مالك المؤسسة',  tone: 'bg-purple-50 text-purple-700 border-purple-200',    icon: ShieldCheck },
  institution_admin:   { label: 'مدير المؤسسة',  tone: 'bg-indigo-50 text-indigo-700 border-indigo-200',    icon: UserCog },
  faculty_admin:       { label: 'مدير كلية',     tone: 'bg-blue-50 text-blue-700 border-blue-200',          icon: Building2 },
  department_admin:    { label: 'مدير قسم',      tone: 'bg-cyan-50 text-cyan-700 border-cyan-200',          icon: Building2 },
  staff:               { label: 'سكرتاريا / موظف إداري', tone: 'bg-amber-50 text-amber-700 border-amber-200', icon: UserCog },
  teacher:             { label: 'أستاذ',         tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: GraduationCap },
  viewer:              { label: 'قارئ فقط',      tone: 'bg-slate-50 text-slate-700 border-slate-200',       icon: Eye },
};

const CREATABLE_ROLE_OPTIONS: { value: CreatableUserRole; label: string }[] = [
  { value: 'teacher',          label: 'أستاذ' },
  { value: 'faculty_admin',    label: 'مدير كلية' },
  { value: 'department_admin', label: 'مدير قسم' },
  { value: 'staff',            label: 'سكرتاريا / موظف إداري' },
  { value: 'viewer',           label: 'قارئ فقط (للاطّلاع)' },
];

export default function InstitutionUsers({ institutionId, institutionName, permissions }: Props) {
  const [users, setUsers] = useState<InstitutionUserRow[]>([]);
  const [units, setUnits] = useState<InstitutionUnitRow[]>([]);
  const [scopesByAdmin, setScopesByAdmin] = useState<Record<string, UserScopeRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    role: 'teacher' as CreatableUserRole,
    rank: '',
    department: '',
    unitId: null as string | null,
  });

  // Credentials display dialog
  const [credentials, setCredentials] = useState<{
    email: string;
    username: string;
    password: string;
    fullName: string;
    role: string;
    scopeLabel: string | null;
    /** Source of the credentials: created vs reset (changes the dialog title/CTA). */
    source: 'created' | 'reset';
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Reset-password state — confirmation modal + busy flag per user
  const [resetTarget, setResetTarget] = useState<InstitutionUserRow | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InstitutionUserRow | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', rank: '', department: '' });

  // Edit-scope dialog state (Phase 5)
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeTarget, setScopeTarget] = useState<InstitutionUserRow | null>(null);
  const [scopeUnitId, setScopeUnitId] = useState<string | null>(null);
  const [scopeBusy, setScopeBusy] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [rows, unitRows] = await Promise.all([
        getInstitutionUsers(institutionId),
        getInstitutionUnits(institutionId),
      ]);
      setUsers(rows);
      setUnits(unitRows);
      // Resolve scopes for sub-institution roles only
      const ids = rows
        .filter((u) => u.role === 'faculty_admin' || u.role === 'department_admin' || u.role === 'staff' || u.role === 'viewer')
        .map((u) => u.id);
      if (ids.length > 0) {
        const grouped = await getScopesByAdminIds(ids, institutionId);
        setScopesByAdmin(grouped);
      } else {
        setScopesByAdmin({});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.full_name ?? '').toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const canCreateUsers = can(permissions, PERMISSIONS.usersCreate);
  const canManageScopes = can(permissions, PERMISSIONS.usersManageScope);
  const canDeleteUsers = can(permissions, PERMISSIONS.usersDelete);
  const canResetPasswords = can(permissions, PERMISSIONS.usersResetPassword);
  const canEditUsers = canCreateUsers; // editing profile fields shares the create capability

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((u) => map.set(u.role, (map.get(u.role) ?? 0) + 1));
    return map;
  }, [users]);

  const resetForm = () => {
    setForm({ fullName: '', username: '', email: '', phone: '', role: 'teacher', rank: '', department: '', unitId: null });
  };

  // Helper: get a friendly scope label for display in credentials/table
  const scopeLabelFor = (unitId: string | null): string | null => {
    if (unitId === null) return null;
    const unit = units.find((u) => u.id === unitId);
    return unit ? unit.name : null;
  };

  // Whether the currently chosen role uses a scope (faculty/department/staff/viewer)
  const roleUsesScope = (r: CreatableUserRole) =>
    r === 'faculty_admin' || r === 'department_admin' || r === 'staff' || r === 'viewer';

  const handleCreate = async () => {
    if (!canCreateUsers) {
      toast.error('ليست لديك صلاحية إنشاء المستخدمين');
      return;
    }
    if (!form.username.trim() || !form.email.trim()) {
      toast.error('اسم المستخدم والبريد الإلكتروني مطلوبان');
      return;
    }
    setCreateBusy(true);
    try {
      const result = await createInstitutionUser({
        username: form.username.trim(),
        email: form.email.trim(),
        fullName: form.fullName.trim() || null,
        phone: form.phone.trim() || null,
        role: form.role,
        rank: form.rank.trim() || null,
        department: form.department.trim() || null,
        institutionId,
        unitId: roleUsesScope(form.role) ? form.unitId : null,
      });

      if (!result.ok || !result.credentials || !result.admin) {
        toast.error(result.error?.message ?? 'تعذر إنشاء الحساب');
        return;
      }

      toast.success('تم إنشاء الحساب');
      setCredentials({
        email: result.credentials.email,
        username: result.credentials.username,
        password: result.credentials.password,
        fullName: result.admin.full_name ?? result.admin.username,
        role: result.admin.role,
        scopeLabel: roleUsesScope(form.role)
          ? (form.unitId ? scopeLabelFor(form.unitId) ?? '—' : 'المؤسسة كاملة')
          : null,
        source: 'created',
      });
      setCreateOpen(false);
      resetForm();
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setCreateBusy(false);
    }
  };

  // Phase 5: open scope editor
  const openScopeEdit = (user: InstitutionUserRow) => {
    if (!canManageScopes) {
      toast.error('ليست لديك صلاحية تعديل النطاق');
      return;
    }
    setScopeTarget(user);
    const current = scopesByAdmin[user.id]?.[0];
    setScopeUnitId(current?.unit_id ?? null);
    setScopeOpen(true);
  };

  const handleSaveScope = async () => {
    if (!scopeTarget) return;
    if (!canManageScopes) {
      toast.error('ليست لديك صلاحية تعديل النطاق');
      return;
    }
    if (!['faculty_admin', 'department_admin', 'staff', 'viewer'].includes(scopeTarget.role)) {
      toast.error('هذا الدور لا يدعم تحديد نطاق');
      return;
    }
    setScopeBusy(true);
    try {
      await replaceUserScope({
        adminId: scopeTarget.id,
        unitId: scopeUnitId,
        scopeRole: scopeTarget.role as 'faculty_admin' | 'department_admin' | 'staff' | 'viewer',
        institutionId,
      });
      toast.success('تم تحديث نطاق الصلاحية');
      setScopeOpen(false);
      setScopeTarget(null);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر تحديث النطاق');
    } finally {
      setScopeBusy(false);
    }
  };

  const openEdit = (user: InstitutionUserRow) => {
    if (!canEditUsers) {
      toast.error('ليست لديك صلاحية تعديل الحسابات');
      return;
    }
    setEditTarget(user);
    setEditForm({
      fullName: user.full_name ?? '',
      rank: user.rank ?? '',
      department: user.department ?? '',
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!canEditUsers) {
      toast.error('ليست لديك صلاحية تعديل الحسابات');
      return;
    }
    const ok = await updateInstitutionUser(editTarget.id, {
      full_name: editForm.fullName.trim() || null,
      rank: editForm.rank.trim() || null,
      department: editForm.department.trim() || null,
    });
    if (ok) {
      toast.success('تم التعديل');
      setEditOpen(false);
      setEditTarget(null);
      await loadUsers();
    } else {
      toast.error('تعذر تحديث المستخدم');
    }
  };

  const handleDelete = async (user: InstitutionUserRow) => {
    if (!canDeleteUsers) {
      toast.error('ليست لديك صلاحية حذف الحسابات');
      return;
    }
    const ok = window.confirm(`هل أنت متأكد من حذف ${user.full_name || user.username}؟ لن يستطيع تسجيل الدخول بعد ذلك.`);
    if (!ok) return;
    const success = await deleteInstitutionUser(user.id);
    if (success) {
      toast.success('تم حذف المستخدم');
      await loadUsers();
    } else {
      toast.error('تعذر حذف المستخدم');
    }
  };

  // Resolve the current scope label of an existing user (used in the reset
  // credentials dialog so the manager sees full context, not just role).
  const currentScopeLabel = (user: InstitutionUserRow): string | null => {
    if (user.role === 'institution_owner' || user.role === 'institution_admin') return 'المؤسسة كاملة';
    if (user.role === 'teacher') return 'عبر التعيينات';
    const scope = scopesByAdmin[user.id]?.[0];
    if (!scope) return null;
    if (scope.unit_id === null) return 'المؤسسة كاملة';
    return scope.unit_name ?? '—';
  };

  const RESETTABLE_ROLES = ['teacher', 'faculty_admin', 'department_admin', 'staff', 'viewer'];

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (!canResetPasswords) {
      toast.error('ليست لديك صلاحية إعادة تعيين كلمة المرور');
      return;
    }
    setResetBusy(true);
    try {
      const result = await resetInstitutionUserPassword(resetTarget.id);
      if (!result.ok || !result.credentials || !result.admin) {
        toast.error(result.error?.message ?? 'تعذر إعادة تعيين كلمة المرور');
        return;
      }
      toast.success('تم توليد كلمة مرور جديدة');
      setCredentials({
        email: result.credentials.email ?? '',
        username: result.credentials.username,
        password: result.credentials.password,
        fullName: result.admin.full_name ?? result.admin.username,
        role: result.admin.role,
        scopeLabel: currentScopeLabel(resetTarget),
        source: 'reset',
      });
      setResetTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setResetBusy(false);
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
      {/* Header + KPI strip */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">المستخدمون داخل المؤسسة</h2>
            <p className="text-xs text-slate-500 mt-1">
              إدارة كل الحسابات الإدارية والتعليمية الخاصة بـ {institutionName}
            </p>
          </div>
          {canCreateUsers && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" /> إنشاء مستخدم جديد
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-5">
          {(['institution_owner','institution_admin','faculty_admin','department_admin','staff','teacher','viewer'] as const).map((r) => {
            const meta = ROLE_META[r];
            const Icon = meta.icon;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(roleFilter === r ? 'all' : r)}
                className={`text-right p-3 rounded-xl border transition-all ${
                  roleFilter === r ? 'border-indigo-300 bg-indigo-50/60 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span className="text-[11px] text-slate-500 font-medium">{meta.label}</span>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-1">{counts.get(r) ?? 0}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ابحث بالاسم، البريد، اسم المستخدم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 h-10 rounded-lg"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-44 h-10 rounded-lg">
              <SelectValue placeholder="كل الأدوار" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأدوار</SelectItem>
              {Object.entries(ROLE_META).map(([role, meta]) => (
                <SelectItem key={role} value={role}>{meta.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-500 ms-auto">
            {filtered.length} / {users.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-right">الاسم الكامل</TableHead>
              <TableHead className="text-right">اسم المستخدم</TableHead>
              <TableHead className="text-right">البريد</TableHead>
              <TableHead className="text-right">الدور</TableHead>
              <TableHead className="text-right">النطاق</TableHead>
              <TableHead className="text-right">القسم/الرتبة</TableHead>
              <TableHead className="text-right">تاريخ الإنشاء</TableHead>
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
                <TableCell colSpan={8} className="text-center text-slate-500 py-10">لا توجد نتائج مطابقة</TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((u) => {
              const meta = ROLE_META[u.role] ?? { label: u.role, tone: 'bg-slate-50 text-slate-700 border-slate-200', icon: UserCog };
              const isScopedRole = u.role === 'faculty_admin' || u.role === 'department_admin' || u.role === 'staff' || u.role === 'viewer';
              const isUnrestrictedRole = u.role === 'institution_owner' || u.role === 'institution_admin' || u.role === 'super_admin';
              const userScopes = scopesByAdmin[u.id] ?? [];
              const primaryScope = userScopes[0];
              return (
                <TableRow key={u.id} className="hover:bg-slate-50/60">
                  <TableCell className="font-bold text-slate-900">{u.full_name || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-700">{u.username}</TableCell>
                  <TableCell className="text-xs text-slate-600">{u.email || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${meta.tone} font-bold text-[11px]`}>{meta.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {isUnrestrictedRole ? (
                      <span className="inline-flex items-center gap-1 text-purple-700 font-bold">
                        <Globe className="h-3 w-3" /> المؤسسة كاملة
                      </span>
                    ) : isScopedRole ? (
                      primaryScope ? (
                        primaryScope.unit_id === null ? (
                          <span className="inline-flex items-center gap-1 text-purple-700 font-bold">
                            <Globe className="h-3 w-3" /> المؤسسة كاملة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-indigo-700 font-bold">
                            <Building2 className="h-3 w-3" /> {primaryScope.unit_name ?? '—'}
                          </span>
                        )
                      ) : (
                        <span className="text-amber-700 font-bold">بدون نطاق</span>
                      )
                    ) : u.role === 'teacher' ? (
                      <span className="text-slate-500">عبر التعيينات</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {[u.rank, u.department].filter(Boolean).join(' • ') || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 font-mono">
                    {new Date(u.created_at).toLocaleDateString('ar-DZ')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {isScopedRole && canManageScopes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-indigo-700 hover:bg-indigo-50 gap-1"
                          onClick={() => openScopeEdit(u)}
                          title="تعديل النطاق"
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-bold">النطاق</span>
                        </Button>
                      )}
                      {canEditUsers && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(u)}
                          title="تعديل"
                          disabled={u.role === 'institution_owner'}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canResetPasswords && RESETTABLE_ROLES.includes(u.role) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-amber-700 hover:bg-amber-50"
                          onClick={() => setResetTarget(u)}
                          title="إعادة تعيين كلمة المرور"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDeleteUsers && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDelete(u)}
                          title="حذف"
                          disabled={u.role === 'institution_owner' || u.role === 'super_admin'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!canManageScopes && !canEditUsers && !canResetPasswords && !canDeleteUsers && (
                        <span className="text-xs font-bold text-slate-400">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إنشاء مستخدم جديد</DialogTitle>
            <DialogDescription>
              سيتم إنشاء الحساب داخل {institutionName}. اختر الدور والنطاق المناسب — سنعطيك كلمة مرور مؤقتة لتمريرها للمستخدم.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الاسم الكامل</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="مثال: محمد بن علي" />
              </div>
              <div>
                <Label className="text-xs">اسم المستخدم *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" />
              </div>
            </div>

            <div>
              <Label className="text-xs">البريد الإلكتروني *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الدور *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as CreatableUserRole, unitId: null })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CREATABLE_ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">رقم الهاتف</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0555 00 00 00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الرتبة</Label>
                <Input value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} placeholder="مثال: أستاذ محاضر" />
              </div>
              <div>
                <Label className="text-xs">القسم/الكلية</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="مثال: علوم الإعلام الآلي" />
              </div>
            </div>

            {/* Scope picker — shown for faculty_admin/department_admin/staff/viewer */}
            {roleUsesScope(form.role) && (
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-xs font-bold text-slate-900">نطاق الصلاحية *</Label>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      يحدد البيانات التي يستطيع هذا المستخدم رؤيتها وإدارتها
                    </p>
                  </div>
                  {form.role === 'faculty_admin' && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      مثال: كلية العلوم
                    </Badge>
                  )}
                  {form.role === 'department_admin' && (
                    <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
                      مثال: قسم الإعلام الآلي
                    </Badge>
                  )}
                </div>
                <ScopePicker
                  units={units}
                  value={form.unitId}
                  onChange={(unitId) => setForm({ ...form, unitId })}
                  institutionName={institutionName}
                  allowInstitutionWide
                />
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                  💡 إذا اخترت كلية، فالمستخدم سيرى جميع الأقسام والأفواج التابعة لها تلقائياً (شجرة هرمية).
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createBusy}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={createBusy}>
              {createBusy ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase 5: Scope edit dialog */}
      <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              تعديل نطاق الصلاحية
            </DialogTitle>
            <DialogDescription>
              {scopeTarget && (
                <>
                  اختر النطاق الذي يستطيع <strong>{scopeTarget.full_name || scopeTarget.username}</strong> ({ROLE_META[scopeTarget.role]?.label ?? scopeTarget.role}) إدارته.
                  التغيير يُطبَّق فوراً عبر RLS.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {scopeTarget && (
            <ScopePicker
              units={units}
              value={scopeUnitId}
              onChange={setScopeUnitId}
              institutionName={institutionName}
              allowInstitutionWide
            />
          )}

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setScopeOpen(false)} disabled={scopeBusy}>إلغاء</Button>
            <Button onClick={handleSaveScope} disabled={scopeBusy} className="bg-indigo-600 hover:bg-indigo-700">
              {scopeBusy ? 'جاري الحفظ...' : 'حفظ النطاق'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
            <DialogDescription>
              {editTarget?.username} — لتغيير كلمة المرور يجب على المستخدم إعادة تعيينها بنفسه
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">الاسم الكامل</Label>
              <Input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">الرتبة</Label>
              <Input value={editForm.rank} onChange={(e) => setEditForm({ ...editForm, rank: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">القسم</Label>
              <Input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleEdit}>حفظ التعديلات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials dialog (one-time view — used for both create & reset) */}
      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              {credentials?.source === 'reset' ? 'كلمة المرور الجديدة' : 'بيانات الدخول للمستخدم الجديد'}
            </DialogTitle>
            <DialogDescription>
              {credentials?.source === 'reset'
                ? 'تم توليد كلمة مرور مؤقتة جديدة. سلّمها للمستخدم وانصحه بتغييرها.'
                : 'انسخ هذه البيانات الآن وسلّمها للمستخدم.'}
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3">
              {/* Strong one-time warning */}
              <div className="bg-rose-50 border-2 border-rose-300 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-[12px] text-rose-900 font-bold leading-relaxed">
                  احفظ كلمة المرور الآن. لن تتمكن من رؤيتها مرة أخرى بعد إغلاق هذه النافذة.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">الاسم الكامل</p>
                    <p className="text-sm font-bold text-slate-900">{credentials.fullName}</p>
                  </div>
                  <Badge variant="outline">
                    {ROLE_META[credentials.role]?.label ?? credentials.role}
                  </Badge>
                </div>
                {credentials.scopeLabel && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs">
                    <span className="text-slate-600">النطاق: </span>
                    <span className="font-bold text-indigo-700">{credentials.scopeLabel}</span>
                  </div>
                )}
                {[
                  { label: 'البريد الإلكتروني', value: credentials.email, key: 'email' },
                  { label: 'اسم المستخدم', value: credentials.username, key: 'username' },
                  { label: 'كلمة المرور المؤقتة', value: credentials.password, key: 'password' },
                ].map((field) => (
                  <div key={field.key}>
                    <Label className="text-[10px] text-slate-500">{field.label}</Label>
                    <div className="flex items-center gap-2 mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2">
                      <span className="font-mono text-sm flex-1 break-all">{field.value}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => copy(field.key, field.value)}
                      >
                        {copied === field.key ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Copy-all button */}
                <Button
                  type="button"
                  variant="default"
                  className="w-full gap-2 mt-2 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    const lines = [
                      `الاسم: ${credentials.fullName}`,
                      `اسم المستخدم: ${credentials.username}`,
                      `البريد: ${credentials.email}`,
                      `كلمة المرور المؤقتة: ${credentials.password}`,
                      `الدور: ${ROLE_META[credentials.role]?.label ?? credentials.role}`,
                    ];
                    if (credentials.scopeLabel) lines.push(`النطاق: ${credentials.scopeLabel}`);
                    copy('all', lines.join('\n'));
                  }}
                >
                  {copied === 'all' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === 'all' ? 'تم نسخ كل البيانات' : 'نسخ بيانات الدخول كاملة'}
                </Button>
              </div>
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                💡 يُنصح بأن يقوم المستخدم بتغيير كلمة المرور عند أول تسجيل دخول.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>تم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password confirmation dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && !resetBusy && setResetTarget(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <RotateCcw className="h-5 w-5" />
              إعادة تعيين كلمة المرور
            </DialogTitle>
            <DialogDescription>
              {resetTarget && (
                <>
                  سيتم توليد كلمة مرور مؤقتة جديدة لـ <strong>{resetTarget.full_name || resetTarget.username}</strong>.
                  ستتعطل كلمة المرور الحالية فوراً ولن يستطيع الدخول بها مرة أخرى. هذه العملية لا يمكن التراجع عنها.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetBusy}>إلغاء</Button>
            <Button onClick={handleResetPassword} disabled={resetBusy} className="bg-amber-600 hover:bg-amber-700 gap-2">
              {resetBusy ? 'جاري التوليد...' : (<><RotateCcw className="h-4 w-4" /> توليد كلمة مرور جديدة</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
