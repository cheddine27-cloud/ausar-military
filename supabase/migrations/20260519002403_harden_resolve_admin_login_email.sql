-- Issue 2: SECURITY DEFINER function callable by anon
-- `public.resolve_admin_login_email` is intentionally callable by anon, because
-- the client needs to translate a username into the auth email BEFORE
-- signing in. Switching it to SECURITY INVOKER would break login since anon
-- cannot read public.admins (RLS).
--
-- We harden the function in three ways:
--   (a) Keep SECURITY DEFINER but make `search_path` resistant to hijacking.
--   (b) Reject obviously malformed input early (length / characters), to
--       reduce enumeration attempts via fuzzing.
--   (c) Document the intentional exposure with a COMMENT.

CREATE OR REPLACE FUNCTION public.resolve_admin_login_email(login_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  ident text;
  v_email text;
BEGIN
  ident := lower(trim(coalesce(login_identifier, '')));

  -- Basic sanity: usernames/emails should be 3..254 chars.
  IF length(ident) < 3 OR length(ident) > 254 THEN
    RETURN NULL;
  END IF;

  -- Allow only safe characters (letters, digits, dot, underscore, hyphen, plus, @).
  IF ident !~ '^[a-z0-9._+\-@]+$' THEN
    RETURN NULL;
  END IF;

  SELECT email
    INTO v_email
  FROM public.admins
  WHERE lower(username) = ident
     OR lower(email) = ident
  LIMIT 1;

  RETURN v_email;
END;
$function$;

COMMENT ON FUNCTION public.resolve_admin_login_email(text) IS
  'Login helper: resolves a username/email identifier to the auth email used by Supabase Auth. Intentionally SECURITY DEFINER and callable by anon so the sign-in flow can translate username -> email before signInWithPassword. Hardened with input validation. Lint 0028 is acknowledged as intentional.';

REVOKE ALL ON FUNCTION public.resolve_admin_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_admin_login_email(text) TO anon, authenticated, service_role;
