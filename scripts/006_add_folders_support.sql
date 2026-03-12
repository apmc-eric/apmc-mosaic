-- Add folders support for organizing favorites (Pinterest-style)

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user's folders
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

-- Add folder_id to favorites table (nullable for backwards compatibility)
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Create index for folder lookups
CREATE INDEX IF NOT EXISTS idx_favorites_folder_id ON favorites(folder_id);

-- Enable RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folders
CREATE POLICY "folders_select_own" ON folders
  FOR SELECT USING (
    auth.uid() = user_id OR is_private = false
  );

CREATE POLICY "folders_insert_own" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "folders_update_own" ON folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "folders_delete_own" ON folders
  FOR DELETE USING (auth.uid() = user_id);
