import type { WorkflowDefinition, WorkflowCardDefinition } from '@/core/workflow/WorkflowTypes';

/**
 * دورة تدقيق تقرير الحضور العسكري:
 * قائد الحصة (العريف/الرقيب) يُعدّ الحضور → مدقق السرية (نقيب) → قائد المركز (رائد+)
 */
export const militaryWorkflow: WorkflowDefinition = {
  moduleId: 'military',
  entityType: 'attendance_report',
  initialState: 'pending_review',
  steps: [
    { id: 'draft', label_ar: 'مسودة', label_fr: 'Brouillon', rolesAllowed: ['teacher', 'staff', 'institution_admin', 'institution_owner'] },
    { id: 'pending_review', label_ar: 'في انتظار التدقيق', label_fr: 'En attente de revue', rolesAllowed: ['staff', 'institution_admin', 'institution_owner'] },
    { id: 'approved', label_ar: 'معتمد', label_fr: 'Approuvé', rolesAllowed: ['institution_admin', 'institution_owner'] },
    { id: 'rejected', label_ar: 'مرفوض', label_fr: 'Rejeté', rolesAllowed: ['institution_admin', 'institution_owner'] },
    { id: 'correction_requested', label_ar: 'طلب تصحيح', label_fr: 'Correction demandée', rolesAllowed: ['teacher', 'staff', 'institution_admin', 'institution_owner'] },
  ],
  transitions: [
    { action: 'submit', fromState: 'draft', toState: 'pending_review', label_ar: 'إعتماد للمراجعة', label_fr: 'Soumettre pour revue' },
    { action: 'approve', fromState: 'pending_review', toState: 'approved', label_ar: 'اعتماد التقرير', label_fr: 'Approuver' },
    { action: 'reject', fromState: 'pending_review', toState: 'rejected', label_ar: 'رفض التقرير', label_fr: 'Rejeter' },
    { action: 'request_correction', fromState: 'pending_review', toState: 'correction_requested', label_ar: 'إرجاع للتصحيح', label_fr: 'Demander correction' },
    { action: 'resubmit', fromState: 'correction_requested', toState: 'pending_review', label_ar: 'إعادة التقديم بعد التصحيح', label_fr: 'Ressoumettre' },
  ],
};

export const militaryDashboardCards: WorkflowCardDefinition[] = [
  {
    id: 'pending_reports',
    label_ar: 'تقارير حضور في انتظار الاعتماد',
    label_fr: 'Rapports en attente',
    icon: 'FileClock',
  },
  {
    id: 'approved_today',
    label_ar: 'تقارير معتمدة اليوم',
    label_fr: 'Rapports approuvés aujourd\'hui',
    icon: 'ShieldCheck',
  },
  {
    id: 'justifications_pending',
    label_ar: 'تبريرات غياب قيد المعالجة',
    label_fr: 'Justifications en attente',
    icon: 'FileCheck2',
  },
];
