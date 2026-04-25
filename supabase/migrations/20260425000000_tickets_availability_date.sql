-- Add availability_date for "When are you available for a 15–30 min follow-up if needed?"
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS availability_date TIMESTAMPTZ;
