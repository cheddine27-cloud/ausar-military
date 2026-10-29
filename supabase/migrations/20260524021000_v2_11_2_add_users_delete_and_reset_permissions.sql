-- v2.11.2 — Add fine-grained permissions for sensitive user actions.

INSERT INTO public.permission_catalog (permission_key, category, description) VALUES
  ('users.delete',         'users', 'Delete downstream user accounts inside the permitted scope'),
  ('users.reset_password', 'users', 'Generate a new temporary password for a downstream user')
ON CONFLICT (permission_key) DO UPDATE
SET category = EXCLUDED.category,
    description = EXCLUDED.description;

INSERT INTO public.role_permission_defaults (role, permission_key, allowed) VALUES
  ('institution_owner', 'users.delete', true),
  ('institution_owner', 'users.reset_password', true),
  ('institution_admin', 'users.delete', true),
  ('institution_admin', 'users.reset_password', true),
  ('faculty_admin',     'users.delete', true),
  ('faculty_admin',     'users.reset_password', true),
  ('department_admin',  'users.delete', true),
  ('department_admin',  'users.reset_password', true),
  ('staff',             'users.delete', false),
  ('staff',             'users.reset_password', false),
  ('teacher',           'users.delete', false),
  ('teacher',           'users.reset_password', false),
  ('viewer',            'users.delete', false),
  ('viewer',            'users.reset_password', false)
ON CONFLICT (role, permission_key) DO UPDATE
SET allowed = EXCLUDED.allowed;
