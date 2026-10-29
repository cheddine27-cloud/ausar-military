import { supabase } from '@/lib/supabase';
import type { AutomationHistoryRecord, TriggerEvent, AutomationActionType } from './AutomationTypes';

export const AutomationHistory = {
  /**
   * Logs a new automation rule execution entry in the database.
   */
  async log(params: {
    institutionId: string;
    ruleId: string;
    ruleName: string;
    triggerEvent: TriggerEvent;
    actionExecuted: AutomationActionType;
    targetId: string | null;
    status: 'success' | 'failed';
    errorMessage: string | null;
  }): Promise<boolean> {
    try {
      const { error } = await supabase.from('automation_history').insert({
        institution_id: params.institutionId,
        rule_id: params.ruleId,
        rule_name: params.ruleName,
        trigger_event: params.triggerEvent,
        action_executed: params.actionExecuted,
        target_id: params.targetId || null,
        status: params.status,
        error_message: params.errorMessage || null,
      });

      if (error) {
        console.error('AutomationHistory.log failed:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('AutomationHistory: Exception during logging:', e);
      return false;
    }
  },

  /**
   * Fetches the logs of executed automations.
   */
  async getLogs(institutionId: string): Promise<AutomationHistoryRecord[]> {
    try {
      const { data, error } = await supabase
        .from('automation_history')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('AutomationHistory.getLogs failed:', error);
        return [];
      }

      return (data || []) as AutomationHistoryRecord[];
    } catch (e) {
      console.error('AutomationHistory: Exception during fetching logs:', e);
      return [];
    }
  }
};
