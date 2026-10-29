-- ⚠️ DEPRECATED: Demo data now managed by scripts/demo/
-- v2.10.2 — Fix login error for the 3 demo accounts created in v2.10.1.
--
-- Root cause: gotrue (Supabase Auth) Go scanner fails with
--   "converting NULL to string is unsupported"
-- on auth.users columns that are typed varchar but expected to be empty
-- string '' instead of NULL: confirmation_token, recovery_token,
-- email_change_token_new, email_change, email_change_token_current,
-- phone_change, phone_change_token, reauthentication_token.
--
-- Working users created via the Supabase Admin API (e.g. admin_skikda)
-- have these columns as ''. Our manual INSERT in v2_10_1_demo_extra_accounts_skikda
-- left them as NULL. Fix is to coalesce them to ''.
--
-- Safe additive: only updates the 3 demo accounts; idempotent.

UPDATE auth.users
SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change               = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '')
WHERE id IN (
  '11111111-aaaa-4aaa-8aaa-000000000201',
  '22222222-aaaa-4aaa-8aaa-000000000202',
  '33333333-aaaa-4aaa-8aaa-000000000203'
);
