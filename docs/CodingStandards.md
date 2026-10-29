# Ausar Military Coding Standards & Guidelines

To maintain production-grade quality, follow these coding standards:

## 1. Zero Direct Role Checks
- Never check raw roles like `role === 'teacher'` for authorization.
- Always use `usePermission()` hook:
  ```typescript
  const { hasPermission } = usePermission();
  if (!hasPermission('attendance.create')) return <AccessDenied />
  ```

## 2. Shared Components
- Reuse components from `@/components/enterprise/` (`EnterpriseStatsCard`, `EnterpriseDataTable`, `EnterpriseBadge`) rather than duplicating markup.
- Ensure all list row items are wrapped with `React.memo` to optimize performance.

## 3. Centralized Error Handling
- Never throw plain `Error` objects in services.
- Throw class-based errors from `@/core/errors/AppErrors` (`ValidationError`, `ApiError`, `WorkflowError`, etc.).
- Catch errors in components and translate them using `ErrorMapper.toUserMessage(err)`.

## 4. Performance Tracing
- Measure expensive operations using the `AuditPerformance` utility:
  ```typescript
  const { result } = await AuditPerformance.trace('fetch_students', () => fetchStudentsApi());
  ```
