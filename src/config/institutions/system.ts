import type { InstitutionConfig } from './types';
import military from './military';

/**
 * System/Platform admin config.
 * Falls back to university terminology since system admins
 * manage the platform itself, not a specific institution.
 */
const system: InstitutionConfig = {
  ...military,
  branding: {
    primaryColor: 'slate',
    secondaryColor: 'zinc',
  },
};

export default system;
