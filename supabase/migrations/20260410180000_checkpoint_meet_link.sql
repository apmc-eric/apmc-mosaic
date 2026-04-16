-- Persist Google Meet / calendar join URL on tickets (required for calendar scheduling + PostgREST updates).
-- If this migration was not applied, run: pnpm migrate scripts/016_checkpoint_meet_link.sql
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS checkpoint_meet_link TEXT;
