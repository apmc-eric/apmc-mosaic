-- Add superadmin emails to settings
-- These users will automatically be assigned admin role on signup

INSERT INTO settings (key, value) VALUES 
  ('superadmin_emails', '["eric@aparentmedia.com", "eric@kidoodle.tv"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = '["eric@aparentmedia.com", "eric@kidoodle.tv"]'::jsonb;

-- Update the signup trigger to check for superadmin emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  superadmin_emails JSONB;
  is_superadmin BOOLEAN := FALSE;
  user_role TEXT := 'member';
BEGIN
  -- Get count of existing profiles
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- Get superadmin emails from settings
  SELECT value INTO superadmin_emails FROM settings WHERE key = 'superadmin_emails';
  
  -- Check if new user's email is in superadmin list
  IF superadmin_emails IS NOT NULL AND superadmin_emails ? new.email THEN
    is_superadmin := TRUE;
    user_role := 'admin';
  -- First user is always admin
  ELSIF user_count = 0 THEN
    user_role := 'admin';
  END IF;
  
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    new.id,
    new.email,
    user_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE 
      WHEN is_superadmin THEN 'admin'
      ELSE profiles.role
    END;

  RETURN new;
END;
$$;
