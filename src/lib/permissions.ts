export const PERMISSIONS = {
  teacherDashboardView: 'teacher.dashboard.view',
  sessionsViewOwn: 'sessions.view_own',
  sessionsCreateOwn: 'sessions.create_own',
  attendanceViewOwn: 'attendance.view_own',
  attendanceManageOwn: 'attendance.manage_own',
  cohortsViewAssigned: 'cohorts.view_assigned',
  studentsViewAssigned: 'students.view_assigned',
  usersCreate: 'users.create',
  usersManageScope: 'users.manage_scope',
  usersDelete: 'users.delete',
  usersResetPassword: 'users.reset_password',
  structureManage: 'structure.manage',
  studentsRead: 'students.read',
  studentsManage: 'students.manage',
  groupsRead: 'groups.read',
  groupsManage: 'groups.manage',
  teachersAssign: 'teachers.assign',
  sessionsCreate: 'sessions.create',
  sessionsManage: 'sessions.manage',
  attendanceRead: 'attendance.read',
  attendanceManage: 'attendance.manage',
  devicesRead: 'devices.read',
  devicesManage: 'devices.manage',
  reportsRead: 'reports.read',
  reportsExport: 'reports.export',
  justificationsManage: 'justifications.manage',
  settingsManage: 'settings.manage',
  subscriptionManage: 'subscription.manage',
  supportCreateTicket: 'support.create_ticket',
  supportManage: 'support.manage',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export type PermissionMap = Partial<Record<PermissionKey, boolean>>;

export function can(permissions: PermissionMap | null | undefined, key: PermissionKey): boolean {
  return permissions?.[key] === true;
}
