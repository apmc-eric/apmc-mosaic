-- Enable Row Level Security on all tables
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Settings policies (read all, write admin only)
CREATE POLICY "settings_select_all" ON settings FOR SELECT USING (true);
CREATE POLICY "settings_insert_admin" ON settings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "settings_update_admin" ON settings FOR UPDATE USING (is_admin());
CREATE POLICY "settings_delete_admin" ON settings FOR DELETE USING (is_admin());

-- Teams policies (read all, write admin only)
CREATE POLICY "teams_select_all" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_insert_admin" ON teams FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "teams_update_admin" ON teams FOR UPDATE USING (is_admin());
CREATE POLICY "teams_delete_admin" ON teams FOR DELETE USING (is_admin());

-- Profiles policies
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE USING (is_admin());

-- Tags policies (read all, write admin only)
CREATE POLICY "tags_select_all" ON tags FOR SELECT USING (true);
CREATE POLICY "tags_insert_admin" ON tags FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "tags_update_admin" ON tags FOR UPDATE USING (is_admin());
CREATE POLICY "tags_delete_admin" ON tags FOR DELETE USING (is_admin());

-- Posts policies (read all active user posts, write own)
CREATE POLICY "posts_select_all" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_own" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update_own" ON posts FOR UPDATE USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "posts_delete_own" ON posts FOR DELETE USING (auth.uid() = user_id OR is_admin());

-- Post tags policies
CREATE POLICY "post_tags_select_all" ON post_tags FOR SELECT USING (true);
CREATE POLICY "post_tags_insert_own" ON post_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM posts WHERE id = post_id AND user_id = auth.uid())
);
CREATE POLICY "post_tags_delete_own" ON post_tags FOR DELETE USING (
  EXISTS (SELECT 1 FROM posts WHERE id = post_id AND user_id = auth.uid()) OR is_admin()
);

-- Favorites policies (user manages own)
CREATE POLICY "favorites_select_own" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites_insert_own" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete_own" ON favorites FOR DELETE USING (auth.uid() = user_id);

-- Comments policies (read all, write own)
CREATE POLICY "comments_select_all" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_own" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON comments FOR DELETE USING (auth.uid() = user_id OR is_admin());

-- Saved views policies (user manages own)
CREATE POLICY "saved_views_select_own" ON saved_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_views_insert_own" ON saved_views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_views_update_own" ON saved_views FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "saved_views_delete_own" ON saved_views FOR DELETE USING (auth.uid() = user_id);
