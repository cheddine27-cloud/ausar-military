import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { WorkflowDefinition, WorkflowCardDefinition } from '@/core/workflow/WorkflowTypes';

export const schoolWorkflow: WorkflowDefinition = {
  moduleId: 'school',
  entityType: 'attendance_report',
  initialState: 'pending_review',
  steps: [
    { id: 'draft', label_ar: 'مسودة', label_fr: 'Brouillon', rolesAllowed: ['teacher', 'staff', 'institution_admin', 'institution_owner'] },
    { id: 'pending_review', label_ar: 'قيد المراجعة', label_fr: 'En attente de revue', rolesAllowed: ['staff', 'institution_admin', 'institution_owner'] },
    { id: 'approved', label_ar: 'معتمد', label_fr: 'Approuvé', rolesAllowed: ['institution_admin', 'institution_owner'] },
    { id: 'rejected', label_ar: 'مرفوض', label_fr: 'Rejeté', rolesAllowed: ['institution_admin', 'institution_owner'] },
    { id: 'correction_requested', label_ar: 'طلب تعديل', label_fr: 'Correction demandée', rolesAllowed: ['teacher', 'staff', 'institution_admin', 'institution_owner'] },
  ],
  transitions: [
    { action: 'submit', fromState: 'draft', toState: 'pending_review', label_ar: 'إرسال للمراجعة', label_fr: 'Soumettre pour revue' },
    { action: 'approve', fromState: 'pending_review', toState: 'approved', label_ar: 'اعتماد التقرير', label_fr: 'Approuver' },
    { action: 'reject', fromState: 'pending_review', toState: 'rejected', label_ar: 'رفض التقرير', label_fr: 'Rejeter' },
    { action: 'request_correction', fromState: 'pending_review', toState: 'correction_requested', label_ar: 'طلب تصحيح من الأستاذ', label_fr: 'Demander correction' },
    { action: 'resubmit', fromState: 'correction_requested', toState: 'pending_review', label_ar: 'إعادة إرسال التقرير للمراجعة', label_fr: 'Ressoumettre' },
  ],
};

export const schoolDashboardCards: WorkflowCardDefinition[] = [
  {
    id: 'pending_reports',
    label_ar: 'تقارير حضور قيد الانتظار',
    label_fr: 'Rapports en attente',
    icon: 'FileClock',
    color: 'amber',
    countQuery: async (institutionId: string) => {
      const { count, error } = await supabase
        .from('school_attendance_reports')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .eq('status', 'submitted')
        .eq('correction_requested', false);
      if (error) {
        console.error('Pending reports count query failed:', error);
        return 0;
      }
      return count || 0;
    },
  },
  {
    id: 'approved_today_card',
    label_ar: 'تقارير معتمدة اليوم',
    label_fr: 'Rapports approuvés aujourd\'hui',
    icon: 'CheckCircle',
    color: 'emerald',
    countQuery: async (institutionId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('school_attendance_reports')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .in('status', ['approved', 'notifications_sent', 'closed'])
        .eq('date', today);
      if (error) {
        console.error('Approved today count query failed:', error);
        return 0;
      }
      return count || 0;
    },
  },
  {
    id: 'correction_requested_card',
    label_ar: 'طلبات تعديل معلقة',
    label_fr: 'Corrections demandées',
    icon: 'AlertTriangle',
    color: 'rose',
    countQuery: async (institutionId: string) => {
      const { count, error } = await supabase
        .from('school_attendance_reports')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .eq('correction_requested', true);
      if (error) {
        console.error('Correction requested count query failed:', error);
        return 0;
      }
      return count || 0;
    },
  },
];

export const predictiveIntelligenceWorkflow: WorkflowDefinition = {
  moduleId: 'school',
  entityType: 'prediction_alert',
  initialState: 'pending_review',
  steps: [
    { id: 'pending_review', label_ar: 'قيد المراجعة', label_fr: 'En attente de revue', rolesAllowed: ['staff', 'institution_admin', 'institution_owner'] },
    { id: 'recommendation_accepted', label_ar: 'تم قبول التوصية', label_fr: 'Recommandation acceptée', rolesAllowed: ['institution_admin', 'institution_owner'] },
    { id: 'action_assigned', label_ar: 'تم تعيين إجراء', label_fr: 'Action assignée', rolesAllowed: ['staff', 'institution_admin', 'institution_owner'] },
    { id: 'completed', label_ar: 'مكتمل', label_fr: 'Complété', rolesAllowed: ['staff', 'institution_admin', 'institution_owner'] },
    { id: 'evaluation', label_ar: 'تقييم الأثر', label_fr: 'Évaluation', rolesAllowed: ['institution_admin', 'institution_owner'] },
    { id: 'dismissed', label_ar: 'مستبعد', label_fr: 'Ignoré', rolesAllowed: ['institution_admin', 'institution_owner'] },
  ],
  transitions: [
    { action: 'accept', fromState: 'pending_review', toState: 'recommendation_accepted', label_ar: 'قبول التوصية', label_fr: 'Accepter la recommandation' },
    { action: 'assign', fromState: 'recommendation_accepted', toState: 'action_assigned', label_ar: 'تعيين إجراء ومسؤول', label_fr: 'Assigner l\'action' },
    { action: 'complete', fromState: 'action_assigned', toState: 'completed', label_ar: 'إكمال الإجراء المتبع', label_fr: 'Marquer comme complété' },
    { action: 'evaluate', fromState: 'completed', toState: 'evaluation', label_ar: 'تقييم أثر التدخل', label_fr: 'Évaluer l\'impact' },
    { action: 'dismiss', fromState: 'pending_review', toState: 'dismissed', label_ar: 'استبعاد التنبيه', label_fr: 'Ignorer l\'alerte' },
    { action: 'dismiss_accepted', fromState: 'recommendation_accepted', toState: 'dismissed', label_ar: 'استبعاد بعد القبول', label_fr: 'Ignorer après acceptation' },
  ],
};

export const studentTransferWorkflow: WorkflowDefinition = {
  moduleId: 'school',
  entityType: 'student_transfer',
  initialState: 'pending_approval',
  steps: [
    { id: 'pending_approval', label_ar: 'قيد الانتظار', label_fr: 'En attente d\'approbation', rolesAllowed: ['staff', 'institution_admin', 'institution_owner'] },
    { id: 'approved', label_ar: 'تم النقل والموافقة', label_fr: 'Approuvé et transféré', rolesAllowed: ['institution_admin', 'institution_owner'] },
    { id: 'rejected', label_ar: 'مرفوض', label_fr: 'Transférer rejeté', rolesAllowed: ['institution_admin', 'institution_owner'] },
  ],
  transitions: [
    { action: 'approve', fromState: 'pending_approval', toState: 'approved', label_ar: 'موافقة ونقل', label_fr: 'Approuver' },
    { action: 'reject', fromState: 'pending_approval', toState: 'rejected', label_ar: 'رفض الطلب', label_fr: 'Rejeter' },
  ],
};

