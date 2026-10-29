# Ausar Military Automations Integration Guide

The **Automation Engine** (`src/core/automation/`) evaluates conditions and triggers actions automatically.

## Registering Rules
Declare automation rules inside your module's manifest:

```typescript
automationRules: [
  {
    id: 'absence_limit_rule',
    name_ar: 'تنبيه غيابات تلقائي',
    name_fr: 'Alerte d\'absence automatique',
    trigger: 'absence_limit_exceeded',
    actions: [
      {
        type: 'send_notification',
        params: { channel: 'sms' }
      }
    ]
  }
]
```

## Triggering an Event
Fire automation triggers in your business flows via `AutomationScheduler`:

```typescript
import { AutomationScheduler } from '@/core/automation/AutomationScheduler';

AutomationScheduler.scheduleTrigger(
  institutionId,
  'school',
  'absence_limit_exceeded',
  studentId
);
```
This processes conditions and logs success/failure outputs inside `automation_history` table.
