CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM projects p
    JOIN user_teams ut ON ut.user_id::text = (SELECT auth.uid())::text
    WHERE p.id = p_project_id
      AND ut.team_id::text IN (SELECT unnest(COALESCE(p.team_access, ARRAY[]::uuid[]))::text)
  )
  OR public.is_admin();
$$;
