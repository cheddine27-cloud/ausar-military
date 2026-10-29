-- 1. Insert delete student permission to catalog
INSERT INTO public.system_permissions (key, category, description)
VALUES ('students.delete', 'students_center', 'Hard delete student records and their history')
ON CONFLICT (key) DO NOTHING;

-- 2. Assign permission to institution_admin
INSERT INTO public.role_permissions (role, permission_key, allowed)
VALUES ('institution_admin', 'students.delete', true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = true;

-- 3. Assign permission to manager
INSERT INTO public.role_permissions (role, permission_key, allowed)
VALUES ('manager', 'students.delete', true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = true;
