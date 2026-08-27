-- Close two production authorization gaps without changing user identifiers or
-- business data. Safe to run repeatedly on the shared Supabase database.

BEGIN;

ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户只能更新自己的等级" ON public.user_tiers;
DROP POLICY IF EXISTS "用户不能修改自己的等级" ON public.user_tiers;
DROP POLICY IF EXISTS user_tiers_self_update ON public.user_tiers;
DROP POLICY IF EXISTS user_tiers_admin_all ON public.user_tiers;

REVOKE INSERT, UPDATE, DELETE ON public.user_tiers FROM anon, authenticated;
GRANT SELECT ON public.user_tiers TO authenticated;

ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可以查看自己的申请" ON public.registration_requests;
DROP POLICY IF EXISTS select_requests ON public.registration_requests;
DROP POLICY IF EXISTS registration_requests_self_select ON public.registration_requests;

REVOKE SELECT, UPDATE, DELETE ON public.registration_requests FROM anon, authenticated;
GRANT INSERT ON public.registration_requests TO anon, authenticated;
GRANT SELECT ON public.registration_requests TO authenticated;

CREATE POLICY registration_requests_self_select
  ON public.registration_requests
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')));

CREATE OR REPLACE FUNCTION public.hs_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tiers
    WHERE user_id = auth.uid()
      AND tier IN ('admin', 'owner')
  );
$function$;

REVOKE ALL ON FUNCTION public.hs_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hs_is_admin() TO anon, authenticated;

COMMIT;
