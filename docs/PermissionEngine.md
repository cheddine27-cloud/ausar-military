# Ausar Military Enterprise Permission Engine

The **Enterprise Permission Engine** handles client-side security and capability check operations.

## Architecture

- **`PermissionTypes.ts`**: Contains types for `PermissionKey` and `PermissionMap`.
- **`PermissionRegistry.ts`**: Aggregates permissions required by modules.
- **`PermissionService.ts`**: Fetches user permissions maps from Supabase.
- **`PermissionProvider.tsx`**: Context provider exposing `hasPermission` and the loaded map.
- **`usePermission.ts`**: Custom hook for checking permissions inside components.

## How to Check Permissions

In any functional React component, import the `usePermission` hook:

```typescript
import usePermission from '@/core/permissions/usePermission';

export default function MyComponent() {
  const { hasPermission } = usePermission();

  return (
    <div>
      {hasPermission('attendance.delete') && (
        <button onClick={handleDelete}>حذف الجلسة</button>
      )}
    </div>
  );
}
```
