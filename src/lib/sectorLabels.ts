// =============================================================================
// Sector-aware labels — Ausar Military (قطاع الجيش/الخدمة الوطنية فقط)
// =============================================================================
// مصدر واحد لمعجم المصطلحات في لوحات الإدارة.
// ملاحظة: هذا التطبيق مخصص للجيش (المديرية الوطنية للخدمة الوطنية) فقط بعد الفصل.
// =============================================================================

export type SectorType = 'military';

export interface SectorVocabulary {
  /** العسكري الدارس (يوافق student) */
  learner: string;
  learners: string;
  /** القائد/المدرب (يوافق educator) */
  educator: string;
  educators: string;
  /** الوحدة العسكرية (يوافق cohort/group) */
  group: string;
  groups: string;
  structureTitle: string;
}

const VOCABULARY: Record<SectorType, SectorVocabulary> = {
  military: {
    learner: 'العسكري الدارس',
    learners: 'العسكريون الدارسون',
    educator: 'القائد/المدرب',
    educators: 'القادة والمدربون',
    group: 'الفوج',
    groups: 'الأفواج',
    structureTitle: 'الهيكل العسكري',
  },
};

/** إرجاع معجم القطاع، مع الارتداد إلى الجيّش إذا كان النوع غير معروف. */
export function getSectorLabels(type: SectorType | string | null | undefined): SectorVocabulary {
  if (type === 'military') return VOCABULARY.military;
  return VOCABULARY.military;
}
