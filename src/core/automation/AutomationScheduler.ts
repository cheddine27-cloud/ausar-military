import { AutomationEngine } from './AutomationEngine';
import type { TriggerEvent } from './AutomationTypes';

export const AutomationScheduler = {
  /**
   * Schedules a rule trigger evaluation after a set delay (simulating async task queues).
   */
  scheduleTrigger(
    institutionId: string,
    moduleId: string,
    event: TriggerEvent,
    targetId: string | null,
    delayMs = 500
  ): void {
    setTimeout(() => {
      // Evaluate rules asynchronously in background
      void AutomationEngine.trigger(institutionId, moduleId, event, targetId);
    }, delayMs);
  }
};
