import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  BarChart3,
  ClipboardList,
  GraduationCap,
  LogOut,
  UserCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ThemeToggle';
import SessionsTab from '@/components/admin/SessionsTab';
import AttendanceTab from '@/components/admin/AttendanceTab';
import TeacherStatsTab from '@/components/admin/TeacherStatsTab';
import InstitutionGroups from '@/components/institution-admin/InstitutionGroups';
import InstitutionStudents from '@/components/institution-admin/InstitutionStudents';
import { getAuthenticatedAdmin, logoutAdmin, resolveLandingRoute } from '@/lib/database';
import { getCurrentAdminPermissionMap } from '@/lib/institutionAdminApi';
import { useInstitutionUI } from '@/config/institutions';
import { PERMISSIONS, can, type PermissionMap } from '@/lib/permissions';
import type { Admin } from '@/lib/types';
import usePermission from '@/core/permissions/usePermission';

const READ_ONLY_PERMISSIONS: PermissionMap = {};

export default function AdminDashboardPage() {
  const ui = useInstitutionUI();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);

  useEffect(() => {
    let isMounted = true;

    const verifyAdmin = async () => {
      const currentAdmin = await getAuthenticatedAdmin();
      if (!isMounted) return;

      if (!currentAdmin?.role) {
        navigate('/panel-sk2025x/login', { replace: true });
        return;
      }

      if (currentAdmin.role !== 'teacher') {
        navigate(resolveLandingRoute(currentAdmin.role), { replace: true });
        return;
      }

      if (!currentAdmin.institution_id) {
        navigate('/panel-sk2025x/access-denied', { replace: true });
        return;
      }

      const permissionMap = await getCurrentAdminPermissionMap().catch((error) => {
        console.error('Failed to load teacher permissions:', error);
        return {};
      });
      if (!isMounted) return;

      setPermissions(permissionMap);
      setAdmin(currentAdmin);
    };

    void verifyAdmin();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleLogout = () => {
    logoutAdmin();
    navigate('/panel-sk2025x/login', { replace: true });
  };

  if (!admin?.institution_id) return null;

  const displayName = admin.fullName || admin.full_name || admin.username;
  const canViewTeacherDashboard = hasPermission(PERMISSIONS.teacherDashboardView);
  const canCreateOwnSessions = hasPermission(PERMISSIONS.sessionsCreateOwn);
  const canManageOwnAttendance = hasPermission(PERMISSIONS.attendanceManageOwn);
  const canViewAssignedCohorts = hasPermission(PERMISSIONS.cohortsViewAssigned);
  const canViewAssignedStudents = hasPermission(PERMISSIONS.studentsViewAssigned);
  const institutionName = 'مؤسستك';
  const institutionType = admin.institution_type === 'school'
    || admin.institution_type === 'primary_school'
    || admin.institution_type === 'secondary_school'
    || admin.institution_type === 'training'
    || admin.institution_type === 'company'
    ? admin.institution_type
    : 'military';

  return (
    <div className="teacher-dashboard min-h-screen overflow-x-auto sm:overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100" dir="rtl">
      <header className="border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="Ausar Military"
              className="h-12 w-12 cursor-pointer drop-shadow-sm transition-transform hover:scale-105"
              onClick={() => navigate('/')}
            />
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">لوحة الأستاذ</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                جلساتك، أفواجك، طلابك ونتائج الحضور الخاصة بك فقط
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white">مرحبا، {displayName}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/70">
                <UserCheck className="h-3.5 w-3.5" />
                أستاذ
              </span>
            </div>
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={handleLogout}
              className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              <LogOut className="ml-2 h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <Tabs defaultValue="sessions" className="space-y-6" dir="rtl">
          {!canViewTeacherDashboard && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              ليست لديك صلاحية فتح لوحة الأستاذ.
            </div>
          )}
          <TabsList className="h-auto w-full flex shrink-0 gap-1 overflow-x-auto whitespace-nowrap rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900" style={{ scrollbarWidth: 'none', scrollbarGutter: 'auto' }}>
            <TabsTrigger value="sessions" className="gap-2 whitespace-nowrap px-3 py-2 text-xs text-slate-700 sm:px-4 sm:text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:text-slate-200 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">جلساتي و QR</span>
              <span className="sm:hidden">الجلسات</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2 whitespace-nowrap px-3 py-2 text-xs text-slate-700 sm:px-4 sm:text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:text-slate-200 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">نتائج الحضور</span>
              <span className="sm:hidden">الحضور</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2 whitespace-nowrap px-3 py-2 text-xs text-slate-700 sm:px-4 sm:text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:text-slate-200 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{ui.dictionary.cohorts}</span>
              <span className="sm:hidden">الدفعات</span>
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-2 whitespace-nowrap px-3 py-2 text-xs text-slate-700 sm:px-4 sm:text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:text-slate-200 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">{ui.dictionary.students}</span>
              <span className="sm:hidden">الطلاب</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2 whitespace-nowrap px-3 py-2 text-xs text-slate-700 sm:px-4 sm:text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:text-slate-200 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">الإحصائيات</span>
              <span className="sm:hidden">الإحصاء</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions">
            <SessionsTab
              adminId={admin.id}
              canCreate={canCreateOwnSessions}
              canManage={canManageOwnAttendance}
            />
          </TabsContent>

          <TabsContent value="attendance">
            <AttendanceTab
              readOnly
              title="نتائج حضوري"
              description="عرض سجلات الحضور المرتبطة بجلساتك فقط"
            />
          </TabsContent>

          <TabsContent value="groups">
            {canViewAssignedCohorts ? (
              <InstitutionGroups
                institutionId={admin.institution_id}
                institutionName={institutionName}
                institutionType={institutionType}
                permissions={READ_ONLY_PERMISSIONS}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="students">
            {canViewAssignedStudents ? (
              <InstitutionStudents
                institutionId={admin.institution_id}
                institutionName={institutionName}
                institutionType={institutionType}
                permissions={READ_ONLY_PERMISSIONS}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="stats">
            <TeacherStatsTab teacherId={admin.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
