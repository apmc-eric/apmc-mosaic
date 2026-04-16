-- Duplicate-company profile merge helper. Source of truth: scripts/014_merge_company_email_alias.sql
-- Must run before 20260410220000_merge_eric_aparentmedia_into_kidoodle.sql (and any script that PERFORMs it).

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
