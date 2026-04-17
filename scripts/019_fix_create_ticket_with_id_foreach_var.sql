-- Fixes typo in deployed `create_ticket_with_id`: `p_support` → `v_support` in the support-assignees loop.
-- Run once in Supabase SQL Editor if ticket submit failed with: column "p_support" does not exist.
-- (Corrected migration: supabase/migrations/20260410221500_tickets_checkpoint_date_timestamptz.sql)

CREATE OR REPLACE FUNCTION public.create_ticket_with_id(
  p_title TEXT,
  p_description TEXT,
  p_urls TEXT[],
  p_team_category TEXT,
  p_project_id UUID,
  p_phase TEXT,
  p_checkpoint_date TIMESTAMPTZ,
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

GRANT EXECUTE ON FUNCTION public.create_ticket_with_id(
  text,
  text,
  text[],
  text,
  uuid,
  text,
  timestamptz,
  text,
  uuid,
  uuid[]
) TO authenticated;
