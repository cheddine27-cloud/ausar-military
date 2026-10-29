import React, { createContext, useEffect, useState, type ReactNode } from 'react';
import { PermissionService } from './PermissionService';
import type { PermissionContextType, PermissionKey, PermissionMap } from './PermissionTypes';
import { getCurrentAdmin } from '@/lib/database';

export const PermissionContext = createContext<PermissionContextType>({
  hasPermission: () => false,
  permissions: {},
  loading: true,
});

interface PermissionProviderProps {
  children: ReactNode;
}

export default function PermissionProvider({ children }: PermissionProviderProps) {
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const admin = getCurrentAdmin();
      if (!admin) {
        setPermissions({});
        return;
      }
      const map = await PermissionService.getPermissions();
      setPermissions(map);
    } catch (err) {
      console.error('PermissionProvider: Failed to load user permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPermissions();

    // Re-verify if login session changes
    const handleSessionChange = () => {
      void loadPermissions();
    };
    window.addEventListener('storage', handleSessionChange);
    return () => {
      window.removeEventListener('storage', handleSessionChange);
    };
  }, []);

  const hasPermission = (key: PermissionKey | string): boolean => {
    // Super admin bypasses all checks
    const admin = getCurrentAdmin();
    if (admin?.role === 'super_admin') return true;

    return permissions[key as PermissionKey] === true;
  };

  return (
    <PermissionContext.Provider value={{ hasPermission, permissions, loading }}>
      {children}
    </PermissionContext.Provider>
  );
}
