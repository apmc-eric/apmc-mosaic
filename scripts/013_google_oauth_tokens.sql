-- Google OAuth tokens for Calendar API access
-- Stores per-user Google access/refresh tokens for server-side Calendar API calls.
-- Run: pnpm migrate scripts/013_google_oauth_tokens.sql

CREATE TABLE IF NOT EXISTS user_google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_google_tokens_user_id_key UNIQUE (user_id)
);

ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read and write their own token row
CREATE POLICY "users_own_google_token"
  ON user_google_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
