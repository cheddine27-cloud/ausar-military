import { supabase } from '@/lib/supabase';
import type { AuditRecord, AuditLogFilters } from './AuditTypes';

export const AuditService = {
  /**
   * Records a new audit log entry in the database.
   */
  async log(params: {
    institutionId: string;
    moduleId: string;
    action: string;
    actorId: string | null;
    actorName: string;
    targetId?: string | null;
    targetType?: string | null;
    result?: 'success' | 'failure' | 'warning';
    remarks?: string | null;
    ipAddress?: string | null;
    deviceInfo?: string | null;
    durationMs?: number;
  }): Promise<boolean> {
    try {
      const formattedRemarks = params.remarks
        ? `${params.remarks}${params.durationMs !== undefined ? ` (Duration: ${params.durationMs.toFixed(1)}ms)` : ''}`
        : params.durationMs !== undefined
        ? `Execution Duration: ${params.durationMs.toFixed(1)}ms`
        : null;

      const { error } = await supabase.from('audit_logs').insert({
        institution_id: params.institutionId,
        module_id: params.moduleId,
        action: params.action,
        actor_id: params.actorId,
        actor_name: params.actorName,
        target_id: params.targetId || null,
        target_type: params.targetType || null,
        result: params.result || 'success',
        remarks: formattedRemarks,
        ip_address: params.ipAddress || null,
        device_info: params.deviceInfo || null,
      });

      if (error) {
        console.error('AuditService.log failed:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('AuditService: Exception during logging:', e);
      return false;
    }
  },

  /**
   * Fetches audit logs based on search criteria and filters.
   */
  async getLogs(
    institutionId: string,
    filters?: AuditLogFilters,
    searchQuery?: string
  ): Promise<AuditRecord[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false });

      if (filters) {
        if (filters.moduleId) {
          query = query.eq('module_id', filters.moduleId);
        }
        if (filters.action) {
          query = query.eq('action', filters.action);
        }
        if (filters.result) {
          query = query.eq('result', filters.result);
        }
        if (filters.startDate) {
          query = query.gte('created_at', `${filters.startDate}T00:00:00Z`);
        }
        if (filters.endDate) {
          query = query.lte('created_at', `${filters.endDate}T23:59:59Z`);
        }
        if (filters.actorName) {
          query = query.ilike('actor_name', `%${filters.actorName}%`);
        }
      }

      if (searchQuery) {
        const trimmed = searchQuery.trim();
        query = query.or(
          `action.ilike.%${trimmed}%,remarks.ilike.%${trimmed}%,actor_name.ilike.%${trimmed}%`
        );
      }

      const { data, error } = await query;
      if (error) {
        console.error('AuditService.getLogs failed:', error);
        return [];
      }
      return (data || []) as AuditRecord[];
    } catch (e) {
      console.error('AuditService: Exception during logs fetch:', e);
      return [];
    }
  }
};
