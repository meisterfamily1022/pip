-- Private storage for toy photographs.
--
-- Photos are the one piece of family data that cannot be regenerated, so the
-- bucket is private and every object is owned by exactly one account. Objects
-- are keyed `<account-id>/<file>`, and the policies below compare that first
-- path segment to the caller's id. That makes the account boundary part of the
-- object's name rather than a column the client could get wrong.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'toy-photos',
  'toy-photos',
  false,
  10485760, -- 10 MB: comfortably above a full-resolution phone photo.
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Dropped first so re-running the migration replaces the policies rather than
-- failing on a name that already exists.
drop policy if exists "Toy photos are readable by their owner" on storage.objects;
drop policy if exists "Toy photos are uploadable by their owner" on storage.objects;
drop policy if exists "Toy photos are replaceable by their owner" on storage.objects;
drop policy if exists "Toy photos are deletable by their owner" on storage.objects;

create policy "Toy photos are readable by their owner"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'toy-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Toy photos are uploadable by their owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'toy-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Toy photos are replaceable by their owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'toy-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'toy-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Toy photos are deletable by their owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'toy-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
