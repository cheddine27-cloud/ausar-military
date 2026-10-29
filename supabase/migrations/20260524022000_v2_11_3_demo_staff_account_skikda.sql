-- ⚠️ DEPRECATED: Demo data now managed by scripts/demo/
-- v2.11.3 — Pre-customer demo: staff account in Skikda for the QA report.

DO $$
DECLARE
  v_inst_id   UUID := '103139b5-3b6a-41a0-a41c-577d0d66e16c';
  v_staff_id  UUID := '44444444-aaaa-4aaa-8aaa-000000000204';
  v_admin_id  UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_staff_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current, phone_change, phone_change_token,
      reauthentication_token,
      created_at, updated_at
    ) VALUES (
      v_staff_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'staff.skikda@q-hudoor.test',
      extensions.crypt('Staff@2026!', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"staff","username":"staff_skikda_demo","full_name":"السكرتاريا — جامعة سكيكدة","email_verified":true}'::jsonb,
      '', '', '', '', '', '', '', '',
      NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = v_staff_id) THEN
    INSERT INTO public.admins (
      auth_user_id, username, role, full_name, email, institution_id, rank, department
    ) VALUES (
      v_staff_id, 'staff_skikda_demo', 'staff', 'السكرتاريا — جامعة سكيكدة',
      'staff.skikda@q-hudoor.test', v_inst_id, 'سكرتارية', 'الإدارة العامة'
    ) RETURNING id INTO v_admin_id;
  ELSE
    SELECT id INTO v_admin_id FROM public.admins WHERE auth_user_id = v_staff_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_scopes
    WHERE admin_id = v_admin_id AND unit_id IS NULL AND institution_id = v_inst_id
  ) THEN
    INSERT INTO public.user_scopes (admin_id, institution_id, unit_id, scope_role)
    VALUES (v_admin_id, v_inst_id, NULL, 'staff');
  END IF;
END
$$;
