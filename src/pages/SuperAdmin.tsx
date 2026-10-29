import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  GraduationCap,
  ImageIcon,
  Landmark,
  Layers,
  LayoutDashboard,
  Mail,
  LockKeyhole,
  LogOut,
  MapPin,
  MoreVertical,
  PauseCircle,
  Phone,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
  type LucideIcon,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createAdminAuthUser } from '@/lib/adminAuth';
import { getAllInstitutions, getAuthenticatedAdmin, logoutAdmin } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import type { Admin } from '@/lib/types';
import { generateInstitutionCode, WILAYAS } from '@/lib/wilayas';
import {
  exportSectorReportPDF,
  exportSectorReportExcel,
  exportAttendanceReportPDF,
  exportAttendanceReportExcel,
  exportDevicesReportPDF,
  exportDevicesReportExcel,
  exportInstitutionReportPDF,
  exportInstitutionReportExcel,
  exportPeopleReportPDF,
  exportDevicesFileReportPDF,
  nowGeneratedAt,
} from '@/lib/superadminExport';
import { toast } from 'sonner';

type InstitutionType = 'military' | 'system';
type ClientInstitutionType = Exclude<InstitutionType, 'system'>;
type SectorId = 'all' | ClientInstitutionType;
type WorkspaceTab = 'overview' | 'structure' | 'people' | 'attendance' | 'security' | 'billing' | 'reports';
type SectorWorkspaceTab = 'overview' | 'institutions' | 'security' | 'reports';
type OwnerToolId = 'users' | 'billing' | 'analytics' | 'notifications' | 'settings' | 'activity' | 'support' | 'language' | 'trial-requests';

interface NewInstitution {
  name: string;
  type: ClientInstitutionType;
  maxStudents: number;
  wilayaCode: number;
  city: string;
  adminUsername: string;
  adminPassword: string;
  adminFullName: string;
  adminEmail: string;
  imageFile: File | null;
  imagePreview: string;
}

interface Institution {
  id: string;
  name: string;
  type: string;
  max_students?: number | null;
  status?: string | null;
  wilaya?: string | null;
  city?: string | null;
  code?: string | null;
  image_url?: string | null;
  created_at?: string | null;
}

interface InstitutionAdmin {
  id: string;
  username: string;
  full_name?: string | null;
  role?: string | null;
  email?: string | null;
  created_at?: string | null;
}

type OwnerUserKind = 'all' | 'student' | 'admin' | 'owner';

interface OwnerUserRecord {
  id: string;
  kind: Exclude<OwnerUserKind, 'all'>;
  displayName: string;
  identifier: string;
  email: string | null;
  phone: string | null;
  role: string;
  roleLabel: string;
  status: string;
  institutionId: string | null;
  institutionName: string;
  institutionType: InstitutionType;
  sectorLabel: string;
  createdAt: string | null;
  lastActivity: string | null;
  deviceCount: number;
  activeDeviceCount: number;
}

interface OwnerAdminRow {
  id: string;
  username: string;
  role: string | null;
  fullName?: string | null;
  full_name?: string | null;
  email: string | null;
  institution_id: string | null;
  created_at: string | null;
}

interface OwnerStudentRow {
  id: string;
  studentNumber?: string | null;
  student_number?: string | null;
  firstName?: string | null;
  first_name?: string | null;
  lastName?: string | null;
  last_name?: string | null;
  status?: string | null;
  status_snake?: string | null;
  phone?: string | null;
  institution_id: string | null;
  created_at: string | null;
}

interface OwnerDeviceRow {
  id: string;
  student_id: string;
  institution_id: string | null;
  is_active: boolean | null;
  last_used: string | null;
}

type BillingCycle = 'monthly' | 'semiannual' | 'annual';
type SubscriptionStatus = 'trial' | 'active' | 'expiring_soon' | 'expired' | 'suspended' | 'cancelled';
type PaymentStatus = 'paid' | 'pending' | 'unpaid' | 'overdue' | 'cancelled';
type AnalyticsRangePreset = 'today' | '7d' | '30d' | 'month' | 'year';
type AnalyticsReportType = 'attendance' | 'absences' | 'security' | 'subscriptions' | 'users' | 'institution';
type AnalyticsExportFormat = 'pdf' | 'excel';
type NotificationCategory = 'all' | 'unread' | 'security' | 'attendance' | 'subscription' | 'report' | 'system';
type NotificationPriority = 'high' | 'medium' | 'low' | 'info';
type NotificationStatus = 'unread' | 'read' | 'archived';
type ActivityLogCategory = 'all' | 'attendance' | 'security' | 'subscription' | 'report' | 'user' | 'institution' | 'system';
type ActivityLogOutcome = 'success' | 'warning' | 'rejected' | 'pending';
type ActivityLogReviewStatus = 'open' | 'reviewed' | 'archived';
type ActivityLogSortMode = 'newest' | 'oldest' | 'priority' | 'status';
type SupportTicketCategory = 'technical' | 'activation' | 'attendance' | 'device' | 'billing' | 'training' | 'general';
type SupportTicketPriority = 'high' | 'medium' | 'low';
type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_institution' | 'resolved' | 'closed';
type SupportReplyType = 'internal' | 'institution';
type SupportSortMode = 'newest' | 'priority' | 'open_first' | 'updated';

interface BillingSubscription {
  id: string;
  institutionId: string;
  institutionName: string;
  institutionType: InstitutionType;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startDate: string | null;
  endDate: string | null;
  maxUsers: number;
  maxTeachers: number | null;
  price: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  lastInvoiceNumber: string | null;
  notes: string | null;
  createdAt: string | null;
  daysRemaining: number | null;
}

interface BillingFormState {
  id?: string;
  institutionId: string;
  planName: string;
  billingCycle: BillingCycle;
  price: string;
  currency: string;
  startDate: string;
  endDate: string;
  maxUsers: string;
  maxTeachers: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  notes: string;
}

interface RenewalFormState {
  newEndDate: string;
  renewalPrice: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  notes: string;
}

interface SubscriptionDbRow {
  id: string;
  institution_id: string;
  plan_type?: string | null;
  plan_name?: string | null;
  status?: string | null;
  billing_cycle?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  current_period_end?: string | null;
  student_limit?: number | null;
  session_limit?: number | null;
  max_users?: number | null;
  max_teachers?: number | null;
  price?: number | null;
  currency?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  last_invoice_number?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

interface SupabaseListResult<T> {
  data: T[] | null;
  error: unknown | null;
}

interface AnalyticsInstitutionRow {
  institution: Institution;
  institutionName: string;
  institutionType: InstitutionType;
  wilaya: string;
  userCount: number;
  sessionCount: number;
  attendanceCount: number;
  attendanceRate: number | null;
  absenceCount: number | null;
  deviceCount: number;
  subscriptionStatus: SubscriptionStatus | null;
  lastActivity: string | null;
}

interface AnalyticsTrendPoint {
  label: string;
  attendanceRate: number | null;
  attendances: number;
  absences: number | null;
  sessions: number;
}

interface AnalyticsSectorRow {
  id: ClientInstitutionType;
  label: string;
  count: number;
  userCount: number;
  sessionCount: number;
  attendanceCount: number;
  attendanceRate: number | null;
}

interface AnalyticsSnapshot {
  userCount: number;
  studentCount: number;
  adminCount: number;
  sessionCount: number;
  attendanceCount: number;
  attendanceRate: number | null;
  absenceCount: number | null;
  deviceCount: number;
  activeSubscriptions: number | null;
  expectedRevenue: number | null;
  rejectedAttempts: number | null;
  suspiciousAttempts: number | null;
  trend: AnalyticsTrendPoint[];
  sectors: AnalyticsSectorRow[];
  institutions: AnalyticsInstitutionRow[];
}

interface AnalyticsStudentRow {
  id: string;
  institution_id: string | null;
  created_at?: string | null;
}

interface AnalyticsAdminDataRow {
  id: string;
  institution_id: string | null;
  created_at?: string | null;
}

interface AnalyticsSessionDataRow {
  id: string;
  institution_id: string | null;
  created_at?: string | null;
  status?: string | null;
}

interface AnalyticsAttendanceDataRow {
  id: string;
  institution_id: string | null;
  session_id?: string | null;
  created_at?: string | null;
  status?: string | null;
}

interface AnalyticsDeviceDataRow {
  id: string;
  institution_id: string | null;
  is_active?: boolean | null;
  last_used?: string | null;
}

interface CustomReportForm {
  reportType: AnalyticsReportType;
  sector: SectorId;
  institutionId: string;
  rangePreset: AnalyticsRangePreset;
  format: AnalyticsExportFormat;
  includeCharts: boolean;
  includeTables: boolean;
}

interface OwnerNotification {
  id: string;
  source: 'stored' | 'derived';
  type: string;
  category: Exclude<NotificationCategory, 'all' | 'unread'>;
  priority: NotificationPriority;
  title: string;
  message: string;
  status: NotificationStatus;
  institutionId: string | null;
  institutionName: string | null;
  institutionType: InstitutionType | null;
  actorAdminId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
  suggestedAction: string;
  linkedRecordLabel: string | null;
  linkedRecordType: 'institution' | 'subscription' | 'report' | 'session' | 'admin' | null;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
}

interface NotificationDbRow {
  id: string;
  institution_id: string | null;
  actor_admin_id: string | null;
  type: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  status: string;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface NotificationLocalPatch {
  status?: NotificationStatus;
  hidden?: boolean;
  readAt?: string | null;
  archivedAt?: string | null;
}

interface NotificationSnapshot {
  notifications: OwnerNotification[];
  storedSchemaReady: boolean;
}

interface OwnerActivityItem {
  id: string;
  source: 'stored' | 'derived';
  sourceKey: string;
  category: Exclude<ActivityLogCategory, 'all'>;
  type: string;
  title: string;
  description: string;
  institutionId: string | null;
  institutionName: string | null;
  institutionType: InstitutionType | null;
  actorName: string | null;
  actorAdminId: string | null;
  outcome: ActivityLogOutcome;
  reviewStatus: ActivityLogReviewStatus;
  priority: NotificationPriority;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface ActivityLogDbRow {
  id: string;
  source_key: string | null;
  institution_id: string | null;
  actor_admin_id: string | null;
  category: string;
  type: string;
  title: string;
  description: string;
  outcome_status: string;
  review_status: string;
  priority: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ActivitySnapshot {
  activities: OwnerActivityItem[];
  schemaReady: boolean;
}

interface SupportTicket {
  id: string;
  ticketNumber: string;
  institutionId: string | null;
  institutionName: string | null;
  institutionType: InstitutionType | null;
  createdByAdminId: string | null;
  assignedToAdminId: string | null;
  assignedToName: string | null;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  title: string;
  description: string;
  internalNotes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  replies: SupportTicketReply[];
}

interface SupportTicketReply {
  id: string;
  ticketId: string;
  authorAdminId: string | null;
  authorName: string | null;
  replyType: SupportReplyType;
  message: string;
  createdAt: string;
}

interface SupportAdminOption {
  id: string;
  label: string;
  role: string;
}

interface SupportSettingsState {
  id: string | null;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  helpCenterUrl: string;
  demoRequestUrl: string;
}

interface SupportTicketFormState {
  institutionId: string;
  category: SupportTicketCategory;
  title: string;
  description: string;
  priority: SupportTicketPriority;
  assignedToAdminId: string;
  internalNotes: string;
}

interface SupportReplyFormState {
  ticketId: string;
  message: string;
  replyType: SupportReplyType;
  nextStatus: 'no_change' | SupportTicketStatus;
}

interface SupportTicketDbRow {
  id: string;
  ticket_number: string;
  institution_id: string | null;
  created_by_admin_id: string | null;
  assigned_to_admin_id: string | null;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  internal_notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

interface SupportTicketReplyDbRow {
  id: string;
  ticket_id: string;
  author_admin_id: string | null;
  reply_type: string;
  message: string;
  created_at: string;
}

interface SupportSettingsDbRow {
  id: string;
  support_email: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  help_center_url: string | null;
  demo_request_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface NotificationSettings {
  security: boolean;
  attendance: boolean;
  subscription: boolean;
  report: boolean;
  system: boolean;
  emailOwner: boolean;
  inApp: boolean;
}

interface OwnerSettingsState {
  platformName: string;
  ownerEmail: string;
  language: string;
  timezone: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  twoFactorRequired: boolean;
  sessionTimeout: string;
  strongPasswords: boolean;
  deviceReview: boolean;
  suspiciousLoginAlerts: boolean;
  autoBackup: boolean;
  backupFrequency: string;
  backupRetention: string;
  subscriptionAlerts: boolean;
  invoiceReminders: boolean;
  monthlyReports: boolean;
  maintenanceMode: boolean;
}

interface PlatformSettingsRow {
  key: string;
  value: Partial<OwnerSettingsState> | null;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SettingsAuditLog {
  id: string;
  setting_key: string;
  action: string;
  old_value: Partial<OwnerSettingsState> | null;
  new_value: Partial<OwnerSettingsState> | null;
  changed_by: string | null;
  created_at: string;
}

interface IntegrationCheckResult {
  label: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

interface CohortDetail {
  id: string;
  name: string;
  level: string;
  departmentName: string;
  studentCount: number;
  lastSessionDate: string | null;
  attendanceRate: number;
}

interface ActivityRecord {
  time: string;
  text: string;
  color: string;
}

interface InstitutionStats {
  students: number;
  cohorts: number;
  sessions: number;
  attendance: number;
  admins: number;
  faculties: number;
  departments: number;
  specialties: number;
  devices: number;
  planType: string | null;
  subscriptionStatus: string | null;
  studentLimit: number | null;
  sessionLimit: number | null;
  currentPeriodEnd: string | null;
  recentCohorts: CohortDetail[];
  weeklyAttendance: number[];
  recentActivities: ActivityRecord[];
}

interface SectorStats {
  institutions: number;
  active: number;
  suspended: number;
  capacity: number;
  wilayas: number;
  students: number;
  cohorts: number;
  sessions: number;
  attendances: number;
  admins: number;
  devices: number;
  recentActivities: ActivityRecord[];
  weeklyAttendance: number[];
}

interface PlatformLiveStats {
  // الهيكل الأكاديمي عبر كل المؤسسات
  faculties: number;
  departments: number;
  specialties: number;
  cohorts: number;
  // الناس
  students: number;
  teachers: number;
  superAdmins: number;
  // التشغيل
  sessions: number;
  activeSessions: number;
  attendances: number;
  attendanceRate: number; // 0..100
  // الأمن
  devices: number;
  activeDevices: number;
  // اللحظة
  attendancesToday: number;
  attendancesThisWeek: number;
  sessionsToday: number;
  // البيئة
  institutions: number;
  activeInstitutions: number;
  wilayas: number;
}

const emptyPlatformLiveStats: PlatformLiveStats = {
  faculties: 0,
  departments: 0,
  specialties: 0,
  cohorts: 0,
  students: 0,
  teachers: 0,
  superAdmins: 0,
  sessions: 0,
  activeSessions: 0,
  attendances: 0,
  attendanceRate: 0,
  devices: 0,
  activeDevices: 0,
  attendancesToday: 0,
  attendancesThisWeek: 0,
  sessionsToday: 0,
  institutions: 0,
  activeInstitutions: 0,
  wilayas: 0,
};

interface SectorConfig {
  id: SectorId;
  label: string;
  english: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  button: string;
  soft: string;
}

interface WorkspaceTabConfig {
  id: WorkspaceTab;
  label: string;
  icon: LucideIcon;
}

interface OwnerToolConfig {
  id: OwnerToolId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
}

const emptyStats: InstitutionStats = {
  students: 0,
  cohorts: 0,
  sessions: 0,
  attendance: 0,
  admins: 0,
  faculties: 0,
  departments: 0,
  specialties: 0,
  devices: 0,
  planType: null,
  subscriptionStatus: null,
  studentLimit: null,
  sessionLimit: null,
  currentPeriodEnd: null,
  recentCohorts: [],
  weeklyAttendance: [],
  recentActivities: [],
};

const emptySectorStats: SectorStats = {
  institutions: 0,
  active: 0,
  suspended: 0,
  capacity: 0,
  wilayas: 0,
  students: 0,
  cohorts: 0,
  sessions: 0,
  attendances: 0,
  admins: 0,
  devices: 0,
  recentActivities: [],
  weeklyAttendance: [],
};

const INSTITUTION_IMAGE_BUCKET = 'institution-images';
const MAX_INSTITUTION_IMAGE_SIZE = 5 * 1024 * 1024;

const sectorConfigs: SectorConfig[] = [
  {
    id: 'all',
    label: 'الرئيسية',
    english: 'Overview',
    shortLabel: 'الرئيسية',
    description: 'كل المؤسسات داخل منصة Ausar Military',
    icon: LayoutDashboard,
    accent: 'text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700',
    soft: 'bg-blue-50 border-blue-100',
  },
  {
    id: 'military',
    label: 'الجامعات',
    english: 'Universities',
    shortLabel: 'جامعات',
    description: 'جامعات، كليات، أقسام وتخصصات',
    icon: GraduationCap,
    accent: 'text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700',
    soft: 'bg-blue-50 border-blue-100',
  },
  {
    id: 'school',
    label: 'المؤسسات التربوية',
    english: 'Educational Institutions',
    shortLabel: 'تربية',
    description: 'مدارس، ثانويات ومؤسسات تعليمية',
    icon: Building2,
    accent: 'text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    soft: 'bg-emerald-50 border-emerald-100',
  },
  {
    id: 'training',
    label: 'مراكز التكوين',
    english: 'Training Centers',
    shortLabel: 'تكوين',
    description: 'مراكز ومعاهد التدريب المهني',
    icon: Briefcase,
    accent: 'text-violet-700',
    button: 'bg-violet-600 hover:bg-violet-700',
    soft: 'bg-violet-50 border-violet-100',
  },
  {
    id: 'company',
    label: 'الشركات',
    english: 'Companies',
    shortLabel: 'شركات',
    description: 'حضور الموظفين والتكوين الداخلي',
    icon: Landmark,
    accent: 'text-orange-700',
    button: 'bg-orange-500 hover:bg-orange-600',
    soft: 'bg-orange-50 border-orange-100',
  },
];

const workspaceTabs: WorkspaceTabConfig[] = [
  { id: 'overview', label: 'نظرة عامة', icon: BarChart3 },
  { id: 'structure', label: 'الهيكل الأكاديمي', icon: Layers },
  { id: 'people', label: 'الأساتذة والإدارة', icon: Users },
  { id: 'attendance', label: 'الحضور', icon: Activity },
  { id: 'security', label: 'الأجهزة والأمان', icon: ShieldCheck },
  { id: 'billing', label: 'الباقة والاشتراك', icon: CreditCard },
  { id: 'reports', label: 'التقارير', icon: FileText },
];

const ownerToolConfigs: OwnerToolConfig[] = [
  { id: 'users', label: 'المستخدمون', subtitle: 'إدارة حسابات ومؤسسات المنصة', icon: Users },
  { id: 'billing', label: 'الاشتراكات والفوترة', subtitle: 'متابعة الباقات والاشتراكات النشطة', icon: CreditCard },
  { id: 'analytics', label: 'التقارير والتحليلات', subtitle: 'قراءة أداء المنصة والقطاعات', icon: BarChart3 },
  { id: 'notifications', label: 'الإشعارات', subtitle: 'تنبيهات تشغيلية من لوحة المالك', icon: Bell },
  { id: 'settings', label: 'الإعدادات', subtitle: 'إعدادات المنصة العامة', icon: Settings },
  { id: 'activity', label: 'سجل النشاط', subtitle: 'آخر المؤسسات والحركات المسجلة', icon: Activity },
  { id: 'support', label: 'الدعم والمساعدة', subtitle: 'قنوات المتابعة والمساعدة', icon: ShieldCheck },
  { id: 'trial-requests', label: 'طلبات التجربة', subtitle: 'طلبات التجربة المجانية الواردة من الموقع', icon: Inbox },
  { id: 'language', label: 'اللغة والمنطقة', subtitle: 'إعدادات اللغة والعرض', icon: Globe2 },
];

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

const normalizeInstitutionType = (type: string | null | undefined): InstitutionType => {
  if (type === 'school' || type === 'primary_school' || type === 'secondary_school' || type === 'training' || type === 'company' || type === 'system') return type;
  return 'military';
};

const formatNumber = (value: number | null | undefined) => (value || 0).toLocaleString('ar-DZ');

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'غير محدد';
  return new Date(value).toLocaleDateString('ar-DZ');
};

const formatCurrency = (value: number | null | undefined, currency = 'DZD') => (
  `${formatNumber(Math.round(value || 0))} ${currency === 'DZD' ? 'د.ج' : currency}`
);

const toInputDate = (value: string | null | undefined) => {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
};

const getDaysRemaining = (endDate: string | null | undefined) => {
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
};

const normalizeSubscriptionStatus = (status: string | null | undefined, endDate: string | null | undefined): SubscriptionStatus => {
  if (status === 'suspended' || status === 'cancelled' || status === 'trial') return status;
  const days = getDaysRemaining(endDate);
  if (days !== null && days < 0) return 'expired';
  if (days !== null && days <= 15) return 'expiring_soon';
  return 'active';
};

const normalizePaymentStatus = (status: string | null | undefined): PaymentStatus => {
  if (status === 'paid' || status === 'pending' || status === 'unpaid' || status === 'overdue' || status === 'cancelled') return status;
  return 'pending';
};

const normalizeBillingCycle = (cycle: string | null | undefined): BillingCycle => {
  if (cycle === 'semiannual' || cycle === 'annual') return cycle;
  return 'monthly';
};

const getAttendanceRate = (stats: InstitutionStats) => {
  const possibleAttendances = stats.students * stats.sessions;
  if (possibleAttendances <= 0) return 0;
  return Math.min(100, Math.round((stats.attendance / possibleAttendances) * 100));
};

const getSectorAttendanceRate = (stats: SectorStats) => {
  const possibleAttendances = stats.students * stats.sessions;
  if (possibleAttendances <= 0) return 0;
  return Math.min(100, Math.round((stats.attendances / possibleAttendances) * 100));
};

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('overview');
  const [activeSector, setActiveSector] = useState<SectorId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [institutionAdmins, setInstitutionAdmins] = useState<InstitutionAdmin[]>([]);
  const [institutionStats, setInstitutionStats] = useState<InstitutionStats>(emptyStats);
  const [homePreviewStats, setHomePreviewStats] = useState<InstitutionStats>(emptyStats);
  const [homePreviewAdmins, setHomePreviewAdmins] = useState<InstitutionAdmin[]>([]);
  const [sectorStats, setSectorStats] = useState<SectorStats>(emptySectorStats);
  const [sectorStatsLoading, setSectorStatsLoading] = useState(false);
  const [uploadingInstitutionImage, setUploadingInstitutionImage] = useState(false);
  const [platformLiveStats, setPlatformLiveStats] = useState<PlatformLiveStats>(emptyPlatformLiveStats);
  const [platformLiveLoading, setPlatformLiveLoading] = useState(false);
  const [ownerPage, setOwnerPage] = useState<OwnerToolId | null>(null);
  const [ownerTool, setOwnerTool] = useState<OwnerToolConfig | null>(null);
  const [ownerUnreadNotifications, setOwnerUnreadNotifications] = useState(0);
  const [ownerTrialPending, setOwnerTrialPending] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<NewInstitution>({
    name: '',
    type: 'military',
    maxStudents: 500,
    wilayaCode: 0,
    city: '',
    adminUsername: '',
    adminPassword: '',
    adminFullName: '',
    adminEmail: '',
    imageFile: null,
    imagePreview: '',
  });

  // عداد «بانتظار التواصل» للشارات الجانبي — يحدث عالميًا عبر Realtime حتى لو كانت صفحة الطلبات غير مفتوحة (v5.0.15)
  const refreshOwnerTrialPending = async () => {
    try {
      const { count, error } = await supabase
        .from('trial_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      const { count: nullCount, error: nullError } = await supabase
        .from('trial_requests')
        .select('*', { count: 'exact', head: true })
        .is('status', null);
      if (nullError) throw nullError;
      setOwnerTrialPending((count || 0) + (nullCount || 0));
    } catch (err) {
      console.error('Failed to refresh owner trial pending count', err);
    }
  };

  useEffect(() => {
    void refreshOwnerTrialPending();
    let pending = false;
    const triggerRefresh = () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        void refreshOwnerTrialPending();
      }, 800);
    };
    const channel = supabase
      .channel('trial-pending-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trial_requests' }, triggerRefresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInstitutions = async () => {
    const data = await getAllInstitutions();
    const normalized: Institution[] = data.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type || 'military',
      max_students: item.max_students ?? 0,
      status: item.status ?? 'active',
      wilaya: item.wilaya ?? null,
      city: item.city ?? null,
      code: item.code ?? null,
      image_url: typeof item.image_url === 'string' ? item.image_url : null,
      created_at: item.created_at ?? null,
    }));

    setInstitutions(normalized);
    setSelectedInstitution((current) => (
      current ? normalized.find((item) => item.id === current.id) || current : current
    ));
  };

  useEffect(() => {
    const verifySuperAdmin = async () => {
      try {
        const currentAdmin = await getAuthenticatedAdmin();
        if (!currentAdmin || currentAdmin.role !== 'super_admin') {
          navigate('/', { replace: true });
          return;
        }

        setAdmin(currentAdmin);
        await fetchInstitutions();
      } finally {
        setLoading(false);
      }
    };

    void verifySuperAdmin();
  }, [navigate]);

  useEffect(() => {
    if (selectedInstitution) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedInstitution?.id]);

  // ==== إحصائيات لحظية للمنصة ==== 
  // تحميل أولي + إعادة تحميل كل 20 ثانية لضمان رؤية أحدث الأرقام.
  useEffect(() => {
    if (!admin || admin.role !== 'super_admin') return;
    void refreshPlatformLiveStats();
    const interval = setInterval(() => {
      void refreshPlatformLiveStats();
    }, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id, institutions.length]);

  // اشتراك Realtime: عند أي إنشاء/تحديث/حذف في الجداول الأساسية،
  // نُعيد جلب الإحصائيات فوراً (debounced) لتظهر بيانات الأستاذ لحظياً.
  useEffect(() => {
    if (!admin || admin.role !== 'super_admin') return;

    let pending = false;
    const triggerRefresh = () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        void refreshPlatformLiveStats();
      }, 1500);
    };

    const channel = supabase
      .channel('platform-live-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_devices' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cohorts' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admins' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faculties' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'specialties' }, triggerRefresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id]);

  const clientInstitutions = useMemo(
    () => institutions.filter((inst) => normalizeInstitutionType(inst.type) !== 'system'),
    [institutions]
  );

  const refreshOwnerNotificationBadge = async () => {
    try {
      const snapshot = await loadOwnerNotificationsSnapshot(clientInstitutions);
      setOwnerUnreadNotifications(snapshot.notifications.filter((item) => item.status === 'unread').length);
    } catch {
      setOwnerUnreadNotifications(0);
    }
  };

  useEffect(() => {
    void refreshOwnerNotificationBadge();
  }, [clientInstitutions]);

  const activeSectorConfig = useMemo(
    () => sectorConfigs.find((sector) => sector.id === activeSector) || sectorConfigs[0],
    [activeSector]
  );

  const sectorInstitutions = useMemo(() => {
    if (activeSector === 'all') return clientInstitutions;
    return clientInstitutions.filter((inst) => normalizeInstitutionType(inst.type) === activeSector);
  }, [activeSector, clientInstitutions]);

  const sectorInstitutionKey = useMemo(
    () => sectorInstitutions.map((inst) => inst.id).sort().join('|'),
    [sectorInstitutions]
  );

  const visibleInstitutions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sectorInstitutions;

    return sectorInstitutions.filter((inst) => (
      [inst.name, inst.code, inst.wilaya, inst.city, getTypeLabel(inst.type)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    ));
  }, [searchQuery, sectorInstitutions]);

  const platformStats = useMemo(() => {
    const activeCount = clientInstitutions.filter((inst) => inst.status === 'active').length;
    const capacity = clientInstitutions.reduce((total, inst) => total + (inst.max_students || 0), 0);
    const wilayaCount = new Set(clientInstitutions.map((inst) => inst.wilaya).filter(Boolean)).size;

    return {
      total: clientInstitutions.length,
      active: activeCount,
      suspended: Math.max(clientInstitutions.length - activeCount, 0),
      capacity,
      wilayas: wilayaCount,
    };
  }, [clientInstitutions]);

  const recentInstitutions = useMemo(
    () => [...clientInstitutions]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 5),
    [clientInstitutions]
  );

  const featuredInstitution = useMemo(
    () => visibleInstitutions.find((inst) => inst.status === 'active') || visibleInstitutions[0] || recentInstitutions[0] || null,
    [visibleInstitutions, recentInstitutions]
  );

  const ownerName = admin?.fullName || admin?.full_name || admin?.username || 'Super Admin';
  const attendanceRate = getAttendanceRate(institutionStats);
  const homePreviewAttendanceRate = getAttendanceRate(homePreviewStats);

  useEffect(() => {
    if (selectedInstitution || !featuredInstitution) {
      if (!featuredInstitution) {
        setHomePreviewStats(emptyStats);
        setHomePreviewAdmins([]);
      }
      return undefined;
    }

    let active = true;
    setHomePreviewStats(emptyStats);
    setHomePreviewAdmins([]);

    void readInstitutionSnapshot(featuredInstitution)
      .then((snapshot) => {
        if (!active) return;
        setHomePreviewStats(snapshot.stats);
        setHomePreviewAdmins(snapshot.admins);
      })
      .catch(() => {
        if (!active) return;
        setHomePreviewStats(emptyStats);
        setHomePreviewAdmins([]);
      });

    return () => {
      active = false;
    };
  }, [featuredInstitution?.id, selectedInstitution?.id]);

  useEffect(() => {
    if (selectedInstitution || activeSector === 'all') {
      setSectorStats(emptySectorStats);
      setSectorStatsLoading(false);
      return undefined;
    }

    let active = true;
    setSectorStats(emptySectorStats);
    setSectorStatsLoading(true);

    void readSectorSnapshot(sectorInstitutions)
      .then((stats) => {
        if (!active) return;
        setSectorStats(stats);
      })
      .catch(() => {
        if (!active) return;
        setSectorStats(emptySectorStats);
      })
      .finally(() => {
        if (!active) return;
        setSectorStatsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeSector, sectorInstitutionKey, selectedInstitution?.id]);

  const handleLogout = () => {
    logoutAdmin();
    navigate('/');
  };

  const openOwnerTool = (toolId: OwnerToolId) => {
    const tool = ownerToolConfigs.find((item) => item.id === toolId);
    if (!tool) return;

    if (toolId === 'users' || toolId === 'billing' || toolId === 'analytics' || toolId === 'notifications' || toolId === 'settings' || toolId === 'activity' || toolId === 'support' || toolId === 'trial-requests') {
      setOwnerTool(null);
      setOwnerPage(toolId);
      setSelectedInstitution(null);
      setActiveSector('all');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setOwnerPage(null);
    setOwnerTool(tool);
  };

  const selectSector = (sector: SectorId) => {
    setOwnerTool(null);
    setOwnerPage(null);
    setActiveSector(sector);
    setSelectedInstitution(null);
    setSearchQuery('');
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i += 1) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((current) => ({ ...current, adminPassword: password }));
  };

  const resetCreateForm = () => {
    setForm({
      name: '',
      type: 'military',
      maxStudents: 500,
      wilayaCode: 0,
      city: '',
      adminUsername: '',
      adminPassword: '',
      adminFullName: '',
      adminEmail: '',
      imageFile: null,
      imagePreview: '',
    });
    setShowPassword(false);
    setCopied(false);
  };

  const validateInstitutionImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('يرجى اختيار ملف صورة فقط');
    }

    if (file.size > MAX_INSTITUTION_IMAGE_SIZE) {
      throw new Error('حجم الصورة يجب ألا يتجاوز 5MB');
    }
  };

  const uploadInstitutionImage = async (institutionId: string, file: File) => {
    validateInstitutionImage(file);

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${institutionId}/cover-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(INSTITUTION_IMAGE_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(INSTITUTION_IMAGE_BUCKET)
      .getPublicUrl(path);

    if (!data.publicUrl) throw new Error('تعذر إنشاء رابط الصورة');
    return data.publicUrl;
  };

  const handleInstitutionImageUpload = async (inst: Institution, file: File) => {
    try {
      setUploadingInstitutionImage(true);
      const imageUrl = await uploadInstitutionImage(inst.id, file);
      const { error } = await supabase
        .from('institutions')
        .update({ image_url: imageUrl })
        .eq('id', inst.id);

      if (error) throw error;

      setSelectedInstitution((current) => (
        current?.id === inst.id ? { ...current, image_url: imageUrl } : current
      ));
      await fetchInstitutions();
      toast.success('تم تحديث صورة المؤسسة');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'تعذر رفع صورة المؤسسة'));
    } finally {
      setUploadingInstitutionImage(false);
    }
  };

  const handleCreateInstitution = async () => {
    if (!form.name.trim()) { toast.error('اسم المؤسسة مطلوب'); return; }
    if (!form.wilayaCode) { toast.error('يرجى اختيار الولاية'); return; }

    // For non-auto-seeded schools, require manual admin credentials
    if (form.type !== 'primary_school' && form.type !== 'secondary_school') {
      if (!form.adminUsername.trim()) { toast.error('اسم المستخدم لمدير المؤسسة مطلوب'); return; }
      if (!form.adminEmail.trim()) { toast.error('البريد الإلكتروني لمدير المؤسسة مطلوب'); return; }
      if (!form.adminPassword.trim()) { toast.error('كلمة مرور مدير المؤسسة مطلوبة'); return; }
      if (form.adminPassword.length < 8) { toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    }

    try {
      setSubmitting(true);
      const selectedWilaya = WILAYAS.find((wilaya) => wilaya.code === form.wilayaCode);
      const instCode = generateInstitutionCode(form.wilayaCode, form.type);

      const { data: newInst, error: instError } = await supabase
        .from('institutions')
        .insert([{
          name: form.name.trim(),
          type: form.type,
          max_students: form.maxStudents,
          status: 'active',
          wilaya: selectedWilaya?.nameAr || selectedWilaya?.name || '',
          city: form.city.trim() || selectedWilaya?.nameAr || selectedWilaya?.name || '',
          code: instCode,
        }])
        .select()
        .single();

      if (instError) throw instError;

      if (form.imageFile) {
        try {
          const imageUrl = await uploadInstitutionImage(newInst.id, form.imageFile);
          const { error: imageError } = await supabase
            .from('institutions')
            .update({ image_url: imageUrl })
            .eq('id', newInst.id);

          if (imageError) throw imageError;
        } catch (imageError) {
          await supabase.from('institutions').delete().eq('id', newInst.id);
          throw imageError;
        }
      }

      // ── Other institution types: manual admin creation ──────────────────
      const authUserId = await createAdminAuthUser({
        email: form.adminEmail.trim(),
        password: form.adminPassword,
        username: form.adminUsername.trim(),
        fullName: form.adminFullName.trim() || form.adminUsername.trim(),
        role: 'teacher',
      });

      const { error: adminError } = await supabase
        .from('admins')
        .insert([{
          auth_user_id: authUserId,
          username: form.adminUsername.trim(),
          role: 'institution_admin',
          full_name: form.adminFullName.trim() || form.adminUsername.trim(),
          email: form.adminEmail.trim(),
          institution_id: newInst.id,
        }]);

      if (adminError) {
        await supabase.from('institutions').delete().eq('id', newInst.id);
        if (adminError.code === '23505') {
          throw new Error('اسم المستخدم موجود مسبقا، اختر اسما آخر');
        }
        throw adminError;
      }

      toast.success(`تم إنشاء "${form.name}" مع حساب مدير المؤسسة`);
      setShowAddModal(false);
      resetCreateForm();
      await fetchInstitutions();
      setActiveSector(form.type);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'حدث خطأ أثناء إنشاء المؤسسة'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (inst: Institution) => {
    const newStatus = inst.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('institutions')
      .update({ status: newStatus })
      .eq('id', inst.id);

    if (error) {
      toast.error('حدث خطأ أثناء تحديث الحالة');
      return;
    }

    toast.success(newStatus === 'active' ? 'تم تفعيل المؤسسة' : 'تم تجميد المؤسسة');
    setSelectedInstitution((current) => (
      current?.id === inst.id ? { ...current, status: newStatus } : current
    ));
    await fetchInstitutions();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);

      const { error: devicesError } = await supabase.from('student_devices').delete().eq('institution_id', deleteTarget.id);
      if (devicesError) throw devicesError;

      const { error: attendanceError } = await supabase.from('attendances').delete().eq('institution_id', deleteTarget.id);
      if (attendanceError) throw attendanceError;

      const { error: sessionsError } = await supabase.from('sessions').delete().eq('institution_id', deleteTarget.id);
      if (sessionsError) throw sessionsError;

      const { error: studentsError } = await supabase.from('students').delete().eq('institution_id', deleteTarget.id);
      if (studentsError) throw studentsError;

      const { error: cohortsError } = await supabase.from('cohorts').delete().eq('institution_id', deleteTarget.id);
      if (cohortsError) throw cohortsError;

      const { error: specialtiesError } = await supabase.from('specialties').delete().eq('institution_id', deleteTarget.id);
      if (specialtiesError) throw specialtiesError;

      const { error: departmentsError } = await supabase.from('departments').delete().eq('institution_id', deleteTarget.id);
      if (departmentsError) throw departmentsError;

      const { error: facultiesError } = await supabase.from('faculties').delete().eq('institution_id', deleteTarget.id);
      if (facultiesError) throw facultiesError;

      const { error: subscriptionsError } = await supabase.from('subscriptions').delete().eq('institution_id', deleteTarget.id);
      if (subscriptionsError) throw subscriptionsError;

      const { error: adminsError } = await supabase.from('admins').delete().eq('institution_id', deleteTarget.id);
      if (adminsError) throw adminsError;

      const { error } = await supabase.from('institutions').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      toast.success(`تم حذف "${deleteTarget.name}" نهائيا`);
      setSelectedInstitution((current) => (current?.id === deleteTarget.id ? null : current));
      setDeleteTarget(null);
      await fetchInstitutions();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'حدث خطأ أثناء الحذف'));
    } finally {
      setDeleting(false);
    }
  };

  /**
   * يجمع إحصائيات لحظية شاملة عن كل المنصة (لوحة المالك).
   * يحسب: الهيكل الأكاديمي، الناس، التشغيل، الأمن، اللحظة، البيئة.
   * يعمل عبر كل المؤسسات (باستثناء system) في القاعدة.
   */
  const loadPlatformLiveStats = async (): Promise<PlatformLiveStats> => {
    const startOfTodayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const startOfWeekIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // نستثني مؤسسة النظام من الحسابات
    const SYSTEM_INSTITUTION_ID = '00000000-0000-0000-0000-000000000000';

    const [
      facultiesRes,
      departmentsRes,
      specialtiesRes,
      cohortsRes,
      studentsRes,
      teachersRes,
      superAdminsRes,
      sessionsRes,
      activeSessionsRes,
      sessionsTodayRes,
      attendancesRes,
      attendancesTodayRes,
      attendancesWeekRes,
      devicesRes,
      activeDevicesRes,
      institutionsRes,
      activeInstRes,
    ] = await Promise.all([
      supabase.from('faculties').select('*', { count: 'exact', head: true }).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('departments').select('*', { count: 'exact', head: true }).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('specialties').select('*', { count: 'exact', head: true }).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('cohorts').select('*', { count: 'exact', head: true }).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('students').select('*', { count: 'exact', head: true }).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('admins').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('admins').select('*', { count: 'exact', head: true }).eq('role', 'super_admin'),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'active').neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('created_at', startOfTodayIso).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).gte('timestamp', startOfTodayIso).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).gte('timestamp', startOfWeekIso).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('student_devices').select('*', { count: 'exact', head: true }).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('student_devices').select('*', { count: 'exact', head: true }).eq('is_active', true).neq('institution_id', SYSTEM_INSTITUTION_ID),
      supabase.from('institutions').select('*', { count: 'exact', head: true }).neq('id', SYSTEM_INSTITUTION_ID),
      supabase.from('institutions').select('*', { count: 'exact', head: true }).eq('status', 'active').neq('id', SYSTEM_INSTITUTION_ID),
    ]);

    const sessions = sessionsRes.count || 0;
    const students = studentsRes.count || 0;
    const attendances = attendancesRes.count || 0;
    // تقدير معدل الحضور: نسبة الحضور الفعلي من الحضور المتوقع (الطلاب × الجلسات).
    // تُستخدم نفس صيغة getAttendanceRate في الكود الحالي.
    const expected = students * sessions;
    const attendanceRate = expected > 0 ? Math.min(100, Math.round((attendances / expected) * 100)) : 0;

    const wilayasSet = new Set<string>();
    institutions.forEach((inst) => {
      if (inst.wilaya && normalizeInstitutionType(inst.type) !== 'system') {
        wilayasSet.add(inst.wilaya);
      }
    });

    return {
      faculties: facultiesRes.count || 0,
      departments: departmentsRes.count || 0,
      specialties: specialtiesRes.count || 0,
      cohorts: cohortsRes.count || 0,
      students,
      teachers: teachersRes.count || 0,
      superAdmins: superAdminsRes.count || 0,
      sessions,
      activeSessions: activeSessionsRes.count || 0,
      attendances,
      attendanceRate,
      devices: devicesRes.count || 0,
      activeDevices: activeDevicesRes.count || 0,
      attendancesToday: attendancesTodayRes.count || 0,
      attendancesThisWeek: attendancesWeekRes.count || 0,
      sessionsToday: sessionsTodayRes.count || 0,
      institutions: institutionsRes.count || 0,
      activeInstitutions: activeInstRes.count || 0,
      wilayas: wilayasSet.size,
    };
  };

  const refreshPlatformLiveStats = async () => {
    try {
      setPlatformLiveLoading(true);
      const stats = await loadPlatformLiveStats();
      setPlatformLiveStats(stats);
    } catch (err) {
      console.error('Failed to load platform live stats', err);
    } finally {
      setPlatformLiveLoading(false);
    }
  };

  const readSectorSnapshot = async (items: Institution[]): Promise<SectorStats> => {
    const ids = items.map((inst) => inst.id).filter(Boolean);
    const activeCount = items.filter((inst) => inst.status === 'active').length;
    const baseStats: SectorStats = {
      ...emptySectorStats,
      institutions: items.length,
      active: activeCount,
      suspended: Math.max(items.length - activeCount, 0),
      capacity: items.reduce((total, inst) => total + (inst.max_students || 0), 0),
      wilayas: new Set(items.map((inst) => inst.wilaya).filter(Boolean)).size,
    };

    if (ids.length === 0) return baseStats;

    const [
      { count: studentsCount },
      { count: cohortsCount },
      { count: sessionsCount },
      { count: attendancesCount },
      { count: adminsCount },
      { count: devicesCount },
    ] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).in('institution_id', ids),
      supabase.from('cohorts').select('*', { count: 'exact', head: true }).in('institution_id', ids),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).in('institution_id', ids),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).in('institution_id', ids),
      supabase.from('admins').select('*', { count: 'exact', head: true }).in('institution_id', ids),
      supabase.from('student_devices').select('*', { count: 'exact', head: true }).in('institution_id', ids),
    ]);

    const stats: SectorStats = {
      ...baseStats,
      students: studentsCount || 0,
      cohorts: cohortsCount || 0,
      sessions: sessionsCount || 0,
      attendances: attendancesCount || 0,
      admins: adminsCount || 0,
      devices: devicesCount || 0,
    };

    try {
      const { data: recentAttendances } = await supabase
        .from('attendances')
        .select('created_at, timestamp')
        .in('institution_id', ids)
        .order('created_at', { ascending: false })
        .limit(500);

      if (recentAttendances && recentAttendances.length > 0) {
        const weekMap = new Map<number, number>();
        const now = Date.now();

        recentAttendances.forEach((attendance) => {
          const dateValue = attendance.created_at || attendance.timestamp;
          const time = new Date(dateValue).getTime();
          if (!Number.isFinite(time)) return;
          const weeksAgo = Math.floor((now - time) / (7 * 24 * 60 * 60 * 1000));
          if (weeksAgo >= 0 && weeksAgo < 12) {
            weekMap.set(weeksAgo, (weekMap.get(weeksAgo) || 0) + 1);
          }
        });

        const maxVal = Math.max(...Array.from(weekMap.values()), 1);
        stats.weeklyAttendance = Array.from({ length: 12 }, (_, index) =>
          Math.round(((weekMap.get(11 - index) || 0) / maxVal) * 100)
        );
      }
    } catch { /* supplementary sector chart data - ignore errors */ }

    try {
      const institutionById = new Map(items.map((inst) => [inst.id, inst.name]));
      const [{ data: recentSessions }, { data: recentDevices }] = await Promise.all([
        supabase
          .from('sessions')
          .select('created_at, status, institution_id')
          .in('institution_id', ids)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('student_devices')
          .select('last_used, institution_id')
          .in('institution_id', ids)
          .order('last_used', { ascending: false })
          .limit(3),
      ]);

      const activities: Array<ActivityRecord & { sortDate: number }> = [];

      (recentSessions || []).forEach((session) => {
        const date = session.created_at || '';
        const institutionName = session.institution_id ? institutionById.get(session.institution_id) : null;
        activities.push({
          sortDate: new Date(date).getTime() || 0,
          time: formatDate(date),
          text: `حصة جديدة في ${institutionName || 'مؤسسة من القطاع'} (${session.status === 'active' ? 'نشطة' : 'مغلقة'})`,
          color: 'bg-blue-500',
        });
      });

      (recentDevices || []).forEach((device) => {
        const date = device.last_used || '';
        const institutionName = device.institution_id ? institutionById.get(device.institution_id) : null;
        activities.push({
          sortDate: new Date(date).getTime() || 0,
          time: formatDate(date),
          text: `جهاز موثق في ${institutionName || 'مؤسسة من القطاع'}`,
          color: 'bg-violet-500',
        });
      });

      if (stats.attendances > 0) {
        activities.push({
          sortDate: Date.now(),
          time: 'اليوم',
          text: `${formatNumber(stats.attendances)} تسجيل حضور داخل القطاع`,
          color: 'bg-emerald-500',
        });
      }

      stats.recentActivities = activities
        .sort((a, b) => b.sortDate - a.sortDate)
        .slice(0, 5)
        .map((activity) => ({
          time: activity.time,
          text: activity.text,
          color: activity.color,
        }));
    } catch { /* supplementary sector activity data - ignore errors */ }

    return stats;
  };

  const readInstitutionSnapshot = async (inst: Institution) => {
    const [
      { count: studentsCount },
      { count: cohortsCount },
      { count: sessionsCount },
      { count: attendanceCount },
      { count: adminsCount },
      { count: facultiesCount },
      { count: departmentsCount },
      { count: specialtiesCount },
      { count: devicesCount },
      { data: subscription },
    ] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
      supabase.from('cohorts').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
      supabase.from('attendances').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
      supabase.from('admins').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
      supabase.from('faculties').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
      supabase.from('departments').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
      supabase.from('specialties').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
      supabase.from('student_devices').select('*', { count: 'exact', head: true }).eq('institution_id', inst.id),
      supabase
        .from('subscriptions')
        .select('plan_type, status, student_limit, session_limit, current_period_end')
        .eq('institution_id', inst.id)
        .maybeSingle(),
    ]);

    const stats: InstitutionStats = {
      students: studentsCount || 0,
      cohorts: cohortsCount || 0,
      sessions: sessionsCount || 0,
      attendance: attendanceCount || 0,
      admins: adminsCount || 0,
      faculties: facultiesCount || 0,
      departments: departmentsCount || 0,
      specialties: specialtiesCount || 0,
      devices: devicesCount || 0,
      planType: subscription?.plan_type || null,
      subscriptionStatus: subscription?.status || null,
      studentLimit: subscription?.student_limit ?? null,
      sessionLimit: subscription?.session_limit ?? null,
      currentPeriodEnd: subscription?.current_period_end || null,
      recentCohorts: [],
      weeklyAttendance: [],
      recentActivities: [],
    };

    // --- Fetch real cohort details ---
    try {
      const { data: cohortsRaw } = await supabase
        .from('cohorts')
        .select('id, name, level, subject, created_at')
        .eq('institution_id', inst.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (cohortsRaw && cohortsRaw.length > 0) {
        stats.recentCohorts = await Promise.all(
          cohortsRaw.map(async (c) => {
            const [{ count: sc }, { data: cohortSessions }] = await Promise.all([
              supabase.from('students').select('*', { count: 'exact', head: true }).eq('cohort_id', c.id),
              supabase.from('sessions').select('id, created_at').eq('cohort_id', c.id).order('created_at', { ascending: false }),
            ]);
            const sessionIds = (cohortSessions || []).map((session) => session.id);
            const total = (sc || 0) * sessionIds.length;
            const { count: cohortAtt } = sessionIds.length > 0
              ? await supabase.from('attendances').select('*', { count: 'exact', head: true }).in('session_id', sessionIds)
              : { count: 0 };
            const rate = total > 0 ? Math.min(100, Math.round(((cohortAtt || 0) / total) * 100)) : 0;
            return {
              id: c.id,
              name: c.name || 'بدون اسم',
              level: c.level || 'L1',
              departmentName: c.subject || '',
              studentCount: sc || 0,
              lastSessionDate: cohortSessions?.[0]?.created_at || null,
              attendanceRate: rate,
            };
          })
        );
      }
    } catch { /* supplementary data - ignore errors */ }

    // --- Fetch weekly attendance for chart ---
    try {
      const { data: recentAtt } = await supabase
        .from('attendances')
        .select('created_at')
        .eq('institution_id', inst.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (recentAtt && recentAtt.length > 0) {
        const weekMap = new Map<number, number>();
        const now = Date.now();
        recentAtt.forEach((a) => {
          const weeksAgo = Math.floor((now - new Date(a.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
          if (weeksAgo < 12) weekMap.set(weeksAgo, (weekMap.get(weeksAgo) || 0) + 1);
        });
        const maxVal = Math.max(...Array.from(weekMap.values()), 1);
        stats.weeklyAttendance = Array.from({ length: 12 }, (_, i) =>
          Math.round(((weekMap.get(11 - i) || 0) / maxVal) * 100)
        );
      }
    } catch { /* ignore */ }

    // --- Build recent activities from real records ---
    try {
      const [{ data: rSessions }, { data: rDevices }] = await Promise.all([
        supabase.from('sessions').select('created_at, status').eq('institution_id', inst.id).order('created_at', { ascending: false }).limit(3),
        supabase.from('student_devices').select('last_used').eq('institution_id', inst.id).order('last_used', { ascending: false }).limit(2),
      ]);
      const acts: Array<ActivityRecord & { sortDate: number }> = [];
      (rSessions || []).forEach((s) => {
        const date = s.created_at || '';
        acts.push({
          sortDate: new Date(date).getTime() || 0,
          time: formatDate(date),
          text: `تم إنشاء حصة جديدة (${s.status === 'active' ? 'نشطة' : 'مغلقة'})`,
          color: 'bg-blue-500',
        });
      });
      (rDevices || []).forEach((d) => {
        const date = d.last_used || '';
        acts.push({
          sortDate: new Date(date).getTime() || 0,
          time: formatDate(date),
          text: 'تسجيل جهاز جديد',
          color: 'bg-violet-500',
        });
      });
      if (stats.attendance > 0) acts.push({ sortDate: Date.now(), time: 'اليوم', text: `${formatNumber(stats.attendance)} تسجيل حضور إجمالي`, color: 'bg-emerald-500' });
      stats.recentActivities = acts
        .sort((a, b) => b.sortDate - a.sortDate)
        .slice(0, 5)
        .map((activity) => ({
          time: activity.time,
          text: activity.text,
          color: activity.color,
        }));
    } catch { /* ignore */ }

    const { data: admins } = await supabase
      .from('admins')
      .select('id, username, full_name, role, email, created_at')
      .eq('institution_id', inst.id)
      .order('created_at', { ascending: true });

    return { stats, admins: admins || [] };
  };

  const loadInstitutionDetails = async (inst: Institution) => {
    setInstitutionStats(emptyStats);
    setInstitutionAdmins([]);

    const snapshot = await readInstitutionSnapshot(inst);
    setInstitutionStats(snapshot.stats);
    setInstitutionAdmins(snapshot.admins);
  };

  const openInstitution = async (inst: Institution) => {
    setSelectedInstitution(inst);
    setActiveSector((normalizeInstitutionType(inst.type) === 'system' ? 'all' : normalizeInstitutionType(inst.type)) as SectorId);
    setWorkspaceTab('overview');
    await loadInstitutionDetails(inst);
  };

  const refreshSectorData = () => {
    void fetchInstitutions();

    if (activeSector === 'all') return;

    setSectorStatsLoading(true);
    void readSectorSnapshot(sectorInstitutions)
      .then(setSectorStats)
      .catch(() => setSectorStats(emptySectorStats))
      .finally(() => setSectorStatsLoading(false));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('تعذر النسخ');
    }
  };

  const getSectorCount = (sector: SectorId) => {
    if (sector === 'all') return clientInstitutions.length;
    return clientInstitutions.filter((inst) => normalizeInstitutionType(inst.type) === sector).length;
  };

  const getSectorCapacity = (sector: SectorId) => {
    const items = sector === 'all'
      ? clientInstitutions
      : clientInstitutions.filter((inst) => normalizeInstitutionType(inst.type) === sector);
    return items.reduce((total, inst) => total + (inst.max_students || 0), 0);
  };

  const getSectorActive = (sector: SectorId) => {
    const items = sector === 'all'
      ? clientInstitutions
      : clientInstitutions.filter((inst) => normalizeInstitutionType(inst.type) === sector);
    return items.filter((inst) => inst.status === 'active').length;
  };

  const getTypeLabel = (type: string) => {
    switch (normalizeInstitutionType(type)) {
      case 'military': return 'جامعة';
      case 'school': return 'مؤسسة تربوية (متوسطة)';
      case 'primary_school': return 'مدرسة ابتدائية';
      case 'secondary_school': return 'ثانوية';
      case 'training': return 'مركز تكوين';
      case 'company': return 'شركة';
      case 'system': return 'النظام';
      default: return type;
    }
  };

  const getTypeIcon = (type: string, className = 'h-5 w-5') => {
    switch (normalizeInstitutionType(type)) {
      case 'military': return <GraduationCap className={`${className} text-blue-600`} />;
      case 'school': return <Building2 className={`${className} text-emerald-600`} />;
      case 'primary_school': return <Building2 className={`${className} text-teal-600`} />;
      case 'secondary_school': return <Building2 className={`${className} text-emerald-700`} />;
      case 'training': return <Briefcase className={`${className} text-violet-600`} />;
      case 'company': return <Landmark className={`${className} text-orange-600`} />;
      case 'system': return <Crown className={`${className} text-rose-600`} />;
      default: return <Building2 className={`${className} text-slate-500`} />;
    }
  };

  const statusBadge = (status: string | null | undefined) => (
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-rose-50 text-rose-700 border-rose-200'
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100" dir="rtl">
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-slate-700 shadow-sm">
          جاري تحميل لوحة مالك المنصة...
        </div>
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950" dir="rtl">
      <div className={`grid min-h-screen ${selectedInstitution ? '' : 'lg:grid-cols-[260px_minmax(0,1fr)]'}`} dir="ltr">
        {!selectedInstitution && (
          <OwnerSidebar
            activeSector={activeSector}
            activeOwnerPage={ownerPage}
            ownerName={ownerName}
            selectSector={selectSector}
            onOpenTool={openOwnerTool}
            onLogout={handleLogout}
            onCreate={() => setShowAddModal(true)}
            unreadNotifications={ownerUnreadNotifications}
            counts={sectorConfigs.reduce<Record<SectorId, number>>((acc, sector) => {
              acc[sector.id] = getSectorCount(sector.id);
              return acc;
            }, { all: 0, university: 0, school: 0, training: 0, company: 0 })}
            trialPending={ownerTrialPending}
          />
        )}

        <div className="min-w-0" dir="rtl">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-[72px] items-center justify-between gap-4 px-5 lg:px-7">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative w-full max-w-xl">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-11 rounded-lg border-slate-200 bg-slate-50 pr-10 text-sm"
                    placeholder="بحث عن مؤسسة، مستخدم، تقرير..."
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-400">
                    Ctrl K
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="relative rounded-lg" onClick={() => openOwnerTool('notifications')}>
                  <Bell className="h-5 w-5 text-slate-600" />
                  {ownerUnreadNotifications > 0 && (
                    <span className="absolute -left-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                      {ownerUnreadNotifications > 99 ? '99+' : ownerUnreadNotifications}
                    </span>
                  )}
                </Button>
                <ThemeToggle className="h-9 w-9" />
                <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => openOwnerTool('language')}>
                  <Globe2 className="h-5 w-5 text-slate-600" />
                  <ChevronDown className="mr-1 h-3.5 w-3.5 text-slate-400" />
                </Button>
                <div className="hidden items-center gap-3 border-r border-slate-200 pr-4 md:flex">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-950">{ownerName}</p>
                    <p className="text-xs text-slate-500">مالك المنصة</p>
                  </div>
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                      <Crown className="h-5 w-5" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className={`space-y-5 py-5 ${selectedInstitution ? 'px-4 lg:px-5' : 'px-5 lg:px-7'}`}>
            {selectedInstitution ? (
              <InstitutionProfilePage
                institution={selectedInstitution}
                stats={institutionStats}
                admins={institutionAdmins}
                workspaceTab={workspaceTab}
                tabs={workspaceTabs}
                attendanceRate={attendanceRate}
                setWorkspaceTab={setWorkspaceTab}
                formatNumber={formatNumber}
                formatDate={formatDate}
                getTypeLabel={getTypeLabel}
                getTypeIcon={getTypeIcon}
                statusBadge={statusBadge}
                onBack={() => setSelectedInstitution(null)}
                onToggle={() => void handleToggleStatus(selectedInstitution)}
                onDelete={() => setDeleteTarget(selectedInstitution)}
                uploadingImage={uploadingInstitutionImage}
                onImageChange={(file) => void handleInstitutionImageUpload(selectedInstitution, file)}
              />
            ) : ownerPage === 'users' ? (
              <OwnerUsersPage
                institutions={clientInstitutions}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                formatNumber={formatNumber}
                formatDate={formatDate}
                getTypeLabel={getTypeLabel}
                getTypeIcon={getTypeIcon}
                onOpenInstitution={(inst) => void openInstitution(inst)}
                onCreateUser={() => setShowAddModal(true)}
              />
            ) : ownerPage === 'billing' ? (
              <OwnerBillingPage
                institutions={clientInstitutions}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                formatNumber={formatNumber}
                formatDate={formatDate}
                getTypeLabel={getTypeLabel}
                getTypeIcon={getTypeIcon}
                onOpenInstitution={(inst) => void openInstitution(inst)}
              />
            ) : ownerPage === 'analytics' ? (
              <OwnerReportsAnalyticsPage
                institutions={clientInstitutions}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                formatNumber={formatNumber}
                formatDate={formatDate}
                getTypeLabel={getTypeLabel}
                getTypeIcon={getTypeIcon}
                onOpenInstitution={(inst) => void openInstitution(inst)}
              />
            ) : ownerPage === 'notifications' ? (
              <OwnerNotificationsPage
                institutions={clientInstitutions}
                unreadCount={ownerUnreadNotifications}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                formatNumber={formatNumber}
                formatDate={formatDate}
                getTypeLabel={getTypeLabel}
                getTypeIcon={getTypeIcon}
                onOpenInstitution={(inst) => void openInstitution(inst)}
                onOpenBilling={() => setOwnerPage('billing')}
                onUnreadCountChange={setOwnerUnreadNotifications}
                onRefreshBadge={() => void refreshOwnerNotificationBadge()}
              />
            ) : ownerPage === 'activity' ? (
              <OwnerActivityLogPage
                institutions={clientInstitutions}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                formatNumber={formatNumber}
                formatDate={formatDate}
                getTypeLabel={getTypeLabel}
                getTypeIcon={getTypeIcon}
                onOpenInstitution={(inst) => void openInstitution(inst)}
                onOpenBilling={() => setOwnerPage('billing')}
                onOpenReports={() => setOwnerPage('analytics')}
                onOpenNotifications={() => setOwnerPage('notifications')}
                onOpenSettings={() => setOwnerPage('settings')}
                onOpenUsers={() => setOwnerPage('users')}
              />
            ) : ownerPage === 'trial-requests' ? (
              <OwnerTrialRequestsPage
                ownerAdminId={admin?.id || null}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                formatNumber={formatNumber}
                formatDate={formatDate}
                onPendingCountChange={setOwnerTrialPending}
              />
            ) : ownerPage === 'support' ? (
              <OwnerSupportHelpPage
                institutions={clientInstitutions}
                ownerAdminId={admin?.id || null}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                formatNumber={formatNumber}
                formatDate={formatDate}
                getTypeLabel={getTypeLabel}
                getTypeIcon={getTypeIcon}
                onOpenInstitution={(inst) => void openInstitution(inst)}
              />
            ) : ownerPage === 'settings' ? (
              <OwnerSettingsPage
                ownerName={ownerName}
                ownerAdminId={admin?.id || null}
                ownerEmail={admin?.email || ''}
                platformStats={platformStats}
                formatNumber={formatNumber}
                formatDate={formatDate}
              />
            ) : activeSector !== 'all' ? (
              <SectorDetailPage
                sector={activeSectorConfig}
                institutions={visibleInstitutions}
                stats={sectorStats}
                loading={sectorStatsLoading}
                formatNumber={formatNumber}
                formatDate={formatDate}
                getTypeLabel={getTypeLabel}
                getTypeIcon={getTypeIcon}
                statusBadge={statusBadge}
                onBack={() => selectSector('all')}
                onRefresh={refreshSectorData}
                onOpen={(inst) => void openInstitution(inst)}
                onToggle={(inst) => void handleToggleStatus(inst)}
                onDelete={setDeleteTarget}
              />
            ) : (
              <>
                <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                      <span>الرئيسية</span>
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>{activeSectorConfig.label}</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">لوحة مالك المنصة</h1>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-slate-500">Ausar Military SaaS Owner Dashboard</p>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">نشطة</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-10 rounded-lg border-slate-200 bg-white"
                      onClick={() => void fetchInstitutions()}
                    >
                      <RefreshCw className="ml-2 h-4 w-4" />
                      تحديث
                    </Button>
                    <Button
                      className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => setShowAddModal(true)}
                    >
                      <Plus className="ml-2 h-4 w-4" />
                      إضافة مؤسسة
                    </Button>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-4" dir="ltr">
                  {sectorConfigs.filter((sector) => sector.id !== 'all').map((sector) => (
                    <SectorOverviewCard
                      key={sector.id}
                      sector={sector}
                      count={getSectorCount(sector.id)}
                      activeCount={getSectorActive(sector.id)}
                      capacity={getSectorCapacity(sector.id)}
                      selected={activeSector === sector.id}
                      onClick={() => selectSector(sector.id)}
                    />
                  ))}
                </section>

                <PlatformLiveStatsBar
                  stats={platformLiveStats}
                  loading={platformLiveLoading}
                  onRefresh={() => void refreshPlatformLiveStats()}
                  formatNumber={formatNumber}
                />

                <section className="grid gap-5 xl:grid-cols-[minmax(520px,1.05fr)_minmax(0,0.95fr)]" dir="ltr">
                  <div className="space-y-5" dir="rtl">
                    <Panel title={activeSectorConfig.label} subtitle="قائمة المؤسسات المسجلة في المنصة" icon={activeSectorConfig.icon}>
                      <InstitutionTable
                        institutions={visibleInstitutions}
                        activeSector={activeSector}
                        getTypeLabel={getTypeLabel}
                        getTypeIcon={getTypeIcon}
                        statusBadge={statusBadge}
                        onOpen={(inst) => void openInstitution(inst)}
                        onToggle={(inst) => void handleToggleStatus(inst)}
                        onDelete={setDeleteTarget}
                      />
                    </Panel>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <AttendanceAnalyticsCard
                        platformStats={platformStats}
                        activeSectorLabel={activeSectorConfig.label}
                      />
                      <PlatformCapacityCard
                        total={platformStats.capacity}
                        active={platformStats.active}
                        suspended={platformStats.suspended}
                        wilayas={platformStats.wilayas}
                      />
                    </div>
                  </div>

                  <div dir="rtl">
                    <OwnerOverview
                      platformStats={platformStats}
                      recentInstitutions={recentInstitutions}
                      featuredInstitution={featuredInstitution}
                      featuredStats={homePreviewStats}
                      featuredAdmins={homePreviewAdmins}
                      featuredAttendanceRate={homePreviewAttendanceRate}
                      formatNumber={formatNumber}
                      formatDate={formatDate}
                      statusBadge={statusBadge}
                      getTypeIcon={getTypeIcon}
                      getTypeLabel={getTypeLabel}
                      onOpen={(inst) => void openInstitution(inst)}
                    />
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      </div>

      {showAddModal && (
        <CreateInstitutionModal
          form={form}
          setForm={setForm}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          copied={copied}
          submitting={submitting}
          onClose={() => {
            setShowAddModal(false);
            resetCreateForm();
          }}
          onGeneratePassword={generatePassword}
          onCopy={(text) => void copyToClipboard(text)}
          onSubmit={() => void handleCreateInstitution()}
        />
      )}

      {ownerTool && (
        <OwnerToolDialog
          tool={ownerTool}
          platformStats={platformStats}
          recentInstitutions={recentInstitutions}
          formatNumber={formatNumber}
          formatDate={formatDate}
          getTypeIcon={getTypeIcon}
          getTypeLabel={getTypeLabel}
          onOpenInstitution={(inst) => void openInstitution(inst)}
          onClose={() => setOwnerTool(null)}
        />
      )}

      {deleteTarget && (
        <DeleteInstitutionDialog
          institution={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

    </div>
  );
}

function OwnerSidebar({
  activeSector,
  activeOwnerPage,
  ownerName,
  selectSector,
  onOpenTool,
  onLogout,
  onCreate,
  unreadNotifications,
  counts,
  trialPending,
}: {
  activeSector: SectorId;
  activeOwnerPage: OwnerToolId | null;
  ownerName: string;
  selectSector: (sector: SectorId) => void;
  onOpenTool: (tool: OwnerToolId) => void;
  onLogout: () => void;
  onCreate: () => void;
  unreadNotifications: number;
  counts: Record<SectorId, number>;
  trialPending: number;
}) {
  const navItems = [
    { id: 'all' as SectorId, label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'military' as SectorId, label: 'الجامعات', icon: GraduationCap },
    { id: 'school' as SectorId, label: 'المؤسسات التربوية', icon: Building2 },
    { id: 'training' as SectorId, label: 'مراكز التكوين', icon: Briefcase },
    { id: 'company' as SectorId, label: 'الشركات', icon: Landmark },
  ];

  return (
    <aside className="hidden border-l border-white/10 bg-[#061a2e] text-white lg:block" dir="rtl">
      <div className="sticky top-0 h-screen overflow-y-auto">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Ausar Military" className="h-12 w-12 rounded-lg object-contain" />
            <div>
              <p className="text-xl font-black leading-tight">Ausar Military</p>
              <p className="mt-1 text-xs text-blue-100/75">منصة الحضور الذكي</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1.5 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = !activeOwnerPage && activeSector === item.id;
            return (
              <button
                 key={item.id}
                 type="button"
                 onClick={() => selectSector(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  {item.label}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-white/20' : 'bg-white/10 text-slate-300'}`}>
                  {formatNumber(counts[item.id])}
                </span>
              </button>
            );
          })}

          <div className="my-4 border-t border-white/10" />

          {[
            { id: 'users' as OwnerToolId, label: 'المستخدمون', icon: Users },
            { id: 'billing' as OwnerToolId, label: 'الاشتراكات والفوترة', icon: CreditCard },
            { id: 'analytics' as OwnerToolId, label: 'التقارير والتحليلات', icon: BarChart3 },
            { id: 'notifications' as OwnerToolId, label: 'الإشعارات', icon: Bell, badge: unreadNotifications },
            { id: 'settings' as OwnerToolId, label: 'الإعدادات', icon: Settings },
            { id: 'activity' as OwnerToolId, label: 'سجل النشاط', icon: Activity },
            { id: 'support' as OwnerToolId, label: 'الدعم والمساعدة', icon: ShieldCheck },
            { id: 'trial-requests' as OwnerToolId, label: 'طلبات التجربة', icon: Inbox, badge: trialPending },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeOwnerPage === item.id;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onOpenTool(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  {item.label}
                </span>
                {'badge' in item && item.badge ? (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">{item.badge > 99 ? '99+' : item.badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-3">
          <div className="rounded-lg border border-blue-300/20 bg-blue-400/10 p-3">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white">
                <Crown className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{ownerName}</p>
                <p className="text-xs text-blue-100/70">صلاحيات كاملة</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="h-9 w-full rounded-lg border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={onCreate}
            >
              <Plus className="ml-2 h-4 w-4" />
              مؤسسة جديدة
            </Button>
          </div>

          <Button
            variant="ghost"
            className="h-9 w-full justify-start rounded-lg text-slate-300 hover:bg-rose-500/10 hover:text-rose-100"
            onClick={onLogout}
          >
            <LogOut className="ml-2 h-4 w-4" />
            تسجيل الخروج
          </Button>
        </div>
      </div>
    </aside>
  );
}

function SectorOverviewCard({
  sector,
  count,
  activeCount,
  capacity,
  selected,
  onClick,
}: {
  sector: SectorConfig;
  count: number;
  activeCount: number;
  capacity: number;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = sector.icon;
  const suspended = Math.max(count - activeCount, 0);

  return (
    <article dir="rtl" className={`rounded-lg border bg-white p-4 shadow-sm transition ${selected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg border ${sector.soft}`}>
          <Icon className={`h-6 w-6 ${sector.accent}`} />
        </div>
        <div className="text-left">
          <p className="text-xs text-slate-500">إجمالي المؤسسات</p>
          <p className="text-2xl font-black text-slate-950">{formatNumber(count)}</p>
        </div>
      </div>
      <div className="mt-3">
        <h3 className="font-black text-slate-950">{sector.label}</h3>
        <p className="text-xs text-slate-500">{sector.english}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 border-y border-slate-100 py-3 text-center">
        <div>
          <p className="text-[11px] text-slate-500">السعة</p>
          <p className="text-sm font-black text-slate-900">{formatNumber(capacity)}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">النشطة</p>
          <p className="text-sm font-black text-emerald-600">{formatNumber(activeCount)}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">الموقوفة</p>
          <p className="text-sm font-black text-rose-500">{formatNumber(suspended)}</p>
        </div>
      </div>
      <Button className={`mt-4 h-9 w-full rounded-lg text-white ${sector.button}`} onClick={onClick}>
        فتح القطاع
        <ArrowLeft className="mr-2 h-4 w-4" />
      </Button>
    </article>
  );
}

function OwnerUsersPage({
  institutions,
  searchQuery,
  setSearchQuery,
  formatNumber,
  formatDate,
  getTypeLabel,
  getTypeIcon,
  onOpenInstitution,
  onCreateUser,
}: {
  institutions: Institution[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  onOpenInstitution: (inst: Institution) => void;
  onCreateUser: () => void;
}) {
  const [users, setUsers] = useState<OwnerUserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [kindFilter, setKindFilter] = useState<OwnerUserKind>('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const institutionById = useMemo(
    () => new Map(institutions.map((institution) => [institution.id, institution])),
    [institutions]
  );

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const [{ data: adminsRaw }, { data: studentsRaw }, { data: devicesRaw }] = await Promise.all([
        supabase
          .from('admins')
          .select('id, username, role, full_name, email, institution_id, created_at')
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase
          .from('students')
          .select('id, student_number, first_name, last_name, status, status_snake, phone, institution_id, created_at')
          .order('created_at', { ascending: false })
          .limit(3000),
        supabase
          .from('student_devices')
          .select('id, student_id, institution_id, is_active, last_used')
          .order('last_used', { ascending: false })
          .limit(3000),
      ]);

      const deviceRows = (devicesRaw || []) as OwnerDeviceRow[];
      const devicesByStudent = new Map<string, OwnerDeviceRow[]>();
      deviceRows.forEach((device) => {
        const current = devicesByStudent.get(device.student_id) || [];
        current.push(device);
        devicesByStudent.set(device.student_id, current);
      });

      const resolveInstitution = (institutionId: string | null | undefined) => {
        const institution = institutionId ? institutionById.get(institutionId) : null;
        const type = normalizeInstitutionType(institution?.type);
        return {
          institution,
          institutionName: institution?.name || 'Ausar Military',
          institutionType: type,
          sectorLabel: institution ? getTypeLabel(institution.type) : 'النظام',
        };
      };

      const adminUsers: OwnerUserRecord[] = ((adminsRaw || []) as OwnerAdminRow[]).map((adminRow) => {
        const institutionInfo = resolveInstitution(adminRow.institution_id);
        const role = adminRow.role || 'admin';
        const isOwner = role === 'super_admin';
        return {
          id: `admin-${adminRow.id}`,
          kind: isOwner ? 'owner' : 'admin',
          displayName: adminRow.full_name || adminRow.fullName || adminRow.username || 'مستخدم إداري',
          identifier: adminRow.username || adminRow.email || adminRow.id,
          email: adminRow.email || null,
          phone: null,
          role,
          roleLabel: isOwner ? 'مالك المنصة' : role === 'teacher' ? 'أستاذ' : 'إدارة',
          status: 'active',
          institutionId: adminRow.institution_id,
          institutionName: institutionInfo.institutionName,
          institutionType: institutionInfo.institutionType,
          sectorLabel: institutionInfo.sectorLabel,
          createdAt: adminRow.created_at,
          lastActivity: adminRow.created_at,
          deviceCount: 0,
          activeDeviceCount: 0,
        };
      });

      const studentUsers: OwnerUserRecord[] = ((studentsRaw || []) as OwnerStudentRow[]).map((studentRow) => {
        const institutionInfo = resolveInstitution(studentRow.institution_id);
        const studentDevices = devicesByStudent.get(studentRow.id) || [];
        const latestDeviceDate = studentDevices
          .map((device) => device.last_used)
          .filter(Boolean)
          .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0] || null;

        const firstName = studentRow.first_name || studentRow.firstName || '';
        const lastName = studentRow.last_name || studentRow.lastName || '';
        const name = `${firstName} ${lastName}`.trim() || 'طالب بدون اسم';
        const status = studentRow.status_snake || studentRow.status || 'active';

        return {
          id: `student-${studentRow.id}`,
          kind: 'student',
          displayName: name,
          identifier: studentRow.student_number || studentRow.studentNumber || studentRow.id,
          email: null,
          phone: studentRow.phone || null,
          role: 'student',
          roleLabel: 'طالب',
          status,
          institutionId: studentRow.institution_id,
          institutionName: institutionInfo.institutionName,
          institutionType: institutionInfo.institutionType,
          sectorLabel: institutionInfo.sectorLabel,
          createdAt: studentRow.created_at,
          lastActivity: latestDeviceDate || studentRow.created_at,
          deviceCount: studentDevices.length,
          activeDeviceCount: studentDevices.filter((device) => device.is_active !== false).length,
        };
      });

      const nextUsers = [...adminUsers, ...studentUsers].sort(
        (a, b) => new Date(b.lastActivity || b.createdAt || 0).getTime() - new Date(a.lastActivity || a.createdAt || 0).getTime()
      );

      setUsers(nextUsers);
      setSelectedUserId((current) => (current && nextUsers.some((user) => user.id === current) ? current : nextUsers[0]?.id || null));
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحميل المستخدمين'));
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [institutionById]);

  const roleOptions = useMemo(
    () => Array.from(new Set(users.map((user) => user.roleLabel))).sort(),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !query || [
        user.displayName,
        user.identifier,
        user.email,
        user.phone,
        user.institutionName,
        user.roleLabel,
        user.sectorLabel,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      const matchesKind = kindFilter === 'all' || user.kind === kindFilter;
      const matchesRole = roleFilter === 'all' || user.roleLabel === roleFilter;
      const matchesInstitution = institutionFilter === 'all' || user.institutionId === institutionFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter || (statusFilter === 'active' && user.status !== 'inactive');
      return matchesQuery && matchesKind && matchesRole && matchesInstitution && matchesStatus;
    });
  }, [institutionFilter, kindFilter, roleFilter, searchQuery, statusFilter, users]);

  useEffect(() => {
    setPage(1);
  }, [institutionFilter, kindFilter, roleFilter, searchQuery, statusFilter, pageSize]);

  useEffect(() => {
    if (filteredUsers.length === 0) {
      setSelectedUserId(null);
      return;
    }
    setSelectedUserId((current) => (current && filteredUsers.some((user) => user.id === current) ? current : filteredUsers[0].id));
  }, [filteredUsers]);

  const stats = useMemo(() => ({
    total: users.length,
    students: users.filter((user) => user.kind === 'student').length,
    admins: users.filter((user) => user.kind === 'admin').length,
    owners: users.filter((user) => user.kind === 'owner').length,
    activeDevices: users.reduce((total, user) => total + user.activeDeviceCount, 0),
    documented: users.filter((user) => user.deviceCount > 0 || user.kind !== 'student').length,
  }), [users]);

  const selectedUser = filteredUsers.find((user) => user.id === selectedUserId) || filteredUsers[0] || null;
  const previewUser = previewUserId ? users.find((user) => user.id === previewUserId) || null : null;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const selectedInstitution = selectedUser?.institutionId ? institutionById.get(selectedUser.institutionId) || null : null;

  const resetFilters = () => {
    setKindFilter('all');
    setRoleFilter('all');
    setInstitutionFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const copyContact = async (value: string | null | undefined) => {
    if (!value) {
      toast.info('لا توجد بيانات اتصال لهذا المستخدم');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success('تم نسخ بيانات الاتصال');
    } catch {
      toast.error('تعذر النسخ');
    }
  };

  const openMail = (email: string | null) => {
    if (!email) {
      toast.info('لا يوجد بريد إلكتروني لهذا المستخدم');
      return;
    }
    window.location.href = `mailto:${email}`;
  };

  const showUserDetails = (user: OwnerUserRecord) => {
    setSelectedUserId(user.id);
    setPreviewUserId(user.id);
  };

  const openUserInstitution = (user: OwnerUserRecord | null) => {
    const institution = user?.institutionId ? institutionById.get(user.institutionId) : null;
    if (!institution) {
      toast.info('هذا المستخدم تابع للنظام أو لا توجد مؤسسة مرتبطة به');
      return;
    }
    onOpenInstitution(institution);
  };

  const exportUsers = () => {
    const columns = ['الاسم', 'المعرف', 'الدور', 'المؤسسة', 'القطاع', 'الحالة', 'آخر نشاط', 'الأجهزة', 'الاتصال'];
    const rows = filteredUsers.map((user) => [
      user.displayName,
      user.identifier,
      user.roleLabel,
      user.institutionName,
      user.sectorLabel,
      user.status,
      formatDate(user.lastActivity),
      String(user.deviceCount),
      user.email || user.phone || '',
    ]);
    const csv = [columns, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ausar Military-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('تم تجهيز ملف المستخدمين');
  };

  const statusClass = (status: string) => (
    status === 'active' || status === 'نشط'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'inactive'
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-orange-200 bg-orange-50 text-orange-700'
  );

  const kindTabs: Array<{ id: OwnerUserKind; label: string; value: number }> = [
    { id: 'all', label: 'الكل', value: stats.total },
    { id: 'student', label: 'الطلاب', value: stats.students },
    { id: 'admin', label: 'الأساتذة والإدارة', value: stats.admins },
    { id: 'owner', label: 'مالكو المنصة', value: stats.owners },
  ];

  return (
    <section className="space-y-5" dir="rtl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>الرئيسية</span>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>المستخدمون</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">إدارة المستخدمين</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-500">Ausar Military SaaS User Management</p>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">بيانات حقيقية من Supabase</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => void loadUsers()}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={exportUsers}>
            <Download className="ml-2 h-4 w-4" />
            تصدير CSV
          </Button>
          <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={onCreateUser}>
            <Plus className="ml-2 h-4 w-4" />
            إضافة مستخدم
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" dir="ltr">
        <UserStatCard label="إجمالي المستخدمين" value={stats.total} delta="+7.8%" icon={Users} tone="bg-blue-50 text-blue-700" formatNumber={formatNumber} />
        <UserStatCard label="الطلاب" value={stats.students} delta="+8.4%" icon={GraduationCap} tone="bg-sky-50 text-sky-700" formatNumber={formatNumber} />
        <UserStatCard label="الأساتذة والإدارة" value={stats.admins} delta="+6.1%" icon={UserPlus} tone="bg-violet-50 text-violet-700" formatNumber={formatNumber} />
        <UserStatCard label="مالكو المنصة" value={stats.owners} delta="+0%" icon={Crown} tone="bg-orange-50 text-orange-700" formatNumber={formatNumber} />
        <UserStatCard label="الحسابات الموثقة" value={stats.documented} delta="+4.7%" icon={ShieldCheck} tone="bg-emerald-50 text-emerald-700" formatNumber={formatNumber} />
        <UserStatCard label="الأجهزة النشطة" value={stats.activeDevices} delta="+7.3%" icon={Smartphone} tone="bg-rose-50 text-rose-700" formatNumber={formatNumber} />
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]" dir="ltr">
        <div className="space-y-4" dir="rtl">
          <Panel title="المستخدمون" subtitle="قائمة المستخدمين الفعليين داخل المنصة" icon={Users}>
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_150px_150px_150px_140px_130px]">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-10 rounded-lg border-slate-200 bg-slate-50 pr-10 text-sm"
                    placeholder="بحث باسم المستخدم، المؤسسة، البريد..."
                  />
                </div>
                <Select value={kindFilter} onValueChange={(value) => setKindFilter(value as OwnerUserKind)}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue placeholder="نوع المستخدم" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    <SelectItem value="student">طلاب</SelectItem>
                    <SelectItem value="admin">أساتذة وإدارة</SelectItem>
                    <SelectItem value="owner">مالكو المنصة</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue placeholder="الدور" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأدوار</SelectItem>
                    {roleOptions.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue placeholder="المؤسسة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المؤسسات</SelectItem>
                    {institutions.map((institution) => <SelectItem key={institution.id} value={institution.id}>{institution.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue placeholder="الحالة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={resetFilters}>
                  مسح الفلاتر
                </Button>
              </div>

              <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
                {kindTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setKindFilter(tab.id)}
                    className={`rounded-lg border px-4 py-3 text-right transition ${
                      kindFilter === tab.id ? 'border-blue-200 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs font-semibold opacity-80">{tab.label}</span>
                    <span className="mt-1 block text-lg font-black">{formatNumber(tab.value)}</span>
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <div className="grid min-w-[900px] grid-cols-[minmax(210px,1.1fr)_100px_minmax(150px,0.9fr)_100px_96px_100px_132px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                  <span>المستخدم</span>
                  <span>الدور</span>
                  <span>المؤسسة</span>
                  <span>القطاع</span>
                  <span>الحالة</span>
                  <span>آخر دخول</span>
                  <span>الإجراء</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {loadingUsers ? (
                    <div className="min-w-[900px] p-6 text-center text-sm text-slate-500">جاري تحميل المستخدمين...</div>
                  ) : visibleRows.length === 0 ? (
                    <div className="min-w-[900px] p-6 text-center text-sm text-slate-500">لا توجد نتائج مطابقة للفلاتر الحالية.</div>
                  ) : (
                    visibleRows.map((user) => (
                      <div
                        key={user.id}
                        className={`grid min-w-[900px] grid-cols-[minmax(210px,1.1fr)_100px_minmax(150px,0.9fr)_100px_96px_100px_132px] gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 ${
                          selectedUser?.id === user.id ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/35 dark:ring-blue-800' : 'bg-white'
                        }`}
                      >
                        <button type="button" className="flex min-w-0 items-center gap-3 text-right" onClick={() => setSelectedUserId(user.id)}>
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${user.kind === 'student' ? 'bg-blue-50 text-blue-700' : user.kind === 'owner' ? 'bg-orange-50 text-orange-700' : 'bg-violet-50 text-violet-700'}`}>
                            {user.kind === 'student' ? <GraduationCap className="h-5 w-5" /> : user.kind === 'owner' ? <Crown className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-black text-slate-950">{user.displayName}</span>
                            <span className="block truncate text-xs text-slate-500">{user.identifier}</span>
                          </span>
                        </button>
                        <span className="self-center text-slate-700">{user.roleLabel}</span>
                        <span className="self-center truncate font-semibold text-slate-800">{user.institutionName}</span>
                        <span className="flex items-center gap-2 self-center text-slate-600">
                          {getTypeIcon(user.institutionType, 'h-4 w-4')}
                          {user.sectorLabel}
                        </span>
                        <span className={`self-center rounded-full border px-2 py-1 text-center text-xs font-bold ${statusClass(user.status)}`}>
                          {user.status === 'active' ? 'نشط' : user.status === 'inactive' ? 'غير نشط' : user.status}
                        </span>
                        <span className="self-center text-xs text-slate-500">{formatDate(user.lastActivity)}</span>
                        <span className="sticky left-0 z-10 flex items-center gap-1 self-center bg-inherit pl-1">
                          <Button variant="outline" size="sm" className="h-8 min-w-[62px] rounded-lg border-slate-200 px-2" onClick={() => showUserDetails(user)}>
                            <Eye className="ml-1 h-3.5 w-3.5" />
                            عرض
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 min-w-[48px] rounded-lg border-slate-200 px-2" onClick={() => openUserInstitution(user)}>
                            فتح
                          </Button>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  عرض {formatNumber(visibleRows.length)} من {formatNumber(filteredUsers.length)} مستخدم
                </p>
                <div className="flex items-center gap-2">
                  <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                    <SelectTrigger className="h-9 w-[86px] rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="rounded-lg border-slate-200" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                    السابق
                  </Button>
                  <span className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white">{formatNumber(currentPage)} / {formatNumber(totalPages)}</span>
                  <Button variant="outline" size="sm" className="rounded-lg border-slate-200" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                    التالي
                  </Button>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <aside className="space-y-4" dir="rtl">
          <Panel title="ملف المستخدم المحدد" subtitle="تفاصيل مرتبطة بالسجل الحقيقي" icon={UserPlus}>
            {selectedUser ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    {selectedUser.kind === 'student' ? <GraduationCap className="h-7 w-7" /> : selectedUser.kind === 'owner' ? <Crown className="h-7 w-7" /> : <UserPlus className="h-7 w-7" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-black text-slate-950">{selectedUser.displayName}</h3>
                    <p className="truncate text-sm text-slate-500">{selectedUser.identifier}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{selectedUser.roleLabel}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(selectedUser.status)}`}>
                        {selectedUser.status === 'active' ? 'نشط' : selectedUser.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <DetailPill label="المؤسسة" value={selectedUser.institutionName} />
                  <DetailPill label="القطاع" value={selectedUser.sectorLabel} />
                  <DetailPill label="تاريخ التسجيل" value={formatDate(selectedUser.createdAt)} />
                  <DetailPill label="آخر نشاط" value={formatDate(selectedUser.lastActivity)} />
                  <DetailPill label="الأجهزة" value={`${formatNumber(selectedUser.activeDeviceCount)} / ${formatNumber(selectedUser.deviceCount)}`} />
                  <DetailPill label="الاتصال" value={selectedUser.email || selectedUser.phone || 'غير متوفر'} />
                </div>

                <div className="grid gap-2">
                  <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => openUserInstitution(selectedUser)}>
                    <Eye className="ml-2 h-4 w-4" />
                    فتح ملف المؤسسة
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-10 rounded-lg border-slate-200" onClick={() => openMail(selectedUser.email)}>
                      <Mail className="ml-2 h-4 w-4" />
                      تواصل
                    </Button>
                    <Button variant="outline" className="h-10 rounded-lg border-slate-200" onClick={() => copyContact(selectedUser.email || selectedUser.phone || selectedUser.identifier)}>
                      <Copy className="ml-2 h-4 w-4" />
                      نسخ
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                اختر مستخدما من الجدول لعرض التفاصيل.
              </div>
            )}
          </Panel>

          <Panel title="الأجهزة والنشاط" subtitle="آخر معلومات موثقة للمستخدم" icon={Smartphone}>
            <div className="space-y-3">
              <SideStat label="الأجهزة المرتبطة" value={formatNumber(selectedUser?.deviceCount || 0)} icon={Smartphone} tone="text-blue-600" />
              <SideStat label="الأجهزة النشطة" value={formatNumber(selectedUser?.activeDeviceCount || 0)} icon={ShieldCheck} tone="text-emerald-600" />
              <SideStat label="آخر نشاط" value={formatDate(selectedUser?.lastActivity)} icon={Clock} tone="text-orange-600" />
              <Button variant="outline" className="h-10 w-full rounded-lg border-slate-200" onClick={() => selectedInstitution ? onOpenInstitution(selectedInstitution) : toast.info('لا توجد مؤسسة مرتبطة')}>
                عرض المؤسسة المرتبطة
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Button>
            </div>
          </Panel>
        </aside>
      </section>

      {previewUser && (
        <UserDetailsDialog
          user={previewUser}
          formatNumber={formatNumber}
          formatDate={formatDate}
          statusClass={statusClass}
          onClose={() => setPreviewUserId(null)}
          onOpenInstitution={() => openUserInstitution(previewUser)}
          onCopy={() => void copyContact(previewUser.email || previewUser.phone || previewUser.identifier)}
          onContact={() => openMail(previewUser.email)}
        />
      )}
    </section>
  );
}

function UserStatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone,
  formatNumber,
}: {
  label: string;
  value: number;
  delta: string;
  icon: LucideIcon;
  tone: string;
  formatNumber: (value: number | null | undefined) => string;
}) {
  return (
    <article dir="rtl" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{formatNumber(value)}</p>
          <p className="mt-1 text-[11px] font-bold text-emerald-600">{delta} من الشهر الماضي</p>
        </div>
      </div>
    </article>
  );
}

function UserDetailsDialog({
  user,
  formatNumber,
  formatDate,
  statusClass,
  onClose,
  onOpenInstitution,
  onCopy,
  onContact,
}: {
  user: OwnerUserRecord;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  statusClass: (status: string) => string;
  onClose: () => void;
  onOpenInstitution: () => void;
  onCopy: () => void;
  onContact: () => void;
}) {
  const Icon = user.kind === 'student' ? GraduationCap : user.kind === 'owner' ? Crown : UserPlus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">ملف المستخدم</h2>
              <p className="mt-1 text-sm text-slate-500">عرض مباشر للتفاصيل المرتبطة بالسجل الحقيقي</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose} aria-label="إغلاق">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="truncate text-2xl font-black text-slate-950">{user.displayName}</h3>
              <p className="mt-1 truncate text-sm text-slate-500">{user.identifier}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{user.roleLabel}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(user.status)}`}>
                {user.status === 'active' ? 'نشط' : user.status === 'inactive' ? 'غير نشط' : user.status}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailPill label="المؤسسة" value={user.institutionName} />
            <DetailPill label="القطاع" value={user.sectorLabel} />
            <DetailPill label="تاريخ التسجيل" value={formatDate(user.createdAt)} />
            <DetailPill label="آخر نشاط" value={formatDate(user.lastActivity)} />
            <DetailPill label="الأجهزة المرتبطة" value={formatNumber(user.deviceCount)} />
            <DetailPill label="الأجهزة النشطة" value={formatNumber(user.activeDeviceCount)} />
            <DetailPill label="البريد" value={user.email || 'غير متوفر'} />
            <DetailPill label="الهاتف" value={user.phone || 'غير متوفر'} />
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onCopy}>
              <Copy className="ml-2 h-4 w-4" />
              نسخ
            </Button>
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onContact}>
              <Mail className="ml-2 h-4 w-4" />
              تواصل
            </Button>
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={onOpenInstitution}>
              <Eye className="ml-2 h-4 w-4" />
              فتح ملف المؤسسة
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function OwnerBillingPage({
  institutions,
  searchQuery,
  setSearchQuery,
  formatNumber,
  formatDate,
  getTypeLabel,
  getTypeIcon,
  onOpenInstitution,
}: {
  institutions: Institution[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  onOpenInstitution: (inst: Institution) => void;
}) {
  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [billingSchemaReady, setBillingSchemaReady] = useState(true);
  const [typeFilter, setTypeFilter] = useState<SectorId>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [form, setForm] = useState<BillingFormState>(() => createEmptyBillingForm());
  const [renewalForm, setRenewalForm] = useState<RenewalFormState>(() => createRenewalForm(null));
  const pageSize = 8;

  const institutionById = useMemo(() => new Map(institutions.map((institution) => [institution.id, institution])), [institutions]);

  const mapRow = (row: SubscriptionDbRow): BillingSubscription => {
    const institution = institutionById.get(row.institution_id);
    const endDate = row.end_date || row.current_period_end || null;
    const status = normalizeSubscriptionStatus(row.status, endDate);
    return {
      id: row.id,
      institutionId: row.institution_id,
      institutionName: institution?.name || 'مؤسسة غير معروفة',
      institutionType: normalizeInstitutionType(institution?.type),
      planName: row.plan_name || row.plan_type || 'Starter',
      status,
      billingCycle: normalizeBillingCycle(row.billing_cycle),
      startDate: row.start_date || null,
      endDate,
      maxUsers: row.max_users ?? row.student_limit ?? institution?.max_students ?? 0,
      maxTeachers: row.max_teachers ?? row.session_limit ?? null,
      price: Number(row.price || 0),
      currency: row.currency || 'DZD',
      paymentStatus: normalizePaymentStatus(row.payment_status),
      paymentMethod: row.payment_method || null,
      lastInvoiceNumber: row.last_invoice_number || null,
      notes: row.notes || null,
      createdAt: row.created_at || null,
      daysRemaining: getDaysRemaining(endDate),
    };
  };

  const loadSubscriptions = async () => {
    setLoadingBilling(true);
    try {
      const enhancedSelect = 'id, institution_id, plan_type, plan_name, status, billing_cycle, start_date, end_date, current_period_end, student_limit, session_limit, max_users, max_teachers, price, currency, payment_status, payment_method, last_invoice_number, notes, created_at';
      let response = await supabase
        .from('subscriptions')
        .select(enhancedSelect)
        .order('created_at', { ascending: false }) as unknown as SupabaseListResult<SubscriptionDbRow>;
      let schemaReady = true;

      if (response.error) {
        schemaReady = false;
        response = await supabase
          .from('subscriptions')
          .select('id, institution_id, plan_type, status, start_date, end_date, student_limit, session_limit, created_at')
          .order('created_at', { ascending: false }) as unknown as SupabaseListResult<SubscriptionDbRow>;
      }

      if (response.error) throw response.error;

      setBillingSchemaReady(schemaReady);
      const rows = ((response.data || []) as SubscriptionDbRow[]).map(mapRow);
      setSubscriptions(rows);
      setSelectedId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0]?.id || null));
      if (!schemaReady) {
        toast.info('الفوترة تعمل بالبيانات الأساسية. طبّق migration v2.5.0 لتفعيل كل حقول الدفع والفواتير.');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحميل الاشتراكات'));
    } finally {
      setLoadingBilling(false);
    }
  };

  useEffect(() => {
    void loadSubscriptions();
  }, [institutionById]);

  const filteredSubscriptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return subscriptions.filter((subscription) => {
      const matchesQuery = !query || [
        subscription.institutionName,
        subscription.planName,
        subscription.status,
        subscription.paymentStatus,
        subscription.lastInvoiceNumber,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      const matchesType = typeFilter === 'all' || subscription.institutionType === typeFilter;
      const matchesStatus = statusFilter === 'all' || subscription.status === statusFilter;
      const matchesPayment = paymentFilter === 'all' || subscription.paymentStatus === paymentFilter;
      return matchesQuery && matchesType && matchesStatus && matchesPayment;
    });
  }, [paymentFilter, searchQuery, statusFilter, subscriptions, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [paymentFilter, searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    if (filteredSubscriptions.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (current && filteredSubscriptions.some((row) => row.id === current) ? current : filteredSubscriptions[0].id));
  }, [filteredSubscriptions]);

  const selected = filteredSubscriptions.find((subscription) => subscription.id === selectedId) || filteredSubscriptions[0] || null;
  const selectedInstitution = selected ? institutionById.get(selected.institutionId) || null : null;
  const totalPages = Math.max(1, Math.ceil(filteredSubscriptions.length / pageSize));
  const visibleRows = filteredSubscriptions.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);

  const stats = useMemo(() => ({
    revenue: subscriptions.reduce((total, item) => total + (item.paymentStatus === 'paid' ? item.price : 0), 0),
    active: subscriptions.filter((item) => item.status === 'active' || item.status === 'trial' || item.status === 'expiring_soon').length,
    expired: subscriptions.filter((item) => item.status === 'expired' || item.status === 'cancelled').length,
    expiring: subscriptions.filter((item) => item.status === 'expiring_soon').length,
    unpaid: subscriptions.filter((item) => item.paymentStatus === 'unpaid' || item.paymentStatus === 'overdue' || item.paymentStatus === 'pending').length,
  }), [subscriptions]);

  const openCreateModal = () => {
    setForm(createEmptyBillingForm(institutions[0]?.id));
    setShowSubscriptionModal(true);
  };

  const openEditModal = (subscription: BillingSubscription | null) => {
    if (!subscription) return;
    setForm({
      id: subscription.id,
      institutionId: subscription.institutionId,
      planName: subscription.planName,
      billingCycle: subscription.billingCycle,
      price: String(subscription.price || ''),
      currency: subscription.currency,
      startDate: toInputDate(subscription.startDate),
      endDate: toInputDate(subscription.endDate),
      maxUsers: String(subscription.maxUsers || ''),
      maxTeachers: String(subscription.maxTeachers || ''),
      paymentMethod: subscription.paymentMethod || '',
      paymentStatus: subscription.paymentStatus,
      notes: subscription.notes || '',
    });
    setShowSubscriptionModal(true);
  };

  const openRenewalModal = (subscription: BillingSubscription | null) => {
    if (!subscription) return;
    setSelectedId(subscription.id);
    setRenewalForm(createRenewalForm(subscription));
    setShowRenewalModal(true);
  };

  const buildSubscriptionPayload = (state: BillingFormState) => {
    const startDate = state.startDate || new Date().toISOString().slice(0, 10);
    const endDate = state.endDate || startDate;
    const price = Number(state.price || 0);
    const maxUsers = Number(state.maxUsers || 0);
    const maxTeachers = state.maxTeachers ? Number(state.maxTeachers) : null;
    const status = normalizeSubscriptionStatus('active', endDate);
    const basePayload = {
      institution_id: state.institutionId,
      plan_type: state.planName,
      status,
      start_date: startDate,
      end_date: endDate,
      student_limit: maxUsers,
      session_limit: maxTeachers || 0,
    };

    if (!billingSchemaReady) return basePayload;

    return {
      ...basePayload,
      plan_name: state.planName,
      billing_cycle: state.billingCycle,
      current_period_end: endDate,
      max_users: maxUsers,
      max_teachers: maxTeachers,
      price,
      currency: state.currency || 'DZD',
      payment_status: state.paymentStatus,
      payment_method: state.paymentMethod || null,
      notes: state.notes || null,
      updated_at: new Date().toISOString(),
    };
  };

  const saveSubscription = async () => {
    if (!form.institutionId) { toast.error('اختر المؤسسة'); return; }
    if (!form.planName.trim()) { toast.error('اختر الباقة'); return; }
    if (!form.startDate || !form.endDate) { toast.error('تاريخ البداية والنهاية مطلوبان'); return; }
    setSavingBilling(true);
    try {
      const payload = buildSubscriptionPayload(form);
      if (form.id) {
        const { error } = await supabase.from('subscriptions').update(payload).eq('id', form.id);
        if (error) throw error;
        toast.success('تم تعديل الاشتراك');
      } else {
        const { error } = await supabase.from('subscriptions').insert([payload]);
        if (error) throw error;
        toast.success('تم إنشاء الاشتراك');
      }
      setShowSubscriptionModal(false);
      await loadSubscriptions();
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر حفظ الاشتراك'));
    } finally {
      setSavingBilling(false);
    }
  };

  const renewSubscription = async () => {
    if (!selected) return;
    if (!renewalForm.newEndDate) { toast.error('تاريخ النهاية الجديد مطلوب'); return; }
    setSavingBilling(true);
    try {
      const updates: Record<string, unknown> = {
        end_date: renewalForm.newEndDate,
        status: normalizeSubscriptionStatus('active', renewalForm.newEndDate),
      };
      if (billingSchemaReady) {
        updates.current_period_end = renewalForm.newEndDate;
        updates.price = Number(renewalForm.renewalPrice || selected.price || 0);
        updates.payment_status = renewalForm.paymentStatus;
        updates.payment_method = renewalForm.paymentMethod || null;
        updates.notes = renewalForm.notes || selected.notes || null;
        updates.updated_at = new Date().toISOString();
      }
      const { error } = await supabase.from('subscriptions').update(updates).eq('id', selected.id);
      if (error) throw error;

      if (billingSchemaReady && Number(renewalForm.renewalPrice || 0) > 0) {
        await supabase.from('subscription_payments').insert([{
          subscription_id: selected.id,
          institution_id: selected.institutionId,
          invoice_number: selected.lastInvoiceNumber || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${selected.id.slice(0, 6)}`,
          amount: Number(renewalForm.renewalPrice || 0),
          currency: selected.currency || 'DZD',
          payment_status: renewalForm.paymentStatus,
          payment_method: renewalForm.paymentMethod || null,
          payment_date: renewalForm.paymentStatus === 'paid' ? new Date().toISOString().slice(0, 10) : null,
          due_date: renewalForm.newEndDate,
        }]);
      }

      toast.success('تم تجديد الاشتراك');
      setShowRenewalModal(false);
      await loadSubscriptions();
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تجديد الاشتراك'));
    } finally {
      setSavingBilling(false);
    }
  };

  const updateSubscriptionStatus = async (subscription: BillingSubscription | null, status: SubscriptionStatus) => {
    if (!subscription) return;
    if (status === 'active' && subscription.daysRemaining !== null && subscription.daysRemaining < 0) {
      toast.info('الاشتراك منتهي. افتح التجديد أولا وحدد تاريخ نهاية جديد.');
      openRenewalModal(subscription);
      return;
    }
    try {
      const payload: Record<string, unknown> = { status };
      if (billingSchemaReady) payload.updated_at = new Date().toISOString();
      const { error } = await supabase.from('subscriptions').update(payload).eq('id', subscription.id);
      if (error) throw error;
      toast.success(status === 'suspended' ? 'تم إيقاف الاشتراك' : 'تمت إعادة التفعيل');
      await loadSubscriptions();
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحديث حالة الاشتراك'));
    }
  };

  const exportBilling = () => {
    const columns = ['المؤسسة', 'النوع', 'الباقة', 'السعر', 'دورة الدفع', 'البداية', 'النهاية', 'حالة الاشتراك', 'حالة الدفع'];
    const rows = filteredSubscriptions.map((item) => [
      item.institutionName,
      getTypeLabel(item.institutionType),
      item.planName,
      formatCurrency(item.price, item.currency),
      billingCycleLabel(item.billingCycle),
      formatDate(item.startDate),
      formatDate(item.endDate),
      subscriptionStatusLabel(item.status),
      paymentStatusLabel(item.paymentStatus),
    ]);
    const csv = [columns, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ausar Military-billing-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير الاشتراكات');
  };

  const downloadInvoice = async (subscription: BillingSubscription | null) => {
    if (!subscription) return;
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Ausar Military Invoice', 20, 20);
    doc.setFontSize(11);
    doc.text(`Institution: ${subscription.institutionName}`, 20, 35);
    doc.text(`Plan: ${subscription.planName}`, 20, 45);
    doc.text(`Amount: ${formatCurrency(subscription.price, subscription.currency)}`, 20, 55);
    doc.text(`Billing cycle: ${billingCycleLabel(subscription.billingCycle)}`, 20, 65);
    doc.text(`Start: ${formatDate(subscription.startDate)} / End: ${formatDate(subscription.endDate)}`, 20, 75);
    doc.text(`Payment: ${paymentStatusLabel(subscription.paymentStatus)}`, 20, 85);
    doc.save(`${subscription.lastInvoiceNumber || `QH-${subscription.id.slice(0, 8)}`}.pdf`);
  };

  const planDistribution = ['Starter', 'Professional', 'Enterprise'].map((plan) => ({
    plan,
    count: subscriptions.filter((item) => item.planName.toLowerCase() === plan.toLowerCase()).length,
  }));
  const paymentMethods = ['facture', 'bank_transfer', 'cheque', 'cash'].map((method) => ({
    method,
    count: subscriptions.filter((item) => item.paymentMethod === method).length,
  }));

  return (
    <section className="space-y-5" dir="rtl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>الرئيسية</span>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>الاشتراكات والفوترة</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">الاشتراكات والفوترة</h1>
          <p className="mt-1 text-sm text-slate-500">إدارة جميع الاشتراكات، الفواتير وطرق الدفع</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={exportBilling}>
            <Download className="ml-2 h-4 w-4" />
            تصدير
          </Button>
          <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={openCreateModal}>
            <Plus className="ml-2 h-4 w-4" />
            إنشاء اشتراك جديد
          </Button>
        </div>
      </div>

      {!billingSchemaReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          قاعدة البيانات تحتاج migration v2.5.0 لتفعيل حقول السعر، الدفع، الفواتير، وطريقة الدفع كاملة.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" dir="ltr">
        <BillingKpi label="إجمالي الإيرادات" value={formatCurrency(stats.revenue)} trend="+12.5% هذا الشهر" icon={TrendingUp} tone="bg-emerald-50 text-emerald-700" />
        <BillingKpi label="الاشتراكات النشطة" value={formatNumber(stats.active)} trend="تشغيل مستقر" icon={Check} tone="bg-blue-50 text-blue-700" />
        <BillingKpi label="الاشتراكات المنتهية" value={formatNumber(stats.expired)} trend="تحتاج متابعة" icon={PauseCircle} tone="bg-rose-50 text-rose-700" />
        <BillingKpi label="قريبة من الانتهاء" value={formatNumber(stats.expiring)} trend="خلال 15 يوما" icon={Clock} tone="bg-orange-50 text-orange-700" />
        <BillingKpi label="الفواتير غير المدفوعة" value={formatNumber(stats.unpaid)} trend="متابعة يدوية" icon={FileText} tone="bg-violet-50 text-violet-700" />
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]" dir="ltr">
        <Panel title="قائمة الاشتراكات" subtitle="كل المؤسسات والباقات المسجلة في المنصة" icon={CreditCard}>
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-10 rounded-lg border-slate-200 bg-slate-50 pr-10" placeholder="بحث باسم المؤسسة أو الباقة..." />
              </div>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as SectorId)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  <SelectItem value="university">جامعة</SelectItem>
                  <SelectItem value="school">مؤسسة تربوية</SelectItem>
                  <SelectItem value="primary_school">مدرسة ابتدائية</SelectItem>
                  <SelectItem value="training">مركز تكوين</SelectItem>
                  <SelectItem value="company">شركة</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | SubscriptionStatus)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل حالات الاشتراك</SelectItem>
                  {subscriptionStatuses.map((status) => <SelectItem key={status} value={status}>{subscriptionStatusLabel(status)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as 'all' | PaymentStatus)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل حالات الدفع</SelectItem>
                  {paymentStatuses.map((status) => <SelectItem key={status} value={status}>{paymentStatusLabel(status)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <div className="grid min-w-[1120px] grid-cols-[minmax(210px,1fr)_120px_130px_120px_110px_110px_110px_130px_120px_150px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                <span>المؤسسة</span><span>نوع المؤسسة</span><span>الباقة</span><span>السعر</span><span>دورة الدفع</span><span>البداية</span><span>النهاية</span><span>حالة الاشتراك</span><span>حالة الدفع</span><span>الإجراءات</span>
              </div>
              <div className="divide-y divide-slate-100">
                {loadingBilling ? (
                  <div className="min-w-[1120px] p-6 text-center text-sm text-slate-500">جاري تحميل الاشتراكات...</div>
                ) : visibleRows.length === 0 ? (
                  <div className="min-w-[1120px] p-6 text-center text-sm text-slate-500">لا توجد اشتراكات مطابقة.</div>
                ) : visibleRows.map((subscription) => (
                  <div key={subscription.id} className={`grid min-w-[1120px] grid-cols-[minmax(210px,1fr)_120px_130px_120px_110px_110px_110px_130px_120px_150px] gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 ${selected?.id === subscription.id ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/35 dark:ring-blue-800' : 'bg-white'}`}>
                    <button type="button" className="min-w-0 text-right" onClick={() => setSelectedId(subscription.id)}>
                      <span className="block truncate font-black text-slate-950">{subscription.institutionName}</span>
                      <span className="block text-xs text-slate-500">{subscription.lastInvoiceNumber || 'بدون فاتورة'}</span>
                    </button>
                    <span className="flex items-center gap-2 self-center text-slate-600">{getTypeIcon(subscription.institutionType, 'h-4 w-4')}{getTypeLabel(subscription.institutionType)}</span>
                    <span className="self-center font-bold text-blue-700">{subscription.planName}</span>
                    <span className="self-center text-slate-700">{formatCurrency(subscription.price, subscription.currency)}</span>
                    <span className="self-center text-slate-600">{billingCycleLabel(subscription.billingCycle)}</span>
                    <span className="self-center text-xs text-slate-500">{formatDate(subscription.startDate)}</span>
                    <span className="self-center text-xs text-slate-500">{formatDate(subscription.endDate)}</span>
                    <span className={`self-center rounded-full border px-2 py-1 text-center text-xs font-bold ${subscriptionStatusClass(subscription.status)}`}>{subscriptionStatusLabel(subscription.status)}</span>
                    <span className={`self-center rounded-full border px-2 py-1 text-center text-xs font-bold ${paymentStatusClass(subscription.paymentStatus)}`}>{paymentStatusLabel(subscription.paymentStatus)}</span>
                    <span className="sticky left-0 z-10 flex items-center gap-1 self-center bg-inherit pl-1">
                      <Button variant="outline" size="sm" className="h-8 rounded-lg px-2" onClick={() => setSelectedId(subscription.id)}>عرض</Button>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg px-2" onClick={() => openEditModal(subscription)}>تعديل</Button>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg px-2" onClick={() => openRenewalModal(subscription)}>تجديد</Button>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">عرض {formatNumber(visibleRows.length)} من {formatNumber(filteredSubscriptions.length)} اشتراك</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-lg border-slate-200" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>السابق</Button>
                <span className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white">{formatNumber(Math.min(page, totalPages))} / {formatNumber(totalPages)}</span>
                <Button variant="outline" size="sm" className="rounded-lg border-slate-200" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>التالي</Button>
              </div>
            </div>
          </div>
        </Panel>

        <aside className="space-y-4" dir="rtl">
          <Panel title="تفاصيل الاشتراك" subtitle="الملف المالي للمؤسسة المحددة" icon={CreditCard}>
            {selected ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{getTypeIcon(selected.institutionType, 'h-7 w-7')}</div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-slate-950">{selected.institutionName}</h3>
                    <p className="text-sm text-slate-500">{getTypeLabel(selected.institutionType)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <DetailPill label="الباقة" value={selected.planName} />
                  <DetailPill label="دورة الدفع" value={billingCycleLabel(selected.billingCycle)} />
                  <DetailPill label="تاريخ البداية" value={formatDate(selected.startDate)} />
                  <DetailPill label="تاريخ النهاية" value={formatDate(selected.endDate)} />
                  <DetailPill label="الأيام المتبقية" value={selected.daysRemaining === null ? 'غير محدد' : formatNumber(selected.daysRemaining)} />
                  <DetailPill label="عدد المستخدمين" value={formatNumber(selected.maxUsers)} />
                  <DetailPill label="عدد الأساتذة/المسؤولين" value={selected.maxTeachers === null ? 'غير محدد' : formatNumber(selected.maxTeachers)} />
                  <DetailPill label="حالة الدفع" value={paymentStatusLabel(selected.paymentStatus)} />
                  <DetailPill label="طريقة الدفع" value={paymentMethodLabel(selected.paymentMethod)} />
                  <DetailPill label="آخر فاتورة" value={selected.lastInvoiceNumber || 'غير متوفر'} />
                </div>
                <div className="grid gap-2">
                  <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => openRenewalModal(selected)}>تجديد الاشتراك</Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-10 rounded-lg border-slate-200" onClick={() => openEditModal(selected)}>تعديل</Button>
                    {selected.status === 'suspended' ? (
                      <Button variant="outline" className="h-10 rounded-lg border-emerald-200 text-emerald-700" onClick={() => void updateSubscriptionStatus(selected, 'active')}>إعادة التفعيل</Button>
                    ) : (
                      <Button variant="outline" className="h-10 rounded-lg border-orange-200 text-orange-700" onClick={() => void updateSubscriptionStatus(selected, 'suspended')}>إيقاف</Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-10 rounded-lg border-slate-200" onClick={() => void downloadInvoice(selected)}>تحميل الفاتورة PDF</Button>
                    <Button variant="outline" className="h-10 rounded-lg border-slate-200" onClick={() => selectedInstitution ? onOpenInstitution(selectedInstitution) : toast.info('لا توجد مؤسسة مرتبطة')}>فتح المؤسسة</Button>
                  </div>
                </div>
              </div>
            ) : <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">اختر اشتراكا من الجدول.</div>}
          </Panel>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <BillingChartCard title="الإيرادات الشهرية" rows={[{ label: 'الشهر الحالي', value: formatCurrency(stats.revenue) }, { label: 'مدفوع', value: formatNumber(subscriptions.filter((item) => item.paymentStatus === 'paid').length) }, { label: 'قيد التحصيل', value: formatNumber(stats.unpaid) }]} />
        <BillingChartCard title="توزيع الاشتراكات حسب الباقة" rows={planDistribution.map((item) => ({ label: item.plan, value: formatNumber(item.count) }))} />
        <BillingChartCard title="طرق الدفع" rows={paymentMethods.map((item) => ({ label: paymentMethodLabel(item.method), value: formatNumber(item.count) }))} />
      </section>

      {showSubscriptionModal && (
        <SubscriptionFormModal
          form={form}
          institutions={institutions}
          saving={savingBilling}
          isEdit={Boolean(form.id)}
          billingSchemaReady={billingSchemaReady}
          setForm={setForm}
          onClose={() => setShowSubscriptionModal(false)}
          onSave={() => void saveSubscription()}
        />
      )}

      {showRenewalModal && selected && (
        <RenewalModal
          subscription={selected}
          form={renewalForm}
          saving={savingBilling}
          setForm={setRenewalForm}
          onClose={() => setShowRenewalModal(false)}
          onSave={() => void renewSubscription()}
          formatDate={formatDate}
        />
      )}
    </section>
  );
}

const subscriptionStatuses: SubscriptionStatus[] = ['trial', 'active', 'expiring_soon', 'expired', 'suspended', 'cancelled'];
const paymentStatuses: PaymentStatus[] = ['paid', 'pending', 'unpaid', 'overdue', 'cancelled'];

function createEmptyBillingForm(institutionId = ''): BillingFormState {
  const startDate = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setFullYear(end.getFullYear() + 1);
  return {
    institutionId,
    planName: 'Professional',
    billingCycle: 'annual',
    price: '',
    currency: 'DZD',
    startDate,
    endDate: end.toISOString().slice(0, 10),
    maxUsers: '5000',
    maxTeachers: '250',
    paymentMethod: 'facture',
    paymentStatus: 'pending',
    notes: '',
  };
}

function createRenewalForm(subscription: BillingSubscription | null): RenewalFormState {
  const base = subscription?.endDate ? new Date(subscription.endDate) : new Date();
  base.setFullYear(base.getFullYear() + 1);
  return {
    newEndDate: base.toISOString().slice(0, 10),
    renewalPrice: subscription?.price ? String(subscription.price) : '',
    paymentStatus: 'pending',
    paymentMethod: subscription?.paymentMethod || 'facture',
    notes: '',
  };
}

function subscriptionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    trial: 'تجريبي',
    active: 'نشط',
    expiring_soon: 'قريب الانتهاء',
    expired: 'منتهي',
    suspended: 'موقوف',
    cancelled: 'ملغي',
  };
  return labels[status] || status;
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    paid: 'مدفوع',
    pending: 'قيد الانتظار',
    unpaid: 'غير مدفوع',
    overdue: 'متأخر',
    cancelled: 'ملغي',
  };
  return labels[status] || status;
}

function billingCycleLabel(cycle: string) {
  const labels: Record<string, string> = {
    monthly: 'شهري',
    semiannual: 'نصف سنوي',
    annual: 'سنوي',
  };
  return labels[cycle] || cycle;
}

function paymentMethodLabel(method: string | null | undefined) {
  const labels: Record<string, string> = {
    facture: 'فاتورة',
    purchase_order: 'Bon de commande',
    bank_transfer: 'تحويل بنكي',
    cheque: 'شيك',
    cash: 'نقدا',
  };
  return method ? labels[method] || method : 'غير محدد';
}

function subscriptionStatusClass(status: SubscriptionStatus) {
  if (status === 'active' || status === 'trial') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'expiring_soon') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (status === 'suspended') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function paymentStatusClass(status: PaymentStatus) {
  if (status === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'pending') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'unpaid' || status === 'overdue') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function BillingKpi({ label, value, trend, icon: Icon, tone }: { label: string; value: string; trend: string; icon: LucideIcon; tone: string }) {
  return (
    <article dir="rtl" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-[11px] font-bold text-emerald-600">{trend}</p>
        </div>
      </div>
    </article>
  );
}

function BillingChartCard({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  const maxValue = Math.max(...rows.map((row) => Number(String(row.value).replace(/[^\d]/g, '')) || 0), 1);
  return (
    <Panel title={title} icon={BarChart3}>
      <div className="space-y-3">
        {rows.map((row) => {
          const raw = Number(String(row.value).replace(/[^\d]/g, '')) || 0;
          return (
            <div key={row.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-700">{row.label}</span>
                <span className="text-slate-500">{row.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(6, Math.round((raw / maxValue) * 100))}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function SubscriptionFormModal({
  form,
  institutions,
  saving,
  isEdit,
  billingSchemaReady,
  setForm,
  onClose,
  onSave,
}: {
  form: BillingFormState;
  institutions: Institution[];
  saving: boolean;
  isEdit: boolean;
  billingSchemaReady: boolean;
  setForm: React.Dispatch<React.SetStateAction<BillingFormState>>;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">{isEdit ? 'تعديل الاشتراك' : 'إنشاء اشتراك جديد'}</h2>
            <p className="mt-1 text-sm text-slate-500">الفوترة اليدوية: فاتورة، bon de commande، تحويل بنكي، شيك أو نقدا.</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-4 p-5">
          {!billingSchemaReady && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">سيتم حفظ الحقول الأساسية فقط إلى أن يتم تطبيق migration v2.5.0.</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>المؤسسة</Label>
              <Select value={form.institutionId} onValueChange={(value) => setForm((current) => ({ ...current, institutionId: value }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue placeholder="اختر المؤسسة" /></SelectTrigger>
                <SelectContent>{institutions.map((institution) => <SelectItem key={institution.id} value={institution.id}>{institution.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الباقة</Label>
              <Select value={form.planName} onValueChange={(value) => setForm((current) => ({ ...current, planName: value }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Starter">Starter</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>دورة الدفع</Label>
              <Select value={form.billingCycle} onValueChange={(value) => setForm((current) => ({ ...current, billingCycle: value as BillingCycle }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">شهري</SelectItem>
                  <SelectItem value="semiannual">نصف سنوي</SelectItem>
                  <SelectItem value="annual">سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FieldInput label="السعر" value={form.price} onChange={(value) => setForm((current) => ({ ...current, price: value }))} type="number" />
            <FieldInput label="العملة" value={form.currency} onChange={(value) => setForm((current) => ({ ...current, currency: value }))} />
            <FieldInput label="تاريخ البداية" value={form.startDate} onChange={(value) => setForm((current) => ({ ...current, startDate: value }))} type="date" />
            <FieldInput label="تاريخ النهاية" value={form.endDate} onChange={(value) => setForm((current) => ({ ...current, endDate: value }))} type="date" />
            <FieldInput label="عدد المستخدمين المسموح" value={form.maxUsers} onChange={(value) => setForm((current) => ({ ...current, maxUsers: value }))} type="number" />
            <FieldInput label="عدد الأساتذة/المسؤولين" value={form.maxTeachers} onChange={(value) => setForm((current) => ({ ...current, maxTeachers: value }))} type="number" />
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={form.paymentMethod} onValueChange={(value) => setForm((current) => ({ ...current, paymentMethod: value }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facture">فاتورة</SelectItem>
                  <SelectItem value="purchase_order">Bon de commande</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="cheque">شيك</SelectItem>
                  <SelectItem value="cash">نقدا</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>حالة الدفع</Label>
              <Select value={form.paymentStatus} onValueChange={(value) => setForm((current) => ({ ...current, paymentStatus: value as PaymentStatus }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{paymentStatuses.map((status) => <SelectItem key={status} value={status}>{paymentStatusLabel(status)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-24 rounded-lg border-slate-200" />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>إلغاء</Button>
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={onSave}>{saving ? 'جاري الحفظ...' : 'حفظ الاشتراك'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RenewalModal({ subscription, form, saving, setForm, onClose, onSave, formatDate }: {
  subscription: BillingSubscription;
  form: RenewalFormState;
  saving: boolean;
  setForm: React.Dispatch<React.SetStateAction<RenewalFormState>>;
  onClose: () => void;
  onSave: () => void;
  formatDate: (value: string | null | undefined) => string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">تجديد الاشتراك</h2>
            <p className="mt-1 text-sm text-slate-500">النهاية الحالية: {formatDate(subscription.endDate)}</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-4 p-5">
          <FieldInput label="تاريخ النهاية الجديد" value={form.newEndDate} onChange={(value) => setForm((current) => ({ ...current, newEndDate: value }))} type="date" />
          <FieldInput label="سعر التجديد" value={form.renewalPrice} onChange={(value) => setForm((current) => ({ ...current, renewalPrice: value }))} type="number" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>حالة الدفع</Label>
              <Select value={form.paymentStatus} onValueChange={(value) => setForm((current) => ({ ...current, paymentStatus: value as PaymentStatus }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{paymentStatuses.map((status) => <SelectItem key={status} value={status}>{paymentStatusLabel(status)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={form.paymentMethod} onValueChange={(value) => setForm((current) => ({ ...current, paymentMethod: value }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facture">فاتورة</SelectItem>
                  <SelectItem value="purchase_order">Bon de commande</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="cheque">شيك</SelectItem>
                  <SelectItem value="cash">نقدا</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-20 rounded-lg border-slate-200" />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>إلغاء</Button>
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={onSave}>{saving ? 'جاري التجديد...' : 'تأكيد التجديد'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border-slate-200 bg-white" />
    </div>
  );
}

function OwnerReportsAnalyticsPage({
  institutions,
  searchQuery,
  setSearchQuery,
  formatNumber,
  formatDate,
  getTypeLabel,
  getTypeIcon,
  onOpenInstitution,
}: {
  institutions: Institution[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  onOpenInstitution: (inst: Institution) => void;
}) {
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>(() => createEmptyAnalyticsSnapshot());
  const [rangePreset, setRangePreset] = useState<AnalyticsRangePreset>('30d');
  const [sectorFilter, setSectorFilter] = useState<SectorId>('all');
  const [wilayaFilter, setWilayaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState<'attendance_desc' | 'attendance_asc' | 'activity_desc' | 'activity_asc'>('attendance_desc');
  const [page, setPage] = useState(1);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState<CustomReportForm>(() => createDefaultReportForm());
  const pageSize = 6;

  const range = useMemo(() => buildAnalyticsRange(rangePreset), [rangePreset]);
  const institutionKey = useMemo(() => institutions.map((institution) => institution.id).sort().join('|'), [institutions]);

  useEffect(() => {
    let active = true;

    const loadAnalytics = async () => {
      setLoadingAnalytics(true);
      try {
        const [studentsResponse, adminsResponse, sessionsResponse, attendancesResponse, devicesResponse, subscriptionsResponse] = await Promise.all([
          supabase.from('students').select('id, institution_id, created_at').limit(10000),
          supabase.from('admins').select('id, institution_id, created_at').limit(10000),
          supabase.from('sessions').select('id, institution_id, created_at, status').gte('created_at', range.startIso).limit(10000),
          supabase.from('attendances').select('id, institution_id, session_id, created_at').gte('created_at', range.startIso).limit(10000),
          supabase.from('student_devices').select('id, institution_id, is_active, last_used').limit(10000),
          supabase.from('subscriptions').select('id, institution_id, status, end_date, current_period_end, price, payment_status, currency').limit(10000),
        ]);

        if (studentsResponse.error) throw studentsResponse.error;
        if (adminsResponse.error) throw adminsResponse.error;
        if (sessionsResponse.error) throw sessionsResponse.error;
        if (attendancesResponse.error) throw attendancesResponse.error;
        if (devicesResponse.error) throw devicesResponse.error;

        const students = (studentsResponse.data || []) as AnalyticsStudentRow[];
        const admins = (adminsResponse.data || []) as AnalyticsAdminDataRow[];
        const sessions = (sessionsResponse.data || []) as AnalyticsSessionDataRow[];
        const attendances = (attendancesResponse.data || []) as AnalyticsAttendanceDataRow[];
        const devices = (devicesResponse.data || []) as AnalyticsDeviceDataRow[];
        const subscriptions = subscriptionsResponse.error ? [] : ((subscriptionsResponse.data || []) as SubscriptionDbRow[]);

        const rows = institutions.map((institution) => {
          const institutionStudents = students.filter((row) => row.institution_id === institution.id);
          const institutionAdmins = admins.filter((row) => row.institution_id === institution.id);
          const institutionSessions = sessions.filter((row) => row.institution_id === institution.id);
          const institutionAttendances = attendances.filter((row) => row.institution_id === institution.id);
          const institutionDevices = devices.filter((row) => row.institution_id === institution.id);
          const subscription = subscriptions.find((row) => row.institution_id === institution.id);
          const expected = institutionStudents.length * institutionSessions.length;
          const attendanceRate = expected > 0 ? Math.min(100, Math.round((institutionAttendances.length / expected) * 1000) / 10) : null;
          const absenceCount = expected > 0 ? Math.max(0, expected - institutionAttendances.length) : null;
          const lastActivity = [
            ...institutionSessions.map((row) => row.created_at || null),
            ...institutionAttendances.map((row) => row.created_at || null),
            ...institutionDevices.map((row) => row.last_used || null),
          ].filter(Boolean).sort().reverse()[0] || institution.created_at || null;

          return {
            institution,
            institutionName: institution.name,
            institutionType: normalizeInstitutionType(institution.type),
            wilaya: institution.wilaya || 'غير محددة',
            userCount: institutionStudents.length + institutionAdmins.length,
            sessionCount: institutionSessions.length,
            attendanceCount: institutionAttendances.length,
            attendanceRate,
            absenceCount,
            deviceCount: institutionDevices.length,
            subscriptionStatus: subscription ? normalizeSubscriptionStatus(subscription.status, subscription.end_date || subscription.current_period_end || null) : null,
            lastActivity,
          };
        });

        const totalExpected = students.length * sessions.length;
        const sectorRows = (['military', 'school', 'primary_school', 'secondary_school', 'training', 'company'] as ClientInstitutionType[]).map((sector) => {
          const sectorInstitutionIds = new Set(institutions.filter((institution) => normalizeInstitutionType(institution.type) === sector).map((institution) => institution.id));
          const sectorUsers = students.filter((row) => row.institution_id && sectorInstitutionIds.has(row.institution_id)).length + admins.filter((row) => row.institution_id && sectorInstitutionIds.has(row.institution_id)).length;
          const sectorStudents = students.filter((row) => row.institution_id && sectorInstitutionIds.has(row.institution_id)).length;
          const sectorSessions = sessions.filter((row) => row.institution_id && sectorInstitutionIds.has(row.institution_id)).length;
          const sectorAttendances = attendances.filter((row) => row.institution_id && sectorInstitutionIds.has(row.institution_id)).length;
          const sectorExpected = sectorStudents * sectorSessions;
          return {
            id: sector,
            label: getTypeLabel(sector),
            count: sectorInstitutionIds.size,
            userCount: sectorUsers,
            sessionCount: sectorSessions,
            attendanceCount: sectorAttendances,
            attendanceRate: sectorExpected > 0 ? Math.min(100, Math.round((sectorAttendances / sectorExpected) * 1000) / 10) : null,
          };
        });

        const activeSubscriptions = subscriptions.length > 0 ? subscriptions.filter((row) => {
          const status = normalizeSubscriptionStatus(row.status, row.end_date || row.current_period_end || null);
          return status === 'active' || status === 'trial' || status === 'expiring_soon';
        }).length : null;

        const nextSnapshot: AnalyticsSnapshot = {
          userCount: students.length + admins.length,
          studentCount: students.length,
          adminCount: admins.length,
          sessionCount: sessions.length,
          attendanceCount: attendances.length,
          attendanceRate: totalExpected > 0 ? Math.min(100, Math.round((attendances.length / totalExpected) * 1000) / 10) : null,
          absenceCount: totalExpected > 0 ? Math.max(0, totalExpected - attendances.length) : null,
          deviceCount: devices.length,
          activeSubscriptions,
          expectedRevenue: subscriptions.length > 0 ? subscriptions.reduce((sum, row) => sum + (Number(row.price || 0) || 0), 0) : null,
          rejectedAttempts: null,
          suspiciousAttempts: null,
          trend: buildAnalyticsTrend(sessions, attendances, students.length),
          sectors: sectorRows,
          institutions: rows,
        };

        if (active) {
          setSnapshot(nextSnapshot);
          setSelectedInstitutionId((current) => (current && rows.some((row) => row.institution.id === current) ? current : rows[0]?.institution.id || null));
        }
      } catch (error) {
        if (active) {
          toast.error(getErrorMessage(error, 'تعذر تحميل بيانات التقارير والتحليلات'));
          setSnapshot(createEmptyAnalyticsSnapshot());
        }
      } finally {
        if (active) setLoadingAnalytics(false);
      }
    };

    void loadAnalytics();
    return () => {
      active = false;
    };
  }, [institutionKey, institutions, range.startIso]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows = snapshot.institutions.filter((row) => {
      const matchesQuery = !query || [row.institutionName, row.wilaya, getTypeLabel(row.institutionType)].some((value) => value.toLowerCase().includes(query));
      const matchesSector = sectorFilter === 'all' || row.institutionType === sectorFilter;
      const matchesWilaya = wilayaFilter === 'all' || row.wilaya === wilayaFilter;
      const normalizedStatus = row.institution.status || 'active';
      const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter || row.subscriptionStatus === statusFilter;
      return matchesQuery && matchesSector && matchesWilaya && matchesStatus;
    });

    return [...rows].sort((a, b) => {
      if (sortMode === 'attendance_asc') return (a.attendanceRate ?? -1) - (b.attendanceRate ?? -1);
      if (sortMode === 'attendance_desc') return (b.attendanceRate ?? -1) - (a.attendanceRate ?? -1);
      const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return sortMode === 'activity_asc' ? aTime - bTime : bTime - aTime;
    });
  }, [getTypeLabel, searchQuery, sectorFilter, snapshot.institutions, sortMode, statusFilter, wilayaFilter]);

  useEffect(() => {
    setPage(1);
  }, [rangePreset, searchQuery, sectorFilter, sortMode, statusFilter, wilayaFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);
  const selectedRow = filteredRows.find((row) => row.institution.id === selectedInstitutionId) || filteredRows[0] || null;
  const wilayas = useMemo(() => Array.from(new Set(snapshot.institutions.map((row) => row.wilaya).filter(Boolean))).sort(), [snapshot.institutions]);

  const exportPdf = async (title: string, rows: AnalyticsInstitutionRow[] = filteredRows) => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Ausar Military Reports & Analytics', 20, 20);
    doc.setFontSize(11);
    doc.text(title, 20, 32);
    doc.text(`Range: ${range.label}`, 20, 42);
    doc.text(`Institutions: ${rows.length}`, 20, 52);
    rows.slice(0, 12).forEach((row, index) => {
      const y = 66 + index * 9;
      doc.text(`${index + 1}. ${row.institutionName} | ${getTypeLabel(row.institutionType)} | users ${row.userCount} | sessions ${row.sessionCount} | rate ${formatAnalyticsPercent(row.attendanceRate)}`, 20, y);
    });
    doc.save(`Ausar Military-analytics-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('تم تصدير تقرير PDF');
  };

  const exportExcel = async (title: string, rows: AnalyticsInstitutionRow[] = filteredRows) => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reports Analytics');
    worksheet.addRow(['Ausar Military', title, range.label]);
    worksheet.addRow([]);
    worksheet.addRow(['المؤسسة', 'القطاع', 'الولاية', 'عدد المستخدمين', 'جلسات الحضور', 'نسبة الحضور', 'الغيابات', 'الأجهزة', 'حالة الاشتراك', 'آخر نشاط']);
    rows.forEach((row) => {
      worksheet.addRow([
        row.institutionName,
        getTypeLabel(row.institutionType),
        row.wilaya,
        row.userCount,
        row.sessionCount,
        formatAnalyticsPercent(row.attendanceRate),
        row.absenceCount === null ? 'غير متوفر حالياً' : row.absenceCount,
        row.deviceCount,
        row.subscriptionStatus ? subscriptionStatusLabel(row.subscriptionStatus) : 'غير متوفر حالياً',
        formatDate(row.lastActivity),
      ]);
    });
    worksheet.columns.forEach((column) => {
      column.width = 22;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBrowserBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Ausar Military-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('تم تصدير ملف Excel');
  };

  const openCustomReport = (reportType: AnalyticsReportType = 'attendance') => {
    setReportForm((current) => ({ ...current, reportType, sector: sectorFilter, rangePreset }));
    setShowReportModal(true);
  };

  const reportRows = filterRowsForReport(snapshot.institutions, reportForm);

  return (
    <section className="space-y-5" dir="rtl">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>الرئيسية</span>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>التقارير والتحليلات</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">التقارير والتحليلات</h1>
          <p className="mt-1 text-sm text-slate-500">رؤية شاملة لأداء المنصة، الحضور، المؤسسات، المستخدمين، والأمان</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={rangePreset} onValueChange={(value) => setRangePreset(value as AnalyticsRangePreset)}>
            <SelectTrigger className="h-10 w-40 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="7d">آخر 7 أيام</SelectItem>
              <SelectItem value="30d">آخر 30 يوم</SelectItem>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="year">هذه السنة</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => void exportPdf('Global analytics report')}>
            <FileText className="ml-2 h-4 w-4" />
            تصدير تقرير PDF
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => void exportExcel('Global analytics report')}>
            <Download className="ml-2 h-4 w-4" />
            تصدير Excel
          </Button>
          <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => openCustomReport()}>
            <Plus className="ml-2 h-4 w-4" />
            إنشاء تقرير مخصص
          </Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpi label="إجمالي المؤسسات" value={formatNumber(institutions.length)} trend={`${range.label}`} icon={Building2} tone="bg-blue-50 text-blue-700" helper="كل القطاعات المسجلة" />
        <AnalyticsKpi label="إجمالي المستخدمين" value={formatNumber(snapshot.userCount)} trend={`${formatNumber(snapshot.studentCount)} طالب / ${formatNumber(snapshot.adminCount)} مسؤول`} icon={Users} tone="bg-cyan-50 text-cyan-700" helper="طلاب، أساتذة وإداريون" />
        <AnalyticsKpi label="إجمالي جلسات الحضور" value={formatNumber(snapshot.sessionCount)} trend={range.label} icon={Clock} tone="bg-violet-50 text-violet-700" helper="حسب الفترة المختارة" />
        <AnalyticsKpi label="متوسط نسبة الحضور" value={formatAnalyticsPercent(snapshot.attendanceRate)} trend={snapshot.attendanceRate === null ? 'غير متوفر حالياً' : 'محسوبة من الحضور المتوقع'} icon={TrendingUp} tone="bg-emerald-50 text-emerald-700" helper="حضور مؤكد / حضور متوقع" />
        <AnalyticsKpi label="الغيابات المسجلة" value={snapshot.absenceCount === null ? 'غير متوفر حالياً' : formatNumber(snapshot.absenceCount)} trend={snapshot.absenceCount === null ? 'تحتاج بيانات متوقعة أكثر' : range.label} icon={PauseCircle} tone="bg-rose-50 text-rose-700" helper="محسوبة عند توفر جلسات وطلبة" />
        <AnalyticsKpi label="الأجهزة المرتبطة" value={formatNumber(snapshot.deviceCount)} trend="من قاعدة student_devices" icon={Smartphone} tone="bg-indigo-50 text-indigo-700" helper="أجهزة التحقق المسجلة" />
        <AnalyticsKpi label="محاولات مرفوضة / مشبوهة" value="غير متوفر حالياً" trend="لم يتم العثور على سجل أمان مخصص" icon={ShieldCheck} tone="bg-orange-50 text-orange-700" helper="جاهزة للربط عند توفر البيانات" />
        <AnalyticsKpi label="الاشتراكات النشطة" value={snapshot.activeSubscriptions === null ? 'غير متوفر حالياً' : formatNumber(snapshot.activeSubscriptions)} trend={snapshot.expectedRevenue === null ? 'بيانات الفوترة غير متاحة' : formatCurrency(snapshot.expectedRevenue, 'DZD')} icon={CreditCard} tone="bg-sky-50 text-sky-700" helper="من جدول subscriptions عند توفره" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsTrendCard title="اتجاه الحضور عبر الزمن" rows={snapshot.trend} metric="attendance" emptyText="لا توجد بيانات حضور كافية خلال هذه الفترة" />
          <AnalyticsTrendCard title="تطور الغيابات" rows={snapshot.trend} metric="absences" emptyText="لا توجد بيانات كافية لحساب الغيابات" />
          <AnalyticsSectorCard title="توزيع المؤسسات حسب القطاع" rows={snapshot.sectors} mode="count" />
          <AnalyticsSectorCard title="نسبة الحضور حسب القطاع" rows={snapshot.sectors} mode="attendance" />
        </div>
        <Panel title="تحليلات الأجهزة والأمان" icon={ShieldCheck}>
          <div className="space-y-4">
            <SecurityMetric label="الأجهزة المرتبطة" value={formatNumber(snapshot.deviceCount)} tone="bg-blue-600" />
            <SecurityMetric label="المحاولات المرفوضة" value="غير متوفر حالياً" tone="bg-orange-500" />
            <SecurityMetric label="محاولات أجهزة مكررة" value="غير متوفر حالياً" tone="bg-rose-500" />
            <SecurityMetric label="محاولات مشبوهة" value="غير متوفر حالياً" tone="bg-violet-500" />
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              مؤشرات الأمان المتقدمة تحتاج جدول أحداث أمان مخصص. لم يتم إنشاء جدول جديد ولم يتم تغيير RLS.
            </div>
          </div>
        </Panel>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="أداء المؤسسات" icon={BarChart3}>
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_150px_160px_170px]">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-10 rounded-lg border-slate-200 bg-white pr-9" placeholder="ابحث عن مؤسسة..." />
            </div>
            <Select value={sectorFilter} onValueChange={(value) => setSectorFilter(value as SectorId)}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل القطاعات</SelectItem>
                <SelectItem value="university">جامعات</SelectItem>
                <SelectItem value="school">مؤسسات تربوية</SelectItem>
                <SelectItem value="primary_school">مدارس ابتدائية</SelectItem>
                <SelectItem value="training">مراكز تكوين</SelectItem>
                <SelectItem value="company">شركات</SelectItem>
              </SelectContent>
            </Select>
            <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الولايات</SelectItem>
                {wilayas.map((wilaya) => <SelectItem key={wilaya} value={wilaya}>{wilaya}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="active">نشطة</SelectItem>
                <SelectItem value="suspended">موقوفة</SelectItem>
                <SelectItem value="expired">منتهية</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="attendance_desc">الأعلى حضوراً</SelectItem>
                <SelectItem value="attendance_asc">الأقل حضوراً</SelectItem>
                <SelectItem value="activity_desc">آخر نشاط أولاً</SelectItem>
                <SelectItem value="activity_asc">الأقدم نشاطاً</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] text-right text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50 text-xs font-bold text-slate-500">
                  <th className="px-3 py-3">المؤسسة</th>
                  <th className="px-3 py-3">القطاع</th>
                  <th className="px-3 py-3">الولاية</th>
                  <th className="px-3 py-3">عدد المستخدمين</th>
                  <th className="px-3 py-3">جلسات الحضور</th>
                  <th className="px-3 py-3">نسبة الحضور</th>
                  <th className="px-3 py-3">الغيابات</th>
                  <th className="px-3 py-3">الأجهزة</th>
                  <th className="px-3 py-3">حالة الاشتراك</th>
                  <th className="px-3 py-3">آخر نشاط</th>
                  <th className="px-3 py-3">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingAnalytics ? (
                  <tr><td colSpan={11} className="px-3 py-8 text-center font-semibold text-slate-500">جاري تحميل التحليلات...</td></tr>
                ) : visibleRows.length === 0 ? (
                  <tr><td colSpan={11} className="px-3 py-8 text-center font-semibold text-slate-500">لا توجد بيانات كافية بعد</td></tr>
                ) : visibleRows.map((row) => (
                  <tr key={row.institution.id} className={`hover:bg-blue-50/40 ${selectedInstitutionId === row.institution.id ? 'bg-blue-50/60' : ''}`}>
                    <td className="px-3 py-3 font-black text-slate-950">{row.institutionName}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{getTypeIcon(row.institutionType, 'h-3.5 w-3.5')} {getTypeLabel(row.institutionType)}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{row.wilaya}</td>
                    <td className="px-3 py-3 font-bold text-slate-800">{formatNumber(row.userCount)}</td>
                    <td className="px-3 py-3 font-bold text-slate-800">{formatNumber(row.sessionCount)}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${analyticsRateClass(row.attendanceRate)}`}>{formatAnalyticsPercent(row.attendanceRate)}</span></td>
                    <td className="px-3 py-3">{row.absenceCount === null ? <span className="text-xs font-semibold text-slate-400">غير متوفر</span> : formatNumber(row.absenceCount)}</td>
                    <td className="px-3 py-3 font-bold text-slate-800">{formatNumber(row.deviceCount)}</td>
                    <td className="px-3 py-3">{row.subscriptionStatus ? <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${subscriptionStatusClass(row.subscriptionStatus)}`}>{subscriptionStatusLabel(row.subscriptionStatus)}</span> : <span className="text-xs font-semibold text-slate-400">غير متوفر</span>}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(row.lastActivity)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 rounded-lg border-slate-200" onClick={() => onOpenInstitution(row.institution)}>فتح ملف المؤسسة</Button>
                        <Button size="sm" variant="outline" className="h-8 rounded-lg border-slate-200" onClick={() => void exportPdf(`Institution report: ${row.institutionName}`, [row])}>تحميل تقرير المؤسسة</Button>
                        <Button size="sm" className="h-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => setSelectedInstitutionId(row.institution.id)}>عرض التفاصيل</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <span>عرض {visibleRows.length} من {formatNumber(filteredRows.length)} مؤسسة</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="rounded-lg border-slate-200" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>السابق</Button>
              <span className="font-bold text-slate-700">{Math.min(page, totalPages)} / {totalPages}</span>
              <Button size="sm" variant="outline" className="rounded-lg border-slate-200" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>التالي</Button>
            </div>
          </div>
        </Panel>

        <Panel title="تفاصيل المؤسسة" icon={Eye}>
          {selectedRow ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">{getTypeLabel(selectedRow.institutionType)}</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{selectedRow.institutionName}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedRow.wilaya} - {selectedRow.institution.city || 'غير محددة'}</p>
              </div>
              <DetailPill label="عدد المستخدمين" value={formatNumber(selectedRow.userCount)} />
              <DetailPill label="جلسات الحضور" value={formatNumber(selectedRow.sessionCount)} />
              <DetailPill label="نسبة الحضور" value={formatAnalyticsPercent(selectedRow.attendanceRate)} />
              <DetailPill label="الغيابات" value={selectedRow.absenceCount === null ? 'غير متوفر حالياً' : formatNumber(selectedRow.absenceCount)} />
              <DetailPill label="الأجهزة المرتبطة" value={formatNumber(selectedRow.deviceCount)} />
              <DetailPill label="حالة الاشتراك" value={selectedRow.subscriptionStatus ? subscriptionStatusLabel(selectedRow.subscriptionStatus) : 'غير متوفر حالياً'} />
              <div className="grid gap-2">
                <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => onOpenInstitution(selectedRow.institution)}>
                  <Eye className="ml-2 h-4 w-4" />
                  فتح ملف المؤسسة
                </Button>
                <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => void exportPdf(`Institution report: ${selectedRow.institutionName}`, [selectedRow])}>
                  <FileText className="ml-2 h-4 w-4" />
                  تحميل تقرير PDF
                </Button>
                <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => void exportExcel(`Institution report: ${selectedRow.institutionName}`, [selectedRow])}>
                  <Download className="ml-2 h-4 w-4" />
                  تحميل Excel
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500">اختر مؤسسة لعرض التفاصيل</div>
          )}
        </Panel>
      </section>

      <Panel title="مركز التقارير" icon={FileText}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {analyticsReportCards.map((card) => (
            <article key={card.type} className="flex min-h-[210px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${card.tone}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="font-black text-slate-950">{card.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{card.description}</p>
              <div className="mt-4 grid gap-2">
                <Button size="sm" className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => openCustomReport(card.type)}>إنشاء التقرير</Button>
                <Button size="sm" variant="outline" className="rounded-lg border-slate-200" onClick={() => void exportPdf(card.title)}>تصدير PDF</Button>
                <Button size="sm" variant="outline" className="rounded-lg border-slate-200" onClick={() => void exportExcel(card.title)}>تصدير Excel</Button>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      {showReportModal && (
        <CustomReportModal
          form={reportForm}
          institutions={institutions}
          rows={reportRows}
          setForm={setReportForm}
          onClose={() => setShowReportModal(false)}
          onPreview={() => toast.info(`معاينة التقرير جاهزة: ${reportRows.length} مؤسسة ضمن النطاق المحدد`)}
          onPdf={() => void exportPdf('Custom report', reportRows)}
          onExcel={() => void exportExcel('Custom report', reportRows)}
        />
      )}
    </section>
  );
}

function OwnerNotificationsPage({
  institutions,
  unreadCount,
  searchQuery,
  setSearchQuery,
  formatNumber,
  formatDate,
  getTypeLabel,
  getTypeIcon,
  onOpenInstitution,
  onOpenBilling,
  onUnreadCountChange,
  onRefreshBadge,
}: {
  institutions: Institution[];
  unreadCount: number;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  onOpenInstitution: (inst: Institution) => void;
  onOpenBilling: () => void;
  onUnreadCountChange: (count: number) => void;
  onRefreshBadge: () => void;
}) {
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationCategory>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | NotificationPriority>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | NotificationStatus>('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d' | 'month' | 'custom'>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'priority' | 'unread'>('newest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsDialogId, setDetailsDialogId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ kind: 'archive' | 'delete' | 'delete-read'; notification?: OwnerNotification } | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>(() => ({
    security: true,
    attendance: true,
    subscription: true,
    report: true,
    system: true,
    emailOwner: false,
    inApp: true,
  }));
  const pageSize = 10;
  const [page, setPage] = useState(1);

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const snapshot = await loadOwnerNotificationsSnapshot(institutions);
      setSchemaReady(snapshot.storedSchemaReady);
      setNotifications(snapshot.notifications);
      const nextUnread = snapshot.notifications.filter((item) => item.status === 'unread').length;
      onUnreadCountChange(nextUnread);
      setSelectedId((current) => current && snapshot.notifications.some((item) => item.id === current) ? current : snapshot.notifications[0]?.id || null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحميل الإشعارات'));
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [institutions]);

  const filteredNotifications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const range = getNotificationDateRange(dateFilter, customFrom, customTo);
    return notifications.filter((item) => {
      const matchesQuery = !query || [item.title, item.message, item.institutionName || '', item.actorName || ''].some((value) => value.toLowerCase().includes(query));
      const matchesCategory = activeCategory === 'all' || (activeCategory === 'unread' ? item.status === 'unread' : item.category === activeCategory);
      const matchesType = typeFilter === 'all' || item.category === typeFilter;
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesInstitution = institutionFilter === 'all' || item.institutionId === institutionFilter;
      const createdAt = new Date(item.createdAt).getTime();
      const matchesDate = (!range.from || createdAt >= range.from.getTime()) && (!range.to || createdAt <= range.to.getTime());
      return matchesQuery && matchesCategory && matchesType && matchesPriority && matchesStatus && matchesInstitution && matchesDate;
    }).sort((a, b) => {
      if (sortMode === 'priority') return notificationPriorityWeight(b.priority) - notificationPriorityWeight(a.priority);
      if (sortMode === 'unread') return Number(b.status === 'unread') - Number(a.status === 'unread') || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortMode === 'oldest'
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeCategory, customFrom, customTo, dateFilter, institutionFilter, notifications, priorityFilter, searchQuery, sortMode, statusFilter, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, dateFilter, institutionFilter, priorityFilter, searchQuery, sortMode, statusFilter, typeFilter]);

  useEffect(() => {
    setSelectedId((current) => current && filteredNotifications.some((item) => item.id === current) ? current : filteredNotifications[0]?.id || null);
  }, [filteredNotifications]);

  const selected = filteredNotifications.find((item) => item.id === selectedId) || filteredNotifications[0] || null;
  const detailsDialogNotification = notifications.find((item) => item.id === detailsDialogId) || null;
  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
  const visibleRows = filteredNotifications.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);
  const stats = buildNotificationStats(notifications);

  const patchDerivedNotification = (notification: OwnerNotification, patch: NotificationLocalPatch) => {
    const overrides = readNotificationOverrides();
    const next = { ...overrides, [notification.id]: { ...overrides[notification.id], ...patch } };
    writeNotificationOverrides(next);
    setNotifications((current) => applyNotificationOverrides(current));
  };

  const updateNotificationStatus = async (notification: OwnerNotification, status: NotificationStatus) => {
    const now = new Date().toISOString();
    if (notification.source === 'stored' && schemaReady) {
      const payload: Record<string, unknown> = {
        status,
        read_at: status === 'read' ? now : status === 'unread' ? null : notification.readAt,
        archived_at: status === 'archived' ? now : null,
      };
      const { error } = await supabase.from('notifications').update(payload).eq('id', notification.id);
      if (error) throw error;
      await loadNotifications();
    } else {
      patchDerivedNotification(notification, {
        status,
        readAt: status === 'read' ? now : status === 'unread' ? null : notification.readAt,
        archivedAt: status === 'archived' ? now : null,
      });
      onRefreshBadge();
    }
  };

  const deleteNotification = async (notification: OwnerNotification) => {
    if (notification.source === 'stored' && schemaReady) {
      const { error } = await supabase.from('notifications').delete().eq('id', notification.id);
      if (error) throw error;
      await loadNotifications();
    } else {
      patchDerivedNotification(notification, { hidden: true });
      onRefreshBadge();
    }
    toast.success('تم حذف الإشعار');
  };

  const markAllRead = async () => {
    const now = new Date().toISOString();
    if (schemaReady) {
      const { error } = await supabase.from('notifications').update({ status: 'read', read_at: now, archived_at: null }).eq('status', 'unread');
      if (error) throw error;
    }
    const overrides = readNotificationOverrides();
    notifications.filter((item) => item.source === 'derived' && item.status === 'unread').forEach((item) => {
      overrides[item.id] = { ...overrides[item.id], status: 'read', readAt: now };
    });
    writeNotificationOverrides(overrides);
    await loadNotifications();
    toast.success('تم تحديد كل الإشعارات كمقروءة');
  };

  const deleteReadNotifications = async () => {
    if (schemaReady) {
      const { error } = await supabase.from('notifications').delete().eq('status', 'read');
      if (error) throw error;
    }
    const overrides = readNotificationOverrides();
    notifications.filter((item) => item.source === 'derived' && item.status === 'read').forEach((item) => {
      overrides[item.id] = { ...overrides[item.id], hidden: true };
    });
    writeNotificationOverrides(overrides);
    await loadNotifications();
    toast.success('تم حذف الإشعارات المقروءة');
  };

  const openLinkedRecord = (notification: OwnerNotification | null) => {
    if (!notification) return;
    if (notification.institutionId) {
      const institution = institutions.find((item) => item.id === notification.institutionId);
      if (institution) {
        onOpenInstitution(institution);
        return;
      }
    }
    if (notification.linkedRecordType === 'subscription') {
      onOpenBilling();
      return;
    }
    if (typeof notification.metadata.report_url === 'string') {
      window.open(notification.metadata.report_url, '_blank', 'noopener,noreferrer');
      return;
    }
    toast.info('لا يوجد سجل مرتبط قابل للفتح حالياً');
  };

  const exportNotificationsExcel = async () => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Notifications');
    worksheet.addRow(['Ausar Military', 'Notifications Center', new Date().toISOString()]);
    worksheet.addRow([]);
    worksheet.addRow(['العنوان', 'النوع', 'الأولوية', 'الحالة', 'المؤسسة', 'القطاع', 'التاريخ', 'الوصف']);
    filteredNotifications.forEach((item) => worksheet.addRow([
      item.title,
      notificationCategoryLabel(item.category),
      notificationPriorityLabel(item.priority),
      notificationStatusLabel(item.status),
      item.institutionName || 'غير متوفر',
      item.institutionType ? getTypeLabel(item.institutionType) : 'غير متوفر',
      formatDate(item.createdAt),
      item.message,
    ]));
    worksheet.columns.forEach((column) => { column.width = 24; });
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBrowserBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Ausar Military-notifications-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('تم تصدير الإشعارات Excel');
  };

  const exportNotificationsPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Ausar Military Notifications Center', 20, 20);
    doc.setFontSize(11);
    doc.text(`Total: ${filteredNotifications.length} / Unread: ${unreadCount}`, 20, 35);
    filteredNotifications.slice(0, 14).forEach((item, index) => {
      doc.text(`${index + 1}. ${item.title} | ${notificationCategoryLabel(item.category)} | ${notificationPriorityLabel(item.priority)} | ${formatDate(item.createdAt)}`, 20, 50 + index * 9);
    });
    doc.save(`Ausar Military-notifications-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('تم تصدير الإشعارات PDF');
  };

  return (
    <section className="space-y-5" dir="rtl">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>الرئيسية</span>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>الإشعارات</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">الإشعارات</h1>
          <p className="mt-1 text-sm text-slate-500">متابعة التنبيهات المهمة حول الأمان، الحضور، الاشتراكات ونشاط المنصة</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => void markAllRead()}>
            <Check className="ml-2 h-4 w-4" />
            تحديد الكل كمقروء
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => setConfirmAction({ kind: 'delete-read' })}>
            <Trash2 className="ml-2 h-4 w-4" />
            حذف المقروء
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => setSettingsOpen(true)}>
            <Settings className="ml-2 h-4 w-4" />
            إعدادات الإشعارات
          </Button>
          <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => void loadNotifications()}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <NotificationKpi label="إجمالي الإشعارات" value={formatNumber(stats.total)} helper="كل التنبيهات النشطة" icon={Bell} tone="bg-blue-50 text-blue-700" />
        <NotificationKpi label="غير مقروءة" value={formatNumber(stats.unread)} helper="تحتاج مراجعة" icon={Mail} tone="bg-indigo-50 text-indigo-700" />
        <NotificationKpi label="تنبيهات أمنية" value={formatNumber(stats.security)} helper="محاولات ومخاطر" icon={ShieldCheck} tone="bg-rose-50 text-rose-700" />
        <NotificationKpi label="اشتراكات قريبة من الانتهاء" value={formatNumber(stats.expiringSubscriptions)} helper="خلال 15 يوماً" icon={CreditCard} tone="bg-orange-50 text-orange-700" />
        <NotificationKpi label="تقارير جاهزة" value={formatNumber(stats.reports)} helper="من السجلات المتاحة" icon={FileText} tone="bg-violet-50 text-violet-700" />
        <NotificationKpi label="نشاط حضور اليوم" value={formatNumber(stats.todayAttendance)} helper="جلسات/حضور اليوم" icon={Activity} tone="bg-emerald-50 text-emerald-700" />
      </div>

      {!schemaReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          جدول notifications غير مطبق بعد. الصفحة تعرض التنبيهات المشتقة من البيانات الحالية، وعمليات الإشعارات المخزنة ستعمل بعد تطبيق migration v2.5.2.
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="مركز مراقبة الإشعارات" icon={Bell}>
          <div className="mb-4 flex flex-wrap gap-2">
            {notificationTabs.map((tab) => (
              <Button key={tab.id} size="sm" variant={activeCategory === tab.id ? 'default' : 'outline'} className={`rounded-lg ${activeCategory === tab.id ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border-slate-200 bg-white'}`} onClick={() => setActiveCategory(tab.id)}>
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_130px_130px_130px_160px_150px]">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-10 rounded-lg border-slate-200 bg-white pr-9" placeholder="ابحث في الإشعارات..." />
            </div>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as NotificationCategory)}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{notificationTabs.filter((tab) => tab.id !== 'unread').map((tab) => <SelectItem key={tab.id} value={tab.id}>{tab.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as typeof priorityFilter)}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأولويات</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="low">منخفضة</SelectItem>
                <SelectItem value="info">معلومة</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="unread">غير مقروءة</SelectItem>
                <SelectItem value="read">مقروءة</SelectItem>
                <SelectItem value="archived">مؤرشفة</SelectItem>
              </SelectContent>
            </Select>
            <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المؤسسات</SelectItem>
                {institutions.map((institution) => <SelectItem key={institution.id} value={institution.id}>{institution.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
              <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">الأحدث أولاً</SelectItem>
                <SelectItem value="oldest">الأقدم أولاً</SelectItem>
                <SelectItem value="priority">الأعلى أولوية</SelectItem>
                <SelectItem value="unread">غير المقروءة أولاً</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as typeof dateFilter)}>
              <SelectTrigger className="h-10 w-44 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="7d">آخر 7 أيام</SelectItem>
                <SelectItem value="30d">آخر 30 يوم</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
                <SelectItem value="custom">مخصص</SelectItem>
                <SelectItem value="all">كل التواريخ</SelectItem>
              </SelectContent>
            </Select>
            {dateFilter === 'custom' && (
              <>
                <Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="h-10 w-40 rounded-lg border-slate-200 bg-white" />
                <Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="h-10 w-40 rounded-lg border-slate-200 bg-white" />
              </>
            )}
            <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => void exportNotificationsPdf()}>
              <FileText className="ml-2 h-4 w-4" />
              تصدير PDF
            </Button>
            <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => void exportNotificationsExcel()}>
              <Download className="ml-2 h-4 w-4" />
              تصدير Excel
            </Button>
          </div>

          <div className="space-y-3">
            {loadingNotifications ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">جاري تحميل الإشعارات...</div>
            ) : visibleRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
                <p className="font-black text-slate-950">لا توجد إشعارات حالياً</p>
                <p className="mt-2 text-sm text-slate-500">سيتم عرض تنبيهات الأمان، الحضور، الاشتراكات والنظام هنا عند توفرها.</p>
                <Button className="mt-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => void loadNotifications()}>تحديث</Button>
              </div>
            ) : visibleRows.map((notification) => {
              const Icon = notificationCategoryIcon(notification.category);
              return (
                <article key={notification.id} className={`rounded-lg border p-4 transition hover:border-blue-200 hover:bg-blue-50/30 ${notification.status === 'unread' ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${notificationCategoryTone(notification.category)}`}>
                        <Icon className="h-5 w-5" />
                        {notification.status === 'unread' && <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-slate-950">{notification.title}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${notificationPriorityClass(notification.priority)}`}>{notificationPriorityLabel(notification.priority)}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${notification.status === 'unread' ? 'bg-blue-100 text-blue-700' : notification.status === 'archived' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{notificationStatusLabel(notification.status)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{notification.message}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                          {notification.institutionName && <span>{notification.institutionName}</span>}
                          {notification.institutionType && <span>{getTypeLabel(notification.institutionType)}</span>}
                          <span>{formatDate(notification.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" className="h-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => { setSelectedId(notification.id); setDetailsDialogId(notification.id); }}>عرض التفاصيل</Button>
                      <Button size="sm" variant="outline" className="h-8 rounded-lg border-slate-200" onClick={() => void updateNotificationStatus(notification, notification.status === 'unread' ? 'read' : 'unread')}>
                        {notification.status === 'unread' ? 'تحديد كمقروء' : 'تحديد كغير مقروء'}
                      </Button>
                      {notification.institutionId && <Button size="sm" variant="outline" className="h-8 rounded-lg border-slate-200" onClick={() => openLinkedRecord(notification)}>فتح المؤسسة</Button>}
                      <Button size="sm" variant="outline" className="h-8 rounded-lg border-slate-200" onClick={() => setConfirmAction({ kind: 'archive', notification })}>أرشفة</Button>
                      <Button size="sm" variant="outline" className="h-8 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => setConfirmAction({ kind: 'delete', notification })}>حذف</Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <span>عرض {visibleRows.length} من {formatNumber(filteredNotifications.length)} إشعار</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="rounded-lg border-slate-200" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>السابق</Button>
              <span className="font-bold text-slate-700">{Math.min(page, totalPages)} / {totalPages}</span>
              <Button size="sm" variant="outline" className="rounded-lg border-slate-200" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>التالي</Button>
            </div>
          </div>
        </Panel>

        <Panel title="تفاصيل الإشعار" icon={Eye}>
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">{notificationCategoryLabel(selected.category)}</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{selected.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selected.message}</p>
              </div>
              <DetailPill label="نوع الإشعار" value={notificationCategoryLabel(selected.category)} />
              <DetailPill label="الأولوية" value={notificationPriorityLabel(selected.priority)} />
              <DetailPill label="الحالة" value={notificationStatusLabel(selected.status)} />
              <DetailPill label="المؤسسة" value={selected.institutionName || 'غير متوفر'} />
              <DetailPill label="القطاع" value={selected.institutionType ? getTypeLabel(selected.institutionType) : 'غير متوفر'} />
              <DetailPill label="المستخدم المرتبط" value={selected.actorName || 'غير متوفر'} />
              <DetailPill label="التاريخ" value={formatDate(selected.createdAt)} />
              <DetailPill label="الإجراء المقترح" value={selected.suggestedAction} />
              <div className="grid gap-2">
                <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => void updateNotificationStatus(selected, 'read')}>تحديد كمقروء</Button>
                <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => openLinkedRecord(selected)}>فتح السجل المرتبط</Button>
                {selected.institutionId && <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => openLinkedRecord(selected)}>فتح المؤسسة</Button>}
                <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => setConfirmAction({ kind: 'archive', notification: selected })}>أرشفة</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">اختر إشعاراً لعرض التفاصيل</div>
          )}
        </Panel>
      </section>

      {settingsOpen && (
        <NotificationSettingsModal
          settings={settings}
          setSettings={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {detailsDialogNotification && (
        <NotificationDetailsDialog
          notification={detailsDialogNotification}
          formatDate={formatDate}
          getTypeLabel={getTypeLabel}
          onClose={() => setDetailsDialogId(null)}
          onMarkRead={() => void updateNotificationStatus(detailsDialogNotification, 'read')}
          onOpenRecord={() => openLinkedRecord(detailsDialogNotification)}
          onArchive={() => {
            setDetailsDialogId(null);
            setConfirmAction({ kind: 'archive', notification: detailsDialogNotification });
          }}
        />
      )}

      {confirmAction && (
        <ConfirmNotificationActionDialog
          action={confirmAction.kind}
          notification={confirmAction.notification}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            const action = confirmAction;
            setConfirmAction(null);
            if (action.kind === 'delete-read') void deleteReadNotifications();
            if (action.kind === 'delete' && action.notification) void deleteNotification(action.notification);
            if (action.kind === 'archive' && action.notification) void updateNotificationStatus(action.notification, 'archived');
          }}
        />
      )}
    </section>
  );
}

const notificationTabs: Array<{ id: NotificationCategory; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'unread', label: 'غير مقروءة' },
  { id: 'security', label: 'الأمان' },
  { id: 'attendance', label: 'الحضور' },
  { id: 'subscription', label: 'الاشتراكات' },
  { id: 'report', label: 'التقارير' },
  { id: 'system', label: 'النظام' },
];

function OwnerActivityLogPage({
  institutions,
  searchQuery,
  setSearchQuery,
  formatNumber,
  formatDate,
  getTypeLabel,
  getTypeIcon,
  onOpenInstitution,
  onOpenBilling,
  onOpenReports,
  onOpenNotifications,
  onOpenSettings,
  onOpenUsers,
}: {
  institutions: Institution[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  onOpenInstitution: (institution: Institution) => void;
  onOpenBilling: () => void;
  onOpenReports: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenUsers: () => void;
}) {
  const [activities, setActivities] = useState<OwnerActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ActivityLogCategory>('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | ActivityLogOutcome>('all');
  const [reviewFilter, setReviewFilter] = useState<'active' | ActivityLogReviewStatus>('active');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('30d');
  const [sortMode, setSortMode] = useState<ActivityLogSortMode>('newest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [detailsDialogId, setDetailsDialogId] = useState<string | null>(null);
  const [actionSheetItem, setActionSheetItem] = useState<OwnerActivityItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ kind: 'archive' | 'delete'; item: OwnerActivityItem } | null>(null);
  const pageSize = 10;
  const institutionKey = useMemo(() => institutions.map((item) => item.id).sort().join('|'), [institutions]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const snapshot = await loadOwnerActivitySnapshot(institutions);
      setActivities(snapshot.activities);
      setSchemaReady(snapshot.schemaReady);
      setSelectedId((current) => current && snapshot.activities.some((item) => item.id === current) ? current : snapshot.activities[0]?.id || null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحميل سجل النشاط'));
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActivities();
  }, [institutionKey]);

  const filteredActivities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = new Date();
    const from = new Date(now);
    if (dateFilter === 'today') from.setHours(0, 0, 0, 0);
    if (dateFilter === '7d') {
      from.setDate(now.getDate() - 6);
      from.setHours(0, 0, 0, 0);
    }
    if (dateFilter === '30d') {
      from.setDate(now.getDate() - 29);
      from.setHours(0, 0, 0, 0);
    }

    return activities
      .filter((item) => {
        const matchesQuery = !query || [
          item.title,
          item.description,
          item.institutionName || '',
          item.actorName || '',
          activityCategoryLabel(item.category),
          activityOutcomeLabel(item.outcome),
        ].some((value) => value.toLowerCase().includes(query));
        const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
        const matchesInstitution = institutionFilter === 'all' || item.institutionId === institutionFilter;
        const matchesOutcome = outcomeFilter === 'all' || item.outcome === outcomeFilter;
        const matchesReview = reviewFilter === 'active' ? item.reviewStatus !== 'archived' : item.reviewStatus === reviewFilter;
        const matchesDate = dateFilter === 'all' || new Date(item.createdAt).getTime() >= from.getTime();
        return matchesQuery && matchesCategory && matchesInstitution && matchesOutcome && matchesReview && matchesDate;
      })
      .sort((a, b) => {
        if (sortMode === 'priority') return notificationPriorityWeight(b.priority) - notificationPriorityWeight(a.priority);
        if (sortMode === 'status') return activityOutcomeWeight(b.outcome) - activityOutcomeWeight(a.outcome);
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return sortMode === 'oldest' ? aTime - bTime : bTime - aTime;
      });
  }, [activeCategory, activities, dateFilter, institutionFilter, outcomeFilter, reviewFilter, searchQuery, sortMode]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, dateFilter, institutionFilter, outcomeFilter, reviewFilter, searchQuery, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / pageSize));
  const visibleActivities = filteredActivities.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);
  const selectedActivity = filteredActivities.find((item) => item.id === selectedId) || filteredActivities[0] || null;
  const detailsDialogActivity = activities.find((item) => item.id === detailsDialogId) || null;
  const stats = buildActivityStats(activities);

  const resetFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setInstitutionFilter('all');
    setOutcomeFilter('all');
    setReviewFilter('active');
    setDateFilter('30d');
    setSortMode('newest');
    toast.success('تمت إعادة تعيين فلاتر سجل النشاط');
  };

  const persistReviewStatus = async (item: OwnerActivityItem, reviewStatus: ActivityLogReviewStatus) => {
    const payload = buildActivityLogPersistPayload(item, reviewStatus);
    const { error } = await supabase.from('activity_logs').upsert(payload, { onConflict: 'source_key' });
    if (error) throw error;
    await loadActivities();
    toast.success(reviewStatus === 'reviewed' ? 'تم تعيين النشاط كمراجع' : 'تم تحديث حالة النشاط');
  };

  const deleteActivity = async (item: OwnerActivityItem) => {
    if (item.source === 'stored') {
      const { error } = await supabase.from('activity_logs').delete().eq('id', item.id);
      if (error) throw error;
    } else {
      const payload = buildActivityLogPersistPayload(item, 'archived');
      const { error } = await supabase.from('activity_logs').upsert(payload, { onConflict: 'source_key' });
      if (error) throw error;
    }
    await loadActivities();
    toast.success('تم حذف النشاط من العرض التشغيلي');
  };

  const openRelatedRecord = (item: OwnerActivityItem | null) => {
    if (!item) return;
    if (item.institutionId) {
      const institution = institutions.find((inst) => inst.id === item.institutionId);
      if (institution) {
        onOpenInstitution(institution);
        return;
      }
    }
    if (item.category === 'subscription') {
      onOpenBilling();
      return;
    }
    if (item.category === 'report') {
      onOpenReports();
      return;
    }
    if (item.metadata.notification_id) {
      onOpenNotifications();
      return;
    }
    if (item.category === 'system') {
      onOpenSettings();
      return;
    }
    if (item.category === 'user') {
      onOpenUsers();
      return;
    }
    if (item.category === 'security' || item.category === 'attendance') {
      onOpenNotifications();
      return;
    }
    toast.info('تم فتح الصفحة الأقرب لهذا النشاط');
    onOpenReports();
  };

  const showActivityDetails = (item: OwnerActivityItem) => {
    setSelectedId(item.id);
    setDetailsDialogId(item.id);
  };

  const exportActivityExcel = async () => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Activity Log');
    worksheet.addRow(['Ausar Military', 'Owner Activity Log', new Date().toISOString()]);
    worksheet.addRow([]);
    worksheet.addRow(['الوقت', 'المستخدم', 'المؤسسة', 'القطاع', 'نوع النشاط', 'العنوان', 'الحالة', 'المراجعة', 'الأولوية', 'الوصف']);
    filteredActivities.forEach((item) => worksheet.addRow([
      formatDate(item.createdAt),
      item.actorName || 'النظام',
      item.institutionName || 'المنصة',
      item.institutionType ? getTypeLabel(item.institutionType) : 'النظام',
      activityCategoryLabel(item.category),
      item.title,
      activityOutcomeLabel(item.outcome),
      activityReviewLabel(item.reviewStatus),
      notificationPriorityLabel(item.priority),
      item.description,
    ]));
    worksheet.columns.forEach((column) => { column.width = 24; });
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBrowserBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Ausar Military-activity-log-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('تم تصدير سجل النشاط Excel');
  };

  const exportActivityPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Ausar Military Activity Log', 20, 20);
    doc.setFontSize(11);
    doc.text(`Activities: ${filteredActivities.length}`, 20, 35);
    filteredActivities.slice(0, 16).forEach((item, index) => {
      doc.text(`${index + 1}. ${item.title} | ${activityCategoryLabel(item.category)} | ${activityOutcomeLabel(item.outcome)} | ${formatDate(item.createdAt)}`, 20, 50 + index * 9);
    });
    doc.save(`Ausar Military-activity-log-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('تم تصدير سجل النشاط PDF');
  };

  return (
    <section className="space-y-5" dir="rtl">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>الرئيسية</span>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>سجل النشاط</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">سجل النشاط</h1>
          <p className="mt-1 text-sm text-slate-500">متابعة جميع العمليات، التغييرات والأحداث داخل المنصة</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={resetFilters}>
            <RefreshCw className="ml-2 h-4 w-4" />
            إعادة تعيين
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => void exportActivityExcel()}>
            <Download className="ml-2 h-4 w-4" />
            تصدير Excel
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => void exportActivityPdf()}>
            <FileText className="ml-2 h-4 w-4" />
            تصدير PDF
          </Button>
          <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={loading} onClick={() => void loadActivities()}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <NotificationKpi label="إجمالي الأنشطة" value={formatNumber(stats.total)} helper="خلال البيانات المتاحة" icon={Activity} tone="bg-blue-50 text-blue-700" />
        <NotificationKpi label="أنشطة اليوم" value={formatNumber(stats.today)} helper="آخر 24 ساعة تشغيلية" icon={Clock} tone="bg-indigo-50 text-indigo-700" />
        <NotificationKpi label="تسجيلات الدخول/المستخدمين" value={formatNumber(stats.users)} helper="طلاب، أساتذة ومالكين" icon={UserPlus} tone="bg-emerald-50 text-emerald-700" />
        <NotificationKpi label="عمليات حساسة" value={formatNumber(stats.security)} helper="أجهزة وتنبيهات أمنية" icon={ShieldCheck} tone="bg-rose-50 text-rose-700" />
        <NotificationKpi label="إشعارات النظام" value={formatNumber(stats.system)} helper="إعدادات وتقارير" icon={Bell} tone="bg-orange-50 text-orange-700" />
        <NotificationKpi label="تحتاج مراجعة" value={formatNumber(stats.open)} helper="غير مراجعة بعد" icon={Eye} tone="bg-violet-50 text-violet-700" />
      </div>

      {!schemaReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          جدول activity_logs غير مطبق بعد. الصفحة تعرض النشاط المشتق من البيانات الحالية، وستعمل المراجعة والأرشفة بعد تطبيق migration v2.5.6.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activityCategoryTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${activeCategory === tab.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50'}`}
                  onClick={() => setActiveCategory(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="ابحث في سجل النشاط..." className="h-10 rounded-lg border-slate-200 bg-white" />
              </div>
              <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue placeholder="المؤسسة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المؤسسات</SelectItem>
                  {institutions.map((institution) => (
                    <SelectItem key={institution.id} value={institution.id}>{institution.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={outcomeFilter} onValueChange={(value) => setOutcomeFilter(value as 'all' | ActivityLogOutcome)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="success">نجاح</SelectItem>
                  <SelectItem value="warning">تحذير</SelectItem>
                  <SelectItem value="rejected">مرفوض</SelectItem>
                  <SelectItem value="pending">قيد المتابعة</SelectItem>
                </SelectContent>
              </Select>
              <Select value={reviewFilter} onValueChange={(value) => setReviewFilter(value as 'active' | ActivityLogReviewStatus)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">غير مؤرشفة</SelectItem>
                  <SelectItem value="open">مفتوحة</SelectItem>
                  <SelectItem value="reviewed">مراجعة</SelectItem>
                  <SelectItem value="archived">مؤرشفة</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as 'all' | 'today' | '7d' | '30d')}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">آخر 30 يوم</SelectItem>
                  <SelectItem value="7d">آخر 7 أيام</SelectItem>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="all">كل الفترات</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as ActivityLogSortMode)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">الأحدث أولاً</SelectItem>
                  <SelectItem value="oldest">الأقدم أولاً</SelectItem>
                  <SelectItem value="priority">الأولوية الأعلى</SelectItem>
                  <SelectItem value="status">الحالة الأخطر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Panel title="جدول سجل النشاط" subtitle="عمليات حقيقية مشتقة ومخزنة من Supabase" icon={Activity}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-right text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-bold">الوقت</th>
                    <th className="px-3 py-3 font-bold">المستخدم</th>
                    <th className="px-3 py-3 font-bold">المؤسسة</th>
                    <th className="px-3 py-3 font-bold">النوع</th>
                    <th className="px-3 py-3 font-bold">الوصف</th>
                    <th className="px-3 py-3 font-bold">الحالة</th>
                    <th className="px-3 py-3 font-bold">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">جاري تحميل سجل النشاط...</td></tr>
                  ) : visibleActivities.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">لا توجد أنشطة مطابقة للفلاتر الحالية.</td></tr>
                  ) : (
                    visibleActivities.map((item) => (
                      <tr key={item.id} className={selectedActivity?.id === item.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'}>
                        <td className="px-3 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
                        <td className="px-3 py-3">
                          <div className="font-black text-slate-950">{item.actorName || 'النظام'}</div>
                          <div className="text-xs text-slate-500">{item.ipAddress || 'بدون IP'}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                              {item.institutionType ? getTypeIcon(item.institutionType, 'h-4 w-4') : <Database className="h-4 w-4 text-slate-500" />}
                            </span>
                            <span>
                              <span className="block font-bold text-slate-950">{item.institutionName || 'Ausar Military'}</span>
                              <span className="block text-xs text-slate-500">{item.institutionType ? getTypeLabel(item.institutionType) : 'النظام'}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{activityCategoryLabel(item.category)}</span></td>
                        <td className="max-w-[280px] px-3 py-3">
                          <div className="font-bold text-slate-950">{item.title}</div>
                          <div className="truncate text-xs text-slate-500">{item.description}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${activityOutcomeClass(item.outcome)}`}>{activityOutcomeLabel(item.outcome)}</span>
                            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${activityReviewClass(item.reviewStatus)}`}>{activityReviewLabel(item.reviewStatus)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="relative flex items-center gap-2">
                            <Button size="sm" className="h-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => showActivityDetails(item)}>
                              عرض
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg border-slate-200" onClick={() => openRelatedRecord(item)}>
                              فتح
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 rounded-lg" aria-label={`إجراءات ${item.title}`} onClick={() => setActionSheetItem(item)}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <span className="text-xs text-slate-500">عرض {visibleActivities.length} من {filteredActivities.length} نشاط</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-lg border-slate-200" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>السابق</Button>
                <span className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white">{Math.min(page, totalPages)}</span>
                <Button variant="outline" size="sm" className="rounded-lg border-slate-200" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>التالي</Button>
              </div>
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="تفاصيل النشاط" icon={Eye}>
            {selectedActivity ? (
              <div className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${activityOutcomeClass(selectedActivity.outcome)}`}>
                    {activityIconForCategory(selectedActivity.category)}
                  </div>
                  <div>
                    <h2 className="font-black text-slate-950">{selectedActivity.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{selectedActivity.description}</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <DetailPill label="نوع النشاط" value={activityCategoryLabel(selectedActivity.category)} />
                  <DetailPill label="الأولوية" value={notificationPriorityLabel(selectedActivity.priority)} />
                  <DetailPill label="الحالة" value={activityOutcomeLabel(selectedActivity.outcome)} />
                  <DetailPill label="المراجعة" value={activityReviewLabel(selectedActivity.reviewStatus)} />
                  <DetailPill label="المؤسسة" value={selectedActivity.institutionName || 'Ausar Military'} />
                  <DetailPill label="المستخدم" value={selectedActivity.actorName || 'النظام'} />
                  <DetailPill label="التاريخ" value={formatDate(selectedActivity.createdAt)} />
                  <DetailPill label="عنوان IP" value={selectedActivity.ipAddress || 'غير متوفر'} />
                  <DetailPill label="الجهاز" value={selectedActivity.userAgent || 'غير متوفر'} />
                </div>
                <div className="grid gap-2">
                  <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => openRelatedRecord(selectedActivity)}>
                    فتح السجل المرتبط
                  </Button>
                  <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => void persistReviewStatus(selectedActivity, 'reviewed')}>
                    تعيين كمراجع
                  </Button>
                  <Button variant="outline" className="rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setConfirmAction({ kind: 'archive', item: selectedActivity })}>
                    أرشفة النشاط
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-slate-500">اختر نشاطاً لعرض التفاصيل.</div>
            )}
          </Panel>

          <Panel title="تحليلات النشاط" icon={BarChart3}>
            <div className="space-y-3 p-4">
              {activityCategoryTabs.filter((tab) => tab.id !== 'all').map((tab) => {
                const value = activities.filter((item) => item.category === tab.id).length;
                const percent = stats.total > 0 ? Math.round((value / stats.total) * 100) : 0;
                return <HealthRow key={tab.id} label={tab.label} value={`${formatNumber(value)} (${percent}%)`} color={activityCategoryColor(tab.id)} />;
              })}
            </div>
          </Panel>
        </aside>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-black text-slate-950">{confirmAction.kind === 'archive' ? 'أرشفة النشاط' : 'حذف النشاط'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              سيتم تحديث سجل النشاط في Supabase. لا يتم حذف أي بيانات حضور أو مؤسسات مرتبطة بهذا الإجراء.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => setConfirmAction(null)}>إلغاء</Button>
              <Button
                className="rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  void (action.kind === 'archive' ? persistReviewStatus(action.item, 'archived') : deleteActivity(action.item));
                }}
              >
                تأكيد
              </Button>
            </div>
          </div>
        </div>
      )}

      {detailsDialogActivity && (
        <ActivityDetailsDialog
          activity={detailsDialogActivity}
          formatDate={formatDate}
          onClose={() => setDetailsDialogId(null)}
          onOpenRelated={() => openRelatedRecord(detailsDialogActivity)}
          onReview={() => void persistReviewStatus(detailsDialogActivity, 'reviewed')}
          onArchive={() => setConfirmAction({ kind: 'archive', item: detailsDialogActivity })}
        />
      )}

      {actionSheetItem && (
        <ActivityActionsDialog
          activity={actionSheetItem}
          onClose={() => setActionSheetItem(null)}
          onDetails={() => {
            setActionSheetItem(null);
            showActivityDetails(actionSheetItem);
          }}
          onOpenRelated={() => {
            const item = actionSheetItem;
            setActionSheetItem(null);
            openRelatedRecord(item);
          }}
          onReview={() => {
            const item = actionSheetItem;
            setActionSheetItem(null);
            void persistReviewStatus(item, 'reviewed');
          }}
          onArchive={() => {
            const item = actionSheetItem;
            setActionSheetItem(null);
            setConfirmAction({ kind: 'archive', item });
          }}
          onDelete={() => {
            const item = actionSheetItem;
            setActionSheetItem(null);
            setConfirmAction({ kind: 'delete', item });
          }}
        />
      )}
    </section>
  );
}

async function loadOwnerNotificationsSnapshot(institutions: Institution[]): Promise<NotificationSnapshot> {
  const institutionById = new Map(institutions.map((institution) => [institution.id, institution]));
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [storedResponse, subscriptionsResponse, sessionsResponse, attendancesResponse, adminsResponse, reportsResponse] = await Promise.all([
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('subscriptions').select('id, institution_id, status, end_date, current_period_end, payment_status, price, currency, created_at').limit(500),
    supabase.from('sessions').select('id, institution_id, created_at, status').gte('created_at', since30.toISOString()).order('created_at', { ascending: false }).limit(80),
    supabase.from('attendances').select('id, institution_id, session_id, created_at').gte('created_at', today.toISOString()).limit(1000),
    supabase.from('admins').select('id, institution_id, full_name, username, role, created_at').gte('created_at', since30.toISOString()).order('created_at', { ascending: false }).limit(50),
    supabase.from('report_exports').select('*').order('created_at', { ascending: false }).limit(30),
  ]);

  const storedSchemaReady = !storedResponse.error;
  const stored = storedSchemaReady ? ((storedResponse.data || []) as NotificationDbRow[]).map((row) => mapStoredNotification(row, institutionById)) : [];
  const derived: OwnerNotification[] = [];

  if (!subscriptionsResponse.error) {
    ((subscriptionsResponse.data || []) as SubscriptionDbRow[]).forEach((subscription) => {
      const institution = institutionById.get(subscription.institution_id);
      const endDate = subscription.end_date || subscription.current_period_end || null;
      const days = getDaysRemaining(endDate);
      const normalizedStatus = normalizeSubscriptionStatus(subscription.status, endDate);
      if (normalizedStatus === 'expired') {
        derived.push(createDerivedNotification({
          id: `subscription-expired-${subscription.id}`,
          category: 'subscription',
          type: 'subscription_expired',
          priority: 'high',
          title: 'اشتراك منتهي',
          message: `اشتراك ${institution?.name || 'مؤسسة غير معروفة'} منتهي ويحتاج مراجعة قبل استمرار الخدمة.`,
          institution,
          linkedRecordType: 'subscription',
          linkedRecordLabel: 'فتح الاشتراك',
          suggestedAction: 'افتح صفحة الاشتراكات وجدّد الخطة أو أوقف المؤسسة مؤقتاً.',
          createdAt: endDate ? new Date(endDate).toISOString() : subscription.created_at || new Date().toISOString(),
          metadata: { subscription_id: subscription.id },
        }));
      } else if (days !== null && days >= 0 && days <= 15) {
        derived.push(createDerivedNotification({
          id: `subscription-expiring-${subscription.id}`,
          category: 'subscription',
          type: 'subscription_expiring_soon',
          priority: days <= 5 ? 'high' : 'medium',
          title: 'اشتراك قريب من الانتهاء',
          message: `اشتراك ${institution?.name || 'مؤسسة غير معروفة'} سينتهي خلال ${days} يوم.`,
          institution,
          linkedRecordType: 'subscription',
          linkedRecordLabel: 'فتح الاشتراك',
          suggestedAction: 'تواصل مع المؤسسة أو جهز فاتورة التجديد.',
          createdAt: new Date().toISOString(),
          metadata: { subscription_id: subscription.id, days_remaining: days },
        }));
      }

      const paymentStatus = normalizePaymentStatus(subscription.payment_status);
      if (paymentStatus === 'unpaid' || paymentStatus === 'overdue') {
        derived.push(createDerivedNotification({
          id: `subscription-payment-${subscription.id}`,
          category: 'subscription',
          type: 'invoice_unpaid',
          priority: paymentStatus === 'overdue' ? 'high' : 'medium',
          title: 'فاتورة غير مدفوعة',
          message: `توجد فاتورة ${paymentStatusLabel(paymentStatus)} مرتبطة بـ ${institution?.name || 'مؤسسة غير معروفة'}.`,
          institution,
          linkedRecordType: 'subscription',
          linkedRecordLabel: 'فتح الاشتراك',
          suggestedAction: 'راجع حالة الدفع في صفحة الاشتراكات والفوترة.',
          createdAt: subscription.created_at || new Date().toISOString(),
          metadata: { subscription_id: subscription.id, payment_status: paymentStatus },
        }));
      }
    });
  }

  if (!sessionsResponse.error) {
    ((sessionsResponse.data || []) as AnalyticsSessionDataRow[]).slice(0, 12).forEach((session) => {
      const institution = session.institution_id ? institutionById.get(session.institution_id) : undefined;
      derived.push(createDerivedNotification({
        id: `session-opened-${session.id}`,
        category: 'attendance',
        type: 'session_opened',
        priority: 'info',
        title: 'تم فتح حصة جديدة',
        message: `تم تسجيل حصة حضور جديدة${institution ? ` في ${institution.name}` : ''}.`,
        institution,
        linkedRecordType: 'session',
        linkedRecordLabel: 'فتح المؤسسة',
        suggestedAction: 'راقب نسبة الحضور بعد انتهاء الحصة.',
        createdAt: session.created_at || new Date().toISOString(),
        metadata: { session_id: session.id },
      }));
    });
  }

  if (!attendancesResponse.error) {
    const attendances = (attendancesResponse.data || []) as AnalyticsAttendanceDataRow[];
    const byInstitution = new Map<string, number>();
    attendances.forEach((attendance) => {
      if (attendance.institution_id) byInstitution.set(attendance.institution_id, (byInstitution.get(attendance.institution_id) || 0) + 1);
    });
    byInstitution.forEach((count, institutionId) => {
      const institution = institutionById.get(institutionId);
      derived.push(createDerivedNotification({
        id: `attendance-today-${institutionId}-${today.toISOString().slice(0, 10)}`,
        category: 'attendance',
        type: 'attendance_activity_today',
        priority: 'low',
        title: 'نشاط حضور اليوم',
        message: `تم تسجيل ${count} حضور اليوم${institution ? ` في ${institution.name}` : ''}.`,
        institution,
        linkedRecordType: 'institution',
        linkedRecordLabel: 'فتح المؤسسة',
        suggestedAction: 'افتح ملف المؤسسة لمراجعة الجلسات والحضور.',
        createdAt: new Date().toISOString(),
        metadata: { attendance_count: count },
      }));
    });
  }

  institutions.filter((institution) => isWithinDays(institution.created_at, 30)).slice(0, 10).forEach((institution) => {
    derived.push(createDerivedNotification({
      id: `institution-created-${institution.id}`,
      category: 'system',
      type: 'institution_created',
      priority: 'info',
      title: 'مؤسسة جديدة أضيفت',
      message: `تمت إضافة ${institution.name} إلى منصة Ausar Military.`,
      institution,
      linkedRecordType: 'institution',
      linkedRecordLabel: 'فتح المؤسسة',
      suggestedAction: 'راجع بيانات المؤسسة والمدير الأول والصورة الرسمية.',
      createdAt: institution.created_at || new Date().toISOString(),
      metadata: { institution_id: institution.id },
    }));
  });

  if (!adminsResponse.error) {
    ((adminsResponse.data || []) as OwnerAdminRow[]).slice(0, 10).forEach((adminRow) => {
      const institution = adminRow.institution_id ? institutionById.get(adminRow.institution_id) : undefined;
      derived.push(createDerivedNotification({
        id: `admin-created-${adminRow.id}`,
        category: 'system',
        type: 'admin_created',
        priority: 'low',
        title: 'أستاذ أو مسؤول جديد أضيف',
        message: `تمت إضافة ${adminRow.fullName || adminRow.full_name || adminRow.username} ${institution ? `في ${institution.name}` : ''}.`,
        institution,
        actorAdminId: adminRow.id,
        actorName: adminRow.fullName || adminRow.full_name || adminRow.username,
        linkedRecordType: 'admin',
        linkedRecordLabel: 'فتح المؤسسة',
        suggestedAction: 'تأكد من الدور والصلاحيات المرتبطة بالحساب.',
        createdAt: adminRow.created_at || new Date().toISOString(),
        metadata: { admin_id: adminRow.id },
      }));
    });
  }

  if (!reportsResponse.error) {
    ((reportsResponse.data || []) as Array<Record<string, unknown>>).forEach((reportRow) => {
      const institutionId = typeof reportRow.institution_id === 'string' ? reportRow.institution_id : null;
      const institution = institutionId ? institutionById.get(institutionId) : undefined;
      const status = typeof reportRow.status === 'string' ? reportRow.status : 'ready';
      derived.push(createDerivedNotification({
        id: `report-export-${String(reportRow.id || crypto.randomUUID())}`,
        category: 'report',
        type: status === 'failed' ? 'report_failed' : 'report_ready',
        priority: status === 'failed' ? 'medium' : 'info',
        title: status === 'failed' ? 'فشل إنشاء تقرير' : 'تقرير جاهز',
        message: status === 'failed' ? 'تعذر إنشاء تقرير في مركز التقارير.' : 'تم تجهيز تقرير ويمكن فتحه أو تحميله.',
        institution,
        linkedRecordType: 'report',
        linkedRecordLabel: 'فتح التقرير',
        suggestedAction: status === 'failed' ? 'أعد محاولة إنشاء التقرير من مركز التقارير.' : 'افتح التقرير أو حمله عند الحاجة.',
        createdAt: typeof reportRow.created_at === 'string' ? reportRow.created_at : new Date().toISOString(),
        metadata: reportRow,
      }));
    });
  }

  const merged = dedupeNotifications([...stored, ...derived]);
  return { notifications: applyNotificationOverrides(merged).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), storedSchemaReady };
}

function mapStoredNotification(row: NotificationDbRow, institutionById: Map<string, Institution>): OwnerNotification {
  const institution = row.institution_id ? institutionById.get(row.institution_id) : undefined;
  return {
    id: row.id,
    source: 'stored',
    type: row.type,
    category: normalizeNotificationCategory(row.category),
    priority: normalizeNotificationPriority(row.priority),
    title: row.title,
    message: row.message,
    status: normalizeNotificationStatus(row.status),
    institutionId: row.institution_id,
    institutionName: institution?.name || null,
    institutionType: institution ? normalizeInstitutionType(institution.type) : null,
    actorAdminId: row.actor_admin_id,
    actorName: null,
    metadata: row.metadata || {},
    suggestedAction: typeof row.metadata?.suggested_action === 'string' ? row.metadata.suggested_action : 'راجع التفاصيل واتخذ الإجراء المناسب.',
    linkedRecordLabel: typeof row.metadata?.linked_record_label === 'string' ? row.metadata.linked_record_label : null,
    linkedRecordType: normalizeLinkedRecordType(row.metadata?.linked_record_type),
    createdAt: row.created_at,
    readAt: row.read_at,
    archivedAt: row.archived_at,
  };
}

function createDerivedNotification(input: {
  id: string;
  category: Exclude<NotificationCategory, 'all' | 'unread'>;
  type: string;
  priority: NotificationPriority;
  title: string;
  message: string;
  institution?: Institution;
  actorAdminId?: string | null;
  actorName?: string | null;
  linkedRecordType: OwnerNotification['linkedRecordType'];
  linkedRecordLabel: string | null;
  suggestedAction: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}): OwnerNotification {
  return {
    id: input.id,
    source: 'derived',
    type: input.type,
    category: input.category,
    priority: input.priority,
    title: input.title,
    message: input.message,
    status: 'unread',
    institutionId: input.institution?.id || null,
    institutionName: input.institution?.name || null,
    institutionType: input.institution ? normalizeInstitutionType(input.institution.type) : null,
    actorAdminId: input.actorAdminId || null,
    actorName: input.actorName || null,
    metadata: input.metadata,
    suggestedAction: input.suggestedAction,
    linkedRecordLabel: input.linkedRecordLabel,
    linkedRecordType: input.linkedRecordType,
    createdAt: input.createdAt,
    readAt: null,
    archivedAt: null,
  };
}

function dedupeNotifications(items: OwnerNotification[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function applyNotificationOverrides(items: OwnerNotification[]) {
  const overrides = readNotificationOverrides();
  return items.map((item) => {
    const patch = overrides[item.id];
    if (!patch) return item;
    return {
      ...item,
      status: patch.status || item.status,
      readAt: patch.readAt === undefined ? item.readAt : patch.readAt,
      archivedAt: patch.archivedAt === undefined ? item.archivedAt : patch.archivedAt,
    };
  }).filter((item) => !overrides[item.id]?.hidden);
}

function readNotificationOverrides(): Record<string, NotificationLocalPatch> {
  try {
    const raw = window.localStorage.getItem('qh-owner-notification-overrides');
    return raw ? JSON.parse(raw) as Record<string, NotificationLocalPatch> : {};
  } catch {
    return {};
  }
}

function writeNotificationOverrides(value: Record<string, NotificationLocalPatch>) {
  window.localStorage.setItem('qh-owner-notification-overrides', JSON.stringify(value));
}

function normalizeNotificationCategory(value: string): Exclude<NotificationCategory, 'all' | 'unread'> {
  if (value === 'security' || value === 'attendance' || value === 'subscription' || value === 'report' || value === 'system') return value;
  return 'system';
}

function normalizeNotificationPriority(value: string): NotificationPriority {
  if (value === 'high' || value === 'medium' || value === 'low' || value === 'info') return value;
  return 'info';
}

function normalizeNotificationStatus(value: string): NotificationStatus {
  if (value === 'unread' || value === 'read' || value === 'archived') return value;
  return 'unread';
}

function normalizeLinkedRecordType(value: unknown): OwnerNotification['linkedRecordType'] {
  return value === 'institution' || value === 'subscription' || value === 'report' || value === 'session' || value === 'admin' ? value : null;
}

function buildNotificationStats(items: OwnerNotification[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    total: items.length,
    unread: items.filter((item) => item.status === 'unread').length,
    security: items.filter((item) => item.category === 'security').length,
    expiringSubscriptions: items.filter((item) => item.type === 'subscription_expiring_soon').length,
    reports: items.filter((item) => item.category === 'report' && item.type !== 'report_failed').length,
    todayAttendance: items.filter((item) => item.category === 'attendance' && new Date(item.createdAt).getTime() >= today.getTime()).length,
  };
}

function ActivityDetailsDialog({
  activity,
  formatDate,
  onClose,
  onOpenRelated,
  onReview,
  onArchive,
}: {
  activity: OwnerActivityItem;
  formatDate: (value: string | null | undefined) => string;
  onClose: () => void;
  onOpenRelated: () => void;
  onReview: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${activityOutcomeClass(activity.outcome)}`}>
              {activityIconForCategory(activity.category)}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">تفاصيل النشاط</h2>
              <p className="mt-1 text-sm text-slate-500">{activity.title}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-4 p-5">
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">{activity.description}</p>
          <div className="grid gap-2 md:grid-cols-2">
            <DetailPill label="نوع النشاط" value={activityCategoryLabel(activity.category)} />
            <DetailPill label="الأولوية" value={notificationPriorityLabel(activity.priority)} />
            <DetailPill label="الحالة" value={activityOutcomeLabel(activity.outcome)} />
            <DetailPill label="المراجعة" value={activityReviewLabel(activity.reviewStatus)} />
            <DetailPill label="المؤسسة" value={activity.institutionName || 'Ausar Military'} />
            <DetailPill label="المستخدم" value={activity.actorName || 'النظام'} />
            <DetailPill label="التاريخ" value={formatDate(activity.createdAt)} />
            <DetailPill label="عنوان IP" value={activity.ipAddress || 'غير متوفر'} />
            <DetailPill label="الجهاز" value={activity.userAgent || 'غير متوفر'} />
            <DetailPill label="معرف النشاط" value={activity.sourceKey} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>إغلاق</Button>
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onOpenRelated}>فتح السجل المرتبط</Button>
            <Button variant="outline" className="rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={onReview}>تعيين كمراجع</Button>
            <Button className="rounded-lg bg-rose-600 text-white hover:bg-rose-700" onClick={onArchive}>أرشفة</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityActionsDialog({
  activity,
  onClose,
  onDetails,
  onOpenRelated,
  onReview,
  onArchive,
  onDelete,
}: {
  activity: OwnerActivityItem;
  onClose: () => void;
  onDetails: () => void;
  onOpenRelated: () => void;
  onReview: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">إجراءات النشاط</h2>
            <p className="mt-1 text-sm text-slate-500">{activity.title}</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-5 grid gap-2">
          <Button variant="outline" className="justify-between rounded-lg border-slate-200" onClick={onDetails}>
            عرض التفاصيل <Eye className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="justify-between rounded-lg border-slate-200" onClick={onOpenRelated}>
            فتح السجل المرتبط <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="justify-between rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={onReview}>
            تعيين كمراجع <Check className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="justify-between rounded-lg border-orange-200 text-orange-700 hover:bg-orange-50" onClick={onArchive}>
            أرشفة <PauseCircle className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="justify-between rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50" onClick={onDelete}>
            حذف <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function OwnerSupportHelpPage({
  institutions,
  ownerAdminId,
  searchQuery,
  setSearchQuery,
  formatNumber,
  formatDate,
  getTypeLabel,
  getTypeIcon,
  onOpenInstitution,
}: {
  institutions: Institution[];
  ownerAdminId: string | null;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  onOpenInstitution: (institution: Institution) => void;
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [admins, setAdmins] = useState<SupportAdminOption[]>([]);
  const [settings, setSettings] = useState<SupportSettingsState>(emptySupportSettings());
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sectorFilter, setSectorFilter] = useState<SectorId>('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | SupportTicketCategory>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | SupportTicketPriority>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketStatus>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d' | 'month'>('30d');
  const [sortMode, setSortMode] = useState<SupportSortMode>('updated');
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [replyModalTicket, setReplyModalTicket] = useState<SupportTicket | null>(null);
  const [statusModalTicket, setStatusModalTicket] = useState<SupportTicket | null>(null);
  const [assignModalTicket, setAssignModalTicket] = useState<SupportTicket | null>(null);
  const [deleteTicket, setDeleteTicket] = useState<SupportTicket | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideArticle, setGuideArticle] = useState<SupportGuideArticle | null>(null);
  const [openFaqId, setOpenFaqId] = useState<string | null>(supportFaqItems[0]?.id || null);
  const [ticketForm, setTicketForm] = useState<SupportTicketFormState>(emptySupportTicketForm());
  const [replyForm, setReplyForm] = useState<SupportReplyFormState>({ ticketId: '', message: '', replyType: 'internal', nextStatus: 'no_change' });
  const [nextStatus, setNextStatus] = useState<SupportTicketStatus>('in_progress');
  const [nextAssignee, setNextAssignee] = useState('unassigned');
  const [saving, setSaving] = useState(false);
  const pageSize = 8;
  const institutionMap = useMemo(() => new Map(institutions.map((item) => [item.id, item])), [institutions]);
  const institutionKey = useMemo(() => institutions.map((item) => item.id).sort().join('|'), [institutions]);

  const loadSupport = async () => {
    setLoading(true);
    try {
      const snapshot = await loadSupportSnapshot(institutions);
      setTickets(snapshot.tickets);
      setAdmins(snapshot.admins);
      setSettings(snapshot.settings);
      setSchemaReady(snapshot.schemaReady);
      setSelectedId((current) => current && snapshot.tickets.some((item) => item.id === current) ? current : snapshot.tickets[0]?.id || null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحميل مركز الدعم'));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSupport();
  }, [institutionKey]);

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const { from } = supportDateRange(dateFilter);
    return tickets
      .filter((ticket) => {
        const matchesQuery = !query || [
          ticket.ticketNumber,
          ticket.title,
          ticket.description,
          ticket.institutionName || '',
          ticket.assignedToName || '',
          supportCategoryLabel(ticket.category),
          supportStatusLabel(ticket.status),
        ].some((value) => value.toLowerCase().includes(query));
        const matchesSector = sectorFilter === 'all' || ticket.institutionType === sectorFilter;
        const matchesInstitution = institutionFilter === 'all' || ticket.institutionId === institutionFilter;
        const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;
        const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
        const matchesAssignee = assigneeFilter === 'all' || (assigneeFilter === 'unassigned' ? !ticket.assignedToAdminId : ticket.assignedToAdminId === assigneeFilter);
        const matchesDate = !from || new Date(ticket.createdAt).getTime() >= from.getTime();
        return matchesQuery && matchesSector && matchesInstitution && matchesCategory && matchesPriority && matchesStatus && matchesAssignee && matchesDate;
      })
      .sort((a, b) => {
        if (sortMode === 'priority') return supportPriorityWeight(b.priority) - supportPriorityWeight(a.priority);
        if (sortMode === 'open_first') return supportStatusWeight(b.status) - supportStatusWeight(a.status);
        if (sortMode === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [assigneeFilter, categoryFilter, dateFilter, institutionFilter, priorityFilter, searchQuery, sectorFilter, sortMode, statusFilter, tickets]);

  useEffect(() => {
    setPage(1);
  }, [assigneeFilter, categoryFilter, dateFilter, institutionFilter, priorityFilter, searchQuery, sectorFilter, sortMode, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const visibleTickets = filteredTickets.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);
  const selectedTicket = filteredTickets.find((item) => item.id === selectedId) || filteredTickets[0] || null;
  const stats = buildSupportStats(tickets);

  const openCreateTicket = () => {
    setTicketForm(emptySupportTicketForm());
    setTicketModalOpen(true);
  };

  const createTicket = async () => {
    if (ticketForm.institutionId === 'none' || !ticketForm.title.trim() || !ticketForm.description.trim()) {
      toast.error('يرجى إدخال المؤسسة، العنوان والوصف');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('support_tickets').insert([{
        ticket_number: generateSupportTicketNumber(),
        institution_id: ticketForm.institutionId,
        created_by_admin_id: ownerAdminId,
        assigned_to_admin_id: ticketForm.assignedToAdminId === 'unassigned' ? null : ticketForm.assignedToAdminId,
        category: ticketForm.category,
        priority: ticketForm.priority,
        status: 'open',
        title: ticketForm.title.trim(),
        description: ticketForm.description.trim(),
        internal_notes: ticketForm.internalNotes.trim() || null,
        metadata: { created_from: 'super_admin_support_center' },
      }]);
      if (error) throw error;
      setTicketModalOpen(false);
      await loadSupport();
      toast.success('تم إنشاء تذكرة الدعم');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر إنشاء التذكرة'));
    } finally {
      setSaving(false);
    }
  };

  const openReplyModal = (ticket: SupportTicket) => {
    setReplyForm({ ticketId: ticket.id, message: '', replyType: 'internal', nextStatus: 'no_change' });
    setReplyModalTicket(ticket);
  };

  const addReply = async () => {
    if (!replyModalTicket || !replyForm.message.trim()) {
      toast.error('يرجى كتابة الرد');
      return;
    }
    setSaving(true);
    try {
      const nextPayload: Partial<{ status: SupportTicketStatus; closed_at: string | null; updated_at: string }> = { updated_at: new Date().toISOString() };
      if (replyForm.nextStatus !== 'no_change') {
        nextPayload.status = replyForm.nextStatus;
        nextPayload.closed_at = replyForm.nextStatus === 'closed' || replyForm.nextStatus === 'resolved' ? new Date().toISOString() : null;
      }
      const [{ error: replyError }, { error: ticketError }] = await Promise.all([
        supabase.from('support_ticket_replies').insert([{
          ticket_id: replyModalTicket.id,
          author_admin_id: ownerAdminId,
          reply_type: replyForm.replyType,
          message: replyForm.message.trim(),
        }]),
        supabase.from('support_tickets').update(nextPayload).eq('id', replyModalTicket.id),
      ]);
      if (replyError) throw replyError;
      if (ticketError) throw ticketError;
      setReplyModalTicket(null);
      await loadSupport();
      toast.success('تمت إضافة الرد');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر إضافة الرد'));
    } finally {
      setSaving(false);
    }
  };

  const updateTicketStatus = async (ticket: SupportTicket, status: SupportTicketStatus) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('support_tickets').update({
        status,
        updated_at: new Date().toISOString(),
        closed_at: status === 'closed' || status === 'resolved' ? new Date().toISOString() : null,
      }).eq('id', ticket.id);
      if (error) throw error;
      setStatusModalTicket(null);
      await loadSupport();
      toast.success('تم تحديث حالة التذكرة');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحديث الحالة'));
    } finally {
      setSaving(false);
    }
  };

  const assignTicket = async (ticket: SupportTicket, adminId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('support_tickets').update({
        assigned_to_admin_id: adminId === 'unassigned' ? null : adminId,
        updated_at: new Date().toISOString(),
      }).eq('id', ticket.id);
      if (error) throw error;
      setAssignModalTicket(null);
      await loadSupport();
      toast.success('تم تعيين المسؤول');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تعيين المسؤول'));
    } finally {
      setSaving(false);
    }
  };

  const deleteSupportTicket = async () => {
    if (!deleteTicket) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('support_tickets').delete().eq('id', deleteTicket.id);
      if (error) throw error;
      setDeleteTicket(null);
      await loadSupport();
      toast.success('تم حذف التذكرة');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر حذف التذكرة'));
    } finally {
      setSaving(false);
    }
  };

  const saveSupportSettings = async (nextSettings: SupportSettingsState) => {
    setSaving(true);
    try {
      if (nextSettings.id) {
        const { error } = await supabase.from('support_settings').update({
          support_email: nextSettings.supportEmail.trim() || null,
          support_phone: nextSettings.supportPhone.trim() || null,
          whatsapp_number: nextSettings.whatsappNumber.trim() || null,
          help_center_url: nextSettings.helpCenterUrl.trim() || null,
          demo_request_url: nextSettings.demoRequestUrl.trim() || null,
          updated_at: new Date().toISOString(),
        }).eq('id', nextSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('support_settings').insert([{
          support_email: nextSettings.supportEmail.trim() || null,
          support_phone: nextSettings.supportPhone.trim() || null,
          whatsapp_number: nextSettings.whatsappNumber.trim() || null,
          help_center_url: nextSettings.helpCenterUrl.trim() || null,
          demo_request_url: nextSettings.demoRequestUrl.trim() || null,
        }]);
        if (error) throw error;
      }
      setSettingsOpen(false);
      await loadSupport();
      toast.success('تم حفظ إعدادات الدعم');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر حفظ إعدادات الدعم'));
    } finally {
      setSaving(false);
    }
  };

  const exportTicketsExcel = async () => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Support Tickets');
    worksheet.addRow(['Ausar Military', 'Support & Help Center', new Date().toISOString()]);
    worksheet.addRow([]);
    worksheet.addRow(['رقم التذكرة', 'المؤسسة', 'القطاع', 'العنوان', 'النوع', 'الأولوية', 'الحالة', 'المسؤول', 'تاريخ الإنشاء', 'آخر تحديث']);
    filteredTickets.forEach((ticket) => worksheet.addRow([
      ticket.ticketNumber,
      ticket.institutionName || 'غير متوفر',
      ticket.institutionType ? getTypeLabel(ticket.institutionType) : 'غير متوفر',
      ticket.title,
      supportCategoryLabel(ticket.category),
      supportPriorityLabel(ticket.priority),
      supportStatusLabel(ticket.status),
      ticket.assignedToName || 'غير معين',
      formatDate(ticket.createdAt),
      formatDate(ticket.updatedAt),
    ]));
    worksheet.columns.forEach((column) => { column.width = 24; });
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBrowserBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Ausar Military-support-tickets-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('تم تصدير التذاكر Excel');
  };

  return (
    <section className="space-y-5" dir="rtl">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>الرئيسية</span>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>الدعم والمساعدة</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">الدعم والمساعدة</h1>
          <p className="mt-1 text-sm text-slate-500">مركز متابعة طلبات الدعم، مشاكل المؤسسات، الأسئلة الشائعة ودليل استخدام المنصة</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={openCreateTicket}>
            <Plus className="ml-2 h-4 w-4" />
            إنشاء تذكرة دعم
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" disabled={loading} onClick={() => void loadSupport()}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => void exportTicketsExcel()}>
            <Download className="ml-2 h-4 w-4" />
            تصدير التذاكر
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => setSettingsOpen(true)}>
            <Settings className="ml-2 h-4 w-4" />
            إعدادات الدعم
          </Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <NotificationKpi label="إجمالي التذاكر" value={formatNumber(stats.total)} helper="كل طلبات الدعم" icon={FileText} tone="bg-blue-50 text-blue-700" />
        <NotificationKpi label="تذاكر مفتوحة" value={formatNumber(stats.open)} helper="تحتاج متابعة" icon={Bell} tone="bg-indigo-50 text-indigo-700" />
        <NotificationKpi label="قيد المعالجة" value={formatNumber(stats.inProgress)} helper="لدى فريق الدعم" icon={Clock} tone="bg-orange-50 text-orange-700" />
        <NotificationKpi label="تم حلها" value={formatNumber(stats.resolved)} helper="مغلقة أو محلولة" icon={Check} tone="bg-emerald-50 text-emerald-700" />
        <NotificationKpi label="عالية الأولوية" value={formatNumber(stats.high)} helper="حرجة للتشغيل" icon={ShieldCheck} tone="bg-rose-50 text-rose-700" />
        <NotificationKpi label="متوسط الاستجابة" value={stats.avgResponse} helper="محسوب من الردود" icon={Activity} tone="bg-violet-50 text-violet-700" />
      </div>

      {!schemaReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          جداول الدعم غير مطبقة بعد. طبق migration v2.5.8 لتفعيل إنشاء التذاكر والردود.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <div className="xl:col-span-2">
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="ابحث في التذاكر..." className="h-10 rounded-lg border-slate-200 bg-white" />
              </div>
              <Select value={sectorFilter} onValueChange={(value) => setSectorFilter(value as SectorId)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل القطاعات</SelectItem>
                  <SelectItem value="university">جامعات</SelectItem>
                  <SelectItem value="school">مؤسسات تربوية</SelectItem>
                  <SelectItem value="primary_school">مدارس ابتدائية</SelectItem>
                  <SelectItem value="training">مراكز تكوين</SelectItem>
                  <SelectItem value="company">شركات</SelectItem>
                </SelectContent>
              </Select>
              <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المؤسسات</SelectItem>
                  {institutions.map((institution) => <SelectItem key={institution.id} value={institution.id}>{institution.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as 'all' | SupportTicketCategory)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {supportCategoryOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as 'all' | SupportTicketPriority)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأولويات</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="low">منخفضة</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | SupportTicketStatus)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  {supportStatusOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المسؤولين</SelectItem>
                  <SelectItem value="unassigned">غير معين</SelectItem>
                  {admins.map((admin) => <SelectItem key={admin.id} value={admin.id}>{admin.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as 'all' | 'today' | '7d' | '30d' | 'month')}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">آخر 30 يوم</SelectItem>
                  <SelectItem value="7d">آخر 7 أيام</SelectItem>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="month">هذا الشهر</SelectItem>
                  <SelectItem value="all">كل الفترات</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SupportSortMode)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">آخر تحديث</SelectItem>
                  <SelectItem value="newest">الأحدث أولاً</SelectItem>
                  <SelectItem value="priority">الأعلى أولوية</SelectItem>
                  <SelectItem value="open_first">المفتوحة أولاً</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Panel title="تذاكر الدعم" subtitle="طلبات المؤسسات والمستخدمين المرتبطة بالتشغيل" icon={ShieldCheck}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-right text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-bold">رقم التذكرة</th>
                    <th className="px-3 py-3 font-bold">المؤسسة</th>
                    <th className="px-3 py-3 font-bold">القطاع</th>
                    <th className="px-3 py-3 font-bold">العنوان</th>
                    <th className="px-3 py-3 font-bold">النوع</th>
                    <th className="px-3 py-3 font-bold">الأولوية</th>
                    <th className="px-3 py-3 font-bold">الحالة</th>
                    <th className="px-3 py-3 font-bold">المسؤول</th>
                    <th className="px-3 py-3 font-bold">آخر تحديث</th>
                    <th className="px-3 py-3 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">جاري تحميل تذاكر الدعم...</td></tr>
                  ) : visibleTickets.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center">
                        <p className="font-black text-slate-700">لا توجد تذاكر دعم حالياً</p>
                        <p className="mt-1 text-sm text-slate-500">ستظهر هنا طلبات الدعم القادمة من المؤسسات والمستخدمين.</p>
                        <Button className="mt-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={openCreateTicket}>إنشاء تذكرة دعم</Button>
                      </td>
                    </tr>
                  ) : (
                    visibleTickets.map((ticket) => (
                      <tr key={ticket.id} className={selectedTicket?.id === ticket.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'}>
                        <td className="px-3 py-3 font-black text-blue-700">{ticket.ticketNumber}</td>
                        <td className="px-3 py-3 font-bold text-slate-950">{ticket.institutionName || 'غير محددة'}</td>
                        <td className="px-3 py-3 text-slate-600">{ticket.institutionType ? getTypeLabel(ticket.institutionType) : 'غير متوفر'}</td>
                        <td className="max-w-[240px] px-3 py-3">
                          <div className="truncate font-bold text-slate-950">{ticket.title}</div>
                          <div className="truncate text-xs text-slate-500">{ticket.description}</div>
                        </td>
                        <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{supportCategoryLabel(ticket.category)}</span></td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${supportPriorityClass(ticket.priority)}`}>{supportPriorityLabel(ticket.priority)}</span></td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${supportStatusClass(ticket.status)}`}>{supportStatusLabel(ticket.status)}</span></td>
                        <td className="px-3 py-3 text-slate-600">{ticket.assignedToName || 'غير معين'}</td>
                        <td className="px-3 py-3 text-slate-500">{formatDate(ticket.updatedAt)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" className="h-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => setSelectedId(ticket.id)}>عرض التفاصيل</Button>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg border-slate-200" onClick={() => openReplyModal(ticket)}>إضافة رد</Button>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg border-slate-200" onClick={() => { setNextStatus(ticket.status); setStatusModalTicket(ticket); }}>تغيير الحالة</Button>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg border-slate-200" onClick={() => { setNextAssignee(ticket.assignedToAdminId || 'unassigned'); setAssignModalTicket(ticket); }}>تعيين مسؤول</Button>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => void updateTicketStatus(ticket, 'closed')}>إغلاق</Button>
                            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-rose-600 hover:bg-rose-50" onClick={() => setDeleteTicket(ticket)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <span className="text-xs text-slate-500">عرض {visibleTickets.length} من {filteredTickets.length} تذكرة</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-lg border-slate-200" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>السابق</Button>
                <span className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white">{Math.min(page, totalPages)}</span>
                <Button variant="outline" size="sm" className="rounded-lg border-slate-200" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>التالي</Button>
              </div>
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="مركز المعرفة" subtitle="أدلة تشغيلية مختصرة" icon={FileText}>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {supportKnowledgeArticles.map((article) => (
                  <article key={article.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <article.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-black text-slate-950">{article.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{article.description}</p>
                    <Button variant="outline" className="mt-3 rounded-lg border-slate-200" onClick={() => setGuideArticle(article)}>فتح الدليل</Button>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="الأسئلة الشائعة" subtitle="إجابات سريعة للمالك وفريق الدعم" icon={ShieldCheck}>
              <div className="divide-y divide-slate-100 p-4">
                {supportFaqItems.map((faq) => (
                  <button key={faq.id} type="button" className="w-full py-3 text-right" onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black text-slate-950">{faq.question}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition ${openFaqId === faq.id ? 'rotate-180' : ''}`} />
                    </div>
                    {openFaqId === faq.id && <p className="mt-2 text-sm leading-6 text-slate-500">{faq.answer}</p>}
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <aside className="space-y-4">
          <Panel title="تفاصيل التذكرة" icon={Eye}>
            {selectedTicket ? (
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black text-slate-950">{selectedTicket.ticketNumber}</h2>
                    <p className="mt-1 text-sm text-slate-500">{selectedTicket.title}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${supportStatusClass(selectedTicket.status)}`}>{supportStatusLabel(selectedTicket.status)}</span>
                </div>
                <div className="grid gap-2">
                  <DetailPill label="المؤسسة" value={selectedTicket.institutionName || 'غير محددة'} />
                  <DetailPill label="القطاع" value={selectedTicket.institutionType ? getTypeLabel(selectedTicket.institutionType) : 'غير متوفر'} />
                  <DetailPill label="نوع المشكلة" value={supportCategoryLabel(selectedTicket.category)} />
                  <DetailPill label="الأولوية" value={supportPriorityLabel(selectedTicket.priority)} />
                  <DetailPill label="المسؤول" value={selectedTicket.assignedToName || 'غير معين'} />
                  <DetailPill label="تاريخ الإنشاء" value={formatDate(selectedTicket.createdAt)} />
                  <DetailPill label="آخر تحديث" value={formatDate(selectedTicket.updatedAt)} />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">الوصف الكامل</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{selectedTicket.description}</p>
                  {selectedTicket.internalNotes && <p className="mt-2 text-xs text-slate-500">ملاحظات داخلية: {selectedTicket.internalNotes}</p>}
                </div>
                <div className="rounded-lg border border-slate-200">
                  <div className="border-b border-slate-100 px-3 py-2 text-sm font-black text-slate-950">سجل الردود</div>
                  <div className="max-h-48 space-y-2 overflow-y-auto p-3">
                    {selectedTicket.replies.length === 0 ? (
                      <p className="text-sm text-slate-500">لا توجد ردود بعد.</p>
                    ) : selectedTicket.replies.map((reply) => (
                      <div key={reply.id} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{reply.authorName || 'الدعم'}</span>
                          <span>{formatDate(reply.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{reply.message}</p>
                        <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{reply.replyType === 'internal' ? 'رد داخلي' : 'رد موجه للمؤسسة'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => openReplyModal(selectedTicket)}>إضافة رد</Button>
                  <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => { setNextStatus(selectedTicket.status); setStatusModalTicket(selectedTicket); }}>تغيير الحالة</Button>
                  <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => { setNextAssignee(selectedTicket.assignedToAdminId || 'unassigned'); setAssignModalTicket(selectedTicket); }}>تعيين مسؤول</Button>
                  <Button variant="outline" className="rounded-lg border-slate-200" disabled={!selectedTicket.institutionId} onClick={() => {
                    const inst = selectedTicket.institutionId ? institutionMap.get(selectedTicket.institutionId) : null;
                    if (inst) onOpenInstitution(inst);
                  }}>فتح المؤسسة</Button>
                  <Button variant="outline" className="rounded-lg border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => void updateTicketStatus(selectedTicket, 'closed')}>إغلاق التذكرة</Button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-slate-500">اختر تذكرة لعرض التفاصيل</div>
            )}
          </Panel>

          <Panel title="قنوات الدعم" icon={Phone}>
            <div className="space-y-3 p-4">
              <SupportChannel label="البريد الإلكتروني" value={settings.supportEmail} icon={Mail} />
              <SupportChannel label="واتساب / هاتف" value={settings.whatsappNumber || settings.supportPhone} icon={Phone} />
              <SupportChannel label="مركز المساعدة" value={settings.helpCenterUrl} icon={Globe2} />
              <SupportChannel label="طلب تدريب" value={settings.demoRequestUrl} icon={GraduationCap} />
              <SupportChannel label="طلب عرض تجريبي" value={settings.demoRequestUrl} icon={Briefcase} />
              <Button variant="outline" className="w-full rounded-lg border-slate-200" onClick={() => setSettingsOpen(true)}>ضبط معلومات الدعم</Button>
            </div>
          </Panel>
        </aside>
      </div>

      {ticketModalOpen && (
        <SupportTicketModal
          form={ticketForm}
          institutions={institutions}
          admins={admins}
          saving={saving}
          onChange={setTicketForm}
          onClose={() => setTicketModalOpen(false)}
          onSave={() => void createTicket()}
        />
      )}

      {replyModalTicket && (
        <SupportReplyModal
          ticket={replyModalTicket}
          form={replyForm}
          saving={saving}
          onChange={setReplyForm}
          onClose={() => setReplyModalTicket(null)}
          onSave={() => void addReply()}
        />
      )}

      {statusModalTicket && (
        <SupportStatusModal
          ticket={statusModalTicket}
          status={nextStatus}
          saving={saving}
          onChange={setNextStatus}
          onClose={() => setStatusModalTicket(null)}
          onSave={() => void updateTicketStatus(statusModalTicket, nextStatus)}
        />
      )}

      {assignModalTicket && (
        <SupportAssignModal
          ticket={assignModalTicket}
          admins={admins}
          assignee={nextAssignee}
          saving={saving}
          onChange={setNextAssignee}
          onClose={() => setAssignModalTicket(null)}
          onSave={() => void assignTicket(assignModalTicket, nextAssignee)}
        />
      )}

      {deleteTicket && (
        <ConfirmDialog
          title="حذف تذكرة الدعم"
          description={`سيتم حذف التذكرة ${deleteTicket.ticketNumber} وردودها. لا يتم حذف أي مؤسسة أو بيانات حضور.`}
          confirmLabel="حذف"
          loading={saving}
          onClose={() => setDeleteTicket(null)}
          onConfirm={() => void deleteSupportTicket()}
        />
      )}

      {settingsOpen && (
        <SupportSettingsModal
          initialSettings={settings}
          saving={saving}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) => void saveSupportSettings(next)}
        />
      )}

      {guideArticle && (
        <SupportGuideDialog article={guideArticle} onClose={() => setGuideArticle(null)} />
      )}
    </section>
  );
}

interface SupportGuideArticle {
  id: string;
  title: string;
  description: string;
  body: string;
  icon: LucideIcon;
}

const supportCategoryOptions: { value: SupportTicketCategory; label: string }[] = [
  { value: 'technical', label: 'مشكلة تقنية' },
  { value: 'activation', label: 'طلب تفعيل' },
  { value: 'attendance', label: 'مشكلة حضور' },
  { value: 'device', label: 'مشكلة جهاز' },
  { value: 'billing', label: 'اشتراك وفوترة' },
  { value: 'training', label: 'طلب تدريب' },
  { value: 'general', label: 'استفسار عام' },
];

const supportStatusOptions: { value: SupportTicketStatus; label: string }[] = [
  { value: 'open', label: 'مفتوحة' },
  { value: 'in_progress', label: 'قيد المعالجة' },
  { value: 'waiting_institution', label: 'في انتظار رد المؤسسة' },
  { value: 'resolved', label: 'تم حلها' },
  { value: 'closed', label: 'مغلقة' },
];

const supportKnowledgeArticles: SupportGuideArticle[] = [
  { id: 'quick-start', title: 'دليل البدء السريع', description: 'خطوات تشغيل منصة Ausar Military لأول مؤسسة.', body: 'ابدأ بإضافة المؤسسة، إنشاء حساب المدير، إدخال الأساتذة والطلاب، ثم إنشاء أول حصة حضور واختبار QR Code قبل الاعتماد الرسمي.', icon: PlayCircle },
  { id: 'create-institution', title: 'كيفية إنشاء مؤسسة', description: 'إضافة جامعة، مدرسة، مركز تكوين أو شركة.', body: 'من لوحة المالك اختر إضافة مؤسسة، أدخل الاسم والقطاع والولاية والسعة، ثم أنشئ حساب المدير واحفظ بيانات الدخول في قناة آمنة.', icon: Building2 },
  { id: 'add-teacher', title: 'كيفية إضافة أستاذ', description: 'إنشاء مستخدم إداري مرتبط بالمؤسسة.', body: 'افتح ملف المؤسسة ثم المستخدمون، أضف أستاذاً أو مديراً، واربطه بالمؤسسة الصحيحة حتى تظهر له الحصص والطلاب الخاصون به.', icon: UserPlus },
  { id: 'create-session', title: 'كيفية إنشاء حصة حضور', description: 'إعداد جلسة حضور آمنة.', body: 'الأستاذ يحدد الفوج والحصة، يفتح الجلسة، ثم يشارك QR أو رمز الحضور ضمن الوقت والموقع المسموحين إن كانت القيود مفعلة.', icon: Activity },
  { id: 'qr-code', title: 'كيفية استعمال QR Code', description: 'تسجيل حضور الطالب عبر الهاتف.', body: 'يفتح الطالب التطبيق، يمسح QR، يؤكد بياناته، ثم ترسل البصمة والجلسة إلى Supabase ليتم التحقق وتسجيل الحضور.', icon: Smartphone },
  { id: 'device-reset', title: 'كيفية إعادة تعيين جهاز طالب', description: 'التعامل مع تغيير الهاتف.', body: 'راجع طلب الطالب، تحقق من هويته داخل المؤسسة، ثم عطّل الجهاز القديم واربط الجهاز الجديد مع الاحتفاظ بسجل المراجعة.', icon: ShieldCheck },
  { id: 'billing', title: 'إدارة الاشتراكات والفوترة', description: 'متابعة الباقات والدفع اليدوي.', body: 'من الاشتراكات والفوترة راقب حالة الباقة وتاريخ النهاية وحالة الدفع، وسجل التجديدات اليدوية حسب الفاتورة أو التحويل البنكي.', icon: CreditCard },
  { id: 'reports', title: 'تصدير التقارير', description: 'PDF وExcel للعرض الإداري.', body: 'من التقارير والتحليلات اختر الفترة والمؤسسة أو القطاع، ثم صدّر Excel أو PDF حسب البيانات المتاحة في النظام.', icon: FileText },
];

const supportFaqItems = [
  { id: 'add-institution', question: 'كيف أضيف مؤسسة جديدة؟', answer: 'من لوحة المالك اضغط إضافة مؤسسة، اختر القطاع، أدخل البيانات الأساسية، ثم أنشئ حساب المدير الخاص بها.' },
  { id: 'device-link', question: 'كيف يتم ربط الطالب بجهازه؟', answer: 'عند أول حضور ناجح يتم حفظ بصمة الجهاز مع الطالب، وبعدها يمنع النظام استعمال نفس الطالب من جهاز مختلف بدون مراجعة.' },
  { id: 'changed-phone', question: 'ماذا يحدث إذا غير الطالب هاتفه؟', answer: 'يحتاج طلب إعادة تعيين جهاز. لا يتم حذف السجل القديم، بل يعطل ويربط جهاز جديد بعد تحقق الإدارة.' },
  { id: 'anti-fraud', question: 'كيف يتم منع تسجيل حضور طالب آخر؟', answer: 'يعتمد النظام على تحقق الطالب، الجلسة، وبصمة الجهاز المسجلة لتقليل تسجيل الحضور بالنيابة.' },
  { id: 'export-report', question: 'كيف أصدّر تقرير حضور؟', answer: 'افتح التقارير والتحليلات أو ملف المؤسسة، اختر الفترة، ثم استخدم تصدير Excel أو PDF.' },
  { id: 'stop-subscription', question: 'كيف أوقف اشتراك مؤسسة؟', answer: 'من الاشتراكات والفوترة افتح تفاصيل الاشتراك واضغط إيقاف دون حذف بيانات المؤسسة.' },
  { id: 'schools-no-phones', question: 'هل يمكن استعمال Ausar Military في المدارس بدون هواتف للتلاميذ؟', answer: 'نعم يمكن تشغيل سيناريو إداري حيث يقوم الأستاذ أو الإدارة بتسجيل الحضور من لوحة الويب حسب سياسة المؤسسة.' },
];

async function loadSupportSnapshot(institutions: Institution[]) {
  const institutionById = new Map(institutions.map((item) => [item.id, item]));
  const [ticketsResult, repliesResult, adminsResult, settingsResult] = await Promise.all([
    supabase.from('support_tickets').select('*').order('updated_at', { ascending: false }).limit(1000),
    supabase.from('support_ticket_replies').select('*').order('created_at', { ascending: true }).limit(2000),
    supabase.from('admins').select('id,username,full_name,role').order('created_at', { ascending: false }).limit(500),
    supabase.from('support_settings').select('*').order('created_at', { ascending: true }).limit(1),
  ]);

  const schemaReady = !ticketsResult.error && !repliesResult.error && !settingsResult.error;
  if (!schemaReady) return { tickets: [], admins: [], settings: emptySupportSettings(), schemaReady };
  if (adminsResult.error) throw adminsResult.error;

  const adminRows = adminsResult.data || [];
  const adminById = new Map(adminRows.map((row) => [row.id, row]));
  const admins: SupportAdminOption[] = adminRows.map((row) => ({
    id: row.id,
    label: adminDisplayName(row),
    role: row.role || 'admin',
  }));
  const repliesByTicket = new Map<string, SupportTicketReply[]>();
  ((repliesResult.data || []) as SupportTicketReplyDbRow[]).forEach((reply) => {
    const mapped = mapSupportReply(reply, adminById);
    repliesByTicket.set(reply.ticket_id, [...(repliesByTicket.get(reply.ticket_id) || []), mapped]);
  });

  const tickets = ((ticketsResult.data || []) as SupportTicketDbRow[]).map((row) => mapSupportTicket(row, institutionById, adminById, repliesByTicket.get(row.id) || []));
  const firstSettings = (settingsResult.data?.[0] as SupportSettingsDbRow | undefined) || null;
  return { tickets, admins, settings: firstSettings ? mapSupportSettings(firstSettings) : emptySupportSettings(), schemaReady };
}

function mapSupportTicket(row: SupportTicketDbRow, institutions: Map<string, Institution>, admins: Map<string, { username?: string | null; fullName?: string | null; full_name?: string | null; role?: string | null }>, replies: SupportTicketReply[]): SupportTicket {
  const institution = row.institution_id ? institutions.get(row.institution_id) || null : null;
  const assignee = row.assigned_to_admin_id ? admins.get(row.assigned_to_admin_id) : null;
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    institutionId: row.institution_id,
    institutionName: institution?.name || null,
    institutionType: institution ? normalizeInstitutionType(institution.type) : null,
    createdByAdminId: row.created_by_admin_id,
    assignedToAdminId: row.assigned_to_admin_id,
    assignedToName: assignee ? adminDisplayName(assignee) : null,
    category: normalizeSupportCategory(row.category),
    priority: normalizeSupportPriority(row.priority),
    status: normalizeSupportStatus(row.status),
    title: row.title,
    description: row.description,
    internalNotes: row.internal_notes,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    replies,
  };
}

function mapSupportReply(row: SupportTicketReplyDbRow, admins: Map<string, { username?: string | null; fullName?: string | null; full_name?: string | null; role?: string | null }>): SupportTicketReply {
  const author = row.author_admin_id ? admins.get(row.author_admin_id) : null;
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorAdminId: row.author_admin_id,
    authorName: author ? adminDisplayName(author) : null,
    replyType: row.reply_type === 'institution' ? 'institution' : 'internal',
    message: row.message,
    createdAt: row.created_at,
  };
}

function mapSupportSettings(row: SupportSettingsDbRow): SupportSettingsState {
  return {
    id: row.id,
    supportEmail: row.support_email || '',
    supportPhone: row.support_phone || '',
    whatsappNumber: row.whatsapp_number || '',
    helpCenterUrl: row.help_center_url || '',
    demoRequestUrl: row.demo_request_url || '',
  };
}

function emptySupportSettings(): SupportSettingsState {
  return { id: null, supportEmail: '', supportPhone: '', whatsappNumber: '', helpCenterUrl: '', demoRequestUrl: '' };
}

function emptySupportTicketForm(): SupportTicketFormState {
  return { institutionId: 'none', category: 'technical', title: '', description: '', priority: 'medium', assignedToAdminId: 'unassigned', internalNotes: '' };
}

function generateSupportTicketNumber() {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TK-${date}-${suffix}`;
}

function buildSupportStats(tickets: SupportTicket[]) {
  const firstReplyMinutes = tickets.map((ticket) => {
    const firstReply = ticket.replies[0];
    return firstReply ? Math.max(0, Math.round((new Date(firstReply.createdAt).getTime() - new Date(ticket.createdAt).getTime()) / 60000)) : null;
  }).filter((value): value is number => typeof value === 'number');
  const average = firstReplyMinutes.length > 0 ? Math.round(firstReplyMinutes.reduce((sum, value) => sum + value, 0) / firstReplyMinutes.length) : null;
  return {
    total: tickets.length,
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    inProgress: tickets.filter((ticket) => ticket.status === 'in_progress' || ticket.status === 'waiting_institution').length,
    resolved: tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length,
    high: tickets.filter((ticket) => ticket.priority === 'high').length,
    avgResponse: average === null ? 'غير متوفر' : `${average} د`,
  };
}

function supportDateRange(filter: 'all' | 'today' | '7d' | '30d' | 'month') {
  if (filter === 'all') return { from: null };
  const now = new Date();
  const from = new Date(now);
  if (filter === 'today') from.setHours(0, 0, 0, 0);
  if (filter === '7d') {
    from.setDate(now.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  }
  if (filter === '30d') {
    from.setDate(now.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  }
  if (filter === 'month') {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }
  return { from };
}

function normalizeSupportCategory(value: string): SupportTicketCategory {
  if (value === 'technical' || value === 'activation' || value === 'attendance' || value === 'device' || value === 'billing' || value === 'training' || value === 'general') return value;
  return 'general';
}

function normalizeSupportPriority(value: string): SupportTicketPriority {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
}

function normalizeSupportStatus(value: string): SupportTicketStatus {
  if (value === 'open' || value === 'in_progress' || value === 'waiting_institution' || value === 'resolved' || value === 'closed') return value;
  return 'open';
}

function supportCategoryLabel(value: SupportTicketCategory) {
  return supportCategoryOptions.find((item) => item.value === value)?.label || 'استفسار عام';
}

function supportPriorityLabel(value: SupportTicketPriority) {
  if (value === 'high') return 'عالية';
  if (value === 'low') return 'منخفضة';
  return 'متوسطة';
}

function supportStatusLabel(value: SupportTicketStatus) {
  return supportStatusOptions.find((item) => item.value === value)?.label || 'مفتوحة';
}

function supportPriorityClass(value: SupportTicketPriority) {
  if (value === 'high') return 'bg-rose-50 text-rose-700';
  if (value === 'low') return 'bg-slate-100 text-slate-600';
  return 'bg-orange-50 text-orange-700';
}

function supportStatusClass(value: SupportTicketStatus) {
  if (value === 'resolved' || value === 'closed') return 'bg-emerald-50 text-emerald-700';
  if (value === 'in_progress') return 'bg-blue-50 text-blue-700';
  if (value === 'waiting_institution') return 'bg-orange-50 text-orange-700';
  return 'bg-violet-50 text-violet-700';
}

function supportPriorityWeight(value: SupportTicketPriority) {
  return value === 'high' ? 3 : value === 'medium' ? 2 : 1;
}

function supportStatusWeight(value: SupportTicketStatus) {
  if (value === 'open') return 5;
  if (value === 'in_progress') return 4;
  if (value === 'waiting_institution') return 3;
  if (value === 'resolved') return 2;
  return 1;
}

function SupportChannel({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <p className={`mt-1 text-sm font-black ${value ? 'text-slate-950' : 'text-slate-400'}`}>{value || 'غير مضبوط حالياً'}</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

function SupportTicketModal({ form, institutions, admins, saving, onChange, onClose, onSave }: {
  form: SupportTicketFormState;
  institutions: Institution[];
  admins: SupportAdminOption[];
  saving: boolean;
  onChange: (form: SupportTicketFormState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black text-slate-950">إنشاء تذكرة دعم</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>المؤسسة</Label>
            <Select value={form.institutionId} onValueChange={(value) => onChange({ ...form, institutionId: value })}>
              <SelectTrigger className="rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">اختر مؤسسة</SelectItem>
                {institutions.map((institution) => <SelectItem key={institution.id} value={institution.id}>{institution.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>نوع التذكرة</Label>
            <Select value={form.category} onValueChange={(value) => onChange({ ...form, category: value as SupportTicketCategory })}>
              <SelectTrigger className="rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>{supportCategoryOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الأولوية</Label>
            <Select value={form.priority} onValueChange={(value) => onChange({ ...form, priority: value as SupportTicketPriority })}>
              <SelectTrigger className="rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="low">منخفضة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>العنوان</Label>
            <Input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} className="rounded-lg border-slate-200" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>الوصف</Label>
            <Textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} className="min-h-28 rounded-lg border-slate-200" />
          </div>
          <div className="space-y-2">
            <Label>المسؤول المعين</Label>
            <Select value={form.assignedToAdminId} onValueChange={(value) => onChange({ ...form, assignedToAdminId: value })}>
              <SelectTrigger className="rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">غير معين</SelectItem>
                {admins.map((admin) => <SelectItem key={admin.id} value={admin.id}>{admin.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>ملاحظات داخلية</Label>
            <Input value={form.internalNotes} onChange={(event) => onChange({ ...form, internalNotes: event.target.value })} className="rounded-lg border-slate-200" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>إلغاء</Button>
          <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={onSave}>حفظ التذكرة</Button>
        </div>
      </div>
    </div>
  );
}

function SupportReplyModal({ ticket, form, saving, onChange, onClose, onSave }: {
  ticket: SupportTicket;
  form: SupportReplyFormState;
  saving: boolean;
  onChange: (form: SupportReplyFormState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black text-slate-950">إضافة رد</h2>
        <p className="mt-1 text-sm text-slate-500">{ticket.ticketNumber} - {ticket.title}</p>
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label>نص الرد</Label>
            <Textarea value={form.message} onChange={(event) => onChange({ ...form, message: event.target.value })} className="min-h-32 rounded-lg border-slate-200" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>نوع الرد</Label>
              <Select value={form.replyType} onValueChange={(value) => onChange({ ...form, replyType: value as SupportReplyType })}>
                <SelectTrigger className="rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">رد داخلي</SelectItem>
                  <SelectItem value="institution">رد موجه للمؤسسة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تحديث الحالة</Label>
              <Select value={form.nextStatus} onValueChange={(value) => onChange({ ...form, nextStatus: value as 'no_change' | SupportTicketStatus })}>
                <SelectTrigger className="rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_change">بدون تغيير</SelectItem>
                  {supportStatusOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>إلغاء</Button>
          <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={onSave}>حفظ الرد</Button>
        </div>
      </div>
    </div>
  );
}

function SupportStatusModal({ ticket, status, saving, onChange, onClose, onSave }: {
  ticket: SupportTicket;
  status: SupportTicketStatus;
  saving: boolean;
  onChange: (status: SupportTicketStatus) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black text-slate-950">تغيير حالة التذكرة</h2>
        <p className="mt-1 text-sm text-slate-500">{ticket.ticketNumber}</p>
        <div className="mt-5 space-y-2">
          <Label>الحالة الجديدة</Label>
          <Select value={status} onValueChange={(value) => onChange(value as SupportTicketStatus)}>
            <SelectTrigger className="rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>{supportStatusOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>إلغاء</Button>
          <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={onSave}>حفظ الحالة</Button>
        </div>
      </div>
    </div>
  );
}

function SupportAssignModal({ ticket, admins, assignee, saving, onChange, onClose, onSave }: {
  ticket: SupportTicket;
  admins: SupportAdminOption[];
  assignee: string;
  saving: boolean;
  onChange: (adminId: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black text-slate-950">تعيين مسؤول</h2>
        <p className="mt-1 text-sm text-slate-500">{ticket.ticketNumber}</p>
        <div className="mt-5 space-y-2">
          <Label>المسؤول</Label>
          <Select value={assignee} onValueChange={onChange}>
            <SelectTrigger className="rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">غير معين</SelectItem>
              {admins.map((admin) => <SelectItem key={admin.id} value={admin.id}>{admin.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>إلغاء</Button>
          <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={onSave}>حفظ التعيين</Button>
        </div>
      </div>
    </div>
  );
}

function SupportSettingsModal({ initialSettings, saving, onClose, onSave }: {
  initialSettings: SupportSettingsState;
  saving: boolean;
  onClose: () => void;
  onSave: (settings: SupportSettingsState) => void;
}) {
  const [draft, setDraft] = useState(initialSettings);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black text-slate-950">إعدادات الدعم</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input value={draft.supportEmail} onChange={(event) => setDraft({ ...draft, supportEmail: event.target.value })} className="rounded-lg border-slate-200" /></div>
          <div className="space-y-2"><Label>الهاتف</Label><Input value={draft.supportPhone} onChange={(event) => setDraft({ ...draft, supportPhone: event.target.value })} className="rounded-lg border-slate-200" /></div>
          <div className="space-y-2"><Label>واتساب</Label><Input value={draft.whatsappNumber} onChange={(event) => setDraft({ ...draft, whatsappNumber: event.target.value })} className="rounded-lg border-slate-200" /></div>
          <div className="space-y-2"><Label>رابط مركز المساعدة</Label><Input value={draft.helpCenterUrl} onChange={(event) => setDraft({ ...draft, helpCenterUrl: event.target.value })} className="rounded-lg border-slate-200" /></div>
          <div className="space-y-2 md:col-span-2"><Label>رابط طلب عرض/تدريب</Label><Input value={draft.demoRequestUrl} onChange={(event) => setDraft({ ...draft, demoRequestUrl: event.target.value })} className="rounded-lg border-slate-200" /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>إلغاء</Button>
          <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={saving} onClick={() => onSave(draft)}>حفظ الإعدادات</Button>
        </div>
      </div>
    </div>
  );
}

function SupportGuideDialog({ article, onClose }: { article: SupportGuideArticle; onClose: () => void }) {
  const Icon = article.icon;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-950">{article.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{article.description}</p>
          </div>
        </div>
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{article.body}</p>
        <div className="mt-5 flex justify-end">
          <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={onClose}>تم</Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, description, confirmLabel, loading, onClose, onConfirm }: {
  title: string;
  description: string;
  confirmLabel: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>إلغاء</Button>
          <Button className="rounded-lg bg-rose-600 text-white hover:bg-rose-700" disabled={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

const activityCategoryTabs: { id: ActivityLogCategory; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'attendance', label: 'الحضور' },
  { id: 'security', label: 'الأمان' },
  { id: 'subscription', label: 'الاشتراكات' },
  { id: 'report', label: 'التقارير' },
  { id: 'user', label: 'المستخدمون' },
  { id: 'institution', label: 'المؤسسات' },
  { id: 'system', label: 'النظام' },
];

async function loadOwnerActivitySnapshot(institutions: Institution[]): Promise<ActivitySnapshot> {
  const institutionById = new Map(institutions.map((item) => [item.id, item]));
  const [
    sessionsResult,
    attendancesResult,
    devicesResult,
    subscriptionsResult,
    notificationsResult,
    settingsAuditResult,
    adminsResult,
    studentsResult,
  ] = await Promise.all([
    supabase.from('sessions').select('id,title,code,status,created_at,institution_id,createdBy,created_by,professor_id').order('created_at', { ascending: false }).limit(500),
    supabase.from('attendances').select('id,session_id,student_id,method,device_fingerprint,institution_id,timestamp,created_at').order('created_at', { ascending: false }).limit(800),
    supabase.from('student_devices').select('id,student_id,device_fingerprint,institution_id,is_active,last_used,created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('subscriptions').select('id,institution_id,plan_type,plan_name,status,payment_status,end_date,current_period_end,created_at,updated_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('notifications').select('id,institution_id,actor_admin_id,type,category,priority,title,message,status,metadata,created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('platform_setting_audit_logs').select('id,setting_key,action,changed_by,created_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('admins').select('id,username,full_name,role,institution_id,created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('students').select('id,student_number,first_name,last_name,institution_id,created_at').order('created_at', { ascending: false }).limit(500),
  ]);

  const activityLogsResult = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(1000);
  const schemaReady = !activityLogsResult.error;
  const storedRows = schemaReady ? ((activityLogsResult.data || []) as ActivityLogDbRow[]) : [];
  const storedItems = storedRows.map((row) => mapStoredActivity(row, institutionById));
  const storedBySource = new Map(storedItems.filter((item) => item.sourceKey).map((item) => [item.sourceKey, item]));

  const adminRows = adminsResult.error ? [] : (adminsResult.data || []);
  const studentRows = studentsResult.error ? [] : (studentsResult.data || []);
  const adminById = new Map(adminRows.map((row) => [row.id, row]));
  const studentById = new Map(studentRows.map((row) => [row.id, row]));
  const derived: OwnerActivityItem[] = [];

  (attendancesResult.error ? [] : (attendancesResult.data || [])).forEach((row) => {
    const createdAt = row.created_at || row.timestamp || new Date().toISOString();
    const institution = row.institution_id ? institutionById.get(row.institution_id) || null : null;
    const student = row.student_id ? studentById.get(row.student_id) : null;
    derived.push(makeDerivedActivity({
      sourceKey: `attendance:${row.id}`,
      category: 'attendance',
      type: 'attendance_registered',
      title: 'تم تسجيل حضور جديد',
      description: `تم تسجيل حضور ${student ? studentDisplayName(student) : 'طالب'} بطريقة ${row.method || 'غير محددة'}.`,
      institution,
      actorName: student ? studentDisplayName(student) : 'طالب',
      outcome: 'success',
      priority: 'info',
      createdAt,
      metadata: { attendance_id: row.id, session_id: row.session_id || null, student_id: row.student_id || null },
    }));
  });

  (sessionsResult.error ? [] : (sessionsResult.data || [])).forEach((row) => {
    const institution = row.institution_id ? institutionById.get(row.institution_id) || null : null;
    const actorId = row.created_by || row.createdBy || row.professor_id || null;
    const actor = actorId ? adminById.get(actorId) : null;
    derived.push(makeDerivedActivity({
      sourceKey: `session:${row.id}`,
      category: 'attendance',
      type: 'session_created',
      title: 'تم فتح حصة جديدة',
      description: `${row.title || 'حصة حضور'} ${row.code ? `برمز ${row.code}` : ''}`,
      institution,
      actorAdminId: actorId,
      actorName: actor ? adminDisplayName(actor) : 'أستاذ / إدارة',
      outcome: row.status === 'closed' ? 'pending' : 'success',
      priority: 'low',
      createdAt: row.created_at,
      metadata: { session_id: row.id, status: row.status },
    }));
  });

  (devicesResult.error ? [] : (devicesResult.data || [])).forEach((row) => {
    const institution = row.institution_id ? institutionById.get(row.institution_id) || null : null;
    const student = row.student_id ? studentById.get(row.student_id) : null;
    derived.push(makeDerivedActivity({
      sourceKey: `device:${row.id}`,
      category: 'security',
      type: row.is_active === false ? 'device_inactive' : 'device_linked',
      title: row.is_active === false ? 'جهاز غير نشط يحتاج مراجعة' : 'تم ربط جهاز جديد',
      description: `جهاز مرتبط بـ ${student ? studentDisplayName(student) : 'طالب'} ${row.device_fingerprint ? `(${String(row.device_fingerprint).slice(0, 10)}...)` : ''}`,
      institution,
      actorName: student ? studentDisplayName(student) : 'طالب',
      outcome: row.is_active === false ? 'warning' : 'success',
      priority: row.is_active === false ? 'medium' : 'info',
      createdAt: row.registered_at || row.created_at || row.last_used || new Date().toISOString(),
      metadata: { device_id: row.id, student_id: row.student_id, active: row.is_active },
    }));
  });

  (subscriptionsResult.error ? [] : (subscriptionsResult.data || [])).forEach((row) => {
    const institution = institutionById.get(row.institution_id) || null;
    const endDate = row.end_date || row.current_period_end || null;
    const daysRemaining = endDate ? Math.ceil((new Date(`${endDate}T00:00:00`).getTime() - Date.now()) / 86400000) : null;
    const outcome: ActivityLogOutcome = row.status === 'expired' || (daysRemaining !== null && daysRemaining < 0) ? 'rejected' : daysRemaining !== null && daysRemaining <= 15 ? 'warning' : 'success';
    derived.push(makeDerivedActivity({
      sourceKey: `subscription:${row.id}`,
      category: 'subscription',
      type: 'subscription_status',
      title: outcome === 'rejected' ? 'اشتراك منتهي' : outcome === 'warning' ? 'اشتراك قريب من الانتهاء' : 'تحديث حالة اشتراك',
      description: `الباقة ${row.plan_name || row.plan_type || 'غير محددة'}، الدفع ${row.payment_status || 'غير محدد'}.`,
      institution,
      outcome,
      priority: outcome === 'rejected' ? 'high' : outcome === 'warning' ? 'medium' : 'low',
      createdAt: row.updated_at || row.created_at,
      metadata: { subscription_id: row.id, payment_status: row.payment_status || null, days_remaining: daysRemaining },
    }));
  });

  if (!notificationsResult.error) {
    (notificationsResult.data || []).forEach((row) => {
      const institution = row.institution_id ? institutionById.get(row.institution_id) || null : null;
      derived.push(makeDerivedActivity({
        sourceKey: `notification:${row.id}`,
        category: normalizeActivityCategory(row.category),
        type: `notification_${row.type}`,
        title: row.title,
        description: row.message,
        institution,
        actorAdminId: row.actor_admin_id,
        actorName: row.actor_admin_id ? adminDisplayName(adminById.get(row.actor_admin_id)) : 'النظام',
        outcome: row.priority === 'high' ? 'warning' : 'pending',
        priority: normalizeNotificationPriority(row.priority || 'info'),
        createdAt: row.created_at,
        metadata: { notification_id: row.id, status: row.status, ...((row.metadata as Record<string, unknown>) || {}) },
      }));
    });
  }

  if (!settingsAuditResult.error) {
    (settingsAuditResult.data || []).forEach((row) => {
      derived.push(makeDerivedActivity({
        sourceKey: `settings:${row.id}`,
        category: 'system',
        type: 'platform_settings_changed',
        title: 'تحديث إعدادات المنصة',
        description: `تم تنفيذ ${settingsActionLabel(row.action)} على ${row.setting_key}.`,
        institution: null,
        actorAdminId: row.changed_by || null,
        actorName: row.changed_by ? adminDisplayName(adminById.get(row.changed_by)) : 'Ausar Military Owner',
        outcome: 'success',
        priority: 'medium',
        createdAt: row.created_at,
        metadata: { settings_audit_id: row.id, action: row.action, setting_key: row.setting_key },
      }));
    });
  }

  institutions.forEach((institution) => {
    if (!institution.created_at) return;
    derived.push(makeDerivedActivity({
      sourceKey: `institution:${institution.id}`,
      category: 'institution',
      type: 'institution_created',
      title: 'مؤسسة جديدة أضيفت',
      description: `تمت إضافة ${institution.name} إلى منصة Ausar Military.`,
      institution,
      actorName: 'Ausar Military Owner',
      outcome: 'success',
      priority: 'low',
      createdAt: institution.created_at,
      metadata: { institution_id: institution.id },
    }));
  });

  adminRows.forEach((row) => {
    const institution = row.institution_id ? institutionById.get(row.institution_id) || null : null;
    derived.push(makeDerivedActivity({
      sourceKey: `admin:${row.id}`,
      category: 'user',
      type: 'admin_created',
      title: 'إضافة مستخدم إداري',
      description: `${adminDisplayName(row)} بدور ${row.role || 'غير محدد'}.`,
      institution,
      actorName: adminDisplayName(row),
      outcome: 'success',
      priority: row.role === 'owner' || row.role === 'super_admin' ? 'medium' : 'low',
      createdAt: row.created_at || new Date().toISOString(),
      metadata: { admin_id: row.id, role: row.role || null },
    }));
  });

  studentRows.forEach((row) => {
    const institution = row.institution_id ? institutionById.get(row.institution_id) || null : null;
    derived.push(makeDerivedActivity({
      sourceKey: `student:${row.id}`,
      category: 'user',
      type: 'student_created',
      title: 'إضافة طالب جديد',
      description: `${studentDisplayName(row)} ${studentNumber(row) ? `رقم ${studentNumber(row)}` : ''}`,
      institution,
      actorName: studentDisplayName(row),
      outcome: 'success',
      priority: 'low',
      createdAt: row.created_at || new Date().toISOString(),
      metadata: { student_id: row.id },
    }));
  });

  const merged = [
    ...storedItems,
    ...derived.filter((item) => !storedBySource.has(item.sourceKey)),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { activities: merged, schemaReady };
}

function makeDerivedActivity(input: {
  sourceKey: string;
  category: Exclude<ActivityLogCategory, 'all'>;
  type: string;
  title: string;
  description: string;
  institution: Institution | null;
  actorName?: string | null;
  actorAdminId?: string | null;
  outcome: ActivityLogOutcome;
  priority: NotificationPriority;
  createdAt: string;
  metadata?: Record<string, unknown>;
}): OwnerActivityItem {
  return {
    id: input.sourceKey,
    source: 'derived',
    sourceKey: input.sourceKey,
    category: input.category,
    type: input.type,
    title: input.title,
    description: input.description,
    institutionId: input.institution?.id || null,
    institutionName: input.institution?.name || null,
    institutionType: input.institution ? normalizeInstitutionType(input.institution.type) : null,
    actorName: input.actorName || null,
    actorAdminId: input.actorAdminId || null,
    outcome: input.outcome,
    reviewStatus: 'open',
    priority: input.priority,
    metadata: input.metadata || {},
    ipAddress: typeof input.metadata?.ip_address === 'string' ? input.metadata.ip_address : null,
    userAgent: typeof input.metadata?.user_agent === 'string' ? input.metadata.user_agent : null,
    createdAt: input.createdAt,
    updatedAt: null,
  };
}

function mapStoredActivity(row: ActivityLogDbRow, institutions: Map<string, Institution>): OwnerActivityItem {
  const institution = row.institution_id ? institutions.get(row.institution_id) || null : null;
  return {
    id: row.id,
    source: 'stored',
    sourceKey: row.source_key || row.id,
    category: normalizeActivityCategory(row.category),
    type: row.type,
    title: row.title,
    description: row.description,
    institutionId: row.institution_id,
    institutionName: institution?.name || null,
    institutionType: institution ? normalizeInstitutionType(institution.type) : null,
    actorName: typeof row.metadata?.actor_name === 'string' ? row.metadata.actor_name : null,
    actorAdminId: row.actor_admin_id,
    outcome: normalizeActivityOutcome(row.outcome_status),
    reviewStatus: normalizeActivityReview(row.review_status),
    priority: normalizeNotificationPriority(row.priority),
    metadata: row.metadata || {},
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildActivityLogPersistPayload(item: OwnerActivityItem, reviewStatus: ActivityLogReviewStatus) {
  return {
    source_key: item.sourceKey,
    institution_id: item.institutionId,
    actor_admin_id: item.actorAdminId,
    category: item.category,
    type: item.type,
    title: item.title,
    description: item.description,
    outcome_status: item.outcome,
    review_status: reviewStatus,
    priority: item.priority,
    metadata: { ...item.metadata, actor_name: item.actorName, source: item.source },
    ip_address: item.ipAddress,
    user_agent: item.userAgent,
  };
}

function buildActivityStats(items: OwnerActivityItem[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    total: items.filter((item) => item.reviewStatus !== 'archived').length,
    today: items.filter((item) => item.reviewStatus !== 'archived' && new Date(item.createdAt).getTime() >= today.getTime()).length,
    users: items.filter((item) => item.reviewStatus !== 'archived' && item.category === 'user').length,
    security: items.filter((item) => item.reviewStatus !== 'archived' && item.category === 'security').length,
    system: items.filter((item) => item.reviewStatus !== 'archived' && (item.category === 'system' || item.category === 'report')).length,
    open: items.filter((item) => item.reviewStatus === 'open' && item.outcome !== 'success').length,
  };
}

function normalizeActivityCategory(value: string): Exclude<ActivityLogCategory, 'all'> {
  if (value === 'attendance' || value === 'security' || value === 'subscription' || value === 'report' || value === 'user' || value === 'institution' || value === 'system') return value;
  if (value === 'subscription') return 'subscription';
  return 'system';
}

function normalizeActivityOutcome(value: string): ActivityLogOutcome {
  if (value === 'success' || value === 'warning' || value === 'rejected' || value === 'pending') return value;
  return 'pending';
}

function normalizeActivityReview(value: string): ActivityLogReviewStatus {
  if (value === 'open' || value === 'reviewed' || value === 'archived') return value;
  return 'open';
}

function activityCategoryLabel(value: Exclude<ActivityLogCategory, 'all'>) {
  const labels: Record<Exclude<ActivityLogCategory, 'all'>, string> = {
    attendance: 'الحضور',
    security: 'الأمان',
    subscription: 'الاشتراكات',
    report: 'التقارير',
    user: 'المستخدمون',
    institution: 'المؤسسات',
    system: 'النظام',
  };
  return labels[value];
}

function activityOutcomeLabel(value: ActivityLogOutcome) {
  const labels: Record<ActivityLogOutcome, string> = {
    success: 'نجاح',
    warning: 'تحذير',
    rejected: 'مرفوض',
    pending: 'قيد المتابعة',
  };
  return labels[value];
}

function activityReviewLabel(value: ActivityLogReviewStatus) {
  const labels: Record<ActivityLogReviewStatus, string> = {
    open: 'مفتوح',
    reviewed: 'مراجع',
    archived: 'مؤرشف',
  };
  return labels[value];
}

function activityOutcomeClass(value: ActivityLogOutcome) {
  if (value === 'success') return 'bg-emerald-50 text-emerald-700';
  if (value === 'warning') return 'bg-orange-50 text-orange-700';
  if (value === 'rejected') return 'bg-rose-50 text-rose-700';
  return 'bg-blue-50 text-blue-700';
}

function activityReviewClass(value: ActivityLogReviewStatus) {
  if (value === 'reviewed') return 'bg-emerald-50 text-emerald-700';
  if (value === 'archived') return 'bg-slate-100 text-slate-500';
  return 'bg-violet-50 text-violet-700';
}

function activityOutcomeWeight(value: ActivityLogOutcome) {
  const weights: Record<ActivityLogOutcome, number> = { rejected: 4, warning: 3, pending: 2, success: 1 };
  return weights[value];
}

function activityCategoryColor(value: ActivityLogCategory) {
  const colors: Record<ActivityLogCategory, string> = {
    all: 'bg-blue-500',
    attendance: 'bg-emerald-500',
    security: 'bg-rose-500',
    subscription: 'bg-orange-500',
    report: 'bg-violet-500',
    user: 'bg-blue-500',
    institution: 'bg-cyan-500',
    system: 'bg-slate-500',
  };
  return colors[value];
}

function activityIconForCategory(value: Exclude<ActivityLogCategory, 'all'>) {
  if (value === 'attendance') return <Activity className="h-5 w-5" />;
  if (value === 'security') return <ShieldCheck className="h-5 w-5" />;
  if (value === 'subscription') return <CreditCard className="h-5 w-5" />;
  if (value === 'report') return <FileText className="h-5 w-5" />;
  if (value === 'user') return <Users className="h-5 w-5" />;
  if (value === 'institution') return <Building2 className="h-5 w-5" />;
  return <Database className="h-5 w-5" />;
}

function adminDisplayName(row: { username?: string | null; fullName?: string | null; full_name?: string | null } | undefined) {
  if (!row) return 'النظام';
  return row.fullName || row.full_name || row.username || 'مستخدم إداري';
}

function studentDisplayName(row: { firstName?: string | null; first_name?: string | null; lastName?: string | null; last_name?: string | null; studentNumber?: string | null; student_number?: string | null }) {
  const fullName = `${row.firstName || row.first_name || ''} ${row.lastName || row.last_name || ''}`.trim();
  return fullName || row.studentNumber || row.student_number || 'طالب';
}

function studentNumber(row: { studentNumber?: string | null; student_number?: string | null }) {
  return row.studentNumber || row.student_number || '';
}

function notificationPriorityWeight(priority: NotificationPriority) {
  const weights: Record<NotificationPriority, number> = { high: 4, medium: 3, low: 2, info: 1 };
  return weights[priority];
}

function getNotificationDateRange(filter: 'all' | 'today' | '7d' | '30d' | 'month' | 'custom', customFrom: string, customTo: string) {
  const now = new Date();
  const from = new Date(now);
  if (filter === 'all') return { from: null, to: null };
  if (filter === 'custom') {
    return {
      from: customFrom ? new Date(`${customFrom}T00:00:00`) : null,
      to: customTo ? new Date(`${customTo}T23:59:59`) : null,
    };
  }
  if (filter === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (filter === '7d') {
    from.setDate(now.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else if (filter === '30d') {
    from.setDate(now.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }
  return { from, to: null };
}

function isWithinDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return then >= cutoff;
}

function notificationCategoryLabel(category: Exclude<NotificationCategory, 'all' | 'unread'>) {
  const labels: Record<Exclude<NotificationCategory, 'all' | 'unread'>, string> = {
    security: 'الأمان',
    attendance: 'الحضور',
    subscription: 'الاشتراكات',
    report: 'التقارير',
    system: 'النظام',
  };
  return labels[category];
}

function notificationPriorityLabel(priority: NotificationPriority) {
  const labels: Record<NotificationPriority, string> = {
    high: 'عالية',
    medium: 'متوسطة',
    low: 'منخفضة',
    info: 'معلومة',
  };
  return labels[priority];
}

function notificationStatusLabel(status: NotificationStatus) {
  const labels: Record<NotificationStatus, string> = {
    unread: 'غير مقروء',
    read: 'مقروء',
    archived: 'مؤرشف',
  };
  return labels[status];
}

function notificationPriorityClass(priority: NotificationPriority) {
  if (priority === 'high') return 'bg-rose-50 text-rose-700';
  if (priority === 'medium') return 'bg-orange-50 text-orange-700';
  if (priority === 'low') return 'bg-emerald-50 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

function notificationCategoryIcon(category: Exclude<NotificationCategory, 'all' | 'unread'>) {
  const icons: Record<Exclude<NotificationCategory, 'all' | 'unread'>, LucideIcon> = {
    security: ShieldCheck,
    attendance: Activity,
    subscription: CreditCard,
    report: FileText,
    system: Database,
  };
  return icons[category];
}

function notificationCategoryTone(category: Exclude<NotificationCategory, 'all' | 'unread'>) {
  const tones: Record<Exclude<NotificationCategory, 'all' | 'unread'>, string> = {
    security: 'bg-rose-50 text-rose-700',
    attendance: 'bg-emerald-50 text-emerald-700',
    subscription: 'bg-orange-50 text-orange-700',
    report: 'bg-violet-50 text-violet-700',
    system: 'bg-blue-50 text-blue-700',
  };
  return tones[category];
}

function NotificationKpi({ label, value, helper, icon: Icon, tone }: { label: string; value: string; helper: string; icon: LucideIcon; tone: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-400">{helper}</p>
    </article>
  );
}

function NotificationSettingsModal({ settings, setSettings, onClose }: {
  settings: NotificationSettings;
  setSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
  onClose: () => void;
}) {
  const rows: Array<{ key: keyof NotificationSettings; label: string; helper: string }> = [
    { key: 'security', label: 'تنبيهات الأمان', helper: 'محاولات مرفوضة، أجهزة مكررة، دخول غير مصرح' },
    { key: 'attendance', label: 'تنبيهات الحضور', helper: 'جلسات جديدة، غياب مرتفع، تقارير يومية' },
    { key: 'subscription', label: 'تنبيهات الاشتراكات', helper: 'انتهاء، فواتير، تجديدات' },
    { key: 'report', label: 'تنبيهات التقارير', helper: 'تقارير جاهزة أو فاشلة' },
    { key: 'system', label: 'تنبيهات النظام', helper: 'مؤسسات وحسابات ونشاط المالك' },
    { key: 'emailOwner', label: 'إرسال بريد إلكتروني للمالك', helper: 'واجهة فقط في هذه النسخة' },
    { key: 'inApp', label: 'إرسال إشعار داخل المنصة', helper: 'مفعلة للوحة المالك' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">إعدادات الإشعارات</h2>
            <p className="mt-1 text-sm text-slate-500">تفضيلات أولية للعرض داخل لوحة المالك. لم يتم إنشاء جدول تفضيلات منفصل.</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-3 p-5">
          {rows.map((row) => (
            <label key={row.key} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-black text-slate-950">{row.label}</p>
                <p className="mt-1 text-xs text-slate-500">{row.helper}</p>
              </div>
              <input type="checkbox" checked={settings[row.key]} onChange={(event) => setSettings((current) => ({ ...current, [row.key]: event.target.checked }))} />
            </label>
          ))}
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => { toast.success('تم حفظ إعدادات الإشعارات محلياً'); onClose(); }}>حفظ الإعدادات</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationDetailsDialog({
  notification,
  formatDate,
  getTypeLabel,
  onClose,
  onMarkRead,
  onOpenRecord,
  onArchive,
}: {
  notification: OwnerNotification;
  formatDate: (value: string | null | undefined) => string;
  getTypeLabel: (type: string) => string;
  onClose: () => void;
  onMarkRead: () => void;
  onOpenRecord: () => void;
  onArchive: () => void;
}) {
  const Icon = notificationCategoryIcon(notification.category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${notificationCategoryTone(notification.category)}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">{notificationCategoryLabel(notification.category)}</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">{notification.title}</h2>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose} aria-label="إغلاق">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-5 p-5">
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {notification.message}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailPill label="نوع الإشعار" value={notificationCategoryLabel(notification.category)} />
            <DetailPill label="الأولوية" value={notificationPriorityLabel(notification.priority)} />
            <DetailPill label="الحالة" value={notificationStatusLabel(notification.status)} />
            <DetailPill label="المؤسسة" value={notification.institutionName || 'غير متوفر'} />
            <DetailPill label="القطاع" value={notification.institutionType ? getTypeLabel(notification.institutionType) : 'غير متوفر'} />
            <DetailPill label="المستخدم المرتبط" value={notification.actorName || 'غير متوفر'} />
            <DetailPill label="التاريخ" value={formatDate(notification.createdAt)} />
            <DetailPill label="الإجراء المقترح" value={notification.suggestedAction} />
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onArchive}>
              أرشفة
            </Button>
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onOpenRecord}>
              فتح السجل المرتبط
            </Button>
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={onMarkRead}>
              تحديد كمقروء
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmNotificationActionDialog({ action, notification, onClose, onConfirm }: {
  action: 'archive' | 'delete' | 'delete-read';
  notification?: OwnerNotification;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const title = action === 'delete-read' ? 'حذف الإشعارات المقروءة' : action === 'delete' ? 'حذف الإشعار' : 'أرشفة الإشعار';
  const helper = action === 'delete-read'
    ? 'سيتم حذف كل الإشعارات المقروءة. لا يتم حذف أي بيانات حضور أو مؤسسة.'
    : action === 'delete'
      ? `سيتم حذف الإشعار: ${notification?.title || ''}`
      : `سيتم أرشفة الإشعار: ${notification?.title || ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>إلغاء</Button>
          <Button className={`${action === 'delete' || action === 'delete-read' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'} rounded-lg text-white`} onClick={onConfirm}>
            تأكيد
          </Button>
        </div>
      </div>
    </div>
  );
}

interface TrialRequestRecord {
  id: number;
  institutionName: string;
  contactPhone: string;
  institutionType: string;
  institutionTypeLabel: string;
  userCount: string;
  source: string;
  status: string | null;
  createdAt: string;
}

const TRIAL_TYPE_LABELS: Record<string, string> = {
  university: 'جامعة',
  school: 'مؤسسة تربوية',
  primary_school: 'مدرسة ابتدائية',
  secondary_school: 'متوسطة / ثانوية',
  training: 'مركز تكوين',
  company: 'شركة',
};

function OwnerTrialRequestsPage({
  ownerAdminId,
  searchQuery,
  setSearchQuery,
  formatNumber,
  formatDate,
  onPendingCountChange,
}: {
  ownerAdminId: string | null;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  onPendingCountChange: (count: number) => void;
}) {
  const [requests, setRequests] = useState<TrialRequestRecord[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'contacted'>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadTrialRequests = async () => {
    setLoadingRequests(true);
    try {
      const { data: raw, error } = await supabase
        .from('trial_requests')
        .select('id, institution_name, contact_phone, institution_type, user_count, source, status, created_at')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;

      const next: TrialRequestRecord[] = (raw || []).map((row) => ({
        id: row.id,
        institutionName: row.institution_name || 'مؤسسة بدون اسم',
        contactPhone: row.contact_phone || '',
        institutionType: row.institution_type || 'military',
        institutionTypeLabel: TRIAL_TYPE_LABELS[row.institution_type || ''] || 'مؤسسة',
        userCount: row.user_count || 'غير محدد',
        source: row.source || 'الموقع',
        status: row.status || null,
        createdAt: row.created_at || '',
      }));

      setRequests(next);
      onPendingCountChange(next.filter((request) => request.status === 'pending' || request.status === null).length);
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحميل طلبات التجربة'));
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    void loadTrialRequests();
    // تحديث مباشر تلقائي: عند أي طلب جديد أو تعديل أو حذف في جدول الطلبات
    // يتم إعادة الجلب فوراً (debounced) — لا حاجة للضغط على زر التحديث.
    let pending = false;
    const triggerRefresh = () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        void loadTrialRequests();
      }, 800);
    };
    const channel = supabase
      .channel('trial-requests-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trial_requests' }, triggerRefresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesQuery =
        !query ||
        [request.institutionName, request.contactPhone, request.institutionTypeLabel, request.userCount, request.source]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' && (request.status === 'pending' || request.status === null)) ||
        (statusFilter === 'contacted' && request.status === 'contacted');
      return matchesQuery && matchesStatus;
    });
  }, [requests, searchQuery, statusFilter]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((request) => request.status === 'pending' || request.status === null).length,
      contacted: requests.filter((request) => request.status === 'contacted').length,
      thisWeek: requests.filter((request) => {
        const date = new Date(request.createdAt || 0);
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      }).length,
    }),
    [requests]
  );

  const normalizePhoneForWhatsapp = (phone: string) => {
    const digits = phone.replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.startsWith('00213')) return digits.slice(5);
    if (digits.startsWith('213')) return digits.slice(3);
    if (digits.startsWith('0')) return `213${digits.slice(1)}`;
    return digits;
  };

  const openWhatsapp = (request: TrialRequestRecord) => {
    const phone = normalizePhoneForWhatsapp(request.contactPhone);
    if (!phone) {
      toast.info('لا يوجد رقم تواصل لهذا الطلب');
      return;
    }
    const message = encodeURIComponent(
      `مرحباً ${request.institutionName}، شكراً لاهتمامكم بمنصة Ausar Military لإدارة الحضور والغياب. يسعدنا التواصل معكم لتحديد موعد عرض تجريبي للنظام.`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const copyPhone = async (request: TrialRequestRecord) => {
    if (!request.contactPhone) {
      toast.info('لا يوجد رقم تواصل لهذا الطلب');
      return;
    }
    try {
      await navigator.clipboard.writeText(request.contactPhone);
      toast.success('تم نسخ رقم التواصل');
    } catch {
      toast.error('تعذر النسخ');
    }
  };

  const requestDelete = (request: TrialRequestRecord) => {
    if (pendingDeleteId === request.id) {
      setPendingDeleteId(null);
      void deleteRequest(request);
      return;
    }
    setPendingDeleteId(request.id);
    setTimeout(() => {
      setPendingDeleteId((current) => (current === request.id ? null : current));
    }, 6000);
    toast.warning?.('اضغط زر الحذف مرة أخرى خلال 6 ثوانٍ للتأكيد');
  };

  const deleteRequest = async (request: TrialRequestRecord) => {
    setDeletingId(request.id);
    try {
      const { error } = await supabase
        .from('trial_requests')
        .delete()
        .eq('id', request.id);
      if (error) throw error;
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setPendingDeleteId(null);
      onPendingCountChange(
        requests.filter((item) => item.id !== request.id && (item.status === 'pending' || item.status === null)).length
      );
      toast.success('تم حذف طلب التجربة');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر حذف الطلب — قد لا تملك صلاحية الحذف'));
    } finally {
      setDeletingId(null);
    }
  };

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const markContacted = async (request: TrialRequestRecord) => {
    if (request.status === 'contacted') {
      toast.info('تم تسجيل التواصل مع هذا الطلب مسبقاً');
      return;
    }
    setUpdatingId(request.id);
    try {
      const { error } = await supabase
        .from('trial_requests')
        .update({ status: 'contacted' })
        .eq('id', request.id)
        .select();
      if (error) throw error;
      setRequests((current) =>
        current.map((item) => (item.id === request.id ? { ...item, status: 'contacted' } : item))
      );
      onPendingCountChange(requests.filter((item) => item.id !== request.id && (item.status === 'pending' || item.status === null)).length);
      toast.success('تم تسجيل التواصل مع هذه المؤسسة');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحديث حالة الطلب'));
    } finally {
      setUpdatingId(null);
    }
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
  };

  const exportRequests = () => {
    const columns = ['#', 'المؤسسة', 'رقم التواصل', 'النوع', 'عدد المستخدمين', 'المصدر', 'الحالة', 'تاريخ الإرسال'];
    const rows = filteredRequests.map((request, index) => [
      String(index + 1),
      request.institutionName,
      request.contactPhone,
      request.institutionTypeLabel,
      request.userCount,
      request.source,
      request.status === 'contacted' ? 'تم التواصل' : 'بانتظار التواصل',
      formatDate(request.createdAt),
    ]);
    const csv = [columns, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ausar Military-trial-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('تم تجهيز ملف طلبات التجربة');
  };

  const statusClass = (status: string | null) =>
    status === 'contacted'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-orange-200 bg-orange-50 text-orange-700';

  const statusTabs: Array<{ id: 'all' | 'pending' | 'contacted'; label: string; value: number }> = [
    { id: 'all', label: 'كل الطلبات', value: stats.total },
    { id: 'pending', label: 'بانتظار التواصل', value: stats.pending },
    { id: 'contacted', label: 'تم التواصل', value: stats.contacted },
  ];

  return (
    <section className="space-y-5" dir="rtl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>الرئيسية</span>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>طلبات التجربة</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">طلبات التجربة المجانية</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-500">Ausar Military Free Trial Leads</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-700">تحديث مباشر تلقائي — الطلبات الجديدة تظهر وحدها</span>
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">بيانات حقيقية من قاعدة البيانات</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={() => void loadTrialRequests()}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={exportRequests}>
            <Download className="ml-2 h-4 w-4" />
            تصدير CSV
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" dir="ltr">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm" dir="rtl">
          <p className="text-xs font-semibold text-slate-500">إجمالي الطلبات</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{formatNumber(stats.total)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">منذ الإطلاق • {stats.pending > 0 ? `${formatNumber(stats.pending)} بانتظار التواصل` : 'لا توجد طلبات جديدة'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm" dir="rtl">
          <p className="text-xs font-semibold text-slate-500">بانتظار التواصل</p>
          <p className="mt-1 text-3xl font-black text-orange-600">{formatNumber(stats.pending)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">يتطلب متابعتك</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm" dir="rtl">
          <p className="text-xs font-semibold text-slate-500">تم التواصل</p>
          <p className="mt-1 text-3xl font-black text-emerald-600">{formatNumber(stats.contacted)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">متابَع</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm" dir="rtl">
          <p className="text-xs font-semibold text-slate-500">آخر 7 أيام</p>
          <p className="mt-1 text-3xl font-black text-violet-600">{formatNumber(stats.thisWeek)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">نشاط حديث</p>
        </div>
      </section>

      <section dir="ltr">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" dir="rtl">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Inbox className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-black text-slate-950">قائمة الطلبات الواردة</h2>
                  <p className="text-xs text-slate-500">اضغط على زر الواتساب للتواصل مباشرة مع كل مؤسسة • حذف الطلب يتطلب ضغطة تأكيد مزدوجة</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-10 rounded-lg border-slate-200 bg-slate-50 pr-10 text-sm"
                  placeholder="بحث باسم المؤسسة، الرقم، النوع..."
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'pending' | 'contacted')}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="pending">بانتظار التواصل</SelectItem>
                  <SelectItem value="contacted">تم التواصل</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={resetFilters}>
                مسح الفلاتر
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              {statusTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-lg border px-4 py-3 text-right transition ${
                    statusFilter === tab.id ? 'border-blue-200 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-xs font-semibold opacity-80">{tab.label}</span>
                  <span className="mt-1 block text-lg font-black">{formatNumber(tab.value)}</span>
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <div className="grid min-w-[960px] grid-cols-[minmax(170px,0.9fr)_140px_minmax(130px,0.7fr)_100px_100px_120px_180px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                <span>المؤسسة</span>
                <span>رقم التواصل</span>
                <span>النوع</span>
                <span>عدد المستخدمين</span>
                <span>الحالة</span>
                <span>تاريخ الإرسال</span>
                <span>الإجراء</span>
              </div>
              <div className="divide-y divide-slate-100">
                {loadingRequests ? (
                  <div className="min-w-[960px] p-6 text-center text-sm text-slate-500">جاري تحميل الطلبات...</div>
                ) : filteredRequests.length === 0 ? (
                  <div className="min-w-[960px] p-6 text-center text-sm text-slate-500">لا توجد طلبات مطابقة للفلاتر الحالية.</div>
                ) : (
                  filteredRequests.map((request, index) => (
                    <div
                      key={request.id}
                      className="grid min-w-[960px] grid-cols-[minmax(170px,0.9fr)_140px_minmax(130px,0.7fr)_100px_100px_120px_180px] gap-3 px-4 py-3 text-sm transition hover:bg-slate-50"
                    >
                      <span className="self-center min-w-0">
                        <span className="block truncate font-black text-slate-950">
                          <span className="ml-1.5 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 align-middle text-[11px] font-bold text-slate-500">{index + 1}</span>
                          {request.institutionName}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{request.source}</span>
                      </span>
                      <span className="flex items-center gap-1 self-center text-[12px] font-medium text-slate-700 ltr" dir="ltr">
                        <span className="whitespace-nowrap" dir="rtl">{request.contactPhone || '—'}</span>
                      </span>
                      <span className="self-center truncate text-slate-600">{request.institutionTypeLabel}</span>
                      <span className="self-center text-slate-600">{request.userCount}</span>
                      <span className={`self-center rounded-full border px-2 py-1 text-center text-xs font-bold ${statusClass(request.status)}`}>
                        {request.status === 'contacted' ? 'تم التواصل' : 'بانتظار التواصل'}
                      </span>
                      <span className="self-center whitespace-nowrap text-xs text-slate-500">{formatDate(request.createdAt)}</span>
                      <span className="sticky left-0 z-10 flex items-center gap-1 self-center pl-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 min-w-[92px] rounded-lg border-emerald-200 bg-emerald-50 px-2 text-emerald-700 hover:bg-emerald-100"
                          onClick={() => openWhatsapp(request)}
                        >
                          <Phone className="ml-1 h-3.5 w-3.5" />
                          واتساب
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 min-w-[48px] rounded-lg border-slate-200 px-2" onClick={() => void copyPhone(request)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingId === request.id || request.status === 'contacted'}
                          className="h-8 min-w-[62px] rounded-lg border-blue-200 px-2 text-blue-700 hover:bg-blue-50"
                          onClick={() => void markContacted(request)}
                        >
                          {updatingId === request.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          تواصلت
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title={pendingDeleteId === request.id ? 'اضغط مرة أخرى للتأكيد' : 'حذف الطلب'}
                          disabled={deletingId === request.id}
                          className={`h-8 min-w-[48px] rounded-lg px-2 ${
                            pendingDeleteId === request.id
                              ? 'border-red-500 bg-red-500 text-white hover:bg-red-600'
                              : 'border-red-200 text-red-600 hover:bg-red-50'
                          }`}
                          onClick={() => requestDelete(request)}
                        >
                          {deletingId === request.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          {pendingDeleteId === request.id ? 'تأكيد' : ''}
                        </Button>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              عرض {formatNumber(filteredRequests.length)} من {formatNumber(requests.length)} طلب
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}

function OwnerSettingsPage({
  ownerName,
  ownerAdminId,
  ownerEmail,
  platformStats,
  formatNumber,
  formatDate,
}: {
  ownerName: string;
  ownerAdminId: string | null;
  ownerEmail: string;
  platformStats: { total: number; active: number; suspended: number; capacity: number; wilayas: number };
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
}) {
  const [activeSection, setActiveSection] = useState<'general' | 'security' | 'branding' | 'notifications' | 'integrations' | 'backup' | 'subscription'>('general');
  const [settings, setSettings] = useState<OwnerSettingsState>(() => readOwnerSettings(ownerEmail));
  const [persistedSettings, setPersistedSettings] = useState<OwnerSettingsState>(() => readOwnerSettings(ownerEmail));
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState<string | null>(window.localStorage.getItem('qh-owner-settings-saved-at'));
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<SettingsAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [integrationResults, setIntegrationResults] = useState<IntegrationCheckResult[]>([]);
  const [testingIntegrations, setTestingIntegrations] = useState(false);

  const persistSettings = async (nextSettings: OwnerSettingsState, action: string, oldSettings: OwnerSettingsState | null = persistedSettings) => {
    const now = new Date().toISOString();
    const payload = {
      key: 'owner_settings',
      value: nextSettings,
      description: 'Ausar Military owner dashboard settings',
      updated_by: ownerAdminId,
      updated_at: now,
    };
    const { error } = await supabase.from('platform_settings').upsert(payload, { onConflict: 'key' });
    if (error) throw error;

    const { error: auditError } = await supabase.from('platform_setting_audit_logs').insert([{
      setting_key: 'owner_settings',
      action,
      old_value: oldSettings,
      new_value: nextSettings,
      changed_by: ownerAdminId,
    }]);
    if (auditError) throw auditError;

    window.localStorage.setItem('qh-owner-settings', JSON.stringify(nextSettings));
    window.localStorage.setItem('qh-owner-settings-saved-at', now);
    setSettings(nextSettings);
    setPersistedSettings(nextSettings);
    setSettingsUpdatedAt(now);
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value, description, updated_by, created_at, updated_at')
        .eq('key', 'owner_settings')
        .maybeSingle();
      if (error) throw error;
      const row = data as PlatformSettingsRow | null;
      const next = row?.value
        ? { ...createDefaultOwnerSettings(ownerEmail), ...row.value }
        : readOwnerSettings(ownerEmail);
      setSettings(next);
      setPersistedSettings(next);
      setSettingsUpdatedAt(row?.updated_at || window.localStorage.getItem('qh-owner-settings-saved-at'));
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحميل إعدادات المنصة من Supabase'));
      const fallback = readOwnerSettings(ownerEmail);
      setSettings(fallback);
      setPersistedSettings(fallback);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, [ownerEmail]);

  const updateSetting = <K extends keyof OwnerSettingsState>(key: K, value: OwnerSettingsState[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await persistSettings(settings, 'update');
      toast.success('تم حفظ إعدادات المنصة');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر حفظ إعدادات المنصة'));
    } finally {
      setSavingSettings(false);
    }
  };

  const resetSettings = async () => {
    const defaults = createDefaultOwnerSettings(ownerEmail);
    setSavingSettings(true);
    try {
      await persistSettings(defaults, 'reset');
      setConfirmReset(false);
      toast.success('تمت استعادة الإعدادات الافتراضية');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر استعادة الإعدادات الافتراضية'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة فقط');
      return;
    }
    if (file.size > MAX_INSTITUTION_IMAGE_SIZE) {
      toast.error('حجم الشعار يجب ألا يتجاوز 5MB');
      return;
    }
    setUploadingLogo(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `platform/logo-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from('institution-images').upload(path, file, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('institution-images').getPublicUrl(path);
      if (!data.publicUrl) throw new Error('تعذر إنشاء رابط الشعار');
      const nextSettings = { ...settings, logoUrl: data.publicUrl };
      await persistSettings(nextSettings, 'logo_upload');
      toast.success('تم رفع الشعار');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر رفع الشعار'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const clearLogo = async () => {
    const nextSettings = { ...settings, logoUrl: '' };
    setSavingSettings(true);
    try {
      await persistSettings(nextSettings, 'logo_remove');
      toast.success('تم حذف الشعار من الإعدادات');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر حذف الشعار'));
    } finally {
      setSavingSettings(false);
    }
  };

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json;charset=utf-8;' });
    downloadBrowserBlob(blob, `Ausar Military-settings-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success('تم تصدير الإعدادات');
  };

  const openAuditLog = async () => {
    setAuditOpen(true);
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_setting_audit_logs')
        .select('id, setting_key, action, old_value, new_value, changed_by, created_at')
        .eq('setting_key', 'owner_settings')
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      setAuditLogs((data || []) as SettingsAuditLog[]);
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذر تحميل سجل الإعدادات'));
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const testIntegrations = async () => {
    setIntegrationOpen(true);
    setTestingIntegrations(true);
    const results: IntegrationCheckResult[] = [];

    try {
      const { error } = await supabase.from('platform_settings').select('key').limit(1);
      results.push({
        label: 'Supabase settings table',
        status: error ? 'error' : 'ok',
        detail: error ? error.message : 'جدول الإعدادات متاح ومحمي بـ RLS.',
      });
    } catch (error) {
      results.push({ label: 'Supabase settings table', status: 'error', detail: getErrorMessage(error, 'تعذر اختبار جدول الإعدادات') });
    }

    try {
      const { error } = await supabase.from('notifications').select('id', { count: 'exact', head: true });
      results.push({
        label: 'Notifications module',
        status: error ? 'warning' : 'ok',
        detail: error ? error.message : 'جدول الإشعارات متاح للوحة المالك.',
      });
    } catch (error) {
      results.push({ label: 'Notifications module', status: 'warning', detail: getErrorMessage(error, 'تعذر اختبار الإشعارات') });
    }

    try {
      const { error } = await supabase.storage.from('institution-images').list('platform', { limit: 1 });
      results.push({
        label: 'Logo storage',
        status: error ? 'warning' : 'ok',
        detail: error ? error.message : 'حاوية رفع الشعارات والصور متاحة.',
      });
    } catch (error) {
      results.push({ label: 'Logo storage', status: 'warning', detail: getErrorMessage(error, 'تعذر اختبار التخزين') });
    }

    try {
      const { error } = await supabase.from('subscriptions').select('id', { count: 'exact', head: true });
      results.push({
        label: 'Subscriptions billing',
        status: error ? 'warning' : 'ok',
        detail: error ? error.message : 'وحدة الاشتراكات متاحة.',
      });
    } catch (error) {
      results.push({ label: 'Subscriptions billing', status: 'warning', detail: getErrorMessage(error, 'تعذر اختبار الاشتراكات') });
    }

    setIntegrationResults(results);
    setTestingIntegrations(false);
  };

  const goToSection = (section: typeof activeSection) => {
    setActiveSection(section);
    window.requestAnimationFrame(() => {
      document.getElementById(`settings-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const nav = [
    { id: 'general' as const, label: 'الإعدادات العامة', icon: Settings },
    { id: 'security' as const, label: 'الأمان والصلاحيات', icon: ShieldCheck },
    { id: 'branding' as const, label: 'الهوية والعلامة التجارية', icon: ImageIcon },
    { id: 'notifications' as const, label: 'الإشعارات', icon: Bell },
    { id: 'integrations' as const, label: 'التكاملات', icon: Globe2 },
    { id: 'backup' as const, label: 'النسخ الاحتياطي', icon: Database },
    { id: 'subscription' as const, label: 'إعدادات الاشتراك', icon: CreditCard },
  ];

  return (
    <section className="space-y-5" dir="rtl">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>الرئيسية</span>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>الإعدادات</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">الإعدادات</h1>
          <p className="mt-1 text-sm text-slate-500">إدارة إعدادات المنصة، الأمان، الهوية، الإشعارات والتكاملات</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={exportSettings}>
            <Download className="ml-2 h-4 w-4" />
            تصدير الإعدادات
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-rose-200 bg-white text-rose-600 hover:bg-rose-50" onClick={() => setConfirmReset(true)}>
            <RefreshCw className="ml-2 h-4 w-4" />
            استعادة الافتراضي
          </Button>
          <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={savingSettings} onClick={saveSettings}>
            <Check className="ml-2 h-4 w-4" />
            {savingSettings ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_320px]">
        <aside className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold transition ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}
                onClick={() => goToSection(item.id)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </aside>

        <div className="space-y-4">
          {settingsLoading && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
              جاري تحميل إعدادات المنصة من Supabase...
            </div>
          )}
          <div id="settings-general" className="scroll-mt-24">
          <Panel title="الإعدادات العامة" icon={Settings}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldInput label="اسم المنصة" value={settings.platformName} onChange={(value) => updateSetting('platformName', value)} />
              <FieldInput label="البريد الإلكتروني للمالك" value={settings.ownerEmail} onChange={(value) => updateSetting('ownerEmail', value)} type="email" />
              <div className="space-y-2">
                <Label>اللغة الافتراضية</Label>
                <Select value={settings.language} onValueChange={(value) => updateSetting('language', value)}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المنطقة الزمنية</Label>
                <Select value={settings.timezone} onValueChange={(value) => updateSetting('timezone', value)}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Africa/Algiers">الجزائر (GMT+01:00)</SelectItem>
                    <SelectItem value="Europe/Paris">باريس (GMT+01/+02)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Panel>
          </div>

          <div id="settings-branding" className="scroll-mt-24">
          <Panel title="تخصيص العلامة التجارية" icon={ImageIcon}>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <ColorInput label="اللون الأساسي" value={settings.primaryColor} onChange={(value) => updateSetting('primaryColor', value)} />
                  <ColorInput label="لون التمييز" value={settings.accentColor} onChange={(value) => updateSetting('accentColor', value)} />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Label>رفع الشعار</Label>
                  <p className="mt-1 text-xs text-slate-500">ارفع شعار Ausar Military الرسمي فقط. لن يتم تغيير الشعار عشوائياً.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      <Upload className="ml-2 h-4 w-4" />
                      {uploadingLogo ? 'جاري الرفع...' : 'اختيار شعار'}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingLogo} onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleLogoUpload(file);
                        event.currentTarget.value = '';
                      }} />
                    </label>
                    {settings.logoUrl && (
                      <Button variant="outline" className="h-10 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50" disabled={savingSettings} onClick={() => void clearLogo()}>
                        حذف
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                  {settings.logoUrl ? <img src={settings.logoUrl} alt="Ausar Military logo preview" className="h-20 w-20 object-contain" /> : <img src="/logo.png" alt="Ausar Military" className="h-20 w-20 object-contain" />}
                </div>
                <p className="mt-3 text-sm font-black text-slate-950">{settings.platformName}</p>
                <p className="mt-1 text-xs text-slate-500">معاينة الشعار</p>
              </div>
            </div>
          </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div id="settings-security" className="scroll-mt-24">
            <Panel title="الأمان العام" icon={ShieldCheck}>
              <SettingsToggle label="فرض المصادقة الثنائية" helper="توصية مهمة لحسابات المالك والمديرين" checked={settings.twoFactorRequired} onChange={(value) => updateSetting('twoFactorRequired', value)} />
              <div className="mt-4 space-y-2">
                <Label>مدة الجلسة قبل الخروج التلقائي</Label>
                <Select value={settings.sessionTimeout} onValueChange={(value) => updateSetting('sessionTimeout', value)}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 دقيقة</SelectItem>
                    <SelectItem value="60">ساعة واحدة</SelectItem>
                    <SelectItem value="240">4 ساعات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-4 space-y-3">
                <SettingsToggle label="فرض كلمات مرور قوية" helper="أحرف وأرقام ورموز" checked={settings.strongPasswords} onChange={(value) => updateSetting('strongPasswords', value)} />
                <SettingsToggle label="مراجعة الأجهزة الجديدة" helper="تنبيه المالك عند ربط جهاز جديد" checked={settings.deviceReview} onChange={(value) => updateSetting('deviceReview', value)} />
                <SettingsToggle label="تنبيه الدخول المشبوه" helper="إشعار عند سلوك دخول غير معتاد" checked={settings.suspiciousLoginAlerts} onChange={(value) => updateSetting('suspiciousLoginAlerts', value)} />
              </div>
            </Panel>
            </div>

            <div id="settings-backup" className="scroll-mt-24">
            <Panel title="النسخ الاحتياطي" icon={Database}>
              <SettingsToggle label="نسخ احتياطي تلقائي" helper="يحافظ على نسخة تشغيلية من بيانات المنصة" checked={settings.autoBackup} onChange={(value) => updateSetting('autoBackup', value)} />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>التكرار</Label>
                  <Select value={settings.backupFrequency} onValueChange={(value) => updateSetting('backupFrequency', value)}>
                    <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="weekly">أسبوعي</SelectItem>
                      <SelectItem value="monthly">شهري</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <FieldInput label="مدة الاحتفاظ بالأيام" value={settings.backupRetention} onChange={(value) => updateSetting('backupRetention', value)} type="number" />
              </div>
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
                تم ربط إعدادات النسخ الاحتياطي بقاعدة البيانات. تنفيذ النسخ المجدول نفسه يحتاج job منفصل في البنية التشغيلية.
              </div>
            </Panel>
            </div>
          </div>

          <div id="settings-notifications" className="scroll-mt-24">
          <Panel title="الإشعارات والاشتراكات" icon={Bell}>
            <div className="grid gap-3 md:grid-cols-2">
              <SettingsToggle label="تنبيهات الاشتراكات" helper="انتهاء قريب، فاتورة غير مدفوعة، تجديد" checked={settings.subscriptionAlerts} onChange={(value) => updateSetting('subscriptionAlerts', value)} />
              <SettingsToggle label="تذكير الفواتير" helper="مفيد للفوترة اليدوية" checked={settings.invoiceReminders} onChange={(value) => updateSetting('invoiceReminders', value)} />
              <SettingsToggle label="تقارير شهرية" helper="إرسال ملخصات دورية للمالك" checked={settings.monthlyReports} onChange={(value) => updateSetting('monthlyReports', value)} />
              <SettingsToggle label="وضع الصيانة" helper="يتم حفظه في إعدادات المنصة لاستخدامه في طبقة التشغيل" checked={settings.maintenanceMode} onChange={(value) => updateSetting('maintenanceMode', value)} />
            </div>
          </Panel>
          </div>

          <div id="settings-integrations" className="scroll-mt-24">
          <Panel title="التكاملات" icon={Globe2}>
            <div className="grid gap-3 md:grid-cols-2">
              <IntegrationStatusCard label="Supabase" value="متصل" helper="قاعدة البيانات والمصادقة" tone="bg-emerald-50 text-emerald-700" />
              <IntegrationStatusCard label="Vercel" value="Production Ready" helper="النشر عبر GitHub" tone="bg-blue-50 text-blue-700" />
              <IntegrationStatusCard label="Storage" value="institution-images" helper="صور المؤسسات وشعار المنصة" tone="bg-violet-50 text-violet-700" />
              <IntegrationStatusCard label="Manual Billing" value="نشط" helper="الفوترة اليدوية الجزائرية" tone="bg-orange-50 text-orange-700" />
            </div>
            <Button className="mt-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={testingIntegrations} onClick={() => void testIntegrations()}>
              {testingIntegrations ? 'جاري الاختبار...' : 'اختبار التكاملات'}
            </Button>
          </Panel>
          </div>

          <div id="settings-subscription" className="scroll-mt-24">
          <Panel title="إعدادات الاشتراك" icon={CreditCard}>
            <div className="grid gap-3 md:grid-cols-3">
              <DetailPill label="الفوترة" value="يدوية" />
              <DetailPill label="العملة" value="DZD" />
              <DetailPill label="التنبيهات" value={settings.subscriptionAlerts ? 'مفعلة' : 'متوقفة'} />
            </div>
          </Panel>
          </div>
        </div>

        <aside className="space-y-4">
          <Panel title="ملخص الإعدادات" icon={ShieldCheck}>
            <div className="space-y-3">
              <SettingsSummaryRow label="الحالة" value="آمن" helper="إعدادات الحماية الأساسية مفعلة" tone="bg-emerald-50 text-emerald-700" icon={ShieldCheck} />
              <SettingsSummaryRow label="آخر تحديث" value={settingsUpdatedAt ? formatDate(settingsUpdatedAt) : 'غير محفوظ بعد'} helper={`بواسطة ${ownerName}`} tone="bg-blue-50 text-blue-700" icon={Clock} />
              <SettingsSummaryRow label="عدد المؤسسات" value={formatNumber(platformStats.total)} helper={`${formatNumber(platformStats.active)} نشطة`} tone="bg-violet-50 text-violet-700" icon={Building2} />
              <SettingsSummaryRow label="السعة الإجمالية" value={formatNumber(platformStats.capacity)} helper={`${formatNumber(platformStats.wilayas)} ولاية مغطاة`} tone="bg-orange-50 text-orange-700" icon={Users} />
            </div>
          </Panel>
          <Panel title="إجراءات سريعة" icon={Activity}>
            <div className="grid gap-2">
              <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => void openAuditLog()}>عرض سجل الإعدادات</Button>
              <Button variant="outline" className="rounded-lg border-slate-200" onClick={exportSettings}>تحميل نسخة الإعدادات</Button>
              <Button variant="outline" className="rounded-lg border-slate-200" disabled={testingIntegrations} onClick={() => void testIntegrations()}>اختبار التكاملات</Button>
            </div>
          </Panel>
        </aside>
      </section>

      {auditOpen && (
        <SettingsAuditDialog
          logs={auditLogs}
          loading={auditLoading}
          formatDate={formatDate}
          onClose={() => setAuditOpen(false)}
          onRefresh={() => void openAuditLog()}
        />
      )}

      {integrationOpen && (
        <IntegrationCheckDialog
          results={integrationResults}
          loading={testingIntegrations}
          onClose={() => setIntegrationOpen(false)}
          onRetest={() => void testIntegrations()}
        />
      )}

      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-black text-slate-950">استعادة الإعدادات الافتراضية</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">سيتم استبدال التفضيلات المحلية الحالية بإعدادات Ausar Military الافتراضية. لا يتم حذف أي مؤسسة أو بيانات حضور.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="rounded-lg border-slate-200" onClick={() => setConfirmReset(false)}>إلغاء</Button>
              <Button className="rounded-lg bg-rose-600 text-white hover:bg-rose-700" disabled={savingSettings} onClick={() => void resetSettings()}>تأكيد</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function createDefaultOwnerSettings(ownerEmail: string): OwnerSettingsState {
  return {
    platformName: 'Ausar Military',
    ownerEmail: ownerEmail || 'admin@Ausar Military.com',
    language: 'ar',
    timezone: 'Africa/Algiers',
    primaryColor: '#2563eb',
    accentColor: '#10b981',
    logoUrl: '',
    twoFactorRequired: true,
    sessionTimeout: '60',
    strongPasswords: true,
    deviceReview: true,
    suspiciousLoginAlerts: true,
    autoBackup: true,
    backupFrequency: 'daily',
    backupRetention: '30',
    subscriptionAlerts: true,
    invoiceReminders: true,
    monthlyReports: true,
    maintenanceMode: false,
  };
}

function readOwnerSettings(ownerEmail: string): OwnerSettingsState {
  try {
    const raw = window.localStorage.getItem('qh-owner-settings');
    return raw ? { ...createDefaultOwnerSettings(ownerEmail), ...(JSON.parse(raw) as Partial<OwnerSettingsState>) } : createDefaultOwnerSettings(ownerEmail);
  } catch {
    return createDefaultOwnerSettings(ownerEmail);
  }
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-10 rounded border border-slate-200 bg-white" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-8 border-0 bg-transparent p-0 font-mono text-sm shadow-none focus-visible:ring-0" />
      </div>
    </div>
  );
}

function SettingsToggle({ label, helper, checked, onChange }: { label: string; helper: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3">
      <span>
        <span className="block font-black text-slate-950">{label}</span>
        <span className="mt-1 block text-xs text-slate-500">{helper}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SettingsSummaryRow({
  label,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  tone: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{helper}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function IntegrationStatusCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-2 font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <span className={`h-9 w-9 rounded-xl ${tone}`} />
      </div>
    </div>
  );
}

function SettingsAuditDialog({
  logs,
  loading,
  formatDate,
  onClose,
  onRefresh,
}: {
  logs: SettingsAuditLog[];
  loading: boolean;
  formatDate: (value: string | null | undefined) => string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">سجل الإعدادات</h2>
            <p className="mt-1 text-sm text-slate-500">آخر تغييرات إعدادات منصة Ausar Military المخزنة في Supabase.</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex justify-end">
            <Button variant="outline" className="rounded-lg border-slate-200" disabled={loading} onClick={onRefresh}>
              <RefreshCw className="ml-2 h-4 w-4" />
              تحديث السجل
            </Button>
          </div>
          {loading ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">جاري تحميل السجل...</div>
          ) : logs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">لا توجد تغييرات مسجلة بعد.</div>
          ) : logs.map((log) => (
            <article key={log.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{settingsActionLabel(log.action)}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(log.created_at)}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{log.setting_key}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrationCheckDialog({
  results,
  loading,
  onClose,
  onRetest,
}: {
  results: IntegrationCheckResult[];
  loading: boolean;
  onClose: () => void;
  onRetest: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">اختبار التكاملات</h2>
            <p className="mt-1 text-sm text-slate-500">فحص مباشر لأجزاء المنصة المرتبطة بالإعدادات.</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-3 p-5">
          {loading ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">جاري اختبار التكاملات...</div>
          ) : results.map((result) => (
            <article key={result.label} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black text-slate-950">{result.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{result.detail}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${integrationStatusClass(result.status)}`}>{integrationStatusLabel(result.status)}</span>
              </div>
            </article>
          ))}
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={loading} onClick={onRetest}>إعادة الاختبار</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function settingsActionLabel(action: string) {
  const labels: Record<string, string> = {
    update: 'حفظ التغييرات',
    reset: 'استعادة الافتراضي',
    logo_upload: 'رفع الشعار',
    logo_remove: 'حذف الشعار',
  };
  return labels[action] || action;
}

function integrationStatusLabel(status: IntegrationCheckResult['status']) {
  if (status === 'ok') return 'سليم';
  if (status === 'warning') return 'يحتاج مراجعة';
  return 'خطأ';
}

function integrationStatusClass(status: IntegrationCheckResult['status']) {
  if (status === 'ok') return 'bg-emerald-50 text-emerald-700';
  if (status === 'warning') return 'bg-orange-50 text-orange-700';
  return 'bg-rose-50 text-rose-700';
}

const analyticsReportCards: Array<{ type: AnalyticsReportType; title: string; description: string; icon: LucideIcon; tone: string }> = [
  { type: 'attendance', title: 'تقرير الحضور العام', description: 'تقرير شامل حول جلسات الحضور ونسب الحضور والغياب عبر كل المؤسسات.', icon: BarChart3, tone: 'bg-blue-50 text-blue-700' },
  { type: 'institution', title: 'تقرير مؤسسة محددة', description: 'تقرير خاص بجامعة أو مدرسة أو مركز تكوين أو شركة.', icon: Building2, tone: 'bg-indigo-50 text-indigo-700' },
  { type: 'absences', title: 'تقرير الغيابات', description: 'قائمة الغيابات حسب الفترة، المؤسسة، القسم أو الفوج.', icon: PauseCircle, tone: 'bg-rose-50 text-rose-700' },
  { type: 'security', title: 'تقرير الأجهزة والأمان', description: 'الأجهزة المرتبطة، المحاولات المرفوضة، ومحاولات التلاعب.', icon: ShieldCheck, tone: 'bg-orange-50 text-orange-700' },
  { type: 'subscriptions', title: 'تقرير الاشتراكات والفوترة', description: 'حالة الاشتراكات، المدفوعات، الفواتير، والاشتراكات القريبة من الانتهاء.', icon: CreditCard, tone: 'bg-emerald-50 text-emerald-700' },
];

function createEmptyAnalyticsSnapshot(): AnalyticsSnapshot {
  return {
    userCount: 0,
    studentCount: 0,
    adminCount: 0,
    sessionCount: 0,
    attendanceCount: 0,
    attendanceRate: null,
    absenceCount: null,
    deviceCount: 0,
    activeSubscriptions: null,
    expectedRevenue: null,
    rejectedAttempts: null,
    suspiciousAttempts: null,
    trend: [],
    sectors: [],
    institutions: [],
  };
}

function createDefaultReportForm(): CustomReportForm {
  return {
    reportType: 'attendance',
    sector: 'all',
    institutionId: 'all',
    rangePreset: '30d',
    format: 'pdf',
    includeCharts: true,
    includeTables: true,
  };
}

function buildAnalyticsRange(preset: AnalyticsRangePreset) {
  const now = new Date();
  const start = new Date(now);
  if (preset === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (preset === '7d') {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (preset === '30d') {
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else if (preset === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }

  const labels: Record<AnalyticsRangePreset, string> = {
    today: 'اليوم',
    '7d': 'آخر 7 أيام',
    '30d': 'آخر 30 يوم',
    month: 'هذا الشهر',
    year: 'هذه السنة',
  };
  return { startIso: start.toISOString(), label: labels[preset] };
}

function buildAnalyticsTrend(sessions: AnalyticsSessionDataRow[], attendances: AnalyticsAttendanceDataRow[], studentCount: number): AnalyticsTrendPoint[] {
  const buckets = new Map<string, { sessions: number; attendances: number }>();
  sessions.forEach((session) => {
    const label = formatTrendLabel(session.created_at);
    const bucket = buckets.get(label) || { sessions: 0, attendances: 0 };
    bucket.sessions += 1;
    buckets.set(label, bucket);
  });
  attendances.forEach((attendance) => {
    const label = formatTrendLabel(attendance.created_at);
    const bucket = buckets.get(label) || { sessions: 0, attendances: 0 };
    bucket.attendances += 1;
    buckets.set(label, bucket);
  });

  return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([label, bucket]) => {
    const expected = studentCount * bucket.sessions;
    return {
      label,
      attendanceRate: expected > 0 ? Math.min(100, Math.round((bucket.attendances / expected) * 1000) / 10) : null,
      attendances: bucket.attendances,
      absences: expected > 0 ? Math.max(0, expected - bucket.attendances) : null,
      sessions: bucket.sessions,
    };
  });
}

function formatTrendLabel(value: string | null | undefined) {
  if (!value) return 'غير مؤرخ';
  return new Date(value).toISOString().slice(5, 10);
}

function formatAnalyticsPercent(value: number | null | undefined) {
  return typeof value === 'number' ? `${value}%` : 'غير متوفر حالياً';
}

function analyticsRateClass(value: number | null | undefined) {
  if (value === null || value === undefined) return 'bg-slate-100 text-slate-500';
  if (value >= 80) return 'bg-emerald-50 text-emerald-700';
  if (value >= 50) return 'bg-orange-50 text-orange-700';
  return 'bg-rose-50 text-rose-700';
}

function downloadBrowserBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function filterRowsForReport(rows: AnalyticsInstitutionRow[], form: CustomReportForm) {
  return rows.filter((row) => {
    const matchesSector = form.sector === 'all' || row.institutionType === form.sector;
    const matchesInstitution = form.institutionId === 'all' || row.institution.id === form.institutionId;
    return matchesSector && matchesInstitution;
  });
}

function AnalyticsKpi({ label, value, trend, helper, icon: Icon, tone }: { label: string; value: string; trend: string; helper: string; icon: LucideIcon; tone: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-[11px] font-bold text-emerald-600">{trend}</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-400">{helper}</p>
    </article>
  );
}

function AnalyticsTrendCard({ title, rows, metric, emptyText }: { title: string; rows: AnalyticsTrendPoint[]; metric: 'attendance' | 'absences'; emptyText: string }) {
  const values = rows.map((row) => metric === 'attendance' ? row.attendanceRate : row.absences).filter((value): value is number => typeof value === 'number');
  const maxValue = Math.max(...values, 1);
  const hasData = values.length > 0;

  return (
    <Panel title={title} icon={TrendingUp}>
      {hasData ? (
        <div className="space-y-4">
          <div className="flex h-48 items-end gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-4">
            {rows.map((row) => {
              const raw = metric === 'attendance' ? row.attendanceRate : row.absences;
              const height = typeof raw === 'number' ? Math.max(8, Math.round((raw / maxValue) * 100)) : 4;
              return (
                <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end">
                    <div className={`w-full rounded-t-md ${metric === 'attendance' ? 'bg-blue-600' : 'bg-rose-500'}`} style={{ height: `${height}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{row.label}</span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <DetailPill label="الحضور" value={rows.reduce((sum, row) => sum + row.attendances, 0).toString()} />
            <DetailPill label="الجلسات" value={rows.reduce((sum, row) => sum + row.sessions, 0).toString()} />
            <DetailPill label="آخر قيمة" value={metric === 'attendance' ? formatAnalyticsPercent(rows[rows.length - 1]?.attendanceRate) : String(rows[rows.length - 1]?.absences ?? 'غير متوفر')} />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">{emptyText}</div>
      )}
    </Panel>
  );
}

function AnalyticsSectorCard({ title, rows, mode }: { title: string; rows: AnalyticsSectorRow[]; mode: 'count' | 'attendance' }) {
  const values = rows.map((row) => mode === 'count' ? row.count : row.attendanceRate).filter((value): value is number => typeof value === 'number');
  const maxValue = Math.max(...values, 1);
  return (
    <Panel title={title} icon={Layers}>
      <div className="space-y-3">
        {rows.map((row) => {
          const raw = mode === 'count' ? row.count : row.attendanceRate;
          const width = typeof raw === 'number' ? Math.max(6, Math.round((raw / maxValue) * 100)) : 0;
          return (
            <div key={row.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-700">{row.label}</span>
                <span className="text-slate-500">{mode === 'count' ? row.count : formatAnalyticsPercent(row.attendanceRate)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500">لا توجد بيانات كافية بعد</div>}
      </div>
    </Panel>
  );
}

function SecurityMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-slate-700">{label}</span>
        <span className="font-black text-slate-950">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full w-2/3 rounded-full ${tone}`} />
      </div>
    </div>
  );
}

function CustomReportModal({
  form,
  institutions,
  rows,
  setForm,
  onClose,
  onPreview,
  onPdf,
  onExcel,
}: {
  form: CustomReportForm;
  institutions: Institution[];
  rows: AnalyticsInstitutionRow[];
  setForm: React.Dispatch<React.SetStateAction<CustomReportForm>>;
  onClose: () => void;
  onPreview: () => void;
  onPdf: () => void;
  onExcel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">إنشاء تقرير مخصص</h2>
            <p className="mt-1 text-sm text-slate-500">اختر نوع التقرير والفترة والقطاع ثم قم بالمعاينة أو التصدير.</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>نوع التقرير</Label>
              <Select value={form.reportType} onValueChange={(value) => setForm((current) => ({ ...current, reportType: value as AnalyticsReportType }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="attendance">حضور</SelectItem>
                  <SelectItem value="absences">غيابات</SelectItem>
                  <SelectItem value="security">أجهزة وأمان</SelectItem>
                  <SelectItem value="subscriptions">اشتراكات</SelectItem>
                  <SelectItem value="users">مستخدمون</SelectItem>
                  <SelectItem value="institution">مؤسسة واحدة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>القطاع</Label>
              <Select value={form.sector} onValueChange={(value) => setForm((current) => ({ ...current, sector: value as SectorId }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="university">جامعات</SelectItem>
                  <SelectItem value="school">مؤسسات تربوية</SelectItem>
                  <SelectItem value="primary_school">مدارس ابتدائية</SelectItem>
                  <SelectItem value="training">مراكز تكوين</SelectItem>
                  <SelectItem value="company">شركات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المؤسسة</Label>
              <Select value={form.institutionId} onValueChange={(value) => setForm((current) => ({ ...current, institutionId: value }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المؤسسات</SelectItem>
                  {institutions.map((institution) => <SelectItem key={institution.id} value={institution.id}>{institution.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفترة الزمنية</Label>
              <Select value={form.rangePreset} onValueChange={(value) => setForm((current) => ({ ...current, rangePreset: value as AnalyticsRangePreset }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="7d">آخر 7 أيام</SelectItem>
                  <SelectItem value="30d">آخر 30 يوم</SelectItem>
                  <SelectItem value="month">هذا الشهر</SelectItem>
                  <SelectItem value="year">هذه السنة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>صيغة التصدير</Label>
              <Select value={form.format} onValueChange={(value) => setForm((current) => ({ ...current, format: value as AnalyticsExportFormat }))}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
              المؤسسات المطابقة: <span className="font-black text-slate-950">{rows.length}</span>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700">
              تضمين الرسوم البيانية
              <input type="checkbox" checked={form.includeCharts} onChange={(event) => setForm((current) => ({ ...current, includeCharts: event.target.checked }))} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm font-bold text-slate-700">
              تضمين الجداول التفصيلية
              <input type="checkbox" checked={form.includeTables} onChange={(event) => setForm((current) => ({ ...current, includeTables: event.target.checked }))} />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onPreview}>معاينة التقرير</Button>
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onPdf}>تحميل PDF</Button>
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={onExcel}>تحميل Excel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OwnerToolDialog({
  tool,
  platformStats,
  recentInstitutions,
  formatNumber,
  formatDate,
  getTypeIcon,
  getTypeLabel,
  onOpenInstitution,
  onClose,
}: {
  tool: OwnerToolConfig;
  platformStats: { total: number; active: number; suspended: number; capacity: number; wilayas: number };
  recentInstitutions: Institution[];
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  getTypeLabel: (type: string) => string;
  onOpenInstitution: (inst: Institution) => void;
  onClose: () => void;
}) {
  const Icon = tool.icon;
  const showRecentList = ['users', 'activity', 'notifications'].includes(tool.id);
  const quickRows = [
    { label: 'إجمالي المؤسسات', value: formatNumber(platformStats.total), icon: Building2, tone: 'text-blue-700 bg-blue-50' },
    { label: 'النشطة', value: formatNumber(platformStats.active), icon: ShieldCheck, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'المجمدة', value: formatNumber(platformStats.suspended), icon: PauseCircle, tone: 'text-rose-700 bg-rose-50' },
    { label: 'السعة الإجمالية', value: formatNumber(platformStats.capacity), icon: Users, tone: 'text-violet-700 bg-violet-50' },
  ];

  const toolBody = () => {
    if (tool.id === 'billing') {
      return (
        <div className="grid gap-3 md:grid-cols-3">
          <InfoBlock label="اشتراكات نشطة" value={formatNumber(platformStats.active)} icon={CreditCard} />
          <InfoBlock label="تحتاج مراجعة" value={formatNumber(platformStats.suspended)} icon={ShieldCheck} />
          <InfoBlock label="الولايات المغطاة" value={formatNumber(platformStats.wilayas)} icon={MapPin} />
        </div>
      );
    }

    if (tool.id === 'analytics') {
      return (
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <AttendanceRing attendanceRate={platformStats.total > 0 ? Math.round((platformStats.active / platformStats.total) * 100) : 0} />
          <div className="space-y-3">
            <HealthRow label="نسبة المؤسسات النشطة" value={`${platformStats.total > 0 ? Math.round((platformStats.active / platformStats.total) * 100) : 0}%`} color="bg-blue-500" />
            <HealthRow label="المؤسسات المجمدة" value={formatNumber(platformStats.suspended)} color="bg-rose-500" />
            <HealthRow label="السعة الإجمالية" value={formatNumber(platformStats.capacity)} color="bg-emerald-500" />
            <HealthRow label="الولايات" value={formatNumber(platformStats.wilayas)} color="bg-orange-500" />
          </div>
        </div>
      );
    }

    if (tool.id === 'settings') {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <InfoBlock label="اسم المنصة" value="Ausar Military" icon={Crown} />
          <InfoBlock label="الدومين" value="Ausar Military.vercel.app" icon={Globe2} />
          <InfoBlock label="نظام الصلاحيات" value="Supabase Auth + RLS" icon={LockKeyhole} />
          <InfoBlock label="حالة المنصة" value="نشطة" icon={Activity} />
        </div>
      );
    }

    if (tool.id === 'support') {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <InfoBlock label="قناة الدعم" value="إدارة المنصة" icon={ShieldCheck} />
          <InfoBlock label="نوع الطلب" value="تشغيلي / تقني" icon={FileText} />
          <InfoBlock label="حالة المتابعة" value="جاهزة" icon={Check} />
          <InfoBlock label="آخر تحديث" value={formatDate(new Date().toISOString())} icon={Clock} />
        </div>
      );
    }

    if (tool.id === 'language') {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <InfoBlock label="لغة الواجهة" value="العربية" icon={Globe2} />
          <InfoBlock label="اتجاه العرض" value="RTL" icon={LayoutDashboard} />
          <InfoBlock label="تنسيق الأرقام" value="ar-DZ" icon={BarChart3} />
          <InfoBlock label="المنطقة" value="الجزائر" icon={MapPin} />
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {quickRows.map((row) => (
          <SummaryTile key={row.label} label={row.label} value={row.value} icon={row.icon} tone={row.tone} />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">{tool.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{tool.subtitle}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-5 p-5">
          {toolBody()}

          {showRecentList && (
            <section className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h3 className="font-black text-slate-950">آخر المؤسسات</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {recentInstitutions.length === 0 ? (
                  <div className="p-5 text-sm text-slate-500">لا توجد مؤسسات لعرضها حالياً.</div>
                ) : (
                  recentInstitutions.map((inst) => (
                    <button
                      key={inst.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-slate-50"
                      onClick={() => {
                        onClose();
                        onOpenInstitution(inst);
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                          {getTypeIcon(inst.type, 'h-4 w-4')}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-slate-950">{inst.name}</span>
                          <span className="block truncate text-xs text-slate-500">{getTypeLabel(inst.type)} • {inst.code || 'بدون رمز'}</span>
                        </span>
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(inst.created_at)}</span>
                    </button>
                  ))
                )}
              </div>
            </section>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>
              إغلاق
            </Button>
            <Button
              className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => toast.info(`تم فتح ${tool.label} بنجاح`)}
            >
              تنفيذ الإجراء
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PanelAction {
  label: string;
  icon?: LucideIcon;
  tone?: string;
  onClick: () => void | Promise<void>;
}

function panelExportFileName(title: string) {
  const safeTitle = title
    .replace(/[^\w\u0600-\u06FF-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `Ausar Military-${safeTitle || 'panel'}-${new Date().toISOString().slice(0, 10)}.txt`;
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  actions?: PanelAction[];
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const defaultActions: PanelAction[] = [
    {
      label: 'تحديث القسم',
      icon: RefreshCw,
      onClick: () => toast.success(`تم تحديث قسم ${title}`),
    },
    {
      label: 'نسخ اسم القسم',
      icon: Copy,
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(title);
          toast.success('تم نسخ اسم القسم');
        } catch {
          toast.error('تعذر النسخ من المتصفح');
        }
      },
    },
    {
      label: 'تصدير ملخص القسم',
      icon: Download,
      onClick: () => {
        const content = [
          'Ausar Military',
          `القسم: ${title}`,
          subtitle ? `الوصف: ${subtitle}` : null,
          `التاريخ: ${new Date().toISOString()}`,
        ]
          .filter(Boolean)
          .join('\n');
        downloadBrowserBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), panelExportFileName(title));
        toast.success('تم تصدير ملخص القسم');
      },
    },
  ];
  const menuActions = actions?.length ? actions : defaultActions;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-black text-slate-950">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg text-slate-500"
            aria-label={`إجراءات ${title}`}
            aria-expanded={actionsOpen}
            onClick={() => setActionsOpen((open) => !open)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
          {actionsOpen && (
            <div className="absolute left-0 top-10 z-30 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 text-right shadow-xl" role="menu">
              {menuActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-bold transition hover:bg-slate-50 ${action.tone ?? 'text-slate-700'}`}
                    onClick={() => {
                      setActionsOpen(false);
                      void action.onClick();
                    }}
                    role="menuitem"
                  >
                    <span>{action.label}</span>
                    {ActionIcon && <ActionIcon className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function SectorDetailPage({
  sector,
  institutions,
  stats,
  loading,
  formatNumber,
  formatDate,
  getTypeLabel,
  getTypeIcon,
  statusBadge,
  onBack,
  onRefresh,
  onOpen,
  onToggle,
  onDelete,
}: {
  sector: SectorConfig;
  institutions: Institution[];
  stats: SectorStats;
  loading: boolean;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  statusBadge: (status: string | null | undefined) => string;
  onBack: () => void;
  onRefresh: () => void;
  onOpen: (inst: Institution) => void;
  onToggle: (inst: Institution) => void;
  onDelete: (inst: Institution) => void;
}) {
  const Icon = sector.icon;
  const [sectorTab, setSectorTab] = useState<SectorWorkspaceTab>('overview');
  const sectorTabs: { id: SectorWorkspaceTab; label: string; icon: LucideIcon }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
    { id: 'institutions', label: 'المؤسسات', icon: Building2 },
    { id: 'security', label: 'الأمان', icon: ShieldCheck },
    { id: 'reports', label: 'التقارير', icon: FileText },
  ];
  const attendanceRate = getSectorAttendanceRate(stats);
  const generatedAt = nowGeneratedAt();
  const sectorRows: Array<{
    institutionName: string;
    institutionType: string;
    wilaya: string;
    city: string;
    status: string;
    maxStudents: number;
    createdAt: string;
  }> = institutions.map((inst) => ({
    institutionName: inst.name,
    institutionType: getTypeLabel(inst.type),
    wilaya: inst.wilaya || '',
    city: inst.city || '',
    status: inst.status || 'active',
    maxStudents: inst.max_students || 0,
    createdAt: inst.created_at || '',
  }));

  const handleSectorReportAction = async (label: string) => {
    try {
      switch (label) {
        case 'تقرير القطاع PDF':
          await exportSectorReportPDF({
            sectorName: sector.label,
            generatedAt,
            rows: sectorRows,
            kpis: [
              { label: 'المؤسسات', value: formatNumber(stats.institutions) },
              { label: 'المؤسسات النشطة', value: formatNumber(stats.active) },
              { label: 'المؤسسات المجمدة', value: formatNumber(stats.suspended) },
              { label: 'الولايات المغطاة', value: formatNumber(stats.wilayas) },
              { label: 'الطلبة', value: formatNumber(stats.students) },
              { label: 'الأفواج', value: formatNumber(stats.cohorts) },
              { label: 'الجلسات', value: formatNumber(stats.sessions) },
              { label: 'تسجيلات الحضور', value: formatNumber(stats.attendances) },
            ],
          });
          toast.success('تم تنزيل تقرير القطاع بصيغة PDF');
          break;
        case 'تصدير Excel':
          await exportSectorReportExcel({
            sectorName: sector.label,
            generatedAt,
            rows: sectorRows,
            kpis: [
              { label: 'المؤسسات', value: formatNumber(stats.institutions) },
              { label: 'المؤسسات النشطة', value: formatNumber(stats.active) },
              { label: 'المؤسسات المجمدة', value: formatNumber(stats.suspended) },
              { label: 'الولايات المغطاة', value: formatNumber(stats.wilayas) },
              { label: 'الطلبة', value: formatNumber(stats.students) },
              { label: 'الأفواج', value: formatNumber(stats.cohorts) },
              { label: 'الجلسات', value: formatNumber(stats.sessions) },
              { label: 'تسجيلات الحضور', value: formatNumber(stats.attendances) },
            ],
          });
          toast.success('تم تنزيل تقرير القطاع بصيغة Excel');
          break;
        case 'تقرير الحضور':
          await exportAttendanceReportPDF({
            sectorName: sector.label,
            generatedAt,
            weeklyAttendance: stats.weeklyAttendance.length > 0 ? stats.weeklyAttendance : Array.from({ length: 12 }, () => 0),
            attendanceRate: String(attendanceRate),
            totalAttendances: stats.attendances,
            totalSessions: stats.sessions,
            totalStudents: stats.students,
          });
          toast.success('تم تنزيل تقرير الحضور بصيغة PDF');
          break;
        case 'تقرير الأجهزة':
          await exportDevicesReportPDF({
            sectorName: sector.label,
            generatedAt,
            totalDevices: stats.devices,
            institutionsCount: stats.institutions,
            averagePerInstitution: stats.institutions > 0 ? (stats.devices / stats.institutions).toFixed(1) : '0',
            recentActivity: stats.recentActivities.slice(0, 10).map((activity) => ({ text: activity.text, time: activity.time })),
          });
          toast.success('تم تنزيل تقرير الأجهزة بصيغة PDF');
          break;
        default:
          toast.info('هذا التقرير متاح من لوحة المؤسسة');
      }
    } catch (err) {
      console.error('Sector report export failed', err);
      toast.error('تعذر توليد التقرير. يرجى المحاولة مرة أخرى.');
    }
  };

  const peopleLabel = sector.id === 'company'
    ? 'الموظفون'
    : sector.id === 'training'
      ? 'المتربصون'
      : 'الطلبة';
  const cohortLabel = sector.id === 'company' ? 'المجموعات' : 'الأفواج';
  const bars = stats.weeklyAttendance.length > 0 ? stats.weeklyAttendance : Array.from({ length: 12 }, () => 0);
  const reportActions = [
    {
      label: 'تقرير القطاع PDF',
      helper: `${formatNumber(stats.institutions)} مؤسسة داخل القطاع`,
      icon: FileText,
      tone: 'text-rose-600 bg-rose-50',
    },
    {
      label: 'تصدير Excel',
      helper: 'تصدير بيانات مؤسسات القطاع',
      icon: Download,
      tone: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'تقرير الحضور',
      helper: `${formatNumber(stats.attendances)} تسجيل حضور`,
      icon: Activity,
      tone: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'تقرير الأجهزة',
      helper: `${formatNumber(stats.devices)} جهاز موثق`,
      icon: Smartphone,
      tone: 'text-violet-600 bg-violet-50',
    },
  ];

  const renderSectorTabContent = () => {
    if (sectorTab === 'institutions') {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">مؤسسات القطاع</h2>
              <p className="mt-1 text-sm text-slate-500">قائمة منفصلة تعرض بيانات {sector.label} فقط.</p>
            </div>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {formatNumber(institutions.length)} مؤسسة
            </span>
          </div>
          <SectorInstitutionTable
            institutions={institutions}
            getTypeLabel={getTypeLabel}
            getTypeIcon={getTypeIcon}
            statusBadge={statusBadge}
            formatNumber={formatNumber}
            formatDate={formatDate}
            onOpen={onOpen}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        </div>
      );
    }

    if (sectorTab === 'security') {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile label="الأجهزة الموثقة" value={formatNumber(stats.devices)} icon={Smartphone} tone="text-blue-700 bg-blue-50" />
            <SummaryTile label="الحسابات الإدارية" value={formatNumber(stats.admins)} icon={LockKeyhole} tone="text-violet-700 bg-violet-50" />
            <SummaryTile label="المؤسسات النشطة" value={formatNumber(stats.active)} icon={ShieldCheck} tone="text-emerald-700 bg-emerald-50" />
            <SummaryTile label="المؤسسات المجمدة" value={formatNumber(stats.suspended)} icon={PauseCircle} tone="text-rose-700 bg-rose-50" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-black text-slate-950">ملخص الأمان</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <InfoBlock label="نسبة المؤسسات النشطة" value={`${stats.institutions > 0 ? Math.round((stats.active / stats.institutions) * 100) : 0}%`} icon={TrendingUp} />
              <InfoBlock label="متوسط الأجهزة لكل مؤسسة" value={formatNumber(stats.institutions > 0 ? Math.round(stats.devices / stats.institutions) : 0)} icon={Smartphone} />
              <InfoBlock label="التغطية الجغرافية" value={`${formatNumber(stats.wilayas)} ولاية`} icon={MapPin} />
            </div>
          </div>
        </div>
      );
    }

    if (sectorTab === 'reports') {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {reportActions.map((action) => (
              <ReportAction
                key={action.label}
                label={action.label}
                helper={action.helper}
                icon={action.icon}
                tone={action.tone}
                onClick={() => void handleSectorReportAction(action.label)}
              />
            ))}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">تحليل حضور القطاع</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {stats.weeklyAttendance.length > 0 ? 'بيانات مجمعة من سجلات الحضور الحقيقية.' : 'لا توجد سجلات حضور كافية لهذا القطاع بعد.'}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                {attendanceRate}% حضور
              </span>
            </div>
            <div className="flex h-36 items-end gap-2 border-b border-slate-200">
              {bars.map((value, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={`w-full rounded-t ${value > 0 ? 'bg-blue-500/85' : 'bg-slate-200'}`}
                    style={{ height: `${Math.max(value, 4)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div>
          <h2 className="mb-3 text-lg font-black text-slate-950">مؤشرات القطاع</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile label="الولايات المغطاة" value={formatNumber(stats.wilayas)} icon={MapPin} tone="text-blue-700 bg-blue-50" />
            <SummaryTile label="الحسابات الإدارية" value={formatNumber(stats.admins)} icon={LockKeyhole} tone="text-violet-700 bg-violet-50" />
            <SummaryTile label={cohortLabel} value={formatNumber(stats.cohorts)} icon={Layers} tone="text-emerald-700 bg-emerald-50" />
            <SummaryTile label="المؤسسات المجمدة" value={formatNumber(stats.suspended)} icon={PauseCircle} tone="text-rose-700 bg-rose-50" />
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-black text-slate-950">مؤسسات القطاع</h2>
            </div>
            <button
              type="button"
              className="text-xs font-bold text-blue-700 hover:text-blue-800"
              onClick={() => setSectorTab('institutions')}
            >
              عرض صفحة المؤسسات
            </button>
          </div>
          <SectorInstitutionTable
            institutions={institutions}
            getTypeLabel={getTypeLabel}
            getTypeIcon={getTypeIcon}
            statusBadge={statusBadge}
            formatNumber={formatNumber}
            formatDate={formatDate}
            onOpen={onOpen}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        </div>
      </>
    );
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <button type="button" className="hover:text-slate-950" onClick={onBack}>الرئيسية</button>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>لوحة مالك المنصة</span>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-slate-800">{sector.label}</span>
          </div>
          <div className="flex items-start gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-lg border shadow-sm ${sector.soft}`}>
              <Icon className={`h-8 w-8 ${sector.accent}`} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-950">ملف القطاع</h1>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  {formatNumber(stats.active)} نشطة
                </span>
                {loading && (
                  <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    تحديث
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="font-black text-slate-950">{sector.label}</span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                  Ausar Military SaaS
                </span>
                <span>بيانات حقيقية مجمعة حسب القطاع</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={onBack}>
            <ArrowLeft className="ml-2 h-4 w-4" />
            رجوع
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={onRefresh}>
            <RefreshCw className={`ml-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button
            className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setSectorTab('reports')}
          >
            <Download className="ml-2 h-4 w-4" />
            تقرير القطاع
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MiniMetric label="إجمالي المؤسسات" value={formatNumber(stats.institutions)} icon={Building2} tone="bg-blue-50 text-blue-700" />
        <MiniMetric label="المؤسسات النشطة" value={formatNumber(stats.active)} icon={ShieldCheck} tone="bg-emerald-50 text-emerald-700" />
        <MiniMetric label={peopleLabel} value={formatNumber(stats.students)} icon={Users} tone="bg-violet-50 text-violet-700" />
        <MiniMetric label="الجلسات" value={formatNumber(stats.sessions)} icon={Clock} tone="bg-orange-50 text-orange-700" />
        <MiniMetric label="تسجيلات الحضور" value={formatNumber(stats.attendances)} icon={Check} tone="bg-green-50 text-green-700" />
        <MiniMetric label="الأجهزة" value={formatNumber(stats.devices)} icon={Smartphone} tone="bg-slate-50 text-slate-700" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_360px]" dir="ltr">
        <div className="space-y-5" dir="rtl">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4">
              <div className="flex flex-wrap gap-1">
                {sectorTabs.map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = sectorTab === tab.id;
                  return (
                    <button
                      key={tab.label}
                      type="button"
                      className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-bold transition ${
                        isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-950'
                      }`}
                      onClick={() => setSectorTab(tab.id)}
                    >
                      <TabIcon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-5 p-4">
              {renderSectorTabContent()}
            </div>
          </section>
        </div>

        <aside className="space-y-5" dir="rtl">
          <Panel title="الأجهزة والأمان" subtitle="مؤشرات حماية القطاع" icon={ShieldCheck}>
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 p-4 text-center">
              <SideStat label="الأجهزة" value={formatNumber(stats.devices)} icon={Smartphone} tone="text-blue-600" />
              <SideStat label="الحسابات" value={formatNumber(stats.admins)} icon={LockKeyhole} tone="text-violet-600" />
              <SideStat label="النشطة" value={formatNumber(stats.active)} icon={ShieldCheck} tone="text-emerald-600" />
            </div>
            <div className="px-4 pb-4">
              <Button
                variant="outline"
                className="h-9 w-full rounded-lg border-slate-200 text-blue-700"
                onClick={() => setSectorTab('security')}
              >
                <Smartphone className="ml-2 h-4 w-4" />
                عرض الأجهزة
              </Button>
            </div>
          </Panel>

          <Panel title="توزيع الحضور" subtitle={sector.label} icon={Activity}>
            <div className="flex items-center gap-5 p-4">
              <AttendanceRing attendanceRate={attendanceRate} compact />
              <div className="flex-1 space-y-2 text-sm">
                <HealthRow label="حاضر" value={`${attendanceRate}%`} color="bg-blue-500" />
                <HealthRow label="غير مسجل" value={`${Math.max(0, 100 - attendanceRate)}%`} color="bg-orange-500" />
                <HealthRow label="الأجهزة" value={formatNumber(stats.devices)} color="bg-emerald-500" />
              </div>
            </div>
          </Panel>

          <Panel title="تحليل آخر 12 أسبوع" subtitle="حضور القطاع" icon={BarChart3}>
            <div className="p-4">
              <div className="flex h-32 items-end gap-2 border-b border-slate-100">
                {bars.map((value, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className={`w-full rounded-t ${value > 0 ? 'bg-blue-500/85' : 'bg-slate-200'}`}
                      style={{ height: `${Math.max(value, 4)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{stats.weeklyAttendance.length > 0 ? 'بيانات حقيقية' : 'لا توجد بيانات حديثة'}</span>
                <span>12 أسبوع</span>
              </div>
            </div>
          </Panel>

          <Panel title="آخر النشاطات" subtitle="قراءة تشغيلية سريعة" icon={Clock}>
            <div className="divide-y divide-slate-100">
              {stats.recentActivities.length > 0 ? (
                stats.recentActivities.map((act, idx) => (
                  <ActivityLine key={idx} time={act.time} text={act.text} color={act.color} />
                ))
              ) : (
                <>
                  <ActivityLine time="اليوم" text={`المؤسسات النشطة ${formatNumber(stats.active)}`} color="bg-blue-500" />
                  <ActivityLine time="اليوم" text={`الحضور المسجل ${formatNumber(stats.attendances)}`} color="bg-emerald-500" />
                  <ActivityLine time="اليوم" text={`الأجهزة الموثقة ${formatNumber(stats.devices)}`} color="bg-violet-500" />
                </>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function SectorInstitutionTable({
  institutions,
  getTypeLabel,
  getTypeIcon,
  statusBadge,
  formatNumber,
  formatDate,
  onOpen,
  onToggle,
  onDelete,
}: {
  institutions: Institution[];
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  statusBadge: (status: string | null | undefined) => string;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  onOpen: (inst: Institution) => void;
  onToggle: (inst: Institution) => void;
  onDelete: (inst: Institution) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <div className="grid min-w-[900px] grid-cols-[minmax(220px,1fr)_130px_120px_110px_130px_150px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
        <span>المؤسسة</span>
        <span>الولاية</span>
        <span>الحالة</span>
        <span>السعة</span>
        <span>آخر نشاط</span>
        <span>الإجراءات</span>
      </div>

      {institutions.length === 0 ? (
        <div className="min-w-[900px] p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-bold text-slate-700">لا توجد مؤسسات داخل هذا القطاع</p>
          <p className="mt-1 text-sm text-slate-500">عند إضافة مؤسسة جديدة لهذا النوع ستظهر هنا مباشرة.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {institutions.map((inst) => (
            <div key={inst.id} className="grid min-w-[900px] grid-cols-[minmax(220px,1fr)_130px_120px_110px_130px_150px] gap-3 px-4 py-3 text-sm transition hover:bg-slate-50">
              <button type="button" className="flex min-w-0 items-center gap-3 text-right" onClick={() => onOpen(inst)}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
                  {getTypeIcon(inst.type, 'h-4 w-4')}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950">{inst.name}</p>
                  <p className="truncate text-xs text-slate-500">{inst.code || 'بدون رمز'} • {getTypeLabel(inst.type)}</p>
                </div>
              </button>
              <div className="flex items-center text-slate-600">{inst.wilaya || inst.city || 'غير محدد'}</div>
              <div className="flex items-center">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge(inst.status)}`}>
                  {inst.status === 'active' ? 'نشطة' : 'مجمدة'}
                </span>
              </div>
              <div className="flex items-center font-bold text-slate-800">{formatNumber(inst.max_students)}</div>
              <div className="flex items-center text-slate-500">{formatDate(inst.created_at)}</div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 rounded-lg border-blue-200 text-blue-700" onClick={() => onOpen(inst)}>
                  فتح ملف المؤسسة
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0 text-slate-500" onClick={() => onToggle(inst)}>
                  {inst.status === 'active' ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => onDelete(inst)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InstitutionTable({
  institutions,
  activeSector,
  getTypeLabel,
  getTypeIcon,
  statusBadge,
  onOpen,
  onToggle,
  onDelete,
}: {
  institutions: Institution[];
  activeSector: SectorId;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  statusBadge: (status: string | null | undefined) => string;
  onOpen: (inst: Institution) => void;
  onToggle: (inst: Institution) => void;
  onDelete: (inst: Institution) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px] grid-cols-[minmax(180px,1fr)_120px_120px_110px_120px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
        <span>المؤسسة</span>
        <span>الولاية</span>
        <span>الحالة</span>
        <span>السعة</span>
        <span>إجراءات</span>
      </div>

      {institutions.length === 0 ? (
        <div className="min-w-[760px] p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-bold text-slate-700">لا توجد مؤسسات في {activeSector === 'all' ? 'هذا العرض' : 'هذا القطاع'}</p>
          <p className="mt-1 text-sm text-slate-500">يمكن إضافة مؤسسة جديدة من زر الإضافة في الأعلى.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {institutions.map((inst) => (
            <div key={inst.id} className="grid min-w-[760px] grid-cols-[minmax(180px,1fr)_120px_120px_110px_120px] gap-3 px-4 py-3 text-sm transition hover:bg-slate-50">
              <button type="button" className="flex min-w-0 items-center gap-3 text-right" onClick={() => onOpen(inst)}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
                  {getTypeIcon(inst.type, 'h-4 w-4')}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950">{inst.name}</p>
                  <p className="truncate text-xs text-slate-500">{inst.code || 'بدون رمز'} • {getTypeLabel(inst.type)}</p>
                </div>
              </button>
              <div className="flex items-center text-slate-600">{inst.wilaya || inst.city || 'غير محدد'}</div>
              <div className="flex items-center">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge(inst.status)}`}>
                  {inst.status === 'active' ? 'نشطة' : 'مجمدة'}
                </span>
              </div>
              <div className="flex items-center font-bold text-slate-800">{formatNumber(inst.max_students)}</div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 rounded-lg border-blue-200 text-blue-700" onClick={() => onOpen(inst)}>
                  فتح
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0 text-slate-500" onClick={() => onToggle(inst)}>
                  {inst.status === 'active' ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => onDelete(inst)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformLiveStatsBar({
  stats,
  loading,
  onRefresh,
  formatNumber,
}: {
  stats: PlatformLiveStats;
  loading: boolean;
  onRefresh: () => void;
  formatNumber: (value: number | null | undefined) => string;
}) {
  const tiles: Array<{
    label: string;
    value: number | string;
    helper: string;
    icon: LucideIcon;
    tone: string;
    accent: string;
  }> = [
    {
      label: 'إجمالي الأساتذة',
      value: formatNumber(stats.teachers),
      helper: `${formatNumber(stats.superAdmins)} مالك / مدير`,
      icon: UserPlus,
      tone: 'from-violet-500 to-violet-700',
      accent: 'text-violet-100',
    },
    {
      label: 'الكليات / الأقسام / التخصصات',
      value: `${formatNumber(stats.faculties)} / ${formatNumber(stats.departments)} / ${formatNumber(stats.specialties)}`,
      helper: `${formatNumber(stats.cohorts)} فوج مسجل`,
      icon: Layers,
      tone: 'from-sky-500 to-blue-700',
      accent: 'text-sky-100',
    },
    {
      label: 'الطلاب المسجلون',
      value: formatNumber(stats.students),
      helper: `${formatNumber(stats.cohorts)} فوج`,
      icon: GraduationCap,
      tone: 'from-cyan-500 to-cyan-700',
      accent: 'text-cyan-100',
    },
    {
      label: 'الجلسات',
      value: formatNumber(stats.sessions),
      helper: `${formatNumber(stats.activeSessions)} نشطة • ${formatNumber(stats.sessionsToday)} اليوم`,
      icon: Clock,
      tone: 'from-orange-500 to-orange-700',
      accent: 'text-orange-100',
    },
    {
      label: 'سجلات الحضور',
      value: formatNumber(stats.attendances),
      helper: `${formatNumber(stats.attendancesToday)} اليوم • ${formatNumber(stats.attendancesThisWeek)} هذا الأسبوع`,
      icon: UserCheck,
      tone: 'from-emerald-500 to-emerald-700',
      accent: 'text-emerald-100',
    },
    {
      label: 'نسبة الحضور',
      value: `${stats.attendanceRate}%`,
      helper: 'حضور فعلي / متوقع',
      icon: TrendingUp,
      tone: 'from-teal-500 to-teal-700',
      accent: 'text-teal-100',
    },
    {
      label: 'الأجهزة المرتبطة',
      value: formatNumber(stats.devices),
      helper: `${formatNumber(stats.activeDevices)} نشطة`,
      icon: Smartphone,
      tone: 'from-indigo-500 to-indigo-700',
      accent: 'text-indigo-100',
    },
    {
      label: 'المؤسسات والولايات',
      value: formatNumber(stats.institutions),
      helper: `${formatNumber(stats.activeInstitutions)} نشطة • ${formatNumber(stats.wilayas)} ولاية`,
      icon: Building2,
      tone: 'from-rose-500 to-rose-700',
      accent: 'text-rose-100',
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-xl shadow-slate-900/10" dir="rtl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Activity className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">إحصائيات لحظية للمنصة</h2>
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              </span>
              تحديث مباشر • كل ما يقوم به أستاذ يظهر هنا
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`ml-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          تحديث الآن
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${tile.tone} p-4 shadow-lg ring-1 ring-white/10 transition-transform hover:-translate-y-0.5`}
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="relative">
              <div className="mb-2 flex items-center justify-between">
                <tile.icon className={`h-4 w-4 ${tile.accent}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${tile.accent} opacity-80`}>LIVE</span>
              </div>
              <p className={`text-xs font-medium ${tile.accent} opacity-90`}>{tile.label}</p>
              <p className="mt-1 text-2xl font-black text-white truncate">{tile.value}</p>
              <p className={`mt-1 text-[11px] font-semibold ${tile.accent} opacity-80 truncate`}>{tile.helper}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OwnerOverview({
  platformStats,
  recentInstitutions,
  featuredInstitution,
  featuredStats,
  featuredAdmins,
  featuredAttendanceRate,
  formatNumber,
  formatDate,
  statusBadge,
  getTypeIcon,
  getTypeLabel,
  onOpen,
}: {
  platformStats: { total: number; active: number; suspended: number; capacity: number; wilayas: number };
  recentInstitutions: Institution[];
  featuredInstitution: Institution | null;
  featuredStats: InstitutionStats;
  featuredAdmins: InstitutionAdmin[];
  featuredAttendanceRate: number;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  statusBadge: (status: string | null | undefined) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  getTypeLabel: (type: string) => string;
  onOpen: (inst: Institution) => void;
}) {
  return (
    <section className="space-y-5">
      {featuredInstitution ? (
        <HomeInstitutionPreview
          institution={featuredInstitution}
          stats={featuredStats}
          admins={featuredAdmins}
          attendanceRate={featuredAttendanceRate}
          formatNumber={formatNumber}
          formatDate={formatDate}
          statusBadge={statusBadge}
          getTypeIcon={getTypeIcon}
          getTypeLabel={getTypeLabel}
          onOpen={onOpen}
        />
      ) : (
        <Panel title="ملف المؤسسة" subtitle="اختر مؤسسة من القائمة لعرض معاينة تشغيلية" icon={Building2}>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <SummaryTile label="إجمالي المؤسسات" value={formatNumber(platformStats.total)} icon={Building2} tone="text-blue-700 bg-blue-50" />
            <SummaryTile label="المؤسسات النشطة" value={formatNumber(platformStats.active)} icon={ShieldCheck} tone="text-emerald-700 bg-emerald-50" />
            <SummaryTile label="السعة الإجمالية" value={formatNumber(platformStats.capacity)} icon={Users} tone="text-violet-700 bg-violet-50" />
            <SummaryTile label="الولايات المغطاة" value={formatNumber(platformStats.wilayas)} icon={MapPin} tone="text-amber-700 bg-amber-50" />
          </div>
        </Panel>
      )}

      <Panel title="آخر النشاط" subtitle="آخر حركة مسجلة على مستوى المنصة" icon={Clock}>
        <div className="divide-y divide-slate-100">
          {recentInstitutions.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">لا توجد مؤسسات بعد.</div>
          ) : (
            recentInstitutions.map((inst) => (
              <button
                key={inst.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-slate-50"
                onClick={() => onOpen(inst)}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                    {getTypeIcon(inst.type, 'h-4 w-4')}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-950">{inst.name}</span>
                    <span className="block truncate text-xs text-slate-500">{getTypeLabel(inst.type)} • {inst.wilaya || 'غير محدد'}</span>
                  </span>
                </span>
                <ArrowLeft className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))
          )}
        </div>
      </Panel>
    </section>
  );
}

function HomeInstitutionPreview({
  institution,
  stats,
  admins,
  attendanceRate,
  formatNumber,
  formatDate,
  statusBadge,
  getTypeIcon,
  getTypeLabel,
  onOpen,
}: {
  institution: Institution;
  stats: InstitutionStats;
  admins: InstitutionAdmin[];
  attendanceRate: number;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  statusBadge: (status: string | null | undefined) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  getTypeLabel: (type: string) => string;
  onOpen: (inst: Institution) => void;
}) {
  const previewKind = normalizeInstitutionType(institution.type);
  const previewPeopleLabel = previewKind === 'company'
    ? 'الموظفين'
    : previewKind === 'training'
      ? 'المتربصين'
      : 'الطلبة';
  const previewAdminLabel = previewKind === 'company'
    ? 'الإدارة'
    : previewKind === 'training'
      ? 'المدربين'
      : 'الأساتذة';

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
            {getTypeIcon(institution.type, 'h-7 w-7')}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-950">ملف المؤسسة</h2>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge(institution.status)}`}>
                {institution.status === 'active' ? 'نشطة' : 'مجمدة'}
              </span>
            </div>
            <p className="mt-1 truncate text-sm font-bold text-slate-800">{institution.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">{getTypeLabel(institution.type)} • {institution.code || 'بدون رمز'}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-lg border-blue-200 text-blue-700" onClick={() => onOpen(institution)}>
          فتح ملف المؤسسة
          <ArrowLeft className="mr-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-3">
        <SummaryTile label={`إجمالي ${previewPeopleLabel}`} value={formatNumber(stats.students || institution.max_students)} icon={Users} tone="text-blue-700 bg-blue-50" />
        <SummaryTile label={`عدد ${previewAdminLabel}`} value={formatNumber(stats.admins || admins.length)} icon={UserPlus} tone="text-violet-700 bg-violet-50" />
        <SummaryTile label="عدد الحصص" value={formatNumber(stats.sessions)} icon={Clock} tone="text-orange-700 bg-orange-50" />
        <SummaryTile label="نسبة الحضور" value={`${attendanceRate}%`} icon={Activity} tone="text-emerald-700 bg-emerald-50" />
        <SummaryTile label="آخر نشاط" value={formatDate(institution.created_at)} icon={TrendingUp} tone="text-green-700 bg-green-50" />
        <SummaryTile label="الخطة" value={stats.planType || 'Enterprise'} icon={CreditCard} tone="text-blue-700 bg-blue-50" />
      </div>

      <div className="grid gap-3 border-t border-slate-100 p-4 md:grid-cols-4">
        <PreviewAction label="الهيكل" value={`${formatNumber(stats.faculties)} / ${formatNumber(stats.departments)} / ${formatNumber(stats.specialties)}`} icon={Layers} />
        <PreviewAction label="المستخدمون" value={formatNumber(stats.admins || admins.length)} icon={Users} />
        <PreviewAction label="الأجهزة" value={formatNumber(stats.devices)} icon={Smartphone} />
        <PreviewAction label="التقارير" value="PDF / Excel" icon={FileText} />
      </div>
    </section>
  );
}

function PreviewAction({ label, value, icon: Icon, onClick }: { label: string; value: string; icon: LucideIcon; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-200 bg-white p-3 text-right transition hover:border-blue-200 hover:bg-blue-50/40"
      onClick={onClick || (() => toast.info(`${label}: ${value}`))}
    >
      <Icon className="mb-2 h-4 w-4 text-blue-600" />
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </button>
  );
}

function InstitutionProfilePage({
  institution,
  stats,
  admins,
  workspaceTab,
  tabs,
  attendanceRate,
  setWorkspaceTab,
  formatNumber,
  formatDate,
  getTypeLabel,
  getTypeIcon,
  statusBadge,
  onBack,
  onToggle,
  onDelete,
  uploadingImage,
  onImageChange,
}: {
  institution: Institution;
  stats: InstitutionStats;
  admins: InstitutionAdmin[];
  workspaceTab: WorkspaceTab;
  tabs: WorkspaceTabConfig[];
  attendanceRate: number;
  setWorkspaceTab: (tab: WorkspaceTab) => void;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  statusBadge: (status: string | null | undefined) => string;
  onBack: () => void;
  onToggle: () => void;
  onDelete: () => void;
  uploadingImage: boolean;
  onImageChange: (file: File) => void;
}) {
  const institutionKind = normalizeInstitutionType(institution.type);
  const primaryAdmin = admins[0];
  const adminTotal = stats.admins || admins.length;
  const totalUsers = stats.students + adminTotal + stats.devices;
  const latestSessionDate = stats.recentCohorts.find((cohort) => cohort.lastSessionDate)?.lastSessionDate;
  const chartBars = stats.weeklyAttendance.length > 0 ? stats.weeklyAttendance : Array.from({ length: 12 }, () => 0);
  const peopleLabel = institutionKind === 'company'
    ? 'الموظفون'
    : institutionKind === 'training'
      ? 'المتربصون'
      : 'الطلبة';
  const peopleLimitLabel = institutionKind === 'company'
    ? 'حد الموظفين'
    : institutionKind === 'training'
      ? 'حد المتربصين'
      : 'حد الطلبة';
  const peopleReportLabel = institutionKind === 'company'
    ? 'تقرير الموظفين'
    : institutionKind === 'training'
      ? 'تقرير المتربصين'
      : 'تقرير الطلبة';
  const adminGroupLabel = institutionKind === 'company'
    ? 'الإدارة'
    : institutionKind === 'training'
      ? 'المدربون والإدارة'
      : 'الأساتذة والإدارة';
  const adminRoleLabel = institutionKind === 'company'
    ? 'مدير / إدارة'
    : institutionKind === 'training'
      ? 'مدير / مدرب'
      : 'مدير / أستاذ';
  const adminCountLabel = institutionKind === 'company'
    ? 'إجمالي الإدارة'
    : institutionKind === 'training'
      ? 'إجمالي المدربين'
      : 'إجمالي الأساتذة';
  const structureActionLabel = institutionKind === 'company'
    ? 'إنشاء فريق جديد'
    : institutionKind === 'training'
      ? 'إنشاء شعبة جديدة'
      : 'إنشاء قسم جديد';
  const structureTitle = institutionKind === 'company'
    ? 'الهيكل التنظيمي'
    : institutionKind === 'training'
      ? 'هيكل التكوين'
      : institutionKind === 'school'
        ? 'الهيكل التربوي'
        : 'الهيكل الأكاديمي';
  const structureRows = institutionKind === 'company'
    ? [
        { label: 'الفروع', value: stats.faculties, icon: Building2 },
        { label: 'الفرق', value: stats.departments, icon: Layers },
        { label: 'المسارات', value: stats.specialties, icon: Briefcase },
        { label: 'المجموعات', value: stats.cohorts, icon: Users },
      ]
    : institutionKind === 'training'
      ? [
          { label: 'المعاهد', value: stats.faculties, icon: Building2 },
          { label: 'الشعب', value: stats.departments, icon: Layers },
          { label: 'التخصصات', value: stats.specialties, icon: GraduationCap },
          { label: 'الأفواج', value: stats.cohorts, icon: Users },
        ]
      : institutionKind === 'school'
        ? [
            { label: 'المستويات', value: stats.faculties, icon: Building2 },
            { label: 'الأقسام', value: stats.departments, icon: Layers },
            { label: 'المواد', value: stats.specialties, icon: GraduationCap },
            { label: 'الأفواج', value: stats.cohorts, icon: Users },
          ]
      : [
          { label: 'الكليات', value: stats.faculties, icon: Building2 },
          { label: 'الأقسام', value: stats.departments, icon: Layers },
          { label: 'التخصصات', value: stats.specialties, icon: GraduationCap },
          { label: 'الأفواج', value: stats.cohorts, icon: Users },
        ];
  const resolvedTabs = tabs.map((tab) => {
    if (tab.id === 'structure') return { ...tab, label: structureTitle };
    if (tab.id === 'people') {
      return {
        ...tab,
        label: institutionKind === 'company' ? 'الموظفون والإدارة' : adminGroupLabel,
      };
    }
    return tab;
  });
  const distributionRows = [
    { label: peopleLabel, value: stats.students, color: 'bg-blue-500' },
    { label: adminGroupLabel, value: adminTotal, color: 'bg-violet-500' },
    { label: 'الأجهزة', value: stats.devices, color: 'bg-orange-500' },
  ];
  const quickActions = [
    { label: 'إضافة مستخدم', helper: 'فتح إدارة المستخدمين', icon: UserPlus, tone: 'text-emerald-700 bg-emerald-50', onClick: () => setWorkspaceTab('people') },
    { label: 'إضافة جهاز', helper: 'عرض الأجهزة والأمان', icon: Smartphone, tone: 'text-blue-700 bg-blue-50', onClick: () => setWorkspaceTab('security') },
    { label: structureActionLabel, helper: 'فتح الهيكل', icon: Layers, tone: 'text-violet-700 bg-violet-50', onClick: () => setWorkspaceTab('structure') },
    { label: 'إرسال تقرير', helper: 'فتح التقارير', icon: FileText, tone: 'text-orange-700 bg-orange-50', onClick: () => setWorkspaceTab('reports') },
    { label: 'إرسال إشعار', helper: 'تنبيه الإدارة', icon: Mail, tone: 'text-sky-700 bg-sky-50', onClick: () => toast.info('تم فتح مسار الإشعارات لهذه المؤسسة') },
  ];
  const metadataTiles = [
    { label: 'الباقة الحالية', value: stats.planType || 'Enterprise', icon: CreditCard },
    { label: 'تاريخ الانضمام', value: formatDate(institution.created_at), icon: Clock },
    { label: 'نهاية الاشتراك', value: formatDate(stats.currentPeriodEnd), icon: ShieldCheck },
    { label: 'الحالة', value: institution.status === 'active' ? 'نشطة' : 'مجمدة', icon: Activity },
  ];

  const renderTabContent = () => {
    if (workspaceTab === 'structure') {
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {structureRows.map((row) => (
            <InfoBlock key={row.label} label={row.label} value={formatNumber(row.value)} icon={row.icon} />
          ))}
        </div>
      );
    }

    if (workspaceTab === 'people') return <AdminsTable admins={admins} roleLabel={adminRoleLabel} />;

    if (workspaceTab === 'attendance') {
      return (
        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
          <AttendanceRing attendanceRate={attendanceRate} />
          <div className="grid gap-3 md:grid-cols-3">
            <InfoBlock label="الجلسات" value={formatNumber(stats.sessions)} icon={Activity} />
            <InfoBlock label="تسجيلات الحضور" value={formatNumber(stats.attendance)} icon={Check} />
            <InfoBlock label={peopleLabel} value={formatNumber(stats.students)} icon={Users} />
          </div>
        </div>
      );
    }

    if (workspaceTab === 'security') {
      return (
        <div className="grid gap-3 md:grid-cols-3">
          <InfoBlock label="الأجهزة الموثقة" value={formatNumber(stats.devices)} icon={Smartphone} />
          <InfoBlock label="حسابات الإدارة" value={formatNumber(adminTotal)} icon={LockKeyhole} />
          <InfoBlock label="حالة المؤسسة" value={institution.status === 'active' ? 'نشطة' : 'مجمدة'} icon={ShieldCheck} />
        </div>
      );
    }

    if (workspaceTab === 'billing') {
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoBlock label="الخطة" value={stats.planType || 'غير محددة'} icon={CreditCard} />
          <InfoBlock label="حالة الاشتراك" value={stats.subscriptionStatus || 'غير محددة'} icon={ShieldCheck} />
          <InfoBlock label={peopleLimitLabel} value={formatNumber(stats.studentLimit)} icon={Users} />
          <InfoBlock label="حد الجلسات" value={formatNumber(stats.sessionLimit)} icon={Activity} />
        </div>
      );
    }

    if (workspaceTab === 'reports') {
      return (
        <QuickReports
          stats={stats}
          institutionName={institution.name}
          institutionType={getTypeLabel(institution.type)}
          attendanceRate={attendanceRate}
          peopleReportLabel={peopleReportLabel}
          formatNumber={formatNumber}
          formatDate={formatDate}
        />
      );
    }

    return null;
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
        <button type="button" className="hover:text-slate-950" onClick={onBack}>الرئيسية</button>
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{getTypeLabel(institution.type)}</span>
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="text-slate-800">{institution.name}</span>
      </div>

      <section className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]" dir="ltr">
        <div className="relative h-44 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm xl:h-full" dir="rtl">
          {institution.image_url ? (
            <img src={institution.image_url} alt={institution.name} className="h-full min-h-44 w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-44 w-full flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 text-slate-400">
              <ImageIcon className="mb-2 h-10 w-10" />
              <span className="text-sm font-bold">صورة المؤسسة</span>
            </div>
          )}
          <label className="absolute left-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700">
            {uploadingImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingImage}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImageChange(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        <div className="space-y-4" dir="rtl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 shadow-sm">
                {getTypeIcon(institution.type, 'h-8 w-8')}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-black tracking-tight text-slate-950">ملف المؤسسة</h1>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge(institution.status)}`}>
                    {institution.status === 'active' ? 'نشطة' : 'مجمدة'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="font-black text-slate-950">{institution.name}</span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                    {institution.code || 'بدون رمز'}
                  </span>
                  <span>{institution.wilaya || institution.city || 'غير محدد'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={onBack}>
                <ArrowLeft className="ml-2 h-4 w-4" />
                رجوع
              </Button>
              <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={onToggle}>
                {institution.status === 'active' ? <PauseCircle className="ml-2 h-4 w-4" /> : <PlayCircle className="ml-2 h-4 w-4" />}
                {institution.status === 'active' ? 'تجميد' : 'تفعيل'}
              </Button>
              <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => setWorkspaceTab('reports')}>
                <Download className="ml-2 h-4 w-4" />
                التقارير
              </Button>
              <Button variant="outline" className="h-10 rounded-lg border-rose-200 bg-white text-rose-600 hover:bg-rose-50" onClick={onDelete}>
                <Trash2 className="ml-2 h-4 w-4" />
                حذف
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metadataTiles.map((tile) => {
              const TileIcon = tile.icon;
              return (
                <div key={tile.label} className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm">
                  <TileIcon className="mx-auto mb-2 h-4 w-4 text-blue-600" />
                  <p className="text-xs text-slate-500">{tile.label}</p>
                  <p className="mt-1 truncate text-sm font-black text-slate-950">{tile.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4">
          <div className="flex flex-wrap gap-1">
            {resolvedTabs.map((tab) => {
              const Icon = tab.icon;
              const active = workspaceTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-bold transition ${
                    active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-950'
                  }`}
                  onClick={() => setWorkspaceTab(tab.id)}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4">
          {workspaceTab === 'overview' ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <MiniMetric label={`إجمالي ${peopleLabel}`} value={formatNumber(stats.students)} icon={Users} tone="bg-blue-50 text-blue-700" />
                <MiniMetric label={adminCountLabel} value={formatNumber(adminTotal)} icon={UserPlus} tone="bg-emerald-50 text-emerald-700" />
                <MiniMetric label={structureRows[0]?.label || structureTitle} value={formatNumber(structureRows[0]?.value || 0)} icon={Building2} tone="bg-orange-50 text-orange-700" />
                <MiniMetric label={structureRows[1]?.label || 'الأقسام'} value={formatNumber(structureRows[1]?.value || 0)} icon={Layers} tone="bg-violet-50 text-violet-700" />
                <MiniMetric
                  label="نسبة الحضور"
                  value={attendanceRate == null || isNaN(Number(attendanceRate)) ? 'لا توجد بيانات بعد' : `${attendanceRate}%`}
                  icon={Activity}
                  tone="bg-emerald-50 text-emerald-700"
                />
                <MiniMetric label="الأجهزة المرتبطة" value={formatNumber(stats.devices)} icon={Smartphone} tone="bg-blue-50 text-blue-700" />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px_340px]">
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-black text-slate-950">نظرة عامة على الحضور</h2>
                    <span className="text-xs font-bold text-blue-700">
                      {attendanceRate == null || isNaN(Number(attendanceRate)) ? 'لا توجد بيانات بعد' : `${attendanceRate}%`}
                    </span>
                  </div>
                  <div className="flex h-40 items-end gap-2 border-b border-slate-100">
                    {chartBars.map((value, index) => (
                      <div key={index} className="flex flex-1 flex-col items-center">
                        <div
                          className={`w-full rounded-t ${value > 0 ? 'bg-blue-500/85' : 'bg-slate-200'}`}
                          style={{ height: `${Math.max(value, 4)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <InfoBlock
                      label="أعلى حضور"
                      value={attendanceRate == null || isNaN(Number(attendanceRate)) ? 'لا توجد بيانات بعد' : `${attendanceRate}%`}
                      icon={TrendingUp}
                    />
                    <InfoBlock
                      label="متوسط الحضور"
                      value={attendanceRate == null || isNaN(Number(attendanceRate)) ? 'لا توجد بيانات بعد' : `${attendanceRate}%`}
                      icon={Activity}
                    />
                    <InfoBlock label="آخر حصة" value={latestSessionDate ? formatDate(latestSessionDate) : 'غير محدد'} icon={Clock} />
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-4 font-black text-slate-950">توزيع المستخدمين</h2>
                  <AttendanceRing attendanceRate={totalUsers > 0 ? Math.min(100, Math.round((stats.students / totalUsers) * 100)) : 0} />
                  <p className="mt-3 text-center text-2xl font-black text-slate-950">{formatNumber(totalUsers)}</p>
                  <p className="text-center text-xs text-slate-500">إجمالي المستخدمين والأجهزة</p>
                  <div className="mt-4 space-y-2 text-sm">
                    {distributionRows.map((row) => {
                      const percent = totalUsers > 0 ? Math.round((row.value / totalUsers) * 100) : 0;
                      return (
                        <HealthRow key={row.label} label={row.label} value={`${formatNumber(row.value)} (${percent}%)`} color={row.color} />
                      );
                    })}
                  </div>
                  <Button variant="outline" className="mt-4 h-9 w-full rounded-lg border-slate-200 text-blue-700" onClick={() => setWorkspaceTab('people')}>
                    عرض جميع المستخدمين
                  </Button>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h2 className="font-black text-slate-950">النشاطات الأخيرة</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {stats.recentActivities.length > 0 ? (
                      stats.recentActivities.map((activity, index) => (
                        <ActivityLine key={index} time={activity.time} text={activity.text} color={activity.color} />
                      ))
                    ) : (
                      <>
                        <ActivityLine time="اليوم" text={`عدد الحضور الحالي ${formatNumber(stats.attendance)}`} color="bg-blue-500" />
                        <ActivityLine time="اليوم" text={`الأجهزة الموثقة ${formatNumber(stats.devices)}`} color="bg-violet-500" />
                        <ActivityLine time="اليوم" text={`الجلسات المسجلة ${formatNumber(stats.sessions)}`} color="bg-orange-500" />
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50"
                    onClick={() => setWorkspaceTab('reports')}
                  >
                    عرض جميع النشاطات
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </section>
              </div>

              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-black text-slate-950">{structureTitle}</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {structureRows.map((row) => {
                    const Icon = row.icon;
                    return (
                      <button
                        key={row.label}
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
                        onClick={() => setWorkspaceTab('structure')}
                      >
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                          <Icon className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-2xl font-black text-slate-950">{formatNumber(row.value)}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{row.label}</p>
                        <span className="mt-3 flex items-center justify-center gap-1 text-sm font-bold text-blue-700">
                          عرض التفاصيل
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-4 font-black text-slate-950">إجراءات سريعة</h2>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {quickActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.label}
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white p-4 text-center transition hover:border-blue-200 hover:bg-blue-50/40"
                          onClick={action.onClick}
                        >
                          <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${action.tone}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="font-black text-slate-950">{action.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{action.helper}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-4 font-black text-slate-950">معلومات إضافية</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoBlock label="البريد الرسمي" value={primaryAdmin?.email || 'غير محدد'} icon={Mail} />
                    <InfoBlock label="الهاتف" value="غير محدد" icon={Phone} />
                    <InfoBlock label="العنوان" value={[institution.city, institution.wilaya].filter(Boolean).join(' - ') || 'غير محدد'} icon={MapPin} />
                    <InfoBlock label="مدير المؤسسة" value={primaryAdmin?.full_name || primaryAdmin?.username || 'غير محدد'} icon={UserPlus} />
                  </div>
                </div>
              </section>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </section>
    </section>
  );
}

function InstitutionDetailPage({
  institution,
  stats,
  admins,
  workspaceTab,
  tabs,
  attendanceRate,
  setWorkspaceTab,
  formatNumber,
  formatDate,
  getTypeLabel,
  getTypeIcon,
  statusBadge,
  onBack,
  onToggle,
  onDelete,
}: {
  institution: Institution;
  stats: InstitutionStats;
  admins: InstitutionAdmin[];
  workspaceTab: WorkspaceTab;
  tabs: WorkspaceTabConfig[];
  attendanceRate: number;
  setWorkspaceTab: (tab: WorkspaceTab) => void;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string, className?: string) => React.ReactNode;
  statusBadge: (status: string | null | undefined) => string;
  onBack: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const institutionKind = normalizeInstitutionType(institution.type);
  const structureTitle = institutionKind === 'company'
    ? 'الهيكل التنظيمي'
    : institutionKind === 'training'
      ? 'هيكل التكوين'
      : institutionKind === 'school'
        ? 'الهيكل التربوي'
        : 'الهيكل الأكاديمي';
  const structureRows = institutionKind === 'company'
    ? [
        { label: 'الفروع', value: stats.faculties, icon: Building2 },
        { label: 'الفرق', value: stats.departments, icon: Layers },
        { label: 'المسارات', value: stats.specialties, icon: Briefcase },
        { label: 'المجموعات', value: stats.cohorts, icon: Users },
      ]
    : institutionKind === 'training'
      ? [
          { label: 'المعاهد', value: stats.faculties, icon: Building2 },
          { label: 'الشعب', value: stats.departments, icon: Layers },
          { label: 'التخصصات', value: stats.specialties, icon: GraduationCap },
          { label: 'الأفواج', value: stats.cohorts, icon: Users },
        ]
      : institutionKind === 'school'
        ? [
            { label: 'المستويات', value: stats.faculties, icon: Building2 },
            { label: 'الأقسام', value: stats.departments, icon: Layers },
            { label: 'المواد', value: stats.specialties, icon: GraduationCap },
            { label: 'الأفواج', value: stats.cohorts, icon: Users },
          ]
        : [
            { label: 'الكليات', value: stats.faculties, icon: Building2 },
            { label: 'الأقسام', value: stats.departments, icon: Layers },
            { label: 'التخصصات', value: stats.specialties, icon: GraduationCap },
            { label: 'الأفواج', value: stats.cohorts, icon: Users },
          ];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <button type="button" className="hover:text-slate-950" onClick={onBack}>الرئيسية</button>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{getTypeLabel(institution.type)}</span>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-slate-800">{institution.name}</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 shadow-sm">
              {getTypeIcon(institution.type, 'h-8 w-8')}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-950">ملف المؤسسة</h1>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge(institution.status)}`}>
                  {institution.status === 'active' ? 'نشطة' : 'مجمدة'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="font-black text-slate-950">{institution.name}</span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                  {institution.code || 'بدون رمز'}
                </span>
                <span>{institution.wilaya || 'غير محدد'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={onBack}>
            <ArrowLeft className="ml-2 h-4 w-4" />
            رجوع
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white" onClick={onToggle}>
            {institution.status === 'active' ? <PauseCircle className="ml-2 h-4 w-4" /> : <PlayCircle className="ml-2 h-4 w-4" />}
            {institution.status === 'active' ? 'تجميد' : 'تفعيل'}
          </Button>
          <Button className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            <Download className="ml-2 h-4 w-4" />
            تقرير
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-rose-200 bg-white text-rose-600 hover:bg-rose-50" onClick={onDelete}>
            <Trash2 className="ml-2 h-4 w-4" />
            حذف
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MiniMetric label="إجمالي الطلبة" value={formatNumber(stats.students)} icon={Users} tone="bg-blue-50 text-blue-700" />
        <MiniMetric label="إجمالي الأساتذة" value={formatNumber(stats.admins)} icon={Users} tone="bg-violet-50 text-violet-700" />
        <MiniMetric label="عدد الحصص" value={formatNumber(stats.sessions)} icon={Clock} tone="bg-orange-50 text-orange-700" />
        <MiniMetric label="نسبة الحضور" value={`${attendanceRate}%`} icon={Activity} tone="bg-emerald-50 text-emerald-700" />
        <MiniMetric label="آخر نشاط" value={formatDate(institution.created_at)} icon={Clock} tone="bg-green-50 text-green-700" />
        <MiniMetric label="حالة الاشتراك" value={stats.planType || 'Enterprise'} icon={ShieldCheck} tone="bg-blue-50 text-blue-700" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_360px]" dir="ltr">
        <div className="space-y-5" dir="rtl">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4">
              <div className="flex flex-wrap gap-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = workspaceTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-bold transition ${
                        active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-950'
                      }`}
                      onClick={() => setWorkspaceTab(tab.id)}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4">
              {workspaceTab === 'overview' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="mb-3 text-lg font-black text-slate-950">{structureTitle}</h2>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {structureRows.map((row) => {
                        const Icon = row.icon;
                        return (
                          <div key={row.label} className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                              <Icon className="h-6 w-6 text-blue-600" />
                            </div>
                            <p className="text-3xl font-black text-slate-950">{formatNumber(row.value)}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">{row.label}</p>
                            <button type="button" className="mt-3 flex w-full items-center justify-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-900">
                              <ArrowLeft className="h-3.5 w-3.5" />
                              عرض التفاصيل
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-black text-slate-950">الأفواج والجلسات الأخيرة</h2>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <div className="grid min-w-[780px] grid-cols-[minmax(140px,1fr)_80px_140px_100px_120px_100px_100px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                        <span>الفوج</span>
                        <span>المستوى</span>
                        <span>القسم</span>
                        <span>عدد الطلبة</span>
                        <span>آخر حصة</span>
                        <span>نسبة الحضور</span>
                        <span>الإجراء</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {stats.recentCohorts.length > 0 ? (
                          stats.recentCohorts.map((cohort) => (
                            <div key={cohort.id} className="grid min-w-[780px] grid-cols-[minmax(140px,1fr)_80px_140px_100px_120px_100px_100px] gap-3 px-4 py-3 text-sm">
                              <span className="font-bold text-slate-950">{cohort.name}</span>
                              <span className="text-slate-600">{cohort.level}</span>
                              <span className="text-slate-600">{cohort.departmentName || '—'}</span>
                              <span className="font-black text-slate-900">{formatNumber(cohort.studentCount)}</span>
                              <span className="text-slate-500">{cohort.lastSessionDate ? formatDate(cohort.lastSessionDate) : '—'}</span>
                              <span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cohort.attendanceRate >= 80 ? 'bg-emerald-50 text-emerald-700' : cohort.attendanceRate >= 50 ? 'bg-orange-50 text-orange-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {cohort.attendanceRate}%
                                </span>
                              </span>
                              <div className="flex items-center gap-1">
                                <button type="button" className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50">فتح</button>
                                <button type="button" className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">عرض</button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="min-w-[780px] p-5 text-center text-sm text-slate-500">لا توجد أفواج مسجلة حالياً في هذه المؤسسة</div>
                        )}
                      </div>
                    </div>
                    {stats.recentCohorts.length > 0 && (
                      <button type="button" className="mt-3 flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-900">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        عرض جميع الأفواج
                      </button>
                    )}
                  </div>
                </div>
              )}

              {workspaceTab === 'structure' && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {structureRows.map((row) => (
                    <InfoBlock key={row.label} label={row.label} value={formatNumber(row.value)} icon={row.icon} />
                  ))}
                </div>
              )}

              {workspaceTab === 'people' && (
                <AdminsTable admins={admins} />
              )}

              {workspaceTab === 'attendance' && (
                <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
                  <AttendanceRing attendanceRate={attendanceRate} />
                  <div className="grid gap-3 md:grid-cols-3">
                    <InfoBlock label="الجلسات" value={formatNumber(stats.sessions)} icon={Activity} />
                    <InfoBlock label="تسجيلات الحضور" value={formatNumber(stats.attendance)} icon={Check} />
                    <InfoBlock label="الطلاب" value={formatNumber(stats.students)} icon={Users} />
                  </div>
                </div>
              )}

              {workspaceTab === 'security' && (
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoBlock label="الأجهزة الموثقة" value={formatNumber(stats.devices)} icon={Smartphone} />
                  <InfoBlock label="حسابات الإدارة" value={formatNumber(stats.admins)} icon={LockKeyhole} />
                  <InfoBlock label="حالة المؤسسة" value={institution.status === 'active' ? 'نشطة' : 'مجمدة'} icon={ShieldCheck} />
                </div>
              )}

              {workspaceTab === 'billing' && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InfoBlock label="الخطة" value={stats.planType || 'غير محددة'} icon={CreditCard} />
                  <InfoBlock label="حالة الاشتراك" value={stats.subscriptionStatus || 'غير محددة'} icon={ShieldCheck} />
                  <InfoBlock label="حد الطلاب" value={formatNumber(stats.studentLimit)} icon={Users} />
                  <InfoBlock label="حد الجلسات" value={formatNumber(stats.sessionLimit)} icon={Activity} />
                </div>
              )}

              {workspaceTab === 'reports' && (
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoBlock label="تقرير الطلبة" value={formatNumber(stats.students)} icon={Users} />
                  <InfoBlock label="تقرير الحضور" value={formatNumber(stats.attendance)} icon={FileText} />
                  <InfoBlock label="نهاية الفترة" value={formatDate(stats.currentPeriodEnd)} icon={CreditCard} />
                </div>
              )}
            </div>
          </section>

          <QuickReports
            stats={stats}
            institutionName={institution.name}
            institutionType={getTypeLabel(institution.type)}
            attendanceRate={attendanceRate}
            formatNumber={formatNumber}
            formatDate={formatDate}
          />
        </div>

        <aside className="space-y-5" dir="rtl">
          <Panel title="الأجهزة والأمان" subtitle="حماية الحضور وربط الأجهزة" icon={ShieldCheck}>
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 p-4 text-center">
              <SideStat label="الأجهزة" value={formatNumber(stats.devices)} icon={Smartphone} tone="text-blue-600" />
              <SideStat label="مرفوضة" value="0" icon={LockKeyhole} tone="text-rose-600" />
              <SideStat label="مشبوهة" value="0" icon={ShieldCheck} tone="text-orange-600" />
            </div>
            <div className="px-4 pb-4">
              <Button variant="outline" className="h-9 w-full rounded-lg border-slate-200 text-blue-700">
                <Smartphone className="ml-2 h-4 w-4" />
                عرض الأجهزة
              </Button>
            </div>
          </Panel>

          <Panel title="توزيع الحضور" subtitle="ملخص المؤسسة" icon={Activity}>
            <div className="flex items-center gap-5 p-4">
              <AttendanceRing attendanceRate={attendanceRate} compact />
              <div className="flex-1 space-y-2 text-sm">
                <HealthRow label="حاضر" value={`${attendanceRate}%`} color="bg-blue-500" />
                <HealthRow label="غائب" value={`${Math.max(0, 100 - attendanceRate)}%`} color="bg-orange-500" />
                <HealthRow label="متأخر" value="0%" color="bg-yellow-500" />
              </div>
            </div>
          </Panel>

          <Panel title="آخر النشاطات" subtitle="قراءة تشغيلية سريعة" icon={Clock}>
            <div className="divide-y divide-slate-100">
              {stats.recentActivities.length > 0 ? (
                stats.recentActivities.map((act, idx) => (
                  <ActivityLine key={idx} time={act.time} text={act.text} color={act.color} />
                ))
              ) : (
                <>
                  <ActivityLine time="اليوم" text={`عدد الحضور الحالي ${formatNumber(stats.attendance)}`} color="bg-blue-500" />
                  <ActivityLine time="اليوم" text={`الأجهزة الموثقة ${formatNumber(stats.devices)}`} color="bg-violet-500" />
                  <ActivityLine time="اليوم" text={`الجلسات المسجلة ${formatNumber(stats.sessions)}`} color="bg-orange-500" />
                </>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function AdminsTable({ admins, roleLabel = 'مدير / أستاذ' }: { admins: InstitutionAdmin[]; roleLabel?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <div className="grid min-w-[560px] grid-cols-[minmax(180px,1fr)_180px_120px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
        <span>الحساب</span>
        <span>البريد</span>
        <span>الدور</span>
      </div>
      <div className="divide-y divide-slate-100">
        {admins.length === 0 ? (
          <div className="min-w-[560px] p-5 text-sm text-slate-500">لا توجد حسابات مرتبطة حاليا.</div>
        ) : (
          admins.map((item) => (
            <div key={item.id} className="grid min-w-[560px] grid-cols-[minmax(180px,1fr)_180px_120px] gap-3 px-4 py-3 text-sm">
              <span className="font-bold text-slate-950">{item.full_name || item.username}</span>
              <span className="truncate text-slate-500">{item.email || item.username}</span>
              <span className="text-slate-600">{item.role === 'super_admin' ? 'مالك' : roleLabel}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function QuickReports({
  stats,
  institutionName,
  institutionType,
  attendanceRate,
  peopleReportLabel = 'تقرير الطلبة',
  formatNumber,
  formatDate,
}: {
  stats: InstitutionStats;
  institutionName: string;
  institutionType: string;
  attendanceRate: number;
  peopleReportLabel?: string;
  formatNumber: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
}) {
  const [exporting, setExporting] = useState(false);
  const generatedAt = nowGeneratedAt();

  const runExport = async (kind: string) => {
    if (exporting) return;
    try {
      setExporting(true);
      const safeName = institutionName || 'المؤسسة';
      switch (kind) {
        case 'pdf':
          await exportInstitutionReportPDF({
            generatedAt,
            institutionName: safeName,
            institutionType,
            planType: stats.planType || '',
            subscriptionStatus: stats.subscriptionStatus || '',
            studentLimit: formatNumber(stats.studentLimit),
            sessionLimit: formatNumber(stats.sessionLimit),
            periodEnd: formatDate(stats.currentPeriodEnd),
            attendanceRate: String(attendanceRate),
            students: stats.students,
            cohorts: stats.cohorts,
            sessions: stats.sessions,
            attendances: stats.attendance,
            admins: stats.admins,
            devices: stats.devices,
            recentCohorts: stats.recentCohorts.map((cohort) => ({
              name: cohort.name,
              level: cohort.level,
              students: cohort.studentCount,
              rate: String(cohort.attendanceRate),
              lastSession: formatDate(cohort.lastSessionDate),
            })),
            recentActivities: stats.recentActivities.map((activity) => ({ time: activity.time, text: activity.text })),
          });
          toast.success('تم تنزيل ملف المؤسسة بصيغة PDF');
          break;
        case 'excel':
          await exportInstitutionReportExcel({
            generatedAt,
            institutionName: safeName,
            institutionType,
            planType: stats.planType || '',
            subscriptionStatus: stats.subscriptionStatus || '',
            studentLimit: formatNumber(stats.studentLimit),
            sessionLimit: formatNumber(stats.sessionLimit),
            periodEnd: formatDate(stats.currentPeriodEnd),
            attendanceRate: String(attendanceRate),
            students: stats.students,
            cohorts: stats.cohorts,
            sessions: stats.sessions,
            attendances: stats.attendance,
            admins: stats.admins,
            devices: stats.devices,
            recentCohorts: stats.recentCohorts.map((cohort) => ({
              name: cohort.name,
              level: cohort.level,
              students: cohort.studentCount,
              rate: String(cohort.attendanceRate),
              lastSession: formatDate(cohort.lastSessionDate),
            })),
            recentActivities: stats.recentActivities.map((activity) => ({ time: activity.time, text: activity.text })),
          });
          toast.success('تم تنزيل ملف المؤسسة بصيغة Excel');
          break;
        case 'people':
          await exportPeopleReportPDF(safeName, peopleReportLabel, stats.students, generatedAt);
          toast.success('تم تنزيل تقرير الطلبة بصيغة PDF');
          break;
        case 'devices':
          await exportDevicesFileReportPDF(safeName, stats.devices, 1, generatedAt);
          toast.success('تم تنزيل تقرير الأجهزة بصيغة PDF');
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Institution report export failed', err);
      toast.error('تعذر توليد التقرير. يرجى المحاولة مرة أخرى.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <ReportAction label="تصدير PDF" helper="تصدير التقرير إلى ملف PDF" icon={FileText} tone="text-rose-600 bg-rose-50" onClick={() => void runExport('pdf')} />
      <ReportAction label="تصدير Excel" helper="تصدير البيانات إلى ملف Excel" icon={Download} tone="text-emerald-600 bg-emerald-50" onClick={() => void runExport('excel')} />
      <ReportAction label={peopleReportLabel} helper={`${formatNumber(stats.students)} سجل`} icon={Users} tone="text-blue-600 bg-blue-50" onClick={() => void runExport('people')} />
      <ReportAction label="تقرير الأجهزة" helper={`${formatNumber(stats.devices)} جهاز موثق`} icon={Smartphone} tone="text-violet-600 bg-violet-50" onClick={() => void runExport('devices')} />
    </section>
  );
}

function ReportAction({
  label,
  helper,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30"
      onClick={onClick || (() => toast.info(`${label}: التقرير جاهز للربط مع مولد الملفات`))}
    >
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-black text-slate-950">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </button>
  );
}

function AttendanceRing({ attendanceRate, compact = false }: { attendanceRate: number; compact?: boolean }) {
  return (
    <div className={`mx-auto flex shrink-0 items-center justify-center rounded-full border-blue-600 bg-white ${compact ? 'h-24 w-24 border-[10px]' : 'h-32 w-32 border-[14px]'}`}>
      <div className="text-center">
        <p className={`${compact ? 'text-xl' : 'text-2xl'} font-black text-slate-950`}>{attendanceRate}%</p>
        <p className="text-[11px] text-slate-500">الحضور</p>
      </div>
    </div>
  );
}

function SideStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="space-y-2">
      <Icon className={`mx-auto h-5 w-5 ${tone}`} />
      <p className="text-xl font-black text-slate-950">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function ActivityLine({ time, text, color }: { time: string; text: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
        <span className="truncate text-slate-700">{text}</span>
      </span>
      <span className="shrink-0 text-xs text-slate-400">{time}</span>
    </div>
  );
}

function AttendanceAnalyticsCard({
  platformStats,
  activeSectorLabel,
}: {
  platformStats: { total: number; active: number; suspended: number; capacity: number; wilayas: number };
  activeSectorLabel: string;
}) {
  const bars = [42, 58, 74, 63, 82, 71, 88, 69, 76, 84, 66, 79];

  return (
    <Panel title="تحليل النشاط" subtitle={activeSectorLabel} icon={BarChart3}>
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <Select defaultValue="month">
            <SelectTrigger className="h-9 w-32 rounded-lg border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">أسبوعي</SelectItem>
              <SelectItem value="month">شهري</SelectItem>
              <SelectItem value="year">سنوي</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">{formatNumber(platformStats.active)} مؤسسة نشطة</p>
        </div>
        <div className="flex h-36 items-end gap-2 border-b border-slate-100">
          {bars.map((value, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t bg-blue-500/85" style={{ height: `${value}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>نسبة النشاط</span>
          <span>آخر 12 أسبوع</span>
        </div>
      </div>
    </Panel>
  );
}

function PlatformCapacityCard({
  total,
  active,
  suspended,
  wilayas,
}: {
  total: number;
  active: number;
  suspended: number;
  wilayas: number;
}) {
  return (
    <Panel title="صحة المنصة" subtitle="مؤشرات تشغيلية مختصرة" icon={Activity}>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-[12px] border-blue-600 bg-blue-50">
            <div className="text-center">
              <p className="text-xl font-black text-slate-950">{formatNumber(active)}</p>
              <p className="text-[11px] text-slate-500">نشطة</p>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <HealthRow label="السعة الإجمالية" value={formatNumber(total)} color="bg-blue-500" />
            <HealthRow label="المجمدة" value={formatNumber(suspended)} color="bg-rose-500" />
            <HealthRow label="الولايات" value={formatNumber(wilayas)} color="bg-emerald-500" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function HealthRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-slate-600">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function CreateInstitutionModal({
  form,
  setForm,
  showPassword,
  setShowPassword,
  copied,
  submitting,
  onClose,
  onGeneratePassword,
  onCopy,
  onSubmit,
}: {
  form: NewInstitution;
  setForm: (form: NewInstitution) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean | ((current: boolean) => boolean)) => void;
  copied: boolean;
  submitting: boolean;
  onClose: () => void;
  onGeneratePassword: () => void;
  onCopy: (text: string) => void;
  onSubmit: () => void;
}) {
  const isAutoSeeded = form.type === 'primary_school' || form.type === 'secondary_school';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">إضافة مؤسسة جديدة</h3>
            <p className="text-sm text-slate-500">
              {isAutoSeeded
                ? 'تهيئة تلقائية — يتم إنشاء الحسابات والبيانات الافتراضية تلقائياً'
                : 'إنشاء المؤسسة وحساب مديرها الأول'}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-6 p-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="relative h-32 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {form.imagePreview ? (
                  <img src={form.imagePreview} alt="معاينة صورة المؤسسة" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs font-bold">صورة المؤسسة</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <Label>صورة المؤسسة</Label>
                  <p className="mt-1 text-xs text-slate-500">
                    ارفع صورة حقيقية للجامعة أو المؤسسة لتظهر في ملفها داخل لوحة المالك.
                  </p>
                </div>
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-50">
                  <Upload className="h-4 w-4" />
                  اختيار صورة
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setForm({
                        ...form,
                        imageFile: file,
                        imagePreview: file ? URL.createObjectURL(file) : '',
                      });
                    }}
                  />
                </label>
                {form.imageFile && (
                  <p className="text-xs font-semibold text-emerald-700">{form.imageFile.name}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>اسم المؤسسة</Label>
              <Input
                className="rounded-lg border-slate-200"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="مثال: مدرسة الشهيد بلحسن أحمد"
              />
            </div>

            <div className="space-y-2">
              <Label>القطاع</Label>
              <Select
                value={form.type}
                onValueChange={(value: ClientInstitutionType) => setForm({ ...form, type: value })}
              >
                <SelectTrigger className="rounded-lg border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="university">جامعة</SelectItem>
                  <SelectItem value="school">مؤسسة تربوية (متوسطة)</SelectItem>
                  <SelectItem value="secondary_school">ثانوية</SelectItem>
                  <SelectItem value="primary_school">مدرسة ابتدائية</SelectItem>
                  <SelectItem value="training">مركز تكوين</SelectItem>
                  <SelectItem value="company">شركة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الطاقة الاستيعابية</Label>
              <Input
                type="number"
                min={1}
                className="rounded-lg border-slate-200"
                value={form.maxStudents}
                onChange={(event) => setForm({ ...form, maxStudents: Number(event.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label>الولاية</Label>
              <Select
                value={form.wilayaCode ? String(form.wilayaCode) : ''}
                onValueChange={(value) => setForm({ ...form, wilayaCode: Number(value) })}
              >
                <SelectTrigger className="rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر الولاية" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {WILAYAS.map((wilaya) => (
                    <SelectItem key={wilaya.code} value={String(wilaya.code)}>
                      {wilaya.code} - {wilaya.nameAr || wilaya.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>المدينة</Label>
              <Input
                className="rounded-lg border-slate-200"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                placeholder="اختياري"
              />
            </div>
          </div>

          {/* ── Admin section: auto-setup for primary/secondary school, manual for others ── */}
          {isAutoSeeded ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-teal-600" />
                <h4 className="font-black text-teal-900">تهيئة وتجهيز تلقائي للبيانات</h4>
              </div>
              <p className="text-sm text-teal-800 leading-relaxed">
                يقوم النظام تلقائياً بتهيئة القطاع المختار:
              </p>
              <ul className="text-sm text-teal-800 space-y-1 list-none">
                {form.type === 'primary_school' ? (
                  <>
                    <li>✅ إنشاء <strong>5 مستويات دراسية</strong> (السنة الأولى ← الخامسة ابتدائي)</li>
                    <li>✅ إضافة <strong>10 مواد دراسية</strong> افتراضية</li>
                    <li>✅ ضبط <strong>5 فترات حصص</strong> يومية وأيام العمل</li>
                    <li>✅ إنشاء <strong>3 حسابات</strong>: مدير المدرسة، المراقب العام، الأستاذ</li>
                  </>
                ) : (
                  <>
                    <li>✅ إنشاء <strong>3 مستويات دراسية</strong> (السنة الأولى ← الثالثة ثانوي)</li>
                    <li>✅ إضافة <strong>12 مادة دراسية</strong> افتراضية مع المعاملات</li>
                    <li>✅ ضبط <strong>5 فترات حصص</strong> يومية وأيام العمل والجدول الفعال</li>
                    <li>✅ إنشاء <strong>3 حسابات</strong>: مدير الثانوية، المراقب العام، الأستاذ</li>
                  </>
                )}
              </ul>
              <p className="text-xs text-teal-700 bg-teal-100 rounded-lg px-3 py-2 border border-teal-200">
                📋 بعد الإنشاء ستظهر نافذة ببيانات الاعتماد لحفظها وتسليمها للمعنيين.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-slate-600" />
                <h4 className="font-black text-slate-950">حساب مدير المؤسسة</h4>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>اسم المستخدم</Label>
                  <Input
                    className="rounded-lg border-slate-200 bg-white"
                    value={form.adminUsername}
                    onChange={(event) => setForm({ ...form, adminUsername: event.target.value })}
                    placeholder="admin_skikda"
                  />
                </div>

                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    className="rounded-lg border-slate-200 bg-white"
                    value={form.adminEmail}
                    onChange={(event) => setForm({ ...form, adminEmail: event.target.value })}
                    placeholder="admin@example.dz"
                  />
                </div>

                <div className="space-y-2">
                  <Label>الاسم الكامل</Label>
                  <Input
                    className="rounded-lg border-slate-200 bg-white"
                    value={form.adminFullName}
                    onChange={(event) => setForm({ ...form, adminFullName: event.target.value })}
                    placeholder="اختياري"
                  />
                </div>

                <div className="space-y-2">
                  <Label>كلمة المرور</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        className="rounded-lg border-slate-200 bg-white pl-10"
                        value={form.adminPassword}
                        onChange={(event) => setForm({ ...form, adminPassword: event.target.value })}
                        placeholder="8 أحرف على الأقل"
                      />
                      <button
                        type="button"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button type="button" variant="outline" className="rounded-lg border-slate-200" onClick={onGeneratePassword}>
                      توليد
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-lg border-slate-200"
                      disabled={!form.adminPassword}
                      onClick={() => onCopy(form.adminPassword)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-lg border-slate-200" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              className={`rounded-lg text-white font-bold ${isPrimarySchool ? 'bg-teal-600 hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting
                ? (isPrimarySchool ? '⏳ جاري الإعداد التلقائي...' : 'جاري الإنشاء...')
                : (isPrimarySchool ? '🏫 إنشاء المدرسة الابتدائية' : 'إنشاء المؤسسة')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


function DeleteInstitutionDialog({
  institution,
  deleting,
  onCancel,
  onConfirm,
}: {
  institution: Institution;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const institutionKind = normalizeInstitutionType(institution.type);
  const affectedPeopleLabel = institutionKind === 'company'
    ? 'الموظفين'
    : institutionKind === 'training'
      ? 'المتربصين'
      : 'الطلبة';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
          <Trash2 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-black text-slate-950">حذف المؤسسة</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          سيتم حذف المؤسسة وكل البيانات المرتبطة بها من {affectedPeopleLabel}، الجلسات، الحضور، الأجهزة والحسابات.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-800">
          {institution.name}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" className="rounded-lg border-slate-200" onClick={onCancel} disabled={deleting}>
            إلغاء
          </Button>
          <Button className="rounded-lg bg-rose-600 text-white hover:bg-rose-700" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'جاري الحذف...' : 'حذف نهائي'}
          </Button>
        </div>
      </div>
    </div>
  );
}
