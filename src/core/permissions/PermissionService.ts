import { getCurrentAdminPermissionMap } from '@/lib/institutionAdminApi';
import type { PermissionMap } from './PermissionTypes';

export const PermissionService = {
  /**
   * Fetches the permissions map for the currently logged-in administrator.
   */
  async getPermissions(): Promise<PermissionMap> {
    try {
      const map = await getCurrentAdminPermissionMap();
      return map as PermissionMap;
    } catch (e) {
      console.error('PermissionService: Failed to fetch permissions map:', e);
      return {};
    }
  }
};
