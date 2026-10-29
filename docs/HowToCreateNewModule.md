# How to Create a New Module in Ausar Military

Follow this guide to create and register a new institution module.

## Step 1: Create the Module Directory
Create a new directory under `src/modules/` (e.g. `src/modules/hospital/`).

## Step 2: Implement the Manifest (`index.ts`)
Create `index.ts` declaring the `ModuleManifest` configuration:

```typescript
import type { ModuleManifest } from '@/config/modules';
import { HospitalDashboardWidget } from './widgets';
import hospitalConfig from '@/config/institutions/hospital';

const hospitalModule: ModuleManifest = {
  id: 'hospital',
  capabilities: {
    canQR: true,
    canSmartRollCall: true,
    canHybrid: false,
    canJustifications: true,
    canParentsNotify: false,
    canDiscipline: false,
    canShiftAttendance: true,
  },
  config: hospitalConfig,
  sidebar: [
    { id: 'overview', label: 'الرئيسية', icon: LayoutDashboard, component: HospitalDashboard },
  ],
  widgets: [
    { id: 'hospital-shifts', component: HospitalDashboardWidget },
  ],
  permissions: ['attendance.create', 'attendance.edit', 'settings.manage'],
  automationRules: [],
};

export default hospitalModule;
```

## Step 3: Register the Module
Open `src/config/modules.ts` and add your module to the registry record:

```typescript
import hospital from '@/modules/hospital';

const registry: Record<string, ModuleManifest> = {
  // ...
  hospital,
};
```
Your module is now fully registered and pluggable!
