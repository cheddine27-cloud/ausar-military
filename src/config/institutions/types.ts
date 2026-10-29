/**
 * Ausar Military — Institution Configuration Types
 *
 * Central type definitions for the plugin-ready institution config system.
 * Each institution type implements this interface to define its terminology,
 * session types, layout, features, dashboard, and branding.
 *
 * To add a new institution type, create a new file that exports an
 * InstitutionConfig object and register it in the registry (index.ts).
 */

// ─── Session Types ───────────────────────────────────────────────

/** A single session type option for dropdown menus */
export interface SessionTypeOption {
  /** Database value (e.g. 'cours', 'td', 'tp', 'exam') */
  id: string;
  /** Arabic display label */
  label_ar: string;
  /** French display label (for future i18n) */
  label_fr: string;
  /** Emoji icon */
  icon: string;
  /** Tailwind color token (e.g. 'blue', 'amber', 'green') */
  color: string;
}

// ─── Layout ──────────────────────────────────────────────────────

/** Controls which structural selectors are visible in forms */
export interface LayoutConfig {
  faculty: boolean;
  department: boolean;
  specialty: boolean;
  // Future extensions:
  // semester?: boolean;
  // academicYear?: boolean;
  // building?: boolean;
}

// ─── Features (Feature Flags) ────────────────────────────────────

/** Feature flags controlling what capabilities are available per institution type */
export interface FeaturesConfig {
  qrAttendance: boolean;
  smartAttendance: boolean;
  manualRollCall: boolean;
  // Future stubs (default false when omitted):
  deviceAttendance?: boolean;
  internships?: boolean;
  guardians?: boolean;
  payroll?: boolean;
  certificates?: boolean;
  faceRecognition?: boolean;
  fingerprint?: boolean;
  gpsTracking?: boolean;
}

// ─── Dashboard ───────────────────────────────────────────────────

/** Defines what appears on the institution's dashboard */
export interface DashboardConfig {
  /** Cards displayed on the overview section */
  cards: string[];
  /** Sidebar / tab navigation items */
  sidebar: string[];
}

// ─── Branding ────────────────────────────────────────────────────

/** Visual branding customization per institution type */
export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  // Future extensions:
  // logo?: string;
  // favicon?: string;
  // theme?: 'light' | 'dark' | 'auto';
}

// ─── Full Plugin Manifest ────────────────────────────────────────

/** Complete configuration for an institution type — the plugin manifest */
export interface InstitutionConfig {
  /** Localized terminology for entities */
  dictionary: {
    student: string;
    students: string;
    cohort: string;
    cohorts: string;
    faculty: string;
    faculties: string;
    department: string;
    departments: string;
    specialty: string;
    specialties: string;
  };

  /** Available session types for this institution */
  sessionTypes: SessionTypeOption[];

  /** Form field visibility rules */
  layout: LayoutConfig;

  /** Feature flags */
  features: FeaturesConfig;

  /** Dashboard layout */
  dashboard: DashboardConfig;

  /** Visual branding */
  branding: BrandingConfig;

  /**
   * Optional risk engine thresholds.
   * Only used for institution types that implement the approval workflow (e.g. school).
   */
  risk?: {
    /** Absence rate (%) at or above which a student is flagged as 'warning' */
    warningThreshold: number;
    /** Absence rate (%) at or above which a student is flagged as 'critical' */
    criticalThreshold: number;
  };
}
