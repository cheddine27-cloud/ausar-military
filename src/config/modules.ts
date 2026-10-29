import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { InstitutionCapabilities } from '@/core/capabilities/types';
import type { InstitutionConfig } from './institutions/types';
import type { WorkflowDefinition, WorkflowCardDefinition } from '@/core/workflow/WorkflowTypes';
import { getCurrentAdmin } from '@/lib/database';

import military from '@/modules/military';
import system from '@/modules/system';

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  permissionKey?: string;
}

export interface WidgetDefinition {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
}

export interface ModuleManifest {
  id: string; // e.g. 'military' | 'system'
  sidebar: SidebarItem[];
  widgets: WidgetDefinition[];
  capabilities: InstitutionCapabilities;
  config: InstitutionConfig; // integrates v3.1.0 configs
  workflow?: WorkflowDefinition;
  dashboardCards?: WorkflowCardDefinition[];
  permissions?: string[];
  automationRules?: unknown[];
}

// ─── Module Registry ─────────────────────────────────────────────
const registry: Record<string, ModuleManifest> = {
  military,
  system,
};

/**
 * Registers an institution type module manifest in the system.
 */
export function registerModule(manifest: ModuleManifest): void {
  registry[manifest.id] = manifest;
}

/**
 * Returns the module manifest for the given institution type.
 * Falls back to 'military' if the type is unknown or missing.
 */
export function getModule(type?: string | null): ModuleManifest {
  let resolvedType = type ?? 'military';
  return registry[resolvedType] ?? registry.military;
}

/**
 * Returns the currently active module manifest based on the logged-in admin's profile.
 */
export function getActiveModule(): ModuleManifest {
  const admin = getCurrentAdmin();
  return getModule(admin?.institution_type);
}

/**
 * React hook to access the active institution's capabilities.
 */
export function useInstitutionCapabilities(): InstitutionCapabilities {
  const admin = getCurrentAdmin();
  const manifest = getModule(admin?.institution_type);
  return manifest.capabilities;
}

/**
 * React hook to access the active module manifest.
 */
export function useActiveModule(): ModuleManifest {
  return getActiveModule();
}
