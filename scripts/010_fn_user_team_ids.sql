CREATE OR REPLACE FUNCTION public.user_team_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(ut.team_id), ARRAY[]::uuid[])
  FROM user_teams ut
  WHERE ut.user_id::text = (SELECT auth.uid())::text;
$$;
