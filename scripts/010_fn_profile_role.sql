CREATE OR REPLACE FUNCTION public.profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM profiles WHERE id::text = (SELECT auth.uid())::text LIMIT 1;
$$;
