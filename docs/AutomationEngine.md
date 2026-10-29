# Ausar Military Core Automation Engine

The **Automation Engine** executes configuration-driven business logic triggers and workflows.

## Configuration-Driven Rules
Rules are defined inside module manifests. Example:

```typescript
automationRules: [
  {
    id: 'school_risk_alert',
    name_ar: 'تنبيه الخطر التلقائي للغيابات المتكررة',
    name_fr: 'Alerte automatique de risque d\'absence',
    trigger: 'absence_limit_exceeded',
    actions: [{ type: 'create_risk_alert' }]
  }
]
```

## Supported Events
- `attendance_submitted`
- `attendance_approved`
- `workflow_completed`
- `absence_limit_exceeded`
- `late_limit_exceeded`

## Action Handlers
- `send_notification`
- `create_risk_alert`
- `generate_daily_report`
- `archive_workflow`
- `flag_student`
