-- Privacy-minimized, authenticated-household analytics and dormant entitlements.
create extension if not exists pgcrypto;

create type public.pip_entitlement as enum ('free', 'plus', 'admin_test');

create table public.analytics_consents (
  household_id uuid primary key references auth.users(id) on delete cascade,
  granted boolean not null default false,
  consent_version integer not null check (consent_version > 0),
  decided_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table public.analytics_installations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references auth.users(id) on delete cascade,
  pseudonym_hash text not null,
  rotated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, pseudonym_hash)
);
create table public.analytics_profiles (
  household_id uuid primary key references auth.users(id) on delete cascade,
  child_count_band text check (child_count_band in ('1','2','3','4+','prefer_not_to_say')),
  caregiver_count_band text check (caregiver_count_band in ('1','2','3+','prefer_not_to_say')),
  child_age_bands text[] not null default '{}',
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  region_code text check (region_code ~ '^[A-Z0-9-]{1,12}$'),
  updated_at timestamptz not null default timezone('utc', now())
);
create table public.telemetry_events (
  id bigint generated always as identity primary key,
  household_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null references public.analytics_installations(id) on delete cascade,
  idempotency_key uuid not null,
  event_name text not null,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  app_version text not null,
  platform text not null check (platform in ('ios','android','web')),
  unique (household_id, idempotency_key)
);
create index telemetry_events_household_occurred on public.telemetry_events(household_id, occurred_at desc);
create index telemetry_events_name_occurred on public.telemetry_events(event_name, occurred_at desc);

create table public.household_entitlements (
  household_id uuid primary key references auth.users(id) on delete cascade,
  entitlement public.pip_entitlement not null default 'free',
  updated_at timestamptz not null default timezone('utc', now())
);
create table public.product_configuration (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);
insert into public.product_configuration(key, value) values ('plus_launch', '{"enabled":false,"visible":false}'::jsonb) on conflict do nothing;

create table public.analytics_deletion_audits (
  id bigint generated always as identity primary key,
  household_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  outcome text not null check (outcome in ('completed','failed'))
);
create table public.staff_report_audits (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('view','export')),
  report_type text not null,
  range_summary jsonb not null,
  outcome text not null check (outcome in ('allowed','denied','failed')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.analytics_consents enable row level security;
alter table public.analytics_installations enable row level security;
alter table public.analytics_profiles enable row level security;
alter table public.telemetry_events enable row level security;
alter table public.household_entitlements enable row level security;
alter table public.product_configuration enable row level security;
alter table public.analytics_deletion_audits enable row level security;
alter table public.staff_report_audits enable row level security;

create policy "Owners manage analytics consent" on public.analytics_consents for all to authenticated using (household_id = (select auth.uid())) with check (household_id = (select auth.uid()));
create policy "Owners manage analytics profile" on public.analytics_profiles for all to authenticated using (household_id = (select auth.uid())) with check (household_id = (select auth.uid()));
create policy "Owners read entitlement" on public.household_entitlements for select to authenticated using (household_id = (select auth.uid()));

create or replace function public.ensure_household_defaults() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.household_entitlements(household_id, entitlement) values (new.id, 'free') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_analytics_defaults after insert on auth.users for each row execute procedure public.ensure_household_defaults();
insert into public.household_entitlements(household_id, entitlement) select id, 'free' from auth.users on conflict do nothing;

create or replace function public.get_my_entitlement() returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare result public.pip_entitlement; config jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('state','free','plusEnabled',false,'plusVisible',false); end if;
  select entitlement into result from public.household_entitlements where household_id = auth.uid();
  select value into config from public.product_configuration where key = 'plus_launch';
  return jsonb_build_object('state',coalesce(result,'free'), 'plusEnabled',coalesce((config->>'enabled')::boolean,false), 'plusVisible',coalesce((config->>'visible')::boolean,false));
end; $$;

create or replace function public.ingest_telemetry(batch jsonb, installation_pseudonym text)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb; installation uuid; inserted_count integer := 0; allowed text[] := array['account_created','onboarding_started','onboarding_completed','consent_decided','first_room','first_storage_spot','first_toy','first_photo','first_category','first_child_profile','first_play_session','first_cleanup','session_started','session_completed','toy_added','toy_edited','search_used','filter_used','child_mode_entered','cleanup_completed','library_scale','recoverable_error','feature_gate_encountered']; forbidden text[] := array['name','childName','toyName','categoryName','query','searchTerm','photo','image','address','city','postalCode','zip','latitude','longitude','ip','birthday','diagnosis','school','therapy','message','stack','email'];
begin
  if auth.uid() is null or not exists (select 1 from public.analytics_consents where household_id=auth.uid() and granted) then raise exception 'analytics_consent_required' using errcode='42501'; end if;
  if jsonb_typeof(batch) <> 'array' or jsonb_array_length(batch) > 25 or length(installation_pseudonym) < 16 then raise exception 'invalid_batch'; end if;
  if (select count(*) from public.telemetry_events where household_id=auth.uid() and received_at > now()-interval '1 hour') >= 120 then raise exception 'rate_limited'; end if;
  insert into public.analytics_installations(household_id,pseudonym_hash) values(auth.uid(), encode(digest(installation_pseudonym,'sha256'),'hex')) on conflict(household_id,pseudonym_hash) do update set rotated_at=excluded.rotated_at returning id into installation;
  for item in select value from jsonb_array_elements(batch) loop
    if not ((item->>'name') = any(allowed)) or (item->'payload') ?| forbidden or (item->'payload') ? 'appVersion' = false or (item->'payload') ? 'platform' = false then raise exception 'invalid_event'; end if;
    insert into public.telemetry_events(household_id,installation_id,idempotency_key,event_name,payload,occurred_at,app_version,platform)
      values(auth.uid(),installation,(item->>'idempotencyKey')::uuid,item->>'name',(item->'payload') - 'appVersion' - 'platform',(item->>'occurredAt')::timestamptz,item->'payload'->>'appVersion',item->'payload'->>'platform')
      on conflict(household_id,idempotency_key) do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end loop;
  return inserted_count;
end; $$;

revoke all on function public.ingest_telemetry(jsonb,text) from public;
grant execute on function public.ingest_telemetry(jsonb,text) to authenticated;
grant execute on function public.get_my_entitlement() to anon, authenticated;

