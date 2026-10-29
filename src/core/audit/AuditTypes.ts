/**
 * Ausar Military — Core Audit Engine Types
 */

export interface AuditRecord {
  id: string;
  institution_id: string;
  module_id: string;
  action: string;
  actor_id: string | null;
  actor_name: string;
  target_id: string | null;
  target_type: string | null;
  result: 'success' | 'failure' | 'warning';
  remarks: string | null;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  moduleId?: string;
  action?: string;
  actorName?: string;
  result?: 'success' | 'failure' | 'warning';
  startDate?: string;
  endDate?: string;
}
