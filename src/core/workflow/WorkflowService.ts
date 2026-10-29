import { supabase } from '@/lib/supabase';
import type { WorkflowEvent, WorkflowInstance } from './WorkflowTypes';

export const WorkflowService = {
  /**
   * Fetches the workflow history events for a specific entity.
   */
  async getTimelineEvents(entityType: string, entityId: string): Promise<WorkflowEvent[]> {
    // 1. Get the instance ID
    const { data: instance, error: instError } = await supabase
      .from('workflow_instances')
      .select('id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .maybeSingle();

    if (instError || !instance) {
      return [];
    }

    // 2. Fetch events ordered chronologically
    const { data: events, error: evError } = await supabase
      .from('workflow_events')
      .select('*')
      .eq('instance_id', instance.id)
      .order('created_at', { ascending: true });

    if (evError) {
      console.error('WorkflowService.getTimelineEvents failed:', evError);
      return [];
    }

    return (events || []) as WorkflowEvent[];
  },

  /**
   * Fetches and searches all workflow audit events for an institution.
   */
  async getAuditLogs(institutionId: string, searchQuery?: string): Promise<WorkflowEvent[]> {
    let query = supabase
      .from('workflow_events')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (searchQuery) {
      query = query.or(`action.ilike.%${searchQuery}%,notes.ilike.%${searchQuery}%,actor_name.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('WorkflowService.getAuditLogs failed:', error);
      return [];
    }

    return (data || []) as WorkflowEvent[];
  }
};
