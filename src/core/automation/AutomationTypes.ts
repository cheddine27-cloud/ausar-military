/**
 * Ausar Military — Core Automation Engine Types
 */

export type TriggerEvent =
  | 'attendance_submitted'
  | 'attendance_approved'
  | 'workflow_completed'
  | 'absence_limit_exceeded'
  | 'late_limit_exceeded';

export type AutomationActionType =
  | 'send_notification'
  | 'create_risk_alert'
  | 'generate_daily_report'
  | 'archive_workflow'
  | 'flag_student';

export interface AutomationActionDefinition {
  type: AutomationActionType;
  params?: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  name_ar: string;
  name_fr: string;
  trigger: TriggerEvent;
  conditions?: {
    field: string;
    operator: 'equals' | 'gte' | 'lte' | 'contains';
    value: unknown;
  }[];
  actions: AutomationActionDefinition[];
}

export interface AutomationHistoryRecord {
  id: string;
  institution_id: string;
  rule_id: string;
  rule_name: string;
  trigger_event: TriggerEvent;
  action_executed: AutomationActionType;
  target_id: string | null;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}
