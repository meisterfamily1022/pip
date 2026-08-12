create or replace function public.set_analytics_consent(next_granted boolean, next_version integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if next_version < 1 then raise exception 'invalid_consent_version'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  insert into public.analytics_consents(household_id,granted,consent_version,decided_at,updated_at)
  values(auth.uid(),next_granted,next_version,now(),now())
  on conflict(household_id) do update set granted=excluded.granted,consent_version=excluded.consent_version,decided_at=excluded.decided_at,updated_at=excluded.updated_at;
end; $$;

create or replace function public.delete_my_analytics() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  update public.analytics_consents set granted=false, updated_at=now(), decided_at=now() where household_id=auth.uid();
  delete from public.telemetry_events where household_id=auth.uid();
  delete from public.analytics_installations where household_id=auth.uid();
  delete from public.analytics_profiles where household_id=auth.uid();
  insert into public.analytics_deletion_audits(household_id,completed_at,outcome) values(auth.uid(),now(),'completed');
end; $$;

-- Invoke daily from Supabase Cron when available, or manually after deployment.
-- It is idempotent and safe when no expired rows exist.
create or replace function public.enforce_telemetry_retention() returns bigint language plpgsql security definer set search_path = '' as $$
declare removed bigint;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'staff_service_role_required' using errcode='42501'; end if;
  delete from public.telemetry_events where received_at < now() - interval '13 months';
  get diagnostics removed = row_count;
  return removed;
end; $$;

-- Serialize ingestion with opt-out/deletion so no event can arrive after either
-- operation has returned successfully.
create or replace function public.ingest_telemetry(batch jsonb, installation_pseudonym text)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb; installation uuid; inserted_count integer := 0; allowed text[] := array['account_created','onboarding_started','onboarding_completed','consent_decided','first_room','first_storage_spot','first_toy','first_photo','first_category','first_child_profile','first_play_session','first_cleanup','session_started','session_completed','toy_added','toy_edited','search_used','filter_used','child_mode_entered','cleanup_completed','library_scale','recoverable_error','feature_gate_encountered']; forbidden text[] := array['name','childName','toyName','categoryName','query','searchTerm','photo','image','address','city','postalCode','zip','latitude','longitude','ip','birthday','diagnosis','school','therapy','message','stack','email'];
begin
  if auth.uid() is null then raise exception 'analytics_consent_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  if not exists (select 1 from public.analytics_consents where household_id=auth.uid() and granted) then raise exception 'analytics_consent_required' using errcode='42501'; end if;
  if jsonb_typeof(batch) <> 'array' or jsonb_array_length(batch) > 25 or length(installation_pseudonym) < 16 then raise exception 'invalid_batch'; end if;
  if (select count(*) from public.telemetry_events where household_id=auth.uid() and received_at > now()-interval '1 hour') >= 120 then raise exception 'rate_limited'; end if;
  insert into public.analytics_installations(household_id,pseudonym_hash) values(auth.uid(),encode(digest(installation_pseudonym,'sha256'),'hex')) on conflict(household_id,pseudonym_hash) do update set rotated_at=excluded.rotated_at returning id into installation;
  for item in select value from jsonb_array_elements(batch) loop
    if not ((item->>'name') = any(allowed)) or (item->'payload') ?| forbidden or not ((item->'payload') ? 'appVersion') or not ((item->'payload') ? 'platform') then raise exception 'invalid_event'; end if;
    insert into public.telemetry_events(household_id,installation_id,idempotency_key,event_name,payload,occurred_at,app_version,platform) values(auth.uid(),installation,(item->>'idempotencyKey')::uuid,item->>'name',(item->'payload')-'appVersion'-'platform',(item->>'occurredAt')::timestamptz,item->'payload'->>'appVersion',item->'payload'->>'platform') on conflict(household_id,idempotency_key) do nothing;
    if found then inserted_count:=inserted_count+1; end if;
  end loop;
  return inserted_count;
end; $$;

revoke all on function public.set_analytics_consent(boolean,integer) from public;
revoke all on function public.delete_my_analytics() from public;
revoke all on function public.enforce_telemetry_retention() from public;
grant execute on function public.set_analytics_consent(boolean,integer) to authenticated;
grant execute on function public.delete_my_analytics() to authenticated;

