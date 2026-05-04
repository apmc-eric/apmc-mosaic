alter table tags
  add column if not exists created_by uuid references auth.users(id);

-- Allow any authenticated user to delete a tag they created;
-- admins are handled client-side (they bypass via service role or the policy below).
drop policy if exists "creator delete" on tags;
create policy "creator delete"
  on tags for delete
  to authenticated using (created_by = auth.uid());
