# Ausar Military Enterprise SaaS Developer Guide

Welcome to the developer guide for building modules and integrating core engines on the Ausar Military platform.

## Codebase Conventions

1. **Decoupling**: Business logic must never check hardcoded institution type strings like `institution.type === 'school'`. Instead, query modular features using `useInstitutionCapabilities()`.
2. **Registry Injection**: Register all page views, menus, custom sidebar links, and dashboard widgets through the manifest file (`index.ts`) in your module directory.
3. **Core API Integrations**:
   - Log all administrative events via `AuditService.log()`.
   - Perform user security validations using the `usePermission()` hook.
   - Enqueue notifications using `NotificationEngine.send()`.
   - Evaluate rules using `AutomationScheduler.scheduleTrigger()`.
