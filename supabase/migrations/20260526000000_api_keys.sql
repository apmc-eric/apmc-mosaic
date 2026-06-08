-- API keys for external / programmatic access to the v1 REST API.
-- Keys are stored as SHA-256 hashes; the plaintext is returned once on creation.

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  key_hash     TEXT        NOT NULL UNIQUE,
  key_prefix   TEXT        NOT NULL,         -- first 12 chars shown in the UI
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Owners can view and delete their own keys.
-- Inserts / updates are handled by the service-role client in the API route.
CREATE POLICY "api_keys: owner select"
  ON api_keys FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "api_keys: owner delete"
  ON api_keys FOR DELETE
  USING (profile_id = auth.uid());
