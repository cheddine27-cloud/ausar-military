-- ⚠️ DEPRECATED: Demo data now managed by scripts/demo/
-- v3.0.2 — Add training center demo accounts (Director & Teacher) for local testing.
-- Safe to re-run.

DO $$
DECLARE
  v_inst_id     UUID := '4d1c8305-f72a-43e4-9460-e00094439a19'; -- Training Center
  v_dir_id      UUID := '55555555-aaaa-4aaa-8aaa-000000000205';
  v_teacher_id  UUID := '66666666-aaaa-4aaa-8aaa-000000000206';
  
  v_dir_admin_id      UUID;
  v_teacher_admin_id  UUID;
BEGIN
  ----------------------------------------------------------------------------
  -- 1) Director (institution_admin) — director_training
  ----------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_dir_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current, phone_change, phone_change_token,
      reauthentication_token,
      created_at, updated_at
    ) VALUES (
      v_dir_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'director.training@q-hudoor.test',
      extensions.crypt('Director@2026!', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"institution_admin","username":"director_training","full_name":"مدير مركز التكوين","email_verified":true}'::jsonb,
      '', '', '', '', '', '', '', '',
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = v_dir_id) THEN
    INSERT INTO public.admins (auth_user_id, username, role, full_name, email, institution_id, rank, department)
    VALUES (v_dir_id, 'director_training', 'institution_admin', 'مدير مركز التكوين', 'director.training@q-hudoor.test', v_inst_id, 'مدير المركز', 'الإدارة العامة')
    RETURNING id INTO v_dir_admin_id;
  ELSE
    SELECT id INTO v_dir_admin_id FROM public.admins WHERE auth_user_id = v_dir_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_scopes WHERE admin_id = v_dir_admin_id AND unit_id IS NULL AND institution_id = v_inst_id) THEN
    INSERT INTO public.user_scopes (admin_id, institution_id, unit_id, scope_role)
    VALUES (v_dir_admin_id, v_inst_id, NULL, 'institution_admin');
  END IF;

  ----------------------------------------------------------------------------
  -- 2) Teacher — teacher_training
  ----------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_teacher_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current, phone_change, phone_change_token,
      reauthentication_token,
      created_at, updated_at
    ) VALUES (
      v_teacher_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'teacher.training@q-hudoor.test',
      extensions.crypt('Teacher@2026!', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"teacher","username":"teacher_training","full_name":"أستاذ مركز التكوين","email_verified":true}'::jsonb,
      '', '', '', '', '', '', '', '',
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = v_teacher_id) THEN
    INSERT INTO public.admins (auth_user_id, username, role, full_name, email, institution_id, rank, department)
    VALUES (v_teacher_id, 'teacher_training', 'teacher', 'أستاذ مركز التكوين', 'teacher.training@q-hudoor.test', v_inst_id, 'أستاذ', 'قسم التدريب')
    RETURNING id INTO v_teacher_admin_id;
  END IF;

END
$$;
