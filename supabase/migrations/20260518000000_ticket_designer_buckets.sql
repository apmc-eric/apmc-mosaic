-- Per-designer view buckets for the Works page redesign.
-- Each row assigns a ticket to one of three buckets for a specific designer.
-- Tickets not present in this table are treated as 'unfocused' by default.

CREATE TABLE ticket_designer_buckets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  designer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  bucket text NOT NULL CHECK (bucket IN ('live_work', 'deprioritized', 'unfocused')),
  -- fractional indexing: lower value = higher position within bucket
  order_index float NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(designer_id, ticket_id)
);

CREATE INDEX ticket_designer_buckets_designer_idx ON ticket_designer_buckets(designer_id);
CREATE INDEX ticket_designer_buckets_ticket_idx ON ticket_designer_buckets(ticket_id);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_ticket_designer_buckets_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_designer_buckets_updated_at
  BEFORE UPDATE ON ticket_designer_buckets
  FOR EACH ROW EXECUTE FUNCTION update_ticket_designer_buckets_updated_at();

-- Row-level security
ALTER TABLE ticket_designer_buckets ENABLE ROW LEVEL SECURITY;

-- Admins can read all bucket assignments; everyone else only reads their own
CREATE POLICY "read_own_or_admin" ON ticket_designer_buckets
  FOR SELECT USING (
    designer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Designers can only insert/update/delete their own rows
CREATE POLICY "write_own" ON ticket_designer_buckets
  FOR ALL USING (designer_id = auth.uid());
