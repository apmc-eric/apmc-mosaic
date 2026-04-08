-- Mosaic: tickets, projects, workspace settings, inspiration_items, saved_items, audit
-- Run after existing schema. Migrates profile role 'user' -> 'designer'.

-- ---------------------------------------------------------------------------
-- Teams: description
-- ---------------------------------------------------------------------------
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT;

-- ---------------------------------------------------------------------------
-- Profiles: name column + expanded roles
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;

-- Drop old role CHECK first (it only allowed user/admin — cannot set designer until dropped)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Map legacy roles, then apply Mosaic roles
UPDATE profiles SET role = 'designer' WHERE role IN ('user', 'member');

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'designer', 'guest', 'collaborator'));

-- ---------------------------------------------------------------------------
-- Workspace settings (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  phase_label_sets JSONB NOT NULL DEFAULT '{}'::jsonb,
  whitelisted_domains TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO workspace_settings (team_categories, phase_label_sets, whitelisted_domains)
SELECT
  '[]'::jsonb,
  '{}'::jsonb,
  COALESCE(
    (SELECT ARRAY(SELECT jsonb_array_elements_text(value)) FROM settings WHERE key = 'allowed_domains'),
    ARRAY[]::text[]
  )
WHERE NOT EXISTS (SELECT 1 FROM workspace_settings LIMIT 1);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  team_access UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ticket_counter INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT projects_abbreviation_upper CHECK (abbreviation = upper(abbreviation) AND char_length(abbreviation) <= 4 AND char_length(abbreviation) >= 1),
  CONSTRAINT projects_abbreviation_unique UNIQUE (abbreviation)
);

CREATE INDEX IF NOT EXISTS idx_projects_team_access ON projects USING gin (team_access);

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  urls TEXT[] DEFAULT ARRAY[]::text[],
  team_category TEXT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  checkpoint_date DATE,
  flag TEXT NOT NULL DEFAULT 'standard',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_project_id ON tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_checkpoint_date ON tickets(checkpoint_date);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);

-- ---------------------------------------------------------------------------
-- Ticket assignees (lead | support)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lead', 'support')),
  UNIQUE (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_ticket ON ticket_assignees(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignees_user ON ticket_assignees(user_id);

-- ---------------------------------------------------------------------------
-- Collaborators (invite by email)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invite_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_collaborators_ticket ON ticket_collaborators(ticket_id);

-- ---------------------------------------------------------------------------
-- Ticket comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ticket ON audit_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log(changed_at DESC);

-- ---------------------------------------------------------------------------
-- Inspiration items (Mosaic feed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspiration_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('url', 'image', 'video')),
  url TEXT,
  file_ref TEXT,
  title TEXT NOT NULL,
  note TEXT,
  thumbnail_url TEXT,
  full_screenshot_url TEXT,
  media_url TEXT,
  submitted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspiration_items_created ON inspiration_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspiration_items_submitted_by ON inspiration_items(submitted_by);

-- ---------------------------------------------------------------------------
-- Saved inspiration (flat list)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  inspiration_item_id UUID NOT NULL REFERENCES inspiration_items(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, inspiration_item_id)
);

-- ---------------------------------------------------------------------------
-- Inspiration comments (separate from legacy post comments)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspiration_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspiration_item_id UUID NOT NULL REFERENCES inspiration_items(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspiration_comments_item ON inspiration_comments(inspiration_item_id);

-- ---------------------------------------------------------------------------
-- Optional: copy legacy posts into inspiration_items (idempotent by skipping if target id exists)
-- ---------------------------------------------------------------------------
INSERT INTO inspiration_items (id, type, url, file_ref, title, note, thumbnail_url, full_screenshot_url, media_url, submitted_by, created_at)
SELECT
  p.id,
  p.type::text,
  p.url,
  NULL,
  p.title,
  p.description,
  p.thumbnail_url,
  p.full_screenshot_url,
  p.media_url,
  p.user_id,
  p.created_at
FROM posts p
WHERE NOT EXISTS (SELECT 1 FROM inspiration_items i WHERE i.id = p.id);

-- ---------------------------------------------------------------------------
-- Create ticket with atomic ticket_id (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_ticket_with_id(
  p_title TEXT,
  p_description TEXT,
  p_urls TEXT[],
  p_team_category TEXT,
  p_project_id UUID,
  p_phase TEXT,
  p_checkpoint_date DATE,
  p_flag TEXT,
  p_lead_id UUID,
  p_support_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_row_id UUID;
  v_display_id TEXT;
  v_counter INT;
  v_abbr TEXT;
  v_support UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE projects
  SET ticket_counter = ticket_counter + 1
  WHERE id = p_project_id
  RETURNING ticket_counter, abbreviation INTO v_counter, v_abbr;

  IF v_abbr IS NULL THEN
    RAISE EXCEPTION 'project not found';
  END IF;

  v_display_id := v_abbr || '-' || lpad(v_counter::text, 4, '0');

  INSERT INTO tickets (
    ticket_id, title, description, urls, team_category, project_id, phase, checkpoint_date, flag, created_by
  ) VALUES (
    v_display_id,
    p_title,
    p_description,
    COALESCE(p_urls, ARRAY[]::text[]),
    p_team_category,
    p_project_id,
    p_phase,
    p_checkpoint_date,
    COALESCE(NULLIF(trim(p_flag), ''), 'standard'),
    auth.uid()
  )
  RETURNING id INTO v_ticket_row_id;

  INSERT INTO ticket_assignees (ticket_id, user_id, role)
  VALUES (v_ticket_row_id, p_lead_id, 'lead');

  IF p_support_ids IS NOT NULL THEN
    FOREACH v_support IN ARRAY p_support_ids
    LOOP
      IF v_support IS NOT NULL AND v_support <> p_lead_id THEN
        INSERT INTO ticket_assignees (ticket_id, user_id, role)
        VALUES (v_ticket_row_id, v_support, 'support')
        ON CONFLICT (ticket_id, user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_ticket_row_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- New user: guest if email domain whitelisted, else designer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_domain TEXT;
  use_guest BOOLEAN;
BEGIN
  email_domain := lower(split_part(NEW.email, '@', 2));

  SELECT EXISTS (
    SELECT 1
    FROM workspace_settings ws
    CROSS JOIN LATERAL unnest(ws.whitelisted_domains) AS u(domain)
    WHERE lower(trim(u.domain)) = email_domain
    LIMIT 1
  ) INTO use_guest;

  INSERT INTO public.profiles (id, email, first_name, last_name, name, avatar_url, role, is_active, onboarding_complete)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(trim(
      COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' ||
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    ), ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    CASE WHEN COALESCE(use_guest, false) THEN 'guest' ELSE 'designer' END,
    true,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
