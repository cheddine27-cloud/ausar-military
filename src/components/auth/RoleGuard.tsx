import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getAuthenticatedAdmin,
  resolveLandingRoute,
  type AdminRole,
} from '@/lib/database';

interface RoleGuardProps {
  allowedRoles: readonly AdminRole[];
  requireInstitution?: boolean;
  children: ReactNode;
}

export default function RoleGuard({
  allowedRoles,
  requireInstitution = false,
  children,
}: RoleGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      const admin = await getAuthenticatedAdmin();
      if (!active) return;

      if (!admin?.role) {
        navigate('/panel-sk2025x/login', { replace: true });
        return;
      }

      const roleAllowed = allowedRoles.includes(admin.role as AdminRole);
      const hasInstitution = !requireInstitution || Boolean(admin.institution_id);

      if (!roleAllowed || !hasInstitution) {
        const landingRoute = resolveLandingRoute(admin.role as AdminRole);
        const safeRoute = landingRoute !== location.pathname
          ? landingRoute
          : '/panel-sk2025x/access-denied';

        navigate(safeRoute, { replace: true });
        return;
      }

      setAllowed(true);
    };

    void verify();
    return () => {
      active = false;
    };
  }, [allowedRoles, location.pathname, navigate, requireInstitution]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-indigo-500 font-mono text-sm">
          جاري التحقق من صلاحيات الدخول...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
