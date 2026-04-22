-- Seed allowed_emails setting (array of {username, first_name, last_name, role} objects)
-- username = local part of email (before @); both company domains are accepted on sign-in.
INSERT INTO settings (key, value)
VALUES ('allowed_emails', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Update handle_new_user trigger:
-- 1. Match new user by email local part against allowed_emails entries.
-- 2. Pre-assign role, first_name, last_name from the allowlist entry if found.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry JSONB;
  predefined_role TEXT;
  predefined_first TEXT;
  predefined_last  TEXT;
  email_local      TEXT;
BEGIN
  email_local := lower(split_part(NEW.email, '@', 1));

  SELECT elem
  INTO entry
  FROM settings,
       jsonb_array_elements(value) AS elem
  WHERE key = 'allowed_emails'
    AND lower(trim(elem->>'username')) = email_local
  LIMIT 1;

  predefined_role  := COALESCE(entry->>'role', 'designer');
  predefined_first := COALESCE(NULLIF(trim(entry->>'first_name'), ''), NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), ''), '');
  predefined_last  := COALESCE(NULLIF(trim(entry->>'last_name'),  ''), NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'last_name',  '')), ''), '');

  INSERT INTO public.profiles (id, email, first_name, last_name, name, avatar_url, role, is_active, onboarding_complete)
  VALUES (
    NEW.id,
    NEW.email,
    predefined_first,
    predefined_last,
    NULLIF(trim(predefined_first || ' ' || predefined_last), ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    predefined_role,
    true,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
