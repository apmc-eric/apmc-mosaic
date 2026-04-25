-- Service-role callable variant of create_ticket_with_id for the Slack integration.
-- Takes p_created_by instead of relying on auth.uid() so it can be called without a session.

CREATE OR REPLACE FUNCTION public.create_ticket_from_slack(
  p_title           TEXT,
  p_description     TEXT,
  p_urls            TEXT[],
  p_team_category   TEXT,
  p_project_id      UUID,
  p_phase           TEXT,
  p_checkpoint_date  TIMESTAMPTZ,
  p_availability_date TIMESTAMPTZ,
  p_flag            TEXT,
  p_created_by      UUID,
  p_lead_id         UUID,
  p_support_ids     UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_row_id UUID;
  v_display_id    TEXT;
  v_counter       INT;
  v_abbr          TEXT;
  v_support       UUID;
BEGIN
  UPDATE projects
  SET ticket_counter = ticket_counter + 1
  WHERE id = p_project_id
  RETURNING ticket_counter, abbreviation INTO v_counter, v_abbr;

  IF v_abbr IS NULL THEN
    RAISE EXCEPTION 'project not found: %', p_project_id;
  END IF;

  v_display_id := v_abbr || '-' || lpad(v_counter::text, 4, '0');

  INSERT INTO tickets (
    ticket_id, title, description, urls, team_category,
    project_id, phase, checkpoint_date, availability_date,
    flag, created_by
  ) VALUES (
    v_display_id,
    p_title,
    p_description,
    COALESCE(p_urls, ARRAY[]::text[]),
    p_team_category,
    p_project_id,
    COALESCE(NULLIF(trim(p_phase), ''), 'Triage'),
    p_checkpoint_date,
    p_availability_date,
    COALESCE(NULLIF(trim(p_flag), ''), 'standard'),
    p_created_by
  )
  RETURNING id INTO v_ticket_row_id;

  IF p_lead_id IS NOT NULL THEN
    INSERT INTO ticket_assignees (ticket_id, user_id, role)
    VALUES (v_ticket_row_id, p_lead_id, 'lead');
  END IF;

  IF p_support_ids IS NOT NULL THEN
    FOREACH v_support IN ARRAY p_support_ids
    LOOP
      IF v_support IS NOT NULL AND (p_lead_id IS NULL OR v_support <> p_lead_id) THEN
        INSERT INTO ticket_assignees (ticket_id, user_id, role)
        VALUES (v_ticket_row_id, v_support, 'support')
        ON CONFLICT (ticket_id, user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_ticket_row_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ticket_from_slack(
  text, text, text[], text, uuid, text, timestamptz, timestamptz, text, uuid, uuid, uuid[]
) TO service_role;
