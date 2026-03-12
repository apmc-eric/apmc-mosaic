-- Create user_teams junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS user_teams (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, team_id)
);

-- Enable RLS
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_teams
CREATE POLICY "user_teams_select_all" ON user_teams
  FOR SELECT USING (true);

CREATE POLICY "user_teams_insert_own" ON user_teams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_teams_delete_own" ON user_teams
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "user_teams_admin_manage" ON user_teams
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Migrate existing team assignments from profiles.team_id to user_teams
INSERT INTO user_teams (user_id, team_id)
SELECT id, team_id FROM profiles WHERE team_id IS NOT NULL
ON CONFLICT DO NOTHING;
