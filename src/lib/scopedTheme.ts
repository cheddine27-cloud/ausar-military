import { useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useLocation } from 'react-router-dom';
import type { Admin } from './types';

export const ADMIN_SESSION_CHANGE_EVENT = 'qhudoor-admin-session-change';

const CURRENT_ADMIN_KEY = 'attendance_current_admin';
type DashboardThemeType = 'public' | 'super_admin' | 'institution' | 'institution_admin' | 'teacher';

interface ScopedThemeOptions {
  role?: Admin['role'] | string | null;
  username?: string | null;
  adminId?: string | null;
  dashboardType?: DashboardThemeType | string | null;
  pathname?: string;
  admin?: Admin | null;
}

const LEGACY_THEME_KEYS = [
  'theme',
  'darkMode',
  'qhudoor_theme',
  'Ausar Military-theme',
  'qhudoor_teacher_theme',
  'qhudoor_institution_theme',
  'qhudoor_super_admin_theme',
] as const;

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readCurrentAdminForTheme(): Admin | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.sessionStorage.getItem(CURRENT_ADMIN_KEY);
    return raw ? (JSON.parse(raw) as Admin) : null;
  } catch {
    return null;
  }
}

function cleanSegment(value: string | null | undefined, fallback: string) {
  const normalized = (value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || fallback;
}

function getDashboardType(pathname: string): DashboardThemeType {
  if (pathname.startsWith('/panel-sk2025x/dashboard')) return 'teacher';
  if (pathname.startsWith('/panel-sk2025x/super-admin')) return 'super_admin';
  if (pathname.startsWith('/panel-sk2025x/institution')) return 'institution';
  return 'public';
}

function resolveThemeRole(dashboardType: DashboardThemeType | string, admin: Admin | null, role?: string | null) {
  if (role) return cleanSegment(role, 'institution_admin');

  if (dashboardType === 'teacher') return 'teacher';
  if (dashboardType === 'super_admin') return 'super_admin';
  if (dashboardType === 'institution' || dashboardType === 'institution_admin') {
    return cleanSegment(admin?.role, 'institution_admin');
  }

  return 'public';
}

function normalizeScopedThemeInput(
  pathnameOrOptions: string | ScopedThemeOptions,
  adminOverride?: Admin | null
): Required<Pick<ScopedThemeOptions, 'pathname'>> & ScopedThemeOptions {
  if (typeof pathnameOrOptions === 'string') {
    return {
      pathname: pathnameOrOptions,
      admin: adminOverride ?? readCurrentAdminForTheme(),
    };
  }

  return {
    pathname: pathnameOrOptions.pathname ?? '/',
    ...pathnameOrOptions,
    admin: pathnameOrOptions.admin ?? readCurrentAdminForTheme(),
  };
}

export function getScopedThemeStorageKey(
  pathnameOrOptions: string | ScopedThemeOptions,
  adminOverride?: Admin | null
) {
  const input = normalizeScopedThemeInput(pathnameOrOptions, adminOverride);
  const dashboardType = input.dashboardType ?? getDashboardType(input.pathname);
  const admin = input.admin ?? null;

  if (dashboardType === 'public') {
    return 'qhudoor_theme_public';
  }

  const role = resolveThemeRole(dashboardType, admin, input.role);
  const identity = cleanSegment(input.username || input.adminId || admin?.username || admin?.id, 'anonymous');

  return `qhudoor_theme_${role}_${identity}`;
}

export function cleanupLegacyThemeKeys() {
  if (!isBrowser()) return;

  for (const key of LEGACY_THEME_KEYS) {
    window.localStorage.removeItem(key);
  }
}

export function notifyAdminSessionChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(ADMIN_SESSION_CHANGE_EVENT));
}

export function useScopedTheme(options: ScopedThemeOptions = {}) {
  const { pathname } = useLocation();
  const { resolvedTheme, setTheme, theme } = useTheme();

  const storageKey = useMemo(
    () => getScopedThemeStorageKey({ pathname, ...options }),
    [options.admin, options.adminId, options.dashboardType, options.role, options.username, pathname]
  );
  const isDark = resolvedTheme === 'dark';
  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  return {
    storageKey,
    theme,
    resolvedTheme,
    isDark,
    setTheme,
    toggleTheme,
  };
}
