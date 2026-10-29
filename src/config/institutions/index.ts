/**
 * Ausar Military — Institution Config Registry
 *
 * Central registry that maps institution types to their configurations.
 * Provides:
 *   - getInstitutionConfig(type)  → Pure function, works anywhere
 *   - useInstitutionUI()          → React hook for components
 *   - getUITerm(key)              → Backward-compatible drop-in replacement
 *
 * @example
 *   // In a React component:
 *   const ui = useInstitutionUI();
 *   ui.dictionary.student     // 'طالب' | 'تلميذ' | 'متربص' | ...
 *   ui.sessionTypes           // [{ id, label_ar, ... }, ...]
 *   ui.layout.faculty         // true | false
 *
 *   // Outside React:
 *   const config = getInstitutionConfig('school');
 */

import type { InstitutionConfig } from './types';
import military from './military';
import system from './system';
import { getCurrentAdmin } from '@/lib/database';

// ─── Registry ────────────────────────────────────────────────────
// To add a new institution type: import it and add to this object.
const registry: Record<string, InstitutionConfig> = {
  military,
  system,
};

// ─── Core API ────────────────────────────────────────────────────

/**
 * Returns the InstitutionConfig for the given type.
 * Falls back to `military` if the type is unknown or missing.
 */
export function getInstitutionConfig(type?: string | null): InstitutionConfig {
  return registry[type ?? ''] ?? registry.military;
}

// ─── React Hook ──────────────────────────────────────────────────

/**
 * React hook that returns the current institution's config
 * based on the logged-in admin's institution_type.
 */
export function useInstitutionUI(): InstitutionConfig {
  const admin = getCurrentAdmin();
  return getInstitutionConfig(admin?.institution_type);
}

// ─── Backward Compatibility Layer ────────────────────────────────
// Drop-in replacement for the old getUITerm() from ui-dictionary.ts.
// Components can be migrated gradually from getUITerm('key') to ui.dictionary.key

type DictionaryKey = keyof InstitutionConfig['dictionary'];

/**
 * @deprecated Use `useInstitutionUI().dictionary.key` instead.
 * Kept for backward compatibility during migration.
 */
export function getUITerm(key: string): string {
  const config = getInstitutionConfig(getCurrentAdmin()?.institution_type);

  // Dictionary keys
  if (key in config.dictionary) {
    return config.dictionary[key as DictionaryKey];
  }

  // Legacy session type keys (sessionTypeCours, sessionTypeTd, etc.)
  const sessionMap: Record<string, string> = {
    sessionTypePlaceholder: config.sessionTypes.map((s) => s.label_ar).join(' / '),
    sessionTypeCours: config.sessionTypes.find((s) => s.id === 'cours')?.label_ar ?? '',
    sessionTypeTd: config.sessionTypes.find((s) => s.id === 'td')?.label_ar ?? '',
    sessionTypeTp: config.sessionTypes.find((s) => s.id === 'tp')?.label_ar ?? '',
  };

  return sessionMap[key] ?? key;
}

// ─── Re-exports ──────────────────────────────────────────────────
export type {
  InstitutionConfig,
  SessionTypeOption,
  LayoutConfig,
  FeaturesConfig,
  DashboardConfig,
  BrandingConfig,
} from './types';
