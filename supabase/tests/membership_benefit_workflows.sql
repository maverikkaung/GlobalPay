-- Disposable database fixture only.
begin;
insert into auth.users(id,raw_user_meta_data) values
  ('b6611111-1111-4111-8111-111111111111','{"full_name":"Benefit Client","account_type":"client"}'),
  ('b6622222-2222-4222-8222-222222222222','{"full_name":"Benefit Freelancer","account_type":"freelancer"}');

update public.membership_entitlements e
set plan_id=p.id, period_credit_limit=p.included_usage_credits,
    period_ends_at=least(e.period_ends_at,now()+interval '1 day')
from public.profiles u join public.membership_plans p on p.account_type=u.account_type and p.slug='gold'
where e.user_id=u.id and u.id in ('b6611111-1111-4111-8111-111111111111','b6622222-2222-4222-8222-222222222222');

set local role authenticated;
select set_config('request.jwt.claim.sub','b6611111-1111-4111-8111-111111111111',true);
insert into public.jobs(id,client_id,title,description,budget,is_featured)
values ('b6633333-3333-4333-8333-333333333333',auth.uid(),'Featured fixture','Current benefit fixture',10,true);
do $$
begin
  if not public.techkarvo_has_membership_feature('featured_jobs')
     or public.techkarvo_has_membership_feature('profile_boost') then
    raise exception 'Client benefit must be role scoped';
  end if;
  begin
    perform public.techkarvo_membership_benefit_until(auth.uid(),'ad_rewards');
    raise exception 'Private benefit helper must not be executable by members';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','b6622222-2222-4222-8222-222222222222',true);
do $$
declare boost_ends timestamptz;
begin
  if not public.techkarvo_has_membership_feature('profile_boost')
     or public.techkarvo_has_membership_feature('featured_jobs') then
    raise exception 'Freelancer benefit must be role scoped';
  end if;
  boost_ends := (public.techkarvo_set_profile_boost(true)->>'profile_boost_until')::timestamptz;
  if boost_ends is distinct from (select period_ends_at from public.membership_entitlements where user_id=auth.uid()) then
    raise exception 'A boost must end with the active membership';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  if not exists (select 1 from public.techkarvo_current_featured_job_ids(array['b6633333-3333-4333-8333-333333333333'::uuid])) then
    raise exception 'Eligible open featured job should be visible publicly';
  end if;
  begin
    perform public.techkarvo_sandbox_claim_ad_reward();
    raise exception 'Anonymous reward must be denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
-- Expire a membership without deleting the profile preference.
update public.membership_entitlements set period_started_at=now()-interval '2 days', period_ends_at=now()-interval '1 day'
where user_id='b6622222-2222-4222-8222-222222222222';
-- Catalog changes take effect immediately, without changing the job row.
update public.membership_plans set entitlements=entitlements || '{"featured_jobs":false}'::jsonb
where account_type='client' and slug='gold';
set local role authenticated;
select set_config('request.jwt.claim.sub','b6622222-2222-4222-8222-222222222222',true);
do $$
begin
  if public.techkarvo_has_membership_feature('ad_rewards')
     or (select is_profile_boosted from public.freelancer_public_profiles where id=auth.uid()) is distinct from false then
    raise exception 'An expired membership must not receive benefits';
  end if;
  begin
    perform public.techkarvo_sandbox_claim_ad_reward();
    raise exception 'Expired reward claim must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.techkarvo_user_analytics();
    raise exception 'Expired analytics request must fail';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.techkarvo_current_featured_job_ids(array['b6633333-3333-4333-8333-333333333333'::uuid])) then
    raise exception 'A changed catalog must remove the effective badge';
  end if;
end;
$$;

reset role;
-- An accidentally mismatched role is never eligible, even when its plan has a benefit.
update public.membership_entitlements set
  plan_id=(select id from public.membership_plans where account_type='client' and slug='gold'),
  period_started_at=now(), period_ends_at=now()+interval '1 day'
where user_id='b6622222-2222-4222-8222-222222222222';
set local role authenticated;
do $$
begin
  if public.techkarvo_has_membership_feature('analytics') then
    raise exception 'A plan assigned to a different role must confer no benefits';
  end if;
end;
$$;

reset role;
update public.membership_entitlements set
  plan_id=(select id from public.membership_plans where account_type='freelancer' and slug='free'),
  period_credit_limit=5
where user_id='b6622222-2222-4222-8222-222222222222';
set local role authenticated;
do $$
begin
  if public.techkarvo_has_membership_feature('profile_boost')
     or (select is_profile_boosted from public.freelancer_public_profiles where id=auth.uid()) is distinct from false then
    raise exception 'A downgrade must remove the effective boost';
  end if;
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.ledger_transactions) then
    raise exception 'Rejected benefit requests must not write a simulated journal';
  end if;
  if not (select is_featured from public.jobs where id='b6633333-3333-4333-8333-333333333333')
     or (select profile_boost_until from public.profiles where id='b6622222-2222-4222-8222-222222222222') is null then
    raise exception 'Benefit verification must preserve the stored preferences';
  end if;
end;
$$;
rollback;
