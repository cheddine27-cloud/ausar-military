# Ausar Military Workflow Integration Guide

The generic **Workflow Engine** (`src/core/workflow/`) manages transition states for records in the database.

## Defining a Workflow
Workflows are defined inside module manifests (e.g. `school` manifest):

```typescript
workflow: {
  states: [
    { name: 'draft', labelAr: 'مسودة', labelFr: 'Brouillon' },
    { name: 'approved', labelAr: 'مقبول', labelFr: 'Approuvé' },
  ],
  transitions: [
    {
      trigger: 'approve',
      from: 'draft',
      to: 'approved',
      requiredPermission: 'workflow.review',
    }
  ]
}
```

## Executing a Transition
Trigger transitions inside services or components via `WorkflowEngine.transition()`:

```typescript
import { WorkflowEngine } from '@/core/workflow/WorkflowEngine';

const result = await WorkflowEngine.transition(
  institutionId,
  'school',
  'attendance_report',
  reportId,
  'approve',
  adminId,
  actorName,
  'Approved attendance logs'
);
```
This logs a workflow history log and updates the current state transition safely.
