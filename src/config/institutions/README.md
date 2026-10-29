# Adding a New Institution Type to Ausar Military

## ⏱ Time required: < 5 minutes

## Step 1 — Create the config file

Create `src/config/institutions/<type>.ts`:

```typescript
import type { InstitutionConfig } from './types';

const hospital: InstitutionConfig = {
  dictionary: {
    student: 'مريض',
    students: 'المرضى',
    cohort: 'جناح',
    cohorts: 'الأجنحة',
    faculty: 'القسم الطبي',
    faculties: 'الأقسام الطبية',
    department: 'المصلحة',
    departments: 'المصالح',
    specialty: 'التخصص الطبي',
    specialties: 'التخصصات الطبية',
  },

  sessionTypes: [
    { id: 'cours', label_ar: 'حصة', label_fr: 'Séance', icon: '🏥', color: 'blue' },
    { id: 'td', label_ar: 'تدريب', label_fr: 'Formation', icon: '✍️', color: 'amber' },
    { id: 'tp', label_ar: 'مناوبة', label_fr: 'Garde', icon: '🔬', color: 'green' },
    { id: 'exam', label_ar: 'تقييم', label_fr: 'Évaluation', icon: '📝', color: 'red' },
  ],

  layout: { faculty: true, department: true, specialty: true },

  features: {
    qrAttendance: true,
    smartAttendance: true,
    manualRollCall: true,
  },

  dashboard: {
    cards: ['attendance', 'students', 'teachers', 'sessions'],
    sidebar: ['overview', 'sessions', 'cohorts', 'students', 'analytics'],
  },

  branding: { primaryColor: 'teal', secondaryColor: 'slate' },
};

export default hospital;
```

## Step 2 — Register in the registry

Edit `src/config/institutions/index.ts`:

```typescript
import hospital from './hospital';

const registry: Record<string, InstitutionConfig> = {
  university, school, training, company, system,
  hospital,  // ← Add here
};
```

## Step 3 — Add the type in the database

When creating an institution, set `type = 'hospital'`.

## ✅ Done!

No component changes required. The UI will automatically:
- Use your Arabic/French terminology
- Show the correct session types
- Show/hide form fields based on your layout config
- Apply your branding colors
