-- Re-evaluate membership benefits at use time. Existing preferences and ledger
-- rows are retained, including badges that are no longer effective.
begin;

create function public.techkarvo_membership_benefit_until(p_user uuid, p_feature text)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select e.period_ends_at
  from public.membership_entitlements e
  join public.profiles u on u.id=e.user_id
  join public.membership_plans p on p.id=e.plan_id and p.account_type=u.account_type
  where e.user_id=p_user and e.period_started_at<=now() and e.period_ends_at>now()
    and p.is_active and p.is_simulation_only
    and p.entitlements->p_feature='true'::jsonb
    and (p_feature<>'featured_jobs' or u.account_type='client')
    and (p_feature<>'profile_boost' or u.account_type='freelancer');
$$;
revoke all on function public.techkarvo_membership_benefit_until(uuid,text) from public, anon, authenticated;

create or replace function public.techkarvo_has_membership_feature(p_feature text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_feature is null or p_feature not in ('profile_boost','featured_jobs','advanced_search','analytics','priority_support','ad_rewards') then
    raise exception 'Unsupported membership benefit' using errcode='22023';
  end if;
  return public.techkarvo_membership_benefit_until(actor,p_feature) is not null;
end;
$$;

create or replace function public.techkarvo_set_profile_boost(p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); ends_at timestamptz;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_enabled is null then raise exception 'Choose whether to enable profile boost' using errcode='22023'; end if;
  if p_enabled then
    ends_at := public.techkarvo_membership_benefit_until(actor,'profile_boost');
    if ends_at is null then raise exception 'Profile boost requires an active eligible membership' using errcode='42501'; end if;
    ends_at := least(ends_at,now()+interval '30 days');
  end if;
  update public.profiles set profile_boost_until=ends_at where id=actor;
  if not found then raise exception 'Marketplace profile not found' using errcode='P0002'; end if;
  return jsonb_build_object('profile_boost_until',ends_at,'simulation_only',true);
end;
$$;

create or replace function public.techkarvo_enforce_feature_entitlements()
returns trigger language plpgsql security definer set search_path = '' as $$
declare benefit_until timestamptz;
begin
  if tg_table_name='jobs' then
    if new.is_featured and public.techkarvo_membership_benefit_until(new.client_id,'featured_jobs') is null then
      raise exception 'Featured job benefit requires an active eligible membership' using errcode='42501';
    end if;
  elsif tg_table_name='profiles' then
    if new.profile_boost_until is distinct from old.profile_boost_until and new.profile_boost_until>now() then
      benefit_until := public.techkarvo_membership_benefit_until(new.id,'profile_boost');
      if benefit_until is null then
        raise exception 'Profile boost requires an active eligible membership' using errcode='42501';
      end if;
      if new.profile_boost_until>least(benefit_until,now()+interval '30 days') then
        raise exception 'Profile boost must end within the active membership window' using errcode='22023';
      end if;
    end if;
  elsif tg_table_name='support_cases' and tg_op='INSERT' then
    benefit_until := public.techkarvo_membership_benefit_until(new.requester_id,'priority_support');
    if benefit_until is not null then
      new.priority := 'urgent';
    elsif new.priority='urgent' then
      raise exception 'Priority support requires an eligible active membership' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace view public.freelancer_public_profiles
with (security_barrier = true) as
select u.id, u.full_name, u.account_type, u.country, u.professional_title, u.bio,
  u.skills, u.experience, u.portfolio_url, u.avatar_path, u.cover_path,
  (u.profile_boost_until>now() and exists (
    select 1 from public.membership_entitlements e
    join public.membership_plans p on p.id=e.plan_id and p.account_type=u.account_type
    where e.user_id=u.id and e.period_started_at<=now() and e.period_ends_at>now()
      and p.is_active and p.is_simulation_only and p.entitlements->'profile_boost'='true'::jsonb
  )) is true as is_profile_boosted
from public.profiles u
where u.account_type='freelancer';

-- Only open job IDs are exposed. The application treats a missing or failing
-- RPC as having no badges, which is safe while the migration is pending.
create function public.techkarvo_current_featured_job_ids(p_job_ids uuid[])
returns table(id uuid) language sql stable security definer set search_path = '' as $$
  select j.id from public.jobs j
  where cardinality(p_job_ids) between 1 and 1000 and j.id=any(p_job_ids)
    and j.status='open' and j.is_featured
    and public.techkarvo_membership_benefit_until(j.client_id,'featured_jobs') is not null;
$$;
revoke all on function public.techkarvo_current_featured_job_ids(uuid[]) from public, anon, authenticated;
grant execute on function public.techkarvo_current_featured_job_ids(uuid[]) to anon, authenticated;

create or replace function public.techkarvo_user_analytics()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); role_name text; result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select p.account_type into role_name from public.profiles p where p.id=actor;
  if public.techkarvo_membership_benefit_until(actor,'analytics') is null then raise exception 'Analytics requires an active eligible membership' using errcode='42501'; end if;
  if role_name='client' then
    select jsonb_build_object('open_jobs',count(*) filter(where j.status='open'),'total_jobs',count(*),
      'applications_received',(select count(*) from public.job_applications a where a.client_id=actor),
      'active_contracts',(select count(*) from public.contracts c where c.client_id=actor and c.status='active'))
      into result from public.jobs j where j.client_id=actor;
  elsif role_name='freelancer' then
    select jsonb_build_object('applications_sent',count(*),'accepted_applications',count(*) filter(where a.status='Accepted'),
      'active_contracts',(select count(*) from public.contracts c where c.freelancer_id=actor and c.status='active'))
      into result from public.job_applications a where a.freelancer_id=actor;
  else raise exception 'A marketplace profile is required' using errcode='42501'; end if;
  return coalesce(result,'{}'::jsonb);
end;
$$;

create or replace function public.techkarvo_sandbox_claim_ad_reward()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); reward numeric(14,2); limit_per_day integer; enabled boolean; claim_count integer; txn uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select sandbox_enabled,ad_reward_kav,ad_rewards_per_day into enabled,reward,limit_per_day from public.financial_sandbox_config where singleton;
  if not coalesce(enabled,false) or limit_per_day < 1 then raise exception 'Simulated rewards are paused' using errcode='55000'; end if;
  if public.techkarvo_membership_benefit_until(actor,'ad_rewards') is null then raise exception 'Ad reward credits are not included in this membership' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||current_date::text,2));
  select count(*) into claim_count from public.sandbox_ad_reward_claims where user_id=actor and claim_date=current_date;
  if claim_count>=limit_per_day then raise exception 'Daily simulated reward limit reached' using errcode='23514'; end if;
  perform public.techkarvo_ensure_wallet_accounts(actor);
  insert into public.ledger_transactions(actor_id,transaction_type,idempotency_key,amount_kav,note)
    values(actor,'sandbox_ad_reward','ad-reward:'||current_date::text||':'||(claim_count+1),reward,'Simulated ad reward; no advertisement network or funds') returning id into txn;
  insert into public.ledger_entries(transaction_id,account_key,amount_kav) values
    (txn,'sandbox:ad_reward_pool',-reward),(txn,'user:'||actor::text||':rewards',reward);
  insert into public.sandbox_ad_reward_claims(user_id,claim_date,claim_number,transaction_id)
    values(actor,current_date,claim_count+1,txn);
  return jsonb_build_object('transaction_id',txn,'reward_kav',reward,'remaining_today',limit_per_day-claim_count-1,'simulation_only',true);
end;
$$;

commit;
