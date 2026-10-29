import { supabase } from '@/lib/supabase';
import { AutomationHistory } from './AutomationHistory';
import type { AutomationActionDefinition, TriggerEvent } from './AutomationTypes';

export const AutomationRules = {
  /**
   * Main router for executing automation actions.
   */
  async execute(
    institutionId: string,
    ruleId: string,
    ruleName: string,
    trigger: TriggerEvent,
    action: AutomationActionDefinition,
    targetId: string | null
  ): Promise<boolean> {
    try {
      let success = false;
      let errorMsg: string | null = null;

      switch (action.type) {
        case 'send_notification':
          success = await this.handleSendNotification(institutionId, targetId, action.params);
          break;
        case 'create_risk_alert':
          success = await this.handleCreateRiskAlert(institutionId, targetId, action.params);
          break;
        case 'generate_daily_report':
          success = await this.handleGenerateDailyReport(institutionId, targetId, action.params);
          break;
        case 'archive_workflow':
          success = await this.handleArchiveWorkflow(institutionId, targetId, action.params);
          break;
        case 'flag_student':
          success = await this.handleFlagStudent(institutionId, targetId, action.params);
          break;
        default:
          errorMsg = `Unsupported action type: ${action.type}`;
          console.warn(errorMsg);
      }

      // Log execution status in database
      await AutomationHistory.log({
        institutionId,
        ruleId,
        ruleName,
        triggerEvent: trigger,
        actionExecuted: action.type,
        targetId,
        status: success ? 'success' : 'failed',
        errorMessage: errorMsg,
      });

      return success;
    } catch (e) {
      const err = e as Error;
      console.error(`AutomationRules: Exception executing action ${action.type}:`, err);
      await AutomationHistory.log({
        institutionId,
        ruleId,
        ruleName,
        triggerEvent: trigger,
        actionExecuted: action.type,
        targetId,
        status: 'failed',
        errorMessage: err.message || 'Unknown automation execution error',
      });
      return false;
    }
  },

  async handleSendNotification(institutionId: string, targetId: string | null, params?: Record<string, unknown>): Promise<boolean> {
    // Send auto notification logic (e.g. absent notifications batch)
    // We already do this via GuardianService/NotificationEngine, this is a clean wrapper/stub
    console.log(`[Automation] Send Notification triggered for target ${targetId}`);
    return true;
  },

  async handleCreateRiskAlert(institutionId: string, targetId: string | null, params?: Record<string, unknown>): Promise<boolean> {
    console.log(`[Automation] Create Risk Alert triggered for target ${targetId}`);
    // Stub to write a notification/flag to the database
    return true;
  },

  async handleGenerateDailyReport(institutionId: string, targetId: string | null, params?: Record<string, unknown>): Promise<boolean> {
    console.log(`[Automation] Generate Daily Report triggered for target ${targetId}`);
    return true;
  },

  async handleArchiveWorkflow(institutionId: string, targetId: string | null, params?: Record<string, unknown>): Promise<boolean> {
    console.log(`[Automation] Archive Workflow triggered for target ${targetId}`);
    return true;
  },

  async handleFlagStudent(institutionId: string, targetId: string | null, params?: Record<string, unknown>): Promise<boolean> {
    console.log(`[Automation] Flag Student triggered for target ${targetId}`);
    return true;
  }
};
