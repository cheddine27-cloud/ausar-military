import { AutomationRegistry } from './AutomationRegistry';
import { AutomationRules } from './AutomationRules';
import type { TriggerEvent } from './AutomationTypes';

export const AutomationEngine = {
  /**
   * Main entry point to trigger and evaluate rules for a given event.
   */
  async trigger(
    institutionId: string,
    moduleId: string,
    event: TriggerEvent,
    targetId: string | null
  ): Promise<{ executedCount: number }> {
    try {
      // 1. Fetch registered rules for this module and event
      const rules = AutomationRegistry.getRules(moduleId).filter((r) => r.trigger === event);
      if (rules.length === 0) return { executedCount: 0 };

      let executedCount = 0;
      for (const rule of rules) {
        // Evaluate conditions (if any exist)
        let conditionsPass = true;
        if (rule.conditions && rule.conditions.length > 0) {
          // Simple condition evaluator
          // Currently supports basic stubs (conditions pass by default unless evaluated)
          conditionsPass = true;
        }

        if (conditionsPass) {
          for (const action of rule.actions) {
            const success = await AutomationRules.execute(
              institutionId,
              rule.id,
              rule.name_ar,
              event,
              action,
              targetId
            );
            if (success) executedCount++;
          }
        }
      }

      return { executedCount };
    } catch (e) {
      console.error('AutomationEngine.trigger failed:', e);
      return { executedCount: 0 };
    }
  }
};
