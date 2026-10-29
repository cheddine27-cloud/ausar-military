/**
 * Ausar Military — Environment Variables Validation
 */

export const EnvValidator = {
  /**
   * Validates required environment variables for the production runtime.
   * Throws an error or returns validation details if keys are missing.
   */
  validate(): { isValid: boolean; missingKeys: string[] } {
    const requiredKeys = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
    ];

    const missingKeys: string[] = [];

    requiredKeys.forEach((key) => {
      const val = ((import.meta as unknown) as { env: Record<string, string> }).env[key];
      if (!val || val === 'PLACEHOLDER' || val === '') {
        missingKeys.push(key);
      }
    });

    const isValid = missingKeys.length === 0;

    if (!isValid) {
      console.error(
        `[EnvValidator]: Critical Configuration Error - Missing environment variables: ${missingKeys.join(', ')}`
      );
    } else {
      console.log('[EnvValidator]: Environment configurations successfully validated.');
    }

    return { isValid, missingKeys };
  }
};
