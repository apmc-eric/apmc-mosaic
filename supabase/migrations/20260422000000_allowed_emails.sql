-- Seed allowed_emails setting (array of {email, role} objects)
INSERT INTO settings (key, value)
VALUES ('allowed_emails', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Update handle_new_user trigger: assign role from allowed_emails list at signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  predefined_role TEXT;
BEGIN
  SELECT elem->>'role'
  INTO predefined_role
  FROM settings,
       jsonb_array_elements(value) AS elem
  WHERE key = 'allowed_emails'
    AND lower(trim(elem->>'email')) = lower(trim(NEW.email))
  LIMIT 1;

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
    COALESCE(predefined_role, 'designer'),
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
