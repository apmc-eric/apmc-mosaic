-- Add full-page screenshot URL for link inspo (shown in detail view)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS full_screenshot_url TEXT;
