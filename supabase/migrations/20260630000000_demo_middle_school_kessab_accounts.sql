-- ⚠️ DEPRECATED: Demo data now managed by scripts/demo/
-- v3.0.3 — Add Middle School (متوسطة لخضر قصاب) demo accounts (Director, General Supervisor, Read-Only Administration).
-- Safe to re-run.

DO $$
DECLARE
  v_inst_id   UUID := '77777777-bbbb-4bbb-9bbb-000000000301';
  
  v_dir_id    UUID := '77777777-bbbb-4bbb-9bbb-000000000302';
  v_sup_id    UUID := '77777777-bbbb-4bbb-9bbb-000000000303';
  v_adm_id    UUID := '77777777-bbbb-4bbb-9bbb-000000000304';
  
  v_dir_admin_id UUID;
  v_sup_admin_id UUID;
  v_adm_admin_id UUID;
BEGIN
  -- 1) Insert Institution
  IF NOT EXISTS (SELECT 1 FROM public.institutions WHERE id = v_inst_id) THEN
    INSERT INTO public.institutions (id, name, type, status, max_students, code, settings_allowed_modes)
    VALUES (v_inst_id, 'متوسطة لخضر قصاب', 'school', 'active', 1000, 'kessab', ARRAY['qr', 'roll_call', 'hybrid']);
  END IF;

  -- 2) Insert Director (institution_admin)
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
      'director.kessab@q-hudoor.test',
      extensions.crypt('Director@2026!k', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"institution_admin","username":"director_kessab","full_name":"مدير متوسطة لخضر قصاب","email_verified":true}'::jsonb,
      '', '', '', '', '', '', '', '',
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = v_dir_id) THEN
    INSERT INTO public.admins (auth_user_id, username, role, full_name, email, institution_id, rank, department)
    VALUES (v_dir_id, 'director_kessab', 'institution_admin', 'مدير متوسطة لخضر قصاب', 'director.kessab@q-hudoor.test', v_inst_id, 'مدير المؤسسة', 'الإدارة العامة')
    RETURNING id INTO v_dir_admin_id;
  ELSE
    SELECT id INTO v_dir_admin_id FROM public.admins WHERE auth_user_id = v_dir_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_scopes WHERE admin_id = v_dir_admin_id AND unit_id IS NULL AND institution_id = v_inst_id) THEN
    INSERT INTO public.user_scopes (admin_id, institution_id, unit_id, scope_role)
    VALUES (v_dir_admin_id, v_inst_id, NULL, 'institution_admin');
  END IF;

  -- 3) Insert General Supervisor (institution_admin)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_sup_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current, phone_change, phone_change_token,
      reauthentication_token,
      created_at, updated_at
    ) VALUES (
      v_sup_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'supervisor.kessab@q-hudoor.test',
      extensions.crypt('Supervisor@2026!k', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"institution_admin","username":"supervisor_kessab","full_name":"المراقب العام — متوسطة لخضر قصاب","email_verified":true}'::jsonb,
      '', '', '', '', '', '', '', '',
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = v_sup_id) THEN
    INSERT INTO public.admins (auth_user_id, username, role, full_name, email, institution_id, rank, department)
    VALUES (v_sup_id, 'supervisor_kessab', 'institution_admin', 'المراقب العام — متوسطة لخضر قصاب', 'supervisor.kessab@q-hudoor.test', v_inst_id, 'مراقب عام', 'شؤون التلاميذ')
    RETURNING id INTO v_sup_admin_id;
  ELSE
    SELECT id INTO v_sup_admin_id FROM public.admins WHERE auth_user_id = v_sup_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_scopes WHERE admin_id = v_sup_admin_id AND unit_id IS NULL AND institution_id = v_inst_id) THEN
    INSERT INTO public.user_scopes (admin_id, institution_id, unit_id, scope_role)
    VALUES (v_sup_admin_id, v_inst_id, NULL, 'institution_admin');
  END IF;

  -- 4) Insert Administration (viewer / read-only)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_adm_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current, phone_change, phone_change_token,
      reauthentication_token,
      created_at, updated_at
    ) VALUES (
      v_adm_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin.kessab@q-hudoor.test',
      extensions.crypt('Admin@2026!k', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"viewer","username":"admin_kessab","full_name":"إدارة متوسطة لخضر قصاب","email_verified":true}'::jsonb,
      '', '', '', '', '', '', '', '',
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = v_adm_id) THEN
    INSERT INTO public.admins (auth_user_id, username, role, full_name, email, institution_id, rank, department)
    VALUES (v_adm_id, 'admin_kessab', 'viewer', 'إدارة متوسطة لخضر قصاب', 'admin.kessab@q-hudoor.test', v_inst_id, 'إدارة ومراقبة', 'مكتب المراقبة')
    RETURNING id INTO v_adm_admin_id;
  ELSE
    SELECT id INTO v_adm_admin_id FROM public.admins WHERE auth_user_id = v_adm_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_scopes WHERE admin_id = v_adm_admin_id AND unit_id IS NULL AND institution_id = v_inst_id) THEN
    INSERT INTO public.user_scopes (admin_id, institution_id, unit_id, scope_role)
    VALUES (v_adm_admin_id, v_inst_id, NULL, 'viewer');
  END IF;

END
$$;
