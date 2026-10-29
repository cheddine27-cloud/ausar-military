# Ausar Military Project Folder Structure

This document details the file organization of the modular Ausar Military platform.

```text
📦 university-attendance-system2026/
 ┣ 📂 docs/                    # Architectural and developer guides
 ┣ 📂 src/
 ┃ ┣ 📂 components/            # Global UI primitives and layouts
 ┃ ┃ ┗ 📂 enterprise/          # Memoized reusable Enterprise components
 ┃ ┣ 📂 core/                  # Core SaaS Engines
 ┃ ┃ ┣ 📂 audit/               # Audit Log and Performance Tracing
 ┃ ┃ ┣ 📂 automation/          # Rule-based workflow automations
 ┃ ┃ ┣ 📂 dashboard/           # Unified institutional dashboard
 ┃ ┃ ┣ 📂 errors/              # Localized centralized AppError classes
 ┃ ┃ ┣ 📂 notifications/       # Outbound channels (SMS/WhatsApp/Mail)
 ┃ ┃ ┣ 📂 permissions/         # Client-side capability authorization
 ┃ ┃ ┣ 📂 status/              # Production Env & Health verification
 ┃ ┃ ┗ 📂 workflow/            # Generic Workflow Engine
 ┃ ┣ 📂 modules/               # Pluggable institutional modules
 ┃ ┃ ┣ 📂 school/              # School attendance, inbox, parent portal
 ┃ ┃ ┣ 📂 university/          # University departments and groups
 ┃ ┃ ┣ 📂 company/             # Enterprise workspace and meetings
 ┃ ┃ ┗ 📂 training/            # Custom workshops and classes
 ┃ ┣ 📂 lib/                   # API, Supabase connection, & utility functions
 ┃ ┗ 📄 App.tsx                # Application shell and route provider
 ┣ 📂 supabase/                # Supabase migrations and database config
 ┣ 📄 package.json             # NPM package dependencies and scripts
 ┗ 📄 README.md                # General readme overview
```
