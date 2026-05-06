create table if not exists inspiration_item_tags (
  inspiration_item_id uuid not null references inspiration_items(id) on delete cascade,
  tag_id              uuid not null references tags(id)             on delete cascade,
  primary key (inspiration_item_id, tag_id)
);

alter table inspiration_item_tags enable row level security;

create policy "authenticated read"
  on inspiration_item_tags for select
  to authenticated using (true);

create policy "authenticated insert"
  on inspiration_item_tags for insert
  to authenticated with check (true);

create policy "authenticated delete"
  on inspiration_item_tags for delete
  to authenticated using (true);
