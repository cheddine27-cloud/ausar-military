# Ausar Military Release Notes — v3.9.4
## QA Phase 1 — Foundation Modules Verification

This release completes Phase 1 of Quality Assurance, checking, validating, and fixing the 15 core foundation modules of the system.

---

## 🛠️ Verification & Bug Fixes

- **Authentication & Roles**: Successfully tested logins and active sidebar setups for Owner, Admin, General Supervisor, and Teacher accounts.
- **Academic Structure & Deletions**: Lifted active academic year deletion constraints to allow administrators to safely undo setup errors.
- **Classrooms & Cohorts**: Appended classroom and cohort delete and update backend methods to the management services.
- **SW Console Warnings**: Removed PWA service worker verbose logs to keep developers console clean.
- **Timetable Period Indices**: Solved numeric indices conflict mapping.
