import type { InstitutionConfig } from './types';

/**
 * قطاع الجيش — المديرية الوطنية للخدمة الوطنية
 *
 * المصطلحان:
 *  - "العسكري الدارس": العسكري الذي يتابع الحصص الدراسية (صباحية/مسائية).
 *  - "الفوج": الوحدة العسكرية التي يُؤخذ فيها الحضور (فوج 1، فوج 2، ...).
 *  - فئات: الخدمة الوطنية (أشبال الأمة) / الأذِرعات (دورات تدريبية) / الموظفون العسكريون الدارسون.
 *
 * أنواع الحصص: صباحية / مسائية / تمرين تطبيقي / مراقبة (اختبار).
 */
const military: InstitutionConfig = {
  dictionary: {
    student: 'العسكري الدارس',
    students: 'العسكريون الدارسون',
    cohort: 'الفوج',
    cohorts: 'الأفواج',
    faculty: 'المركز',
    faculties: 'المراكز',
    department: 'السرية',
    departments: 'السرايا',
    specialty: 'التخصص',
    specialties: 'التخصصات',
  },

  sessionTypes: [
    {
      id: 'cours',
      label_ar: 'حصة صباحية',
      label_fr: 'Séance du matin',
      icon: '🌅',
      color: 'amber',
    },
    {
      id: 'td',
      label_ar: 'حصة مسائية',
      label_fr: 'Séance du soir',
      icon: '🌙',
      color: 'indigo',
    },
    {
      id: 'tp',
      label_ar: 'تمرين تطبيقي',
      label_fr: 'Exercice pratique',
      icon: '🎯',
      color: 'emerald',
    },
    {
      id: 'exam',
      label_ar: 'مراقبة / اختبار',
      label_fr: 'Contrôle / Test',
      icon: '📋',
      color: 'red',
    },
  ],

  layout: {
    faculty: true,
    department: true,
    specialty: true,
  },

  features: {
    qrAttendance: true,
    smartAttendance: true,
    manualRollCall: true,
    deviceAttendance: false,
    faceRecognition: false,
    fingerprint: false,
    gpsTracking: false,
  },

  dashboard: {
    cards: [
      'overview',
      'structure',
      'users',
      'students',
      'teachers',
      'groups',
      'attendance',
    ],
    sidebar: [
      'overview',
      'structure',
      'users',
      'students',
      'teachers',
      'groups',
      'attendance',
      'justifications',
      'devices',
      'reports',
      'subscription',
      'settings',
      'activity',
      'support',
    ],
  },

  branding: {
    primaryColor: 'emerald',
    secondaryColor: 'amber',
  },

  risk: {
    warningThreshold: 10,
    criticalThreshold: 20,
  },
};

export default military;
