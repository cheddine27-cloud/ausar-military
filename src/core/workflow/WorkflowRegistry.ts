import { getModule } from '@/config/modules';
import type { WorkflowDefinition, WorkflowCardDefinition, WorkflowStepDefinition, WorkflowTransitionDefinition } from './WorkflowTypes';
import { predictiveIntelligenceWorkflow, studentTransferWorkflow } from '@/modules/school/workflow';

/**
 * Resolves workflow definitions and dashboard cards dynamically from active module manifests.
 */
export const WorkflowRegistry = {
  /**
   * Retrieves the workflow definition associated with the given module ID and entity type.
   */
  getWorkflow(moduleId: string, entityType?: string): WorkflowDefinition | null {
    try {
      if (moduleId === 'school' && entityType === 'prediction_alert') {
        return predictiveIntelligenceWorkflow;
      }
      if (moduleId === 'school' && entityType === 'student_transfer') {
        return studentTransferWorkflow;
      }
      const manifest = getModule(moduleId);
      return manifest.workflow || null;
    } catch (e) {
      console.error(`WorkflowRegistry: Failed to retrieve workflow for ${moduleId} (${entityType}):`, e);
      return null;
    }
  },

  /**
   * Retrieves the dashboard KPI cards registered for the given module ID.
   */
  getDashboardCards(moduleId: string): WorkflowCardDefinition[] {
    try {
      const manifest = getModule(moduleId);
      return manifest.dashboardCards || [];
    } catch (e) {
      console.error(`WorkflowRegistry: Failed to retrieve dashboard cards for ${moduleId}:`, e);
      return [];
    }
  },

  /**
   * Helper to retrieve a specific step's definition.
   */
  getStep(moduleId: string, stepId: string, entityType?: string): WorkflowStepDefinition | null {
    const workflow = this.getWorkflow(moduleId, entityType);
    if (!workflow) return null;
    return workflow.steps.find((s) => s.id === stepId) || null;
  },

  /**
   * Helper to resolve the next transition state given an action and fromState.
   */
  getTransition(moduleId: string, action: string, fromState: string, entityType?: string): WorkflowTransitionDefinition | null {
    const workflow = this.getWorkflow(moduleId, entityType);
    if (!workflow) return null;
    return workflow.transitions.find((t) => t.action === action && t.fromState === fromState) || null;
  }
};

