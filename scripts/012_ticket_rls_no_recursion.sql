-- Break tickets <-> ticket_assignees RLS recursion:
-- tickets_select referenced ticket_assignees; ticket_assignees_select referenced tickets.
-- This SECURITY DEFINER helper reads tickets/assignees/collaborators with row_security off
-- so nested checks do not re-enter policies (PostgreSQL 15+).

CREATE OR REPLACE FUNCTION public.ticket_visible_to_reader(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tickets t
    WHERE t.id = p_ticket_id
      AND (
        public.is_admin()
        OR (
          public.profile_role() = 'guest'
          AND t.created_by::text = (SELECT auth.uid())::text
        )
        OR (
          public.profile_role() IS NOT NULL
          AND public.profile_role() <> 'guest'
          AND (
            t.created_by::text = (SELECT auth.uid())::text
            OR public.can_access_project(t.project_id)
            OR EXISTS (
              SELECT 1 FROM ticket_assignees ta
              WHERE ta.ticket_id = t.id AND ta.user_id::text = (SELECT auth.uid())::text
            )
            OR EXISTS (
              SELECT 1 FROM ticket_collaborators tc
              WHERE tc.ticket_id = t.id
                AND tc.user_id::text = (SELECT auth.uid())::text
                AND tc.status = 'accepted'
            )
          )
        )
      )
  );
$$;

DROP POLICY IF EXISTS "tickets_select" ON tickets;
CREATE POLICY "tickets_select" ON tickets FOR SELECT TO authenticated USING (public.ticket_visible_to_reader(id));

DROP POLICY IF EXISTS "ticket_assignees_select" ON ticket_assignees;
CREATE POLICY "ticket_assignees_select" ON ticket_assignees FOR SELECT TO authenticated USING (
  public.ticket_visible_to_reader(ticket_assignees.ticket_id)
);

DROP POLICY IF EXISTS "ticket_collaborators_select" ON ticket_collaborators;
CREATE POLICY "ticket_collaborators_select" ON ticket_collaborators FOR SELECT TO authenticated USING (
  public.ticket_visible_to_reader(ticket_collaborators.ticket_id)
);

DROP POLICY IF EXISTS "ticket_comments_select" ON ticket_comments;
CREATE POLICY "ticket_comments_select" ON ticket_comments FOR SELECT TO authenticated USING (
  public.ticket_visible_to_reader(ticket_comments.ticket_id)
);

DROP POLICY IF EXISTS "ticket_comments_insert" ON ticket_comments;
CREATE POLICY "ticket_comments_insert" ON ticket_comments FOR INSERT TO authenticated WITH CHECK (
  author_id::text = (SELECT auth.uid())::text
  AND public.ticket_visible_to_reader(ticket_comments.ticket_id)
);

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO authenticated USING (
  public.ticket_visible_to_reader(audit_log.ticket_id)
);

DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (
  changed_by::text = (SELECT auth.uid())::text
  AND public.ticket_visible_to_reader(audit_log.ticket_id)
);

GRANT EXECUTE ON FUNCTION public.ticket_visible_to_reader(uuid) TO authenticated;
