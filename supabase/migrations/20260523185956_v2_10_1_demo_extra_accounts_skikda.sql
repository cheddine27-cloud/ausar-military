-- ⚠️ DEPRECATED: Demo data now managed by scripts/demo/
-- v2.10.1 — Pre-Customer Demo: 3 additional Skikda accounts to showcase scope picker
-- (faculty_admin / department_admin / viewer). Idempotent — safe to re-run.
-- Auth users are created with bcrypt-hashed passwords using extensions.crypt.
--
-- NOTE: passwords are intentionally inline here because these are throw-away
-- DEMO accounts on a non-production demo institution. Replace before any
-- real production deployment.

DO $$
DECLARE
  v_inst_id     UUID := '103139b5-3b6a-41a0-a41c-577d0d66e16c';
  v_unit_fac    UUID := 'd1000001-0000-0000-0000-000000000001'; -- FST faculty
  v_unit_dep    UUID := 'd1000002-0000-0000-0000-000000000002'; -- INFO department

  v_dean_id     UUID := '11111111-aaaa-4aaa-8aaa-000000000201';
  v_head_id     UUID := '22222222-aaaa-4aaa-8aaa-000000000202';
  v_view_id     UUID := '33333333-aaaa-4aaa-8aaa-000000000203';

  v_dean_admin  UUID;
  v_head_admin  UUID;
  v_view_admin  UUID;
BEGIN
  ----------------------------------------------------------------------------
  -- 1) faculty_admin — dean_sciences_demo  (scope: FST)
  ----------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_dean_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_dean_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'dean.sciences@q-hudoor.test',
      extensions.crypt('Dean@2026!', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"faculty_admin","username":"dean_sciences_demo","full_name":"د. أحمد بن سالم","email_verified":true}'::jsonb,
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = v_dean_id) THEN
    INSERT INTO public.admins (auth_user_id, username, role, full_name, email, institution_id, rank, department)
    VALUES (v_dean_id, 'dean_sciences_demo', 'faculty_admin', 'د. أحمد بن سالم', 'dean.sciences@q-hudoor.test', v_inst_id, 'عميد الكلية', 'كلية العلوم وعلوم التكنولوجيا')
    RETURNING id INTO v_dean_admin;
  ELSE
    SELECT id INTO v_dean_admin FROM public.admins WHERE auth_user_id = v_dean_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_scopes WHERE admin_id = v_dean_admin AND unit_id = v_unit_fac) THEN
    INSERT INTO public.user_scopes (admin_id, institution_id, unit_id, scope_role)
    VALUES (v_dean_admin, v_inst_id, v_unit_fac, 'faculty_admin');
  END IF;

  ----------------------------------------------------------------------------
  -- 2) department_admin — head_it_demo  (scope: INFO department)
  ----------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_head_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_head_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'head.it@q-hudoor.test',
      extensions.crypt('Head@2026!', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"department_admin","username":"head_it_demo","full_name":"د. ياسين زرقاوي","email_verified":true}'::jsonb,
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = v_head_id) THEN
    INSERT INTO public.admins (auth_user_id, username, role, full_name, email, institution_id, rank, department)
    VALUES (v_head_id, 'head_it_demo', 'department_admin', 'د. ياسين زرقاوي', 'head.it@q-hudoor.test', v_inst_id, 'رئيس قسم', 'قسم الإعلام الآلي')
    RETURNING id INTO v_head_admin;
  ELSE
    SELECT id INTO v_head_admin FROM public.admins WHERE auth_user_id = v_head_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_scopes WHERE admin_id = v_head_admin AND unit_id = v_unit_dep) THEN
    INSERT INTO public.user_scopes (admin_id, institution_id, unit_id, scope_role)
    VALUES (v_head_admin, v_inst_id, v_unit_dep, 'department_admin');
  END IF;

  ----------------------------------------------------------------------------
  -- 3) viewer — viewer_demo  (institution-wide read-only)
  ----------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_view_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_view_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'viewer@q-hudoor.test',
      extensions.crypt('Viewer@2026!', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"viewer","username":"viewer_demo","full_name":"مشاهد للقراءة","email_verified":true}'::jsonb,
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = v_view_id) THEN
    INSERT INTO public.admins (auth_user_id, username, role, full_name, email, institution_id, rank, department)
    VALUES (v_view_id, 'viewer_demo', 'viewer', 'مشاهد للقراءة فقط', 'viewer@q-hudoor.test', v_inst_id, 'مشاهد', 'الإدارة العامة')
    RETURNING id INTO v_view_admin;
  ELSE
    SELECT id INTO v_view_admin FROM public.admins WHERE auth_user_id = v_view_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_scopes WHERE admin_id = v_view_admin AND unit_id IS NULL AND institution_id = v_inst_id) THEN
    INSERT INTO public.user_scopes (admin_id, institution_id, unit_id, scope_role)
    VALUES (v_view_admin, v_inst_id, NULL, 'viewer');
  END IF;
END
$$;
