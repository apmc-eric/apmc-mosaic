CREATE POLICY "workspace_settings_select_auth" ON workspace_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "workspace_settings_update_admin" ON workspace_settings FOR UPDATE TO authenticated USING (public.is_admin());
