create or replace function public.staff_analytics_report(range_start date, range_end date, access_action text default 'view')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare is_admin boolean := coalesce((auth.jwt()->'app_metadata'->>'pip_admin')::boolean,false); result jsonb; actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if access_action not in ('view','export') or range_start is null or range_end is null or range_end < range_start or range_end-range_start > 366 then raise exception 'invalid_report_range'; end if;
  if not is_admin then
    insert into public.staff_report_audits(actor_id,action,report_type,range_summary,outcome) values(actor,access_action,'overview',jsonb_build_object('start',range_start,'end',range_end),'denied');
    return jsonb_build_object('authorized',false);
  end if;
  with scoped as (select * from public.telemetry_events where occurred_at >= range_start::timestamptz and occurred_at < (range_end+1)::timestamptz),
  totals as (select count(distinct household_id) households, count(*) events from scoped),
  funnel as (select event_name, count(distinct household_id) households from scoped where event_name in ('account_created','onboarding_completed','toy_added','first_play_session','cleanup_completed') group by event_name),
  active as (select count(distinct household_id) filter(where occurred_at >= (range_end+1)::timestamptz-interval '1 day') dau, count(distinct household_id) filter(where occurred_at >= (range_end+1)::timestamptz-interval '7 day') wau, count(distinct household_id) filter(where occurred_at >= (range_end+1)::timestamptz-interval '30 day') mau from scoped),
  engagement as (select count(*) filter(where event_name='session_started') play_sessions, count(*) filter(where event_name='cleanup_completed') cleanup_completions from scoped),
  signups as (select household_id,min(occurred_at)::date signup_date,date_trunc('week',min(occurred_at))::date signup_week from public.telemetry_events where event_name='account_created' group by household_id having min(occurred_at)::date between range_start and range_end),
  cohorts as (select signup_week,count(*) denominator,count(*) filter(where exists(select 1 from public.telemetry_events e where e.household_id=s.household_id and e.occurred_at::date=s.signup_date+1)) d1,count(*) filter(where exists(select 1 from public.telemetry_events e where e.household_id=s.household_id and e.occurred_at::date=s.signup_date+7)) d7,count(*) filter(where exists(select 1 from public.telemetry_events e where e.household_id=s.household_id and e.occurred_at::date=s.signup_date+30)) d30 from signups s group by signup_week),
  library_bands as (select payload->>'toys' toy_band,count(distinct household_id) households from scoped where event_name='library_scale' group by payload->>'toys'),
  health as (select payload->>'feature' feature, payload->>'errorCode' error_code, count(*) total from scoped where event_name='recoverable_error' group by 1,2),
  demographics as (select 'country' kind, country_code value, count(distinct household_id) households from public.analytics_profiles where country_code is not null group by country_code union all select 'region', region_code, count(distinct household_id) from public.analytics_profiles where region_code is not null group by region_code union all select 'child_count', child_count_band, count(distinct household_id) from public.analytics_profiles where child_count_band is not null group by child_count_band union all select 'caregiver_count', caregiver_count_band, count(distinct household_id) from public.analytics_profiles where caregiver_count_band is not null group by caregiver_count_band),
  entitlements as (select entitlement::text state, count(*) households from public.household_entitlements group by entitlement)
  select jsonb_build_object('authorized',true,'timezone','UTC','range',jsonb_build_object('start',range_start,'end',range_end),'totals',(select to_jsonb(totals) from totals),'funnel',coalesce((select jsonb_agg(funnel) from funnel),'[]'),'active',(select to_jsonb(active) from active),'engagement',(select to_jsonb(engagement) from engagement),'cohorts',coalesce((select jsonb_agg(cohorts order by signup_week) from cohorts),'[]'),'libraryBands',coalesce((select jsonb_agg(library_bands) from library_bands),'[]'),'health',coalesce((select jsonb_agg(health) from health),'[]'),'demographics',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'value',case when households<10 then null else value end,'households',case when households<10 then null else households end,'suppressed',households<10)) from demographics),'[]'),'entitlements',coalesce((select jsonb_agg(entitlements) from entitlements),'[]')) into result;
  insert into public.staff_report_audits(actor_id,action,report_type,range_summary,outcome) values(actor,access_action,'overview',jsonb_build_object('start',range_start,'end',range_end),'allowed');
  return result;
exception when others then
  if actor is not null and is_admin then insert into public.staff_report_audits(actor_id,action,report_type,range_summary,outcome) values(actor,case when access_action in ('view','export') then access_action else 'view' end,'overview',jsonb_build_object('start',range_start,'end',range_end),'failed'); end if;
  raise;
end; $$;
revoke all on function public.staff_analytics_report(date,date,text) from public;
grant execute on function public.staff_analytics_report(date,date,text) to authenticated;
