# Ausar Military Core Audit Engine

The **Audit Engine** records administrative activities, security operations, and business actions.

## Database Schema
Logs are stored in the `public.audit_logs` table:
- `institution_id` (uuid)
- `module_id` (text)
- `action` (text)
- `actor_name` (text)
- `result` ('success' | 'failure' | 'warning')
- `remarks` (text)
- `ip_address` (text)
- `device_info` (text)

## Recording an Event
Use the `AuditService` to log events from anywhere in the codebase:

```typescript
import { AuditService } from '@/core/audit/AuditService';

await AuditService.log({
  institutionId: 'inst-id',
  moduleId: 'school',
  action: 'attendance_submitted',
  actorId: 'admin-id',
  actorName: 'Taher',
  remarks: 'Submitted attendance report for 1AM-01',
});
```

## UI Components
- **`AuditTimeline`**: A clean, vertical visual representation of audit logs.
- **`AuditFilters`**: Search, select-range, and status filter panel.
