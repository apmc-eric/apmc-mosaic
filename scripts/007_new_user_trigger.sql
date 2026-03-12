-- Fix: Add trigger to auto-create a profile row when a new auth user signs up.
-- Without this, Supabase returns "Database error saving new user" because the
-- profiles_insert_own RLS policy blocks any insert not coming from the user themselves,
-- and there is no row yet for new signups.

-- Function that runs as SECURITY DEFINER (bypasses RLS) to insert the profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url, role, is_active, onboarding_complete)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'user',
    true,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists (safe re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Fire after every new auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
