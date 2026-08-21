-- Account-scoped backup for a Pip household.
--
-- SQLite on the device stays authoritative for everything a family does
-- offline. This schema exists only so a signed-in parent can restore their
-- library, and it is shaped by that: every table carries the household it
-- belongs to, a server-assigned `revision`, and a `deleted_at` tombstone so a
-- deletion replicates instead of the row reappearing from the other device.
--
-- Conflicts are never decided by comparing two devices' clocks. `revision` is
-- assigned by a trigger from one shared sequence (`sync_revision_seq`, below),
-- so a client writes with `UPDATE ... WHERE id = ? AND revision = ?` and finds
-- out it lost a race by the WHERE clause matching zero rows — not by a
-- timestamp it cannot trust. `src/features/sync/conflict-resolution.ts` is the
-- pure decision of what happens next: ordinary edits resolve automatically,
-- but a destructive outcome (an edit that would be replaced by a delete, a
-- photo replaced on both sides, two active play sessions for one child) is
-- never silently discarded — the losing side is archived in
-- `conflict_archive` or `toy_image_history` and stays recoverable.
--
-- Whole-household replacement is deliberately not available: two devices
-- editing different toys must not cost either of them their work.
--
-- Ownership follows the app's rule exactly. A household row exists here only
-- because a parent explicitly backed it up, and RLS ties every descendant row
-- to that owner, so no policy below ever consults anything but auth.uid().

create extension if not exists "pgcrypto";

-- One counter shared by every synced table, so a revision number is globally
-- ordered and never repeats. That is what makes "WHERE revision = ?" a
-- reliable conflict check: two rows can never legitimately claim the same
-- revision, on the same table or different ones.
create sequence if not exists public.sync_revision_seq;

-- Assigns the next revision and stamps `updated_at` from the server clock,
-- overwriting whatever the client sent for both. A client's own clock is not
-- trusted for anything that decides a conflict outcome — only the server's
-- sequence and the server's `now()` are.
create or replace function public.assign_sync_revision()
returns trigger
language plpgsql
as $$
begin
  new.revision := nextval('public.sync_revision_seq');
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Households
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- The device's local household id, so a re-backup from the same device
  -- reattaches instead of creating a second remote library.
  local_id text not null,
  name text not null check (length(trim(name)) > 0),
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_id, local_id)
);

create index if not exists households_owner_index on public.households (owner_id);

drop trigger if exists households_assign_revision on public.households;
create trigger households_assign_revision
  before insert or update on public.households
  for each row execute function public.assign_sync_revision();

-- ─────────────────────────────────────────────────────────────────────────────
-- Household contents
--
-- `local_id` on each row is the device's integer primary key. It makes a replay
-- idempotent: restoring twice updates the same rows rather than duplicating a
-- family's toys, which is the failure mode that matters most here.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  local_id bigint not null,
  name text not null check (length(trim(name)) > 0),
  avatar_id text not null default 'circle-dot',
  accent_color_id text not null default 'mint',
  age_range text,
  choice_limit smallint not null default 3 check (choice_limit in (1, 3, 5)),
  reading_support text not null default 'pictures-words',
  display_order integer not null default 0,
  hidden_at timestamptz,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, local_id)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  local_id bigint not null,
  name text not null check (length(trim(name)) > 0),
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, local_id)
);

create table if not exists public.storage_spots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  local_id bigint not null,
  room_local_id bigint not null,
  name text not null check (length(trim(name)) > 0),
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, local_id)
);

create table if not exists public.toys (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  local_id bigint not null,
  name text not null check (length(trim(name)) > 0),
  room_local_id bigint,
  storage_spot_local_id bigint,
  cleanup_difficulty text not null default 'easy' check (cleanup_difficulty in ('easy', 'medium', 'big')),
  adult_help_required boolean not null default false,
  is_available boolean not null default true,
  is_archived boolean not null default false,
  availability_scope text not null default 'everyone',
  categories text[] not null default '{}',
  -- Path within the toy-images bucket. Null means the toy has no photo, which
  -- is a real state and not an error; the app draws a truthful blank for it.
  image_path text,
  -- Set once the bytes are confirmed uploaded. A row may exist with a path and
  -- no upload yet, and restore must not present that as a photo it can show.
  image_uploaded_at timestamptz,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, local_id)
);

create table if not exists public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  local_id bigint not null,
  child_local_id bigint,
  toy_local_id bigint not null,
  -- 'interrupted' is not a status SQLite ever writes on its own — it exists
  -- only as the outcome of resolving two devices that each believe the same
  -- child is mid-play. See conflict-resolution.ts, rule 2c.
  status text not null check (status in ('active', 'completed', 'interrupted')),
  started_at timestamptz not null,
  completed_at timestamptz,
  interrupted_at timestamptz,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, local_id)
);

create index if not exists child_profiles_household_index on public.child_profiles (household_id);
create index if not exists rooms_household_index on public.rooms (household_id);
create index if not exists storage_spots_household_index on public.storage_spots (household_id);
create index if not exists toys_household_index on public.toys (household_id);
create index if not exists play_sessions_household_index on public.play_sessions (household_id);

-- Every synced table's revision comes from the shared sequence, the same way
-- households' does. A restore pulls with `WHERE household_id = ? AND revision
-- > ? ORDER BY revision`, so these also want an index on that pair.
do $$
declare synced_table text;
begin
  foreach synced_table in array array['child_profiles', 'rooms', 'storage_spots', 'toys', 'play_sessions']
  loop
    execute format('drop trigger if exists %I_assign_revision on public.%I;', synced_table, synced_table);
    execute format(
      'create trigger %I_assign_revision before insert or update on public.%I
         for each row execute function public.assign_sync_revision();',
      synced_table, synced_table
    );
    execute format(
      'create index if not exists %I_household_revision_index on public.%I (household_id, revision);',
      synced_table, synced_table
    );
  end loop;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- What a conflict cost, kept instead of discarded
--
-- `conflict_archive` holds the edited content that would otherwise vanish when
-- a delete wins over an edit (rule 2a). `toy_image_history` holds a photo path
-- that lost a photo conflict (rule 2b) — the file itself stays in the bucket,
-- referenced here rather than removed, so "recoverable" is actually true and
-- not just a claim in a confirmation dialog.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.conflict_archive (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  entity text not null,
  entity_local_id bigint not null,
  reason text not null check (reason in ('edited-and-deleted', 'competing-active-sessions')),
  -- The intent that lost the conflict, as-is: `{"kind":"edit", ...}` or
  -- `{"kind":"delete"}`. Kept opaque rather than normalised into columns
  -- because what it needs to do is round-trip back to the app for recovery,
  -- not be queried in SQL.
  archived_data jsonb not null,
  archived_at timestamptz not null default now()
);

create index if not exists conflict_archive_household_index on public.conflict_archive (household_id);

create table if not exists public.toy_image_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  toy_local_id bigint not null,
  -- The path the current toy row no longer points at. Left in the bucket.
  image_path text not null,
  replaced_at timestamptz not null default now()
);

create index if not exists toy_image_history_household_index on public.toy_image_history (household_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
--
-- One rule, stated once per table: you reach a row if you own the household it
-- hangs from. Ownership is never taken from the request — only from auth.uid().
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.households enable row level security;
alter table public.child_profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.storage_spots enable row level security;
alter table public.toys enable row level security;
alter table public.play_sessions enable row level security;
alter table public.conflict_archive enable row level security;
alter table public.toy_image_history enable row level security;

drop policy if exists households_owner_all on public.households;
create policy households_owner_all on public.households
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create or replace function public.owns_household(candidate uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.households h
     where h.id = candidate and h.owner_id = auth.uid()
  );
$$;

do $$
declare child_table text;
begin
  foreach child_table in array array[
    'child_profiles', 'rooms', 'storage_spots', 'toys', 'play_sessions',
    'conflict_archive', 'toy_image_history'
  ]
  loop
    execute format('drop policy if exists %I_owner_all on public.%I;', child_table, child_table);
    execute format(
      'create policy %I_owner_all on public.%I for all to authenticated
         using (public.owns_household(household_id))
         with check (public.owns_household(household_id));',
      child_table, child_table
    );
  end loop;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Toy photographs
--
-- Private bucket. Objects live under `<household_id>/<file>`, and the policies
-- read that first path segment back to the households table, so a parent can
-- only ever reach the photographs of a household they own.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('toy-images', 'toy-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Supabase enables RLS on storage.objects by default, but a policy without RLS
-- switched on is a silent no-op rather than an error — the object would just
-- be readable by anyone. Stated explicitly so protection does not depend on an
-- assumption about the platform's default that this file cannot verify.
alter table storage.objects enable row level security;

drop policy if exists toy_images_owner_all on storage.objects;
create policy toy_images_owner_all on storage.objects
  for all to authenticated
  using (
    bucket_id = 'toy-images'
    and public.owns_household(nullif(split_part(name, '/', 1), '')::uuid)
  )
  with check (
    bucket_id = 'toy-images'
    and public.owns_household(nullif(split_part(name, '/', 1), '')::uuid)
  );
