/**
 * Ausar Military — Central Capability System Type Definitions
 *
 * Defines strongly-typed capabilities that can be enabled or disabled
 * per institution type. UI components query these capabilities instead of
 * checking hardcoded institution type strings (e.g. type === 'school').
 */

export interface InstitutionCapabilities {
  /** Allows dynamic or static QR attendance scan flow */
  canQR: boolean;
  /** Allows smart roll call (student list selection) */
  canSmartRollCall: boolean;
  /** Allows hybrid mode (QR followed by roll call review) */
  canHybrid: boolean;
  /** Allows uploading, reviewing, and approving absence justifications */
  canJustifications: boolean;
  /** Allows sending automated notifications to parents (schools only) */
  canParentsNotify: boolean;
  /** Allows tracking student discipline records (schools only) */
  canDiscipline: boolean;
  /** Allows shift/schedule based check-ins (companies only) */
  canShiftAttendance: boolean;
  /** Allows workshop-specific attendance metrics (training centers only) */
  canWorkshopAttendance: boolean;

  // Future stubs (optional capabilities, defaults to false if omitted):
  canFaceRecognition?: boolean;
  canFingerprint?: boolean;
  canGpsTracking?: boolean;
}
