import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  GraduationCap,
  CalendarCheck,
  ShieldCheck,
  FileText,
  CreditCard,
  Settings,
  Activity,
  HelpCircle,
  LayoutDashboard,
  Layers,
  FileCheck2,
  LogOut,
  Bell,
  Search,
  ChevronDown,
  Clock,
  Calendar,
  MessageSquare,
  ClipboardList,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { getAuthenticatedAdmin, logoutAdmin, isInstitutionDashboardRole, resolveLandingRoute } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import type { Admin } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getCurrentAdminPermissionMap } from '@/lib/institutionAdminApi';
import { can, type PermissionMap } from '@/lib/permissions';
import { getActiveModule } from '@/config/modules';
import usePermission from '@/core/permissions/usePermission';

// =============================================================================
// Institution Admin Dashboard — Phase 1 shell
// =============================================================================
// This is the shell + auth gate + sidebar layout. Real content for each
// section will be filled in subsequent phases (overview, structure, users,
// attendance, justifications, devices, reports, subscription, settings).
// =============================================================================

type InstitutionType = 'military';

interface InstitutionContext {
  id: string;
  name: string;
  type: InstitutionType;
  wilaya: string | null;
  city: string | null;
  imageUrl: string | null;
  status: string | null;
}

function normalizeInstitutionType(value: string | null | undefined): InstitutionType {
  if (value === 'school' || value === 'primary_school' || value === 'secondary_school' || value === 'training' || value === 'company') return value;
  return 'military';
}

function getDashboardTitle(role: Admin['role']): string {
  switch (role) {
    case 'faculty_admin':
      return 'لوحة عميد الكلية';
    case 'department_admin':
      return 'لوحة رئيس القسم';
    case 'staff':
      return 'لوحة الموظف الإداري';
    case 'viewer':
      return 'لوحة القراءة';
    default:
      return 'لوحة إدارة المؤسسة';
  }
}

function getDashboardDescription(role: Admin['role']): string {
  switch (role) {
    case 'faculty_admin':
      return 'إدارة ومتابعة البيانات داخل نطاق الكلية المسموح به لهذا الحساب';
    case 'department_admin':
      return 'إدارة ومتابعة البيانات داخل نطاق القسم المسموح به لهذا الحساب';
    case 'staff':
      return 'عرض ومتابعة الملفات الإدارية حسب الصلاحيات الممنوحة';
    case 'viewer':
      return 'عرض البيانات والتقارير بصلاحية قراءة فقط';
    default:
      return 'إدارة الهيكل التنظيمي، المستخدمين، الحضور، التبريرات والتقارير داخل المؤسسة';
  }
}

export default function InstitutionAdminPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [institution, setInstitution] = useState<InstitutionContext | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('overview');

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded_groups');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('sidebar_expanded_groups', JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  const sidebarGroupsConfig = useMemo(() => [
    {
      id: 'attendance-group',
      label: 'الحضور والغيابات',
      icon: Clock,
      itemIds: ['attendance-inbox', 'attendance-operations', 'attendance', 'justifications', 'discipline'],
    },
    {
      id: 'students-group',
      label: 'التلاميذ',
      icon: GraduationCap,
      itemIds: ['student-management', 'parent-contacts'],
    },
    {
      id: 'academic-group',
      label: 'التخطيط الأكاديمي',
      icon: Calendar,
      itemIds: ['subjects', 'timetable', 'substitution', 'classroom', 'academic-years'],
    },
    {
      id: 'institution-group',
      label: 'المؤسسة والموارد',
      icon: Building2,
      itemIds: ['teachers', 'users', 'groups', 'academic-structure'],
    },
    {
      id: 'communications-group',
      label: 'الاتصالات والأحداث',
      icon: MessageSquare,
      itemIds: ['communication-logs', 'daily-operations', 'communication-center'],
    },
    {
      id: 'admin-group',
      label: 'الإدارة والمتابعة',
      icon: ClipboardList,
      itemIds: ['decision-center', 'reports', 'early-warning', 'institution-health'],
    },
    {
      id: 'system-group',
      label: 'النظام',
      icon: Shield,
      itemIds: ['devices', 'subscription', 'settings', 'support'],
    },
  ], []);

  useEffect(() => {
    if (!activeSection) return;
    const parentGroup = sidebarGroupsConfig.find((g) => g.itemIds.includes(activeSection));
    if (parentGroup) {
      setExpandedGroups((prev) => {
        if (prev[parentGroup.id]) return prev;
        return { ...prev, [parentGroup.id]: true };
      });
    }
  }, [activeSection, sidebarGroupsConfig]);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const current = await getAuthenticatedAdmin();
        if (!active) return;

        const role = current?.role ?? null;
        if (!current) {
          navigate('/panel-sk2025x/login', { replace: true });
          return;
        }

        if (!isInstitutionDashboardRole(role)) {
          navigate(resolveLandingRoute(role), { replace: true });
          return;
        }
        setAdmin(current);

        const permissionMap = await getCurrentAdminPermissionMap().catch((error) => {
          console.error('Failed to load institution permissions:', error);
          return {};
        });
        if (!active) return;
        setPermissions(permissionMap);

        if (current.institution_id) {
          const { data, error } = await supabase
            .from('institutions')
            .select('id, name, type, wilaya, city, image_url, status')
            .eq('id', current.institution_id)
            .maybeSingle();

          if (!active) return;
          if (!error && data) {
            setInstitution({
              id: data.id,
              name: data.name,
              type: normalizeInstitutionType(data.type),
              wilaya: data.wilaya ?? null,
              city: data.city ?? null,
              imageUrl: (data as { image_url?: string | null }).image_url ?? null,
              status: data.status ?? null,
            });
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void verify();
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleLogout = () => {
    logoutAdmin();
    navigate('/panel-sk2025x/login', { replace: true });
  };

  const { hasPermission } = usePermission();
  const activeModule = getActiveModule();
  const sidebar = useMemo(() => {
    return activeModule.sidebar.filter((item) => {
      if (!item.permissionKey) return true;
      return hasPermission(item.permissionKey);
    });
  }, [activeModule, hasPermission]);

  const { groupedData, standaloneItems } = useMemo(() => {
    const groupedIds = sidebarGroupsConfig.flatMap((g) => g.itemIds);
    const standalone = sidebar.filter((item) => !groupedIds.includes(item.id));
    return {
      groupedData: sidebarGroupsConfig.map((group) => {
        const items = sidebar.filter((item) => group.itemIds.includes(item.id));
        return { ...group, items };
      }).filter((g) => g.items.length > 0),
      standaloneItems: standalone,
    };
  }, [sidebar, sidebarGroupsConfig]);

  const canViewActiveSection = sidebar.some((item) => item.id === activeSection);
  const adminDisplayName = admin?.fullName || admin?.full_name || admin?.username || 'مدير المؤسسة';

  useEffect(() => {
    if (loading || sidebar.length === 0) return;
    if (!sidebar.some((item) => item.id === activeSection)) {
      setActiveSection(sidebar[0].id);
    }
  }, [activeSection, loading, sidebar]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-indigo-500 font-mono text-sm">
          جاري التحقق من جلستك...
        </div>
      </div>
    );
  }

  if (admin?.role === 'super_admin' && !institution) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-4">
          <Building2 className="h-12 w-12 mx-auto text-indigo-500" />
          <h1 className="text-xl font-black text-slate-900">معاينة لوحة المؤسسة</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            هذه اللوحة مخصّصة لمدراء المؤسسات. كمالك للمنصّة، يمكنك فتح لوحة
            مؤسسة معيّنة من Super Admin Dashboard لمعاينتها.
          </p>
          <Button onClick={() => navigate('/panel-sk2025x/super-admin')} className="w-full">
            الذهاب إلى لوحة المالك
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <aside className="fixed top-0 right-0 h-full w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Ausar Military" className="w-10 h-10" />
            <div>
              <p className="text-base font-black tracking-tight">Ausar Military</p>
              <p className="text-[10px] text-slate-400 font-medium">منصة الحضور الذكي</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {/* Standalone Items */}
          {standaloneItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeSection;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors my-0.5
                  ${isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30 font-bold'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Grouped Items (Collapsible Accordions) */}
          {groupedData.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = !!expandedGroups[group.id];
            const hasActiveChild = group.items.some((item) => item.id === activeSection);
            
            return (
              <div key={group.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group.id]: !prev[group.id],
                    }));
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors mt-2
                    ${hasActiveChild && !isExpanded
                      ? 'text-indigo-400 font-bold'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon className={`h-4 w-4 shrink-0 transition-colors ${hasActiveChild ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span>{group.label}</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-200 pr-4 space-y-0.5
                    ${isExpanded ? 'max-h-[500px] opacity-100 py-1' : 'max-h-0 opacity-0 pointer-events-none'}`}
                >
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.id === activeSection;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors my-0.5
                          ${isActive
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950/50 font-bold'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-black text-white text-sm">
              {adminDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{adminDisplayName}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {admin?.role === 'institution_owner' && 'مالك المؤسسة'}
                {admin?.role === 'institution_admin' && 'مدير المؤسسة'}
                {admin?.role === 'faculty_admin' && 'مدير كلية'}
                {admin?.role === 'department_admin' && 'مدير قسم'}
                {admin?.role === 'staff' && 'سكرتاريا / موظف إداري'}
                {admin?.role === 'viewer' && 'مشاهد للقراءة فقط'}
                {admin?.role === 'super_admin' && 'مالك المنصة (معاينة)'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </aside>

      <main className="mr-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-3 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="ابحث عن طالب، أستاذ، قسم، حصة..."
              className="h-9 pr-10 rounded-lg bg-slate-50 border-slate-200"
            />
          </div>
          <ThemeToggle className="h-9 w-9 shrink-0" />
          <button type="button" className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <Bell className="h-4 w-4 text-slate-600" />
          </button>
          <div className="flex items-center gap-2 text-right">
            <div className="text-[11px]">
              <p className="font-bold text-slate-900">{adminDisplayName}</p>
              {institution && (
                <p className="text-slate-500">{institution.name}</p>
              )}
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-black text-white text-sm">
              {adminDisplayName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="px-6 py-5 bg-white border-b border-slate-100">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {getDashboardTitle(admin?.role)}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {getDashboardDescription(admin?.role)}
              </p>
            </div>
            {institution && (
              <div className="flex items-center gap-3">
                {institution.imageUrl ? (
                  <img src={institution.imageUrl} alt={institution.name} className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-indigo-600" />
                  </div>
                )}
                <div className="text-right">
                  <p className="font-bold text-slate-900 text-sm">{institution.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {[institution.wilaya, institution.city].filter(Boolean).join(' • ') || '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-6">
          {institution && !canViewActiveSection && (
            <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6 text-center text-amber-800">
              <Building2 className="mx-auto mb-3 h-10 w-10" />
              <h2 className="text-lg font-black">ليست لديك صلاحية فتح هذا القسم</h2>
              <p className="mt-1 text-sm">تم ضبط لوحة التحكم حسب الدور والصلاحيات الممنوحة لهذا الحساب.</p>
            </div>
          )}
          {institution && canViewActiveSection && (() => {
            const sidebarItem = sidebar.find(item => item.id === activeSection);
            if (sidebarItem) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const TabComponent = sidebarItem.component as any;
              return (
                <TabComponent
                  institutionId={institution.id}
                  institutionName={institution.name}
                  institutionType={institution.type}
                  permissions={permissions}
                />
              );
            }
            return null;
          })()}
        </div>
      </main>
    </div>
  );
}
