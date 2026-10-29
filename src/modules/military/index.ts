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
import militaryConfig from '@/config/institutions/military';
import { militaryWorkflow, militaryDashboardCards } from './workflow';

// Widgets وقودية الأدوات الإحصائية (الأجواء)
import { PendingWorkflowsWidget } from '@/core/dashboard/widgets/PendingWorkflowsWidget';
import { AuditEventsTodayWidget } from '@/core/dashboard/widgets/AuditEventsTodayWidget';
import { AutomationsExecutedWidget } from '@/core/dashboard/widgets/AutomationsExecutedWidget';

// قوائم القطاع المشتركة
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

/**
 * قطاع الجيش — المديرية الوطنية للخدمة الوطنية
 *
 * الهيكل: القائد العام (سوبر أدمن) ← قائد المركز ← قائد السرية ← العريف/الرقيب
 * الحصص: صباحية ومسائية
 * أسباب الغياب: الأمانة / الخدمات (البستان) / مريض / مأمورية / بدون تبرير
 */
const militaryModule: ModuleManifest = {
  id: 'military',
  capabilities: {
    canQR: true,
    canSmartRollCall: true,
    canHybrid: true,
    canJustifications: true,
    canParentsNotify: false,
    canDiscipline: false,
    canShiftAttendance: true, // انزلاق صباحي/مسائي
    canWorkshopAttendance: false,
  },
  config: militaryConfig,
  sidebar: [
    { id: 'overview', label: 'الرئيسية', icon: LayoutDashboard, component: Dashboard },
    { id: 'structure', label: 'الهيكل العسكري', icon: Layers, component: InstitutionStructure, permissionKey: 'structure.manage' },
    { id: 'users', label: 'المستخدمون', icon: Users, component: InstitutionUsers, permissionKey: 'users.create' },
    { id: 'students', label: 'العسكريون الدارسون', icon: GraduationCap, component: InstitutionStudents, permissionKey: 'students.read' },
    { id: 'teachers', label: 'القادة والمدربون', icon: Users, component: InstitutionTeachers, permissionKey: 'teachers.assign' },
    { id: 'groups', label: 'الأفواج', icon: Building2, component: InstitutionGroups, permissionKey: 'groups.read' },
    { id: 'attendance', label: 'الحضور والغياب', icon: CalendarCheck, component: InstitutionAttendanceView, permissionKey: 'attendance.read' },
    { id: 'justifications', label: 'تبريرات الغياب', icon: FileCheck2, component: InstitutionJustifications, permissionKey: 'justifications.manage' },
    { id: 'devices', label: 'الأجهزة والأمان', icon: ShieldCheck, component: InstitutionDevicesView, permissionKey: 'devices.read' },
    { id: 'reports', label: 'التقارير', icon: FileText, component: InstitutionReports, permissionKey: 'reports.read' },
    { id: 'subscription', label: 'الاشتراك', icon: CreditCard, component: InstitutionSubscriptionView, permissionKey: 'subscription.manage' },
    { id: 'settings', label: 'الإعدادات', icon: Settings, component: InstitutionSettingsView, permissionKey: 'settings.manage' },
    { id: 'activity', label: 'سجل النشاط', icon: Activity, component: InstitutionActivityView, permissionKey: 'reports.read' },
    { id: 'support', label: 'الدعم والمساعدة', icon: HelpCircle, component: InstitutionSupportView, permissionKey: 'support.create_ticket' },
  ],
  widgets: [
    { id: 'pending-workflows', component: PendingWorkflowsWidget },
    { id: 'audit-today', component: AuditEventsTodayWidget },
    { id: 'automations-executed', component: AutomationsExecutedWidget },
  ],
  workflow: militaryWorkflow,
  dashboardCards: militaryDashboardCards,
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
  automationRules: [
    {
      id: 'military_absent_alert',
      name_ar: 'تنبيه غياب متكرر لعسكري دراسي',
      name_fr: 'Alerte absence fréquente',
      trigger: 'absence_limit_exceeded',
      actions: [{ type: 'flag_student' }],
    },
    {
      id: 'military_morning_report',
      name_ar: 'نقرير الحضور الصباحي اليومي',
      name_fr: 'Rapport quotidien du matin',
      trigger: 'session_ended',
      actions: [{ type: 'notify_admin' }],
    },
  ],
};

export default militaryModule;
