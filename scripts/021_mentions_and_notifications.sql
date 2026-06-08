-- 021: Add mentions to ticket_comments + create notifications table
-- Safe to re-run (IF NOT EXISTS / DROP IF EXISTS guards).

-- ---------------------------------------------------------------------------
-- ticket_comments: mentions column
-- ---------------------------------------------------------------------------
ALTER TABLE public.ticket_comments
  ADD COLUMN IF NOT EXISTS mentions UUID[] NOT NULL DEFAULT ARRAY[]::uuid[];

-- ---------------------------------------------------------------------------
-- notifications table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('assigned', 'comment_mention', 'description_mention')),
  actor_id   UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  ticket_id  UUID        NOT NULL REFERENCES public.tickets(id)   ON DELETE CASCADE,
  comment_id UUID        REFERENCES public.ticket_comments(id)    ON DELETE SET NULL,
  message    TEXT        NOT NULL,
  read       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON public.notifications(created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own"  ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own"  ON public.notifications;

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_auth"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
