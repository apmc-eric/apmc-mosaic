-- Google Meet / Calendar join URL persisted when a checkpoint calendar event is created
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS checkpoint_meet_link TEXT;
