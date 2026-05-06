-- Add pixel dimensions so the client can reserve the correct aspect-ratio
-- space before the image loads (skeleton / no-layout-shift loading).
alter table inspiration_items
  add column if not exists media_width  integer,
  add column if not exists media_height integer;
