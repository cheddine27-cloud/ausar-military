/**
 * Ausar Military — Enterprise Permission Engine Types
 */

export type PermissionKey =
  | 'attendance.create'
  | 'attendance.edit'
  | 'attendance.delete'
  | 'attendance.review'
  | 'attendance.export'
  | 'students.view'
  | 'students.create'
  | 'students.edit'
  | 'students.delete'
  | 'guardian.notify'
  | 'guardian.view'
  | 'guardian.edit'
  | 'reports.view'
  | 'reports.export'
  | 'devices.manage'
  | 'analytics.view'
  | 'workflow.review'
  | 'workflow.manage'
  | 'settings.manage'
  | 'dashboard.view';

export type PermissionMap = Partial<Record<PermissionKey, boolean>>;

export interface PermissionContextType {
  hasPermission: (key: PermissionKey | string) => boolean;
  permissions: PermissionMap;
  loading: boolean;
}
