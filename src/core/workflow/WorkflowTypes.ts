/**
 * Ausar Military — Workflow Engine Types
 *
 * Defines the core types and interfaces for the extensible SaaS workflow system.
 */

export interface WorkflowStepDefinition {
  id: string; // e.g. 'submitted', 'approved', 'notifications_sent', 'closed'
  label_ar: string; // Arabic display label for step
  label_fr: string; // French display label for step
  rolesAllowed: string[]; // e.g. ['teacher', 'institution_admin', 'institution_owner']
}

export interface WorkflowTransitionDefinition {
  action: string; // e.g. 'submit', 'approve', 'notify', 'reject'
  fromState: string; // e.g. 'draft', 'submitted', 'approved'
  toState: string; // e.g. 'submitted', 'approved', 'notifications_sent'
  label_ar: string;
  label_fr: string;
}

export interface WorkflowDefinition {
  moduleId: string; // e.g. 'school', 'military', 'company', 'training'
  entityType: string; // e.g. 'attendance_report'
  initialState: string; // e.g. 'submitted' or 'draft'
  steps: WorkflowStepDefinition[];
  transitions: WorkflowTransitionDefinition[];
}

export interface WorkflowCardDefinition {
  id: string; // e.g. 'pending_reports'
  label_ar: string;
  label_fr: string;
  icon: string; // Lucide icon name (e.g. 'FileClock', 'Send', 'Activity')
  color: string; // Tailwind color token (e.g. 'amber', 'indigo', 'emerald')
  countQuery: (institutionId: string) => Promise<number>;
}

export interface WorkflowInstance {
  id: string;
  institution_id: string;
  module_id: string;
  entity_type: string;
  entity_id: string;
  current_state: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowEvent {
  id: string;
  institution_id: string;
  instance_id: string;
  action: string;
  from_state: string;
  to_state: string;
  actor_id: string | null;
  actor_name: string | null;
  notes: string | null;
  created_at: string;
}
