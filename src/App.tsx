import { useEffect, useMemo, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PermissionProvider from '@/core/permissions/PermissionProvider';
import NotFound from './pages/NotFound';
import Student from './pages/Student';
import StudentScan from './pages/StudentScan';
import StudentQRScanner from './pages/StudentQRScanner';
import StudentCodeEntry from './pages/StudentCodeEntry';
import StudentRegister from './pages/StudentRegister';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdmin from './pages/SuperAdmin';
import InstitutionAdmin from './pages/InstitutionAdmin';
import AccessDenied from './pages/AccessDenied';
import DownloadPage from './pages/DownloadPage';
import FreeTrialPage from './pages/FreeTrialPage';
import LandingPage from './pages/LandingPage';
import RoleGuard from './components/auth/RoleGuard';
import UpdateNotification from './components/UpdateNotification';
import type { AdminRole } from './lib/database';
import {
  ADMIN_SESSION_CHANGE_EVENT,
  cleanupLegacyThemeKeys,
  getScopedThemeStorageKey,
} from './lib/scopedTheme';
import { startAutoSync } from './lib/offlineQueue'; // ✅ جديد

const queryClient = new QueryClient();

const TEACHER_DASHBOARD_ROLES = ['teacher'] satisfies readonly AdminRole[];
const SUPER_ADMIN_ROLES = ['super_admin'] satisfies readonly AdminRole[];
const INSTITUTION_DASHBOARD_ROLES = [
  'institution_owner',
  'institution_admin',
  'faculty_admin',
  'department_admin',
  'staff',
  'viewer',
] satisfies readonly AdminRole[];

function ScopedThemeProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [sessionVersion, setSessionVersion] = useState(0);

  useEffect(() => {
    cleanupLegacyThemeKeys();

    const handleSessionChange = () => setSessionVersion((version) => version + 1);
    window.addEventListener(ADMIN_SESSION_CHANGE_EVENT, handleSessionChange);
    window.addEventListener('storage', handleSessionChange);

    return () => {
      window.removeEventListener(ADMIN_SESSION_CHANGE_EVENT, handleSessionChange);
      window.removeEventListener('storage', handleSessionChange);
    };
  }, []);

  const storageKey = useMemo(
    () => getScopedThemeStorageKey(pathname),
    [pathname, sessionVersion]
  );

  return (
    <ThemeProvider
      key={storageKey}
      attribute="class"
      defaultTheme="light"
      enableSystem
      storageKey={storageKey}
    >
      {children}
    </ThemeProvider>
  );
}

const App = () => {
  // ✅ بدء المزامنة التلقائية عند تحميل التطبيق
  useEffect(() => {
    startAutoSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <ScopedThemeProvider>
            <PermissionProvider>
              <Toaster />
              <UpdateNotification />
              {/* أزرار الوضع الليلي الآن داخل شريط التنقل في كل صفحة */}
              <Routes>
                  {/* الصفحة الرئيسية - صفحة هبوط تسويقية */}
                  <Route path="/" element={<LandingPage />} />
              {/* صفحة تحميل التطبيق — مسارين متطابقين دون قفز */}
              <Route path="/app" element={<DownloadPage />} />
              <Route path="/download" element={<DownloadPage />} />

              {/* صفحة التجربة المجانية — نموذج + دخول ديمو فوري */}
              <Route path="/trial" element={<FreeTrialPage />} />
              <Route path="/landing" element={<Navigate to="/" replace />} />

              {/* مسارات الطالب */}
              <Route path="/scan" element={<StudentScan />} />
              <Route path="/qr-scanner" element={<StudentQRScanner />} />
              <Route path="/code-entry" element={<StudentCodeEntry />} />
              <Route path="/register" element={<StudentRegister />} />

              {/* حماية المسارات القديمة - إعادة توجيه للرئيسية */}
              <Route path="/student" element={<Navigate to="/scan" replace />} />
              <Route path="/student/*" element={<Navigate to="/" replace />} />
              <Route path="/admin" element={<Navigate to="/" replace />} />
              <Route path="/admin/login" element={<Navigate to="/" replace />} />
              <Route path="/admin/dashboard" element={<Navigate to="/" replace />} />

              {/* لوحة التحكم المحمية - مخفية تماماً */}
              <Route path="/panel-sk2025x/login" element={<AdminLogin />} />
              <Route
                path="/panel-sk2025x/dashboard"
                element={(
                  <RoleGuard allowedRoles={TEACHER_DASHBOARD_ROLES} requireInstitution>
                    <AdminDashboard />
                  </RoleGuard>
                )}
              />
              <Route
                path="/panel-sk2025x/super-admin"
                element={(
                  <RoleGuard allowedRoles={SUPER_ADMIN_ROLES}>
                    <SuperAdmin />
                  </RoleGuard>
                )}
              />
              <Route
                path="/panel-sk2025x/institution"
                element={(
                  <RoleGuard allowedRoles={INSTITUTION_DASHBOARD_ROLES} requireInstitution>
                    <InstitutionAdmin />
                  </RoleGuard>
                )}
              />
              <Route path="/panel-sk2025x/access-denied" element={<AccessDenied />} />

              {/* صفحة 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </PermissionProvider>
          </ScopedThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
