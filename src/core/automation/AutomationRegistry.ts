import { getModule } from '@/config/modules';
import type { AutomationRule } from './AutomationTypes';

export const AutomationRegistry = {
  /**
   * Retrieves automation rules registered under a specific module manifest.
   */
  getRules(moduleId: string): AutomationRule[] {
    try {
      const manifest = getModule(moduleId);
      const rules = manifest.automationRules as AutomationRule[] | undefined;
      return rules || [];
    } catch (e) {
      console.error(`AutomationRegistry: Failed to retrieve rules for ${moduleId}:`, e);
      return [];
    }
  }
};
