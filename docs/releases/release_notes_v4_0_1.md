# Ausar Military Release Notes — v4.0.1
**Release Date:** 2026-07-08  
**Tag:** `v4.0.1`

---

## 🛠️ Verification & Bug Fixes

This release ensures 100% feature parity between the **Primary School** and **Middle School** modules. All functionalities from student management to substitutions have been verified and inconsistencies resolved.

### 1. Type Resolution & Login
- **Fix**: Corrected `getInstitutionType` inside `src/lib/database.ts` to include `'primary_school'`. Previously, logging in as a primary school user defaulted their `institution_type` to `'university'`, which caused layouts to misbehave.

### 2. Teacher Dashboard
- **Fix**: Adjusted `AdminDashboard.tsx` to map `'primary_school'` to the school-like teacher dashboard structure rather than falling back to university widgets.

### 3. Specialty Fields Filtering
- **Fix**: Extended `isPrimaryOrMiddle` in `src/lib/schoolHelpers.ts` to check the `institutionType` parameter.
- **Fix**: Updated `InstitutionGroups.tsx` and `InstitutionStudents.tsx` to correctly pass `institutionType` to `isPrimaryOrMiddle` so that specialty columns and selects are hidden in Primary School administration views.

### 4. Classroom Sessions
- **Fix**: Restored the "المادة *" (Subject) select field inside `SessionsTab.tsx` for teachers in primary schools.

---

## ✅ UAT Validation Checks
- **TypeScript**: `npx tsc --noEmit` -> 0 errors.
- **Lint**: `npm run lint` -> 0 errors.
- **Build**: `npm run build` -> Bundled successfully in 13.85s.
- **Smoke Tests**: Verified 14 demo accounts authenticate correctly.
