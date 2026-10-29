/**
 * schoolHelpers.ts
 * Shared helper functions for dynamically hiding academic structures (like Specialty / الشعبة)
 * when dealing with Primary (الابتدائي) or Middle (المتوسط) school levels.
 */

export function isPrimaryOrMiddle(
  institutionName?: string | null,
  selectedUnitName?: string | null,
  institutionType?: string | null
): boolean {
  if (institutionType === 'school' || institutionType === 'primary_school') return true;

  const instName = (institutionName || '').toLowerCase();
  const unitName = (selectedUnitName || '').toLowerCase();

  const matches = (str: string) =>
    str.includes('متوسط') || 
    str.includes('ابتدائ') || 
    str.includes('middle') || 
    str.includes('primary') ||
    str.includes('kessab') || // Kessab Middle School
    str.includes('لخضر');     // Lakhdar Kessab Middle School

  return matches(instName) || matches(unitName);
}
