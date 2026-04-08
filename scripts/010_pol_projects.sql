CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (
  public.is_admin()
  OR public.profile_role() = 'guest'
  OR EXISTS (
    SELECT 1 FROM user_teams ut
    WHERE ut.user_id::text = (SELECT auth.uid())::text
      AND ut.team_id::text IN (SELECT unnest(COALESCE(projects.team_access, ARRAY[]::uuid[]))::text)
  )
);
CREATE POLICY "projects_insert_admin" ON projects FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "projects_update_admin" ON projects FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "projects_delete_admin" ON projects FOR DELETE TO authenticated USING (public.is_admin());
