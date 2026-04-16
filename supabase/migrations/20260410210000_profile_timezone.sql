-- Profile time zones + targeted user updates + merge duplicate Eric account (kidoodle → aparentmedia).
-- Requires public.merge_profile_identity (see scripts/014_merge_company_email_alias.sql).
-- After merge, delete the orphaned auth user for the merged-from id in Supabase Dashboard → Authentication.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT;

UPDATE public.profiles
SET timezone = 'America/Chicago', updated_at = NOW()
WHERE (
  (trim(coalesce(first_name, '')) ILIKE 'sunhee' AND trim(coalesce(last_name, '')) ILIKE 'lee')
  OR (trim(coalesce(name, '')) ILIKE '%sunhee%lee%')
);

UPDATE public.profiles
SET timezone = 'America/Los_Angeles', updated_at = NOW()
WHERE (
  (trim(coalesce(first_name, '')) ILIKE 'brian' AND trim(coalesce(last_name, '')) ILIKE 'lao')
  OR (trim(coalesce(name, '')) ILIKE '%brian%lao%')
);

UPDATE public.profiles
SET timezone = 'Europe/Warsaw', updated_at = NOW()
WHERE trim(coalesce(first_name, '')) ILIKE 'lukasz';

UPDATE public.profiles
SET timezone = 'America/Los_Angeles', updated_at = NOW()
WHERE lower(trim(email)) = 'eric@aparentmedia.com';

DO $$
DECLARE
  from_id uuid;
  to_id uuid;
BEGIN
  SELECT id INTO to_id
  FROM public.profiles
  WHERE lower(trim(email)) = 'eric@aparentmedia.com'
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO from_id
  FROM public.profiles
  WHERE lower(trim(email)) = 'eric@kidoodle.tv'
  ORDER BY created_at ASC
  LIMIT 1;

  IF from_id IS NOT NULL AND to_id IS NOT NULL AND from_id <> to_id THEN
    PERFORM public.merge_profile_identity(from_id, to_id);
  END IF;
END $$;
