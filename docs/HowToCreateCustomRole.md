# How to Create a Custom Role in Ausar Military

Follow this guide to create and seed a custom role with permissions in the SaaS platform database.

## Step 1: Database Seed
Execute a database migration or run an SQL query to insert default permissions for your custom role (e.g. `supervisor`):

```sql
-- 1. Insert default permissions
INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('supervisor', 'attendance.create', true),
  ('supervisor', 'attendance.edit', true),
  ('supervisor', 'attendance.delete', false),
  ('supervisor', 'students.view', true),
  ('supervisor', 'dashboard.view', true);
```

## Step 2: Update Client Enums
If necessary, update typescript typings in `src/lib/database.ts` or helper files to add `'supervisor'` to the allowed role array to enable layout styling.

The permission engine will automatically resolve the defaults for `'supervisor'` on session load without any extra code modifications!
