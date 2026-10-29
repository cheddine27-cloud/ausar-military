-- ⚠️ DEPRECATED: Demo data now managed by scripts/demo/
-- v2.11.4 — Re-sync demo teacher (taher) password to match docs.

UPDATE auth.users
SET encrypted_password = extensions.crypt('Taher@2026!', extensions.gen_salt('bf')),
    confirmation_token         = COALESCE(confirmation_token, ''),
    recovery_token             = COALESCE(recovery_token, ''),
    email_change_token_new     = COALESCE(email_change_token_new, ''),
    email_change               = COALESCE(email_change, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change               = COALESCE(phone_change, ''),
    phone_change_token         = COALESCE(phone_change_token, ''),
    reauthentication_token     = COALESCE(reauthentication_token, ''),
    updated_at = NOW()
WHERE id = (
  SELECT auth_user_id FROM public.admins WHERE username = 'taher' LIMIT 1
);
