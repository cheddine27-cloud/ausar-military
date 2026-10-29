import { supabase } from '@/lib/supabase';
import { WorkflowRegistry } from './WorkflowRegistry';
import type { WorkflowInstance, WorkflowEvent } from './WorkflowTypes';

export const WorkflowEngine = {
  /**
   * Lazily fetches or initializes a workflow instance for an entity.
   */
  async getOrStartInstance(
    institutionId: string,
    moduleId: string,
    entityType: string,
    entityId: string,
    actorId: string | null,
    actorName: string | null
  ): Promise<WorkflowInstance | null> {
    // 1. Check if instance already exists
    const { data: existing, error: fetchErr } = await supabase
      .from('workflow_instances')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .maybeSingle();

    if (fetchErr) {
      console.error('WorkflowEngine: Failed to fetch workflow instance:', fetchErr);
      return null;
    }

    if (existing) {
      return existing as WorkflowInstance;
    }

    // 2. Resolve workflow definition
    const workflow = WorkflowRegistry.getWorkflow(moduleId, entityType);
    if (!workflow) {
      console.warn(`WorkflowEngine: No workflow registered for module ${moduleId}`);
      return null;
    }

    // 3. Create new instance with initial state
    const initialState = workflow.initialState;
    const { data: newInst, error: insertErr } = await supabase
      .from('workflow_instances')
      .insert({
        institution_id: institutionId,
        module_id: moduleId,
        entity_type: entityType,
        entity_id: entityId,
        current_state: initialState,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('WorkflowEngine: Failed to create workflow instance:', insertErr);
      return null;
    }

    // 4. Log the initial creation event
    await supabase.from('workflow_events').insert({
      institution_id: institutionId,
      instance_id: newInst.id,
      action: 'initialize',
      from_state: 'none',
      to_state: initialState,
      actor_id: actorId,
      actor_name: actorName || 'النظام',
      notes: 'تهيئة مسار العمل',
    });

    return newInst as WorkflowInstance;
  },

  /**
   * Transitions an entity's workflow to the next state based on the action.
   */
  async transition(
    institutionId: string,
    moduleId: string,
    entityType: string,
    entityId: string,
    action: string,
    actorId: string | null,
    actorName: string | null,
    notes?: string
  ): Promise<{ success: boolean; nextState: string | null; error?: string }> {
    // 1. Get current instance
    const instance = await this.getOrStartInstance(institutionId, moduleId, entityType, entityId, actorId, actorName);
    if (!instance) {
      return { success: false, nextState: null, error: 'تعذر العثور على أو إنشاء مسار العمل' };
    }

    // 2. Resolve transition
    const transitionDef = WorkflowRegistry.getTransition(moduleId, action, instance.current_state, entityType);
    if (!transitionDef) {
      return {
        success: false,
        nextState: null,
        error: `العملية غير صالحة: لا يوجد انتقال من الحالة "${instance.current_state}" بواسطة الإجراء "${action}"`,
      };
    }

    // 3. Update the instance state
    const nextState = transitionDef.toState;
    const { error: updateErr } = await supabase
      .from('workflow_instances')
      .update({
        current_state: nextState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instance.id);

    if (updateErr) {
      console.error('WorkflowEngine: Failed to update state:', updateErr);
      return { success: false, nextState: null, error: 'فشل تحديث حالة مسار العمل في قاعدة البيانات' };
    }

    // 4. Log the transition event
    const { error: logErr } = await supabase.from('workflow_events').insert({
      institution_id: institutionId,
      instance_id: instance.id,
      action,
      from_state: instance.current_state,
      to_state: nextState,
      actor_id: actorId,
      actor_name: actorName || 'النظام',
      notes: notes || transitionDef.label_ar,
    });

    if (logErr) {
      console.error('WorkflowEngine: Failed to log workflow event:', logErr);
    }

    return { success: true, nextState };
  }
};
