import {
  LayoutDashboard,
  Layers,
  Users,
  GraduationCap,
  Building2,
  CalendarCheck,
  FileCheck2,
  ShieldCheck,
  FileText,
  CreditCard,
  Settings,
  Activity,
  HelpCircle,
} from 'lucide-react';
import type { ModuleManifest } from '@/config/modules';
import systemConfig from '@/config/institutions/system';

// Enterprise core widgets
import { AuditEventsTodayWidget } from '@/core/dashboard/widgets/AuditEventsTodayWidget';

// Component imports
import InstitutionStructure from '@/components/institution-admin/InstitutionStructure';
import InstitutionUsers from '@/components/institution-admin/InstitutionUsers';
import InstitutionTeachers from '@/components/institution-admin/InstitutionTeachers';
import InstitutionStudents from '@/components/institution-admin/InstitutionStudents';
import InstitutionGroups from '@/components/institution-admin/InstitutionGroups';
import InstitutionJustifications from '@/components/institution-admin/InstitutionJustifications';
import InstitutionReports from '@/components/institution-admin/InstitutionReports';
import InstitutionAttendanceView from '@/components/institution-admin/InstitutionAttendanceView';
import InstitutionDevicesView from '@/components/institution-admin/InstitutionDevicesView';
import InstitutionSubscriptionView from '@/components/institution-admin/InstitutionSubscriptionView';
import InstitutionSettingsView from '@/components/institution-admin/InstitutionSettingsView';
import InstitutionActivityView from '@/components/institution-admin/InstitutionActivityView';
import InstitutionSupportView from '@/components/institution-admin/InstitutionSupportView';
import Dashboard from '@/core/dashboard/Dashboard';

const systemModule: ModuleManifest = {
  id: 'system',
  capabilities: {
    canQR: true,
    canSmartRollCall: true,
    canHybrid: true,
    canJustifications: true,
    canParentsNotify: false,
    canDiscipline: false,
    canShiftAttendance: false,
    canWorkshopAttendance: false,
  },
  config: systemConfig,
  sidebar: [
    { id: 'overview', label: 'الرئيسية', icon: LayoutDashboard, component: Dashboard },
    { id: 'structure', label: 'الهيكل', icon: Layers, component: InstitutionStructure, permissionKey: 'structure.manage' },
    { id: 'users', label: 'المستخدمون', icon: Users, component: InstitutionUsers, permissionKey: 'users.create' },
    { id: 'students', label: 'الطلاب', icon: GraduationCap, component: InstitutionStudents, permissionKey: 'students.read' },
    { id: 'teachers', label: 'الأساتذة', icon: Users, component: InstitutionTeachers, permissionKey: 'teachers.assign' },
    { id: 'groups', label: 'الأفواج', icon: Building2, component: InstitutionGroups, permissionKey: 'groups.read' },
    { id: 'attendance', label: 'الحضور والغيابات', icon: CalendarCheck, component: InstitutionAttendanceView, permissionKey: 'attendance.read' },
    { id: 'justifications', label: 'التبريرات', icon: FileCheck2, component: InstitutionJustifications, permissionKey: 'justifications.manage' },
    { id: 'devices', label: 'الأجهزة والأمان', icon: ShieldCheck, component: InstitutionDevicesView, permissionKey: 'devices.read' },
    { id: 'reports', label: 'التقارير', icon: FileText, component: InstitutionReports, permissionKey: 'reports.read' },
    { id: 'subscription', label: 'الاشتراك', icon: CreditCard, component: InstitutionSubscriptionView, permissionKey: 'subscription.manage' },
    { id: 'settings', label: 'الإعدادات', icon: Settings, component: InstitutionSettingsView, permissionKey: 'settings.manage' },
    { id: 'activity', label: 'سجل النشاط', icon: Activity, component: InstitutionActivityView, permissionKey: 'reports.read' },
    { id: 'support', label: 'الدعم والمساعدة', icon: HelpCircle, component: InstitutionSupportView, permissionKey: 'support.create_ticket' },
  ],
  widgets: [
    { id: 'audit-today', component: AuditEventsTodayWidget },
  ],
  permissions: [
    'attendance.create',
    'attendance.edit',
    'attendance.delete',
    'attendance.review',
    'attendance.export',
    'students.view',
    'students.create',
    'students.edit',
    'students.delete',
    'reports.view',
    'reports.export',
    'devices.manage',
    'analytics.view',
    'workflow.review',
    'workflow.manage',
    'settings.manage',
    'dashboard.view',
  ],
  automationRules: [],
};

export default systemModule;
