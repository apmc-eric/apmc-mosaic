-- Mosaic RLS (run after 009_mosaic_core.sql)

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspiration_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspiration_comments ENABLE ROW LEVEL SECURITY;

-- Idempotent: safe to re-run after partial applies
DROP POLICY IF EXISTS "workspace_settings_select_auth" ON workspace_settings;
DROP POLICY IF EXISTS "workspace_settings_update_admin" ON workspace_settings;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert_admin" ON projects;
DROP POLICY IF EXISTS "projects_update_admin" ON projects;
DROP POLICY IF EXISTS "projects_delete_admin" ON projects;
DROP POLICY IF EXISTS "tickets_select" ON tickets;
DROP POLICY IF EXISTS "tickets_insert" ON tickets;
DROP POLICY IF EXISTS "tickets_update" ON tickets;
DROP POLICY IF EXISTS "tickets_delete" ON tickets;
DROP POLICY IF EXISTS "ticket_assignees_select" ON ticket_assignees;
DROP POLICY IF EXISTS "ticket_assignees_write" ON ticket_assignees;
DROP POLICY IF EXISTS "ticket_assignees_insert" ON ticket_assignees;
DROP POLICY IF EXISTS "ticket_assignees_update" ON ticket_assignees;
DROP POLICY IF EXISTS "ticket_assignees_delete" ON ticket_assignees;
DROP POLICY IF EXISTS "ticket_collaborators_select" ON ticket_collaborators;
DROP POLICY IF EXISTS "ticket_collaborators_write" ON ticket_collaborators;
DROP POLICY IF EXISTS "ticket_collaborators_update" ON ticket_collaborators;
DROP POLICY IF EXISTS "ticket_collaborators_delete" ON ticket_collaborators;
DROP POLICY IF EXISTS "ticket_comments_select" ON ticket_comments;
DROP POLICY IF EXISTS "ticket_comments_insert" ON ticket_comments;
DROP POLICY IF EXISTS "ticket_comments_update" ON ticket_comments;
DROP POLICY IF EXISTS "ticket_comments_delete" ON ticket_comments;
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
DROP POLICY IF EXISTS "inspiration_items_select" ON inspiration_items;
DROP POLICY IF EXISTS "inspiration_items_insert" ON inspiration_items;
DROP POLICY IF EXISTS "inspiration_items_update" ON inspiration_items;
DROP POLICY IF EXISTS "inspiration_items_delete" ON inspiration_items;
DROP POLICY IF EXISTS "saved_items_select" ON saved_items;
DROP POLICY IF EXISTS "saved_items_insert" ON saved_items;
DROP POLICY IF EXISTS "saved_items_delete" ON saved_items;
DROP POLICY IF EXISTS "inspiration_comments_select" ON inspiration_comments;
DROP POLICY IF EXISTS "inspiration_comments_insert" ON inspiration_comments;
DROP POLICY IF EXISTS "inspiration_comments_update" ON inspiration_comments;
DROP POLICY IF EXISTS "inspiration_comments_delete" ON inspiration_comments;

-- Align with Mosaic policies: avoid uuid = text when auth.uid() is text in some contexts
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id::text = (SELECT auth.uid())::text AND profiles.role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_team_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(ut.team_id), ARRAY[]::uuid[])
  FROM user_teams ut
  WHERE ut.user_id::text = (SELECT auth.uid())::text;
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM projects p
    JOIN user_teams ut ON ut.user_id::text = (SELECT auth.uid())::text
    WHERE p.id = p_project_id
      AND ut.team_id::text IN (SELECT unnest(COALESCE(p.team_access, ARRAY[]::uuid[]))::text)
  )
  OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM profiles WHERE id::text = (SELECT auth.uid())::text LIMIT 1;
$$;

-- Avoid tickets <-> ticket_assignees RLS infinite recursion (each policy queried the other table).
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

-- workspace_settings
CREATE POLICY "workspace_settings_select_auth" ON workspace_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "workspace_settings_update_admin" ON workspace_settings FOR UPDATE TO authenticated USING (public.is_admin());

-- projects (guests can read all projects for submission dropdowns)
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (
  public.is_admin()
  OR public.profile_role() = 'guest'
  OR EXISTS (
    SELECT 1 FROM user_teams ut
    WHERE ut.user_id::text = (SELECT auth.uid())::text
      AND ut.team_id::text IN (SELECT unnest(COALESCE(projects.team_access, ARRAY[]::uuid[]))::text)
  )
);
CREATE POLICY "projects_insert_admin" ON projects FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "projects_update_admin" ON projects FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "projects_delete_admin" ON projects FOR DELETE TO authenticated USING (public.is_admin());

-- tickets (visibility via helper — avoids recursion with ticket_assignees_select)
CREATE POLICY "tickets_select" ON tickets FOR SELECT TO authenticated USING (public.ticket_visible_to_reader(id));

CREATE POLICY "tickets_insert" ON tickets FOR INSERT TO authenticated WITH CHECK (
  created_by::text = (SELECT auth.uid())::text
  AND (
    public.is_admin()
    OR public.profile_role() = 'guest'
    OR public.can_access_project(project_id)
  )
);

CREATE POLICY "tickets_update" ON tickets FOR UPDATE TO authenticated USING (
  public.is_admin()
  OR created_by::text = (SELECT auth.uid())::text
  OR EXISTS (
    SELECT 1 FROM ticket_assignees ta
    WHERE ta.ticket_id = tickets.id AND ta.user_id::text = (SELECT auth.uid())::text AND ta.role = 'lead'
  )
  OR EXISTS (
    SELECT 1 FROM ticket_assignees ta
    WHERE ta.ticket_id = tickets.id AND ta.user_id::text = (SELECT auth.uid())::text AND ta.role = 'support'
  )
);

CREATE POLICY "tickets_delete" ON tickets FOR DELETE TO authenticated USING (
  public.is_admin() OR created_by::text = (SELECT auth.uid())::text
);

-- ticket_assignees (qualify ticket_id: tickets.ticket_id is TEXT display id, not FK uuid)
CREATE POLICY "ticket_assignees_select" ON ticket_assignees FOR SELECT TO authenticated USING (
  public.ticket_visible_to_reader(ticket_assignees.ticket_id)
);

CREATE POLICY "ticket_assignees_insert" ON ticket_assignees FOR INSERT TO authenticated WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_assignees.ticket_id AND (t.created_by::text = (SELECT auth.uid())::text OR public.can_access_project(t.project_id))
  )
);
CREATE POLICY "ticket_assignees_update" ON ticket_assignees FOR UPDATE TO authenticated USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_assignees.ticket_id AND (t.created_by::text = (SELECT auth.uid())::text OR public.can_access_project(t.project_id))
  )
);
CREATE POLICY "ticket_assignees_delete" ON ticket_assignees FOR DELETE TO authenticated USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_assignees.ticket_id AND (t.created_by::text = (SELECT auth.uid())::text OR public.can_access_project(t.project_id))
  )
);

-- ticket_collaborators
CREATE POLICY "ticket_collaborators_select" ON ticket_collaborators FOR SELECT TO authenticated USING (
  public.ticket_visible_to_reader(ticket_collaborators.ticket_id)
);
CREATE POLICY "ticket_collaborators_write" ON ticket_collaborators FOR INSERT TO authenticated WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = ticket_collaborators.ticket_id
      AND (t.created_by::text = (SELECT auth.uid())::text OR EXISTS (
        SELECT 1 FROM ticket_assignees ta WHERE ta.ticket_id = t.id AND ta.user_id::text = (SELECT auth.uid())::text
      ))
  )
);
CREATE POLICY "ticket_collaborators_update" ON ticket_collaborators FOR UPDATE TO authenticated USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = ticket_collaborators.ticket_id
      AND (t.created_by::text = (SELECT auth.uid())::text OR EXISTS (
        SELECT 1 FROM ticket_assignees ta WHERE ta.ticket_id = t.id AND ta.user_id::text = (SELECT auth.uid())::text
      ))
  )
);
CREATE POLICY "ticket_collaborators_delete" ON ticket_collaborators FOR DELETE TO authenticated USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM tickets t WHERE t.id = ticket_collaborators.ticket_id AND t.created_by::text = (SELECT auth.uid())::text
  )
);

-- ticket_comments
CREATE POLICY "ticket_comments_select" ON ticket_comments FOR SELECT TO authenticated USING (
  public.ticket_visible_to_reader(ticket_comments.ticket_id)
);
CREATE POLICY "ticket_comments_insert" ON ticket_comments FOR INSERT TO authenticated WITH CHECK (
  author_id::text = (SELECT auth.uid())::text
  AND public.ticket_visible_to_reader(ticket_comments.ticket_id)
);
CREATE POLICY "ticket_comments_update" ON ticket_comments FOR UPDATE TO authenticated USING (author_id::text = (SELECT auth.uid())::text);
CREATE POLICY "ticket_comments_delete" ON ticket_comments FOR DELETE TO authenticated USING (author_id::text = (SELECT auth.uid())::text OR public.is_admin());

-- audit_log (read if can read ticket; insert via trigger or service — allow insert for ticket editors)
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO authenticated USING (
  public.ticket_visible_to_reader(audit_log.ticket_id)
);
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (
  changed_by::text = (SELECT auth.uid())::text
  AND public.ticket_visible_to_reader(audit_log.ticket_id)
);

-- inspiration_items
CREATE POLICY "inspiration_items_select" ON inspiration_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspiration_items_insert" ON inspiration_items FOR INSERT TO authenticated WITH CHECK (submitted_by::text = (SELECT auth.uid())::text);
CREATE POLICY "inspiration_items_update" ON inspiration_items FOR UPDATE TO authenticated USING (
  submitted_by::text = (SELECT auth.uid())::text OR public.is_admin()
);
CREATE POLICY "inspiration_items_delete" ON inspiration_items FOR DELETE TO authenticated USING (
  submitted_by::text = (SELECT auth.uid())::text OR public.is_admin()
);

-- saved_items
CREATE POLICY "saved_items_select" ON saved_items FOR SELECT TO authenticated USING (user_id::text = (SELECT auth.uid())::text);
CREATE POLICY "saved_items_insert" ON saved_items FOR INSERT TO authenticated WITH CHECK (user_id::text = (SELECT auth.uid())::text);
CREATE POLICY "saved_items_delete" ON saved_items FOR DELETE TO authenticated USING (user_id::text = (SELECT auth.uid())::text);

-- inspiration_comments
CREATE POLICY "inspiration_comments_select" ON inspiration_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspiration_comments_insert" ON inspiration_comments FOR INSERT TO authenticated WITH CHECK (author_id::text = (SELECT auth.uid())::text);
CREATE POLICY "inspiration_comments_update" ON inspiration_comments FOR UPDATE TO authenticated USING (author_id::text = (SELECT auth.uid())::text);
CREATE POLICY "inspiration_comments_delete" ON inspiration_comments FOR DELETE TO authenticated USING (author_id::text = (SELECT auth.uid())::text OR public.is_admin());

-- Grant RPC in Dashboard: GRANT EXECUTE ON FUNCTION public.create_ticket_with_id(...) TO authenticated;
-- (Omit from batch if your Postgres version errors on unqualified GRANT.)
GRANT EXECUTE ON FUNCTION public.ticket_visible_to_reader(uuid) TO authenticated;
