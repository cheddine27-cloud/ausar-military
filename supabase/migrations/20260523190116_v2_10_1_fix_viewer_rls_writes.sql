-- v2.10.1 — RLS hardening: viewer must never gain write access via institution-wide scope.
--
-- Discovered during pre-customer demo verification: `is_unrestricted_in_institution()`
-- treated any user_scopes row with unit_id IS NULL as "unrestricted manager", even
-- when scope_role = 'viewer'. Mirroring the safer logic already used in
-- `user_can_manage_unit()`, we now exclude viewers from the unrestricted check.
--
-- This is a SAFE additive bug fix on a defense-in-depth helper. It does not change
-- legitimate manager (institution_admin / institution_owner) behavior, only blocks
-- viewer write attempts. No table writes are touched. No INSERT/UPDATE/DELETE
-- policies on any table are altered.

CREATE OR REPLACE FUNCTION private.is_unrestricted_in_institution(target_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    private.is_super_admin()
    OR (
      private.current_admin_role() IN ('institution_owner', 'institution_admin')
      AND private.current_admin_institution_id() = target_institution_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_scopes us
      WHERE us.admin_id = private.current_admin_id()
        AND us.institution_id = target_institution_id
        AND us.unit_id IS NULL
        AND us.scope_role <> 'viewer'
    )
$function$;
