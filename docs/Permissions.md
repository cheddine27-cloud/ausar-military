# Ausar Military Permissions Integration Guide

The **Permission Engine** handles authorization via capabilities and defaults.

## Registering Permissions
Declare the permissions needed by your module in the manifest:

```typescript
permissions: [
  'attendance.create',
  'attendance.edit',
  'attendance.delete',
]
```

## Hook Usage
Use `usePermission` to authorize views in React:

```typescript
import usePermission from '@/core/permissions/usePermission';

export default function MyComponent() {
  const { hasPermission } = usePermission();

  if (!hasPermission('attendance.create')) {
    return <AccessDenied />
  }

  return <CreateAttendanceForm />;
}
```
This is fully dynamic and integrates seamlessly with role defaults and overrides in the database.
