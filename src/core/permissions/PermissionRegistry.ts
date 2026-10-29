import { getModule } from '@/config/modules';

/**
 * Registry to compile permissions declared by each active module manifest dynamically.
 */
export const PermissionRegistry = {
  /**
   * Retrieves required permissions defined for a specific module manifest.
   */
  getRequiredPermissions(moduleId: string): string[] {
    try {
      const manifest = getModule(moduleId);
      const permissions = manifest.permissions as string[] | undefined;
      return permissions || [];
    } catch (e) {
      console.error(`PermissionRegistry: Failed to retrieve permissions for ${moduleId}:`, e);
      return [];
    }
  }
};
