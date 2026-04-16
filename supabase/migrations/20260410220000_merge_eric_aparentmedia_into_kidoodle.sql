-- Merge eric@aparentmedia.com → eric@kidoodle.tv (exact emails). See scripts/018_merge_eric_aparentmedia_into_kidoodle.sql for comments + diagnostics.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT;

DO $$
DECLARE
  ap_id uuid;
  kd_id uuid;
  kd_email text;
  ap_tz text;
BEGIN
  SELECT id, email INTO kd_id, kd_email
  FROM public.profiles
  WHERE lower(trim(email)) = 'eric@kidoodle.tv'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO ap_id
  FROM public.profiles
  WHERE lower(trim(email)) = 'eric@aparentmedia.com'
  ORDER BY created_at ASC
  LIMIT 1;

  IF kd_id IS NULL THEN
    RAISE EXCEPTION 'merge_018: No profile with email exactly eric@kidoodle.tv';
  END IF;

  IF ap_id IS NULL THEN
    RAISE NOTICE 'merge_018: No profile with email exactly eric@aparentmedia.com — nothing to merge.';
    RETURN;
  END IF;

  IF ap_id = kd_id THEN
    RAISE NOTICE 'merge_018: Same profile id — skip.';
    RETURN;
  END IF;

  ap_tz := (SELECT timezone FROM public.profiles WHERE id = ap_id);

  PERFORM public.merge_profile_identity(ap_id, kd_id);

  UPDATE public.profiles t
  SET
    email = kd_email,
    timezone = COALESCE(NULLIF(trim(t.timezone), ''), ap_tz),
    updated_at = NOW()
  WHERE t.id = kd_id;
END $$;
