-- Merge **eric@aparentmedia.com** → **eric@kidoodle.tv** (Google Sign-In is the surviving account).
-- Uses exact email matches only (no `eric.sin` / fuzzy `LIKE '%eric%'` — those can pick the wrong row).
--
-- BEFORE running, inspect rows (paste in SQL editor):
--   SELECT id, email, role, created_at
--   FROM public.profiles
--   WHERE lower(trim(email)) IN ('eric@kidoodle.tv', 'eric@aparentmedia.com')
--   ORDER BY email, created_at;
--
-- You must see **two** rows: one per email. If `eric@aparentmedia.com` is missing, that data is already
-- gone from `profiles` (merge may have run earlier in the other direction) — restore from backup or
-- re-link data manually.
--
-- **`public.merge_profile_identity`** is defined below (same as `scripts/014_merge_company_email_alias.sql`)
-- so this file runs in one paste even if that migration was never applied.
--
-- Adds **`profiles.timezone`** if missing (avoids `column "timezone" does not exist` when 017 / timezone
-- migration was not applied yet).
--
-- After success:
--   1. Sign in as **eric@kidoodle.tv** (OAuth or dev login with that exact email).
--   2. Delete the orphaned **auth.users** row for **eric@aparentmedia.com** in Dashboard → Authentication.

CREATE OR REPLACE FUNCTION public.merge_profile_identity(from_id uuid, to_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF from_id IS NULL OR to_id IS NULL OR from_id = to_id THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = from_id) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = to_id) THEN
    RETURN;
  END IF;

  DELETE FROM public.ticket_assignees ta
  WHERE ta.user_id = from_id
    AND EXISTS (
      SELECT 1 FROM public.ticket_assignees x
      WHERE x.ticket_id = ta.ticket_id AND x.user_id = to_id
    );
  UPDATE public.ticket_assignees SET user_id = to_id WHERE user_id = from_id;

  DELETE FROM public.saved_items sa
  WHERE sa.user_id = from_id
    AND EXISTS (
      SELECT 1 FROM public.saved_items x
      WHERE x.inspiration_item_id = sa.inspiration_item_id AND x.user_id = to_id
    );
  UPDATE public.saved_items SET user_id = to_id WHERE user_id = from_id;

  DELETE FROM public.favorites fa
  WHERE fa.user_id = from_id
    AND EXISTS (
      SELECT 1 FROM public.favorites x
      WHERE x.post_id = fa.post_id AND x.user_id = to_id
    );
  UPDATE public.favorites SET user_id = to_id WHERE user_id = from_id;

  UPDATE public.posts SET user_id = to_id WHERE user_id = from_id;
  UPDATE public.comments SET user_id = to_id WHERE user_id = from_id;
  UPDATE public.saved_views SET user_id = to_id WHERE user_id = from_id;

  UPDATE public.tickets SET created_by = to_id WHERE created_by = from_id;
  UPDATE public.ticket_collaborators SET user_id = to_id WHERE user_id = from_id;
  UPDATE public.ticket_comments SET author_id = to_id WHERE author_id = from_id;
  UPDATE public.audit_log SET changed_by = to_id WHERE changed_by = from_id;

  UPDATE public.inspiration_items SET submitted_by = to_id WHERE submitted_by = from_id;
  UPDATE public.inspiration_comments SET author_id = to_id WHERE author_id = from_id;

  DELETE FROM public.user_teams ut
  WHERE ut.user_id = from_id
    AND EXISTS (
      SELECT 1 FROM public.user_teams x
      WHERE x.team_id = ut.team_id AND x.user_id = to_id
    );
  UPDATE public.user_teams SET user_id = to_id WHERE user_id = from_id;

  IF to_regclass('public.user_google_tokens') IS NOT NULL THEN
    DELETE FROM public.user_google_tokens WHERE user_id = from_id
      AND EXISTS (SELECT 1 FROM public.user_google_tokens WHERE user_id = to_id);
    UPDATE public.user_google_tokens SET user_id = to_id WHERE user_id = from_id;
  END IF;

  UPDATE public.folders SET user_id = to_id WHERE user_id = from_id;

  UPDATE public.profiles t
  SET
    first_name = COALESCE(NULLIF(TRIM(t.first_name), ''), (SELECT NULLIF(TRIM(f.first_name), '') FROM public.profiles f WHERE f.id = from_id)),
    last_name = COALESCE(NULLIF(TRIM(t.last_name), ''), (SELECT NULLIF(TRIM(f.last_name), '') FROM public.profiles f WHERE f.id = from_id)),
    name = COALESCE(NULLIF(TRIM(t.name), ''), (SELECT NULLIF(TRIM(f.name), '') FROM public.profiles f WHERE f.id = from_id)),
    avatar_url = COALESCE(NULLIF(TRIM(t.avatar_url), ''), (SELECT NULLIF(TRIM(f.avatar_url), '') FROM public.profiles f WHERE f.id = from_id)),
    role = CASE
      WHEN t.role = 'admin' OR (SELECT f.role FROM public.profiles f WHERE f.id = from_id) = 'admin' THEN 'admin'
      ELSE t.role
    END,
    onboarding_complete = t.onboarding_complete OR (SELECT f.onboarding_complete FROM public.profiles f WHERE f.id = from_id),
    email = CASE
      WHEN lower(t.email) LIKE '%@aparentmedia.com' THEN t.email
      WHEN EXISTS (
        SELECT 1 FROM public.profiles f
        WHERE f.id = from_id AND lower(f.email) LIKE '%@aparentmedia.com'
      ) THEN (
        SELECT f.email FROM public.profiles f
        WHERE f.id = from_id AND lower(f.email) LIKE '%@aparentmedia.com'
        LIMIT 1
      )
      ELSE t.email
    END,
    updated_at = NOW()
  WHERE t.id = to_id;

  DELETE FROM public.profiles WHERE id = from_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_profile_identity(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_profile_identity(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.merge_profile_identity(uuid, uuid) IS
  'Reassigns all app FKs from duplicate profile from_id to to_id, merges profile fields, deletes from_id profile. Caller deletes auth user from_id via Admin API.';

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
    RAISE EXCEPTION
      'merge_018: No profile with email exactly eric@kidoodle.tv (check spelling and run the diagnostic SELECT above).';
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

  RAISE NOTICE 'merge_018: merge_profile_identity(from=%, aparentmedia) → (to=%, kidoodle) | restore email %',
    ap_id, kd_id, kd_email;

  PERFORM public.merge_profile_identity(ap_id, kd_id);

  UPDATE public.profiles t
  SET
    email = kd_email,
    timezone = COALESCE(NULLIF(trim(t.timezone), ''), ap_tz),
    updated_at = NOW()
  WHERE t.id = kd_id;

  RAISE NOTICE 'merge_018: done. Survivor profile id=% email=%', kd_id, kd_email;
END $$;
