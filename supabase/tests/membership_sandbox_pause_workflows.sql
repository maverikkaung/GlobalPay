-- Disposable PostgreSQL fixture only. Every balance and journal is simulated.
begin;
insert into auth.users(id,raw_user_meta_data) values
  ('c1711111-1111-4111-8111-111111111111','{"full_name":"Current Client","account_type":"client"}'),
  ('c1722222-2222-4222-8222-222222222222','{"full_name":"Paused Renewal Client","account_type":"client"}'),
  ('c1733333-3333-4333-8333-333333333333','{"full_name":"Funded Renewal Client","account_type":"client"}');

update public.membership_entitlements set
  plan_id=(select id from public.membership_plans where account_type='client' and slug='gold'),
  period_credit_limit=30, credits_used=2
where user_id='c1711111-1111-4111-8111-111111111111';
update public.membership_entitlements set
  plan_id=(select id from public.membership_plans where account_type='client' and slug='plus'),
  period_credit_limit=10, credits_used=4, auto_renew=true,
  period_started_at=date_trunc('month',now())-interval '1 month',
  period_ends_at=date_trunc('month',now())
where user_id in ('c1722222-2222-4222-8222-222222222222','c1733333-3333-4333-8333-333333333333');

set local role authenticated;
select set_config('request.jwt.claim.sub','c1711111-1111-4111-8111-111111111111',true);
select public.techkarvo_sandbox_deposit(50,'pause-fixture-current');
select set_config('request.jwt.claim.sub','c1722222-2222-4222-8222-222222222222',true);
select public.techkarvo_sandbox_deposit(50,'pause-fixture-a');
select set_config('request.jwt.claim.sub','c1733333-3333-4333-8333-333333333333',true);
select public.techkarvo_sandbox_deposit(50,'pause-fixture-b');
reset role;
update public.financial_sandbox_config set sandbox_enabled=false where singleton;

set local role authenticated;
select set_config('request.jwt.claim.sub','c1711111-1111-4111-8111-111111111111',true);
do $$
begin
  begin
    perform public.techkarvo_sandbox_activate_plan('plus');
    raise exception 'A paused sandbox must reject new paid purchases before debiting';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    perform public.techkarvo_sandbox_claim_ad_reward();
    raise exception 'A paused sandbox must reject eligible reward claims';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    perform public.techkarvo_sandbox_deposit(1,'pause-fixture-deposit');
    raise exception 'A paused sandbox must reject deposits';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    perform public.techkarvo_sandbox_withdraw(1,'pause-fixture-withdraw');
    raise exception 'A paused sandbox must reject withdrawals';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','c1722222-2222-4222-8222-222222222222',true);
insert into public.jobs(client_id,title,description,budget)
values(auth.uid(),'Ordinary job while paused','Must fall back to the new Free cycle',10);
select public.techkarvo_sandbox_activate_plan('free');
do $$
begin
  if (public.techkarvo_sandbox_wallet()->>'available_kav')::numeric<>50 then
    raise exception 'Paused renewal must leave the simulated wallet unchanged';
  end if;
  if not exists (select 1 from public.membership_entitlements e join public.membership_plans p on p.id=e.plan_id
    where e.user_id=auth.uid() and p.slug='free' and e.credits_used=1 and not e.auto_renew) then
    raise exception 'Free selection must preserve usage even during a pause';
  end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.ledger_transactions)<>3
     or (select count(*) from public.ledger_entries)<>6 then
    raise exception 'Paused operations must preserve the opening fixture journals';
  end if;
end;
$$;

update public.membership_plans set included_usage_credits=2 where account_type='client' and slug='gold';
set local role authenticated;
select set_config('request.jwt.claim.sub','c1711111-1111-4111-8111-111111111111',true);
do $$
begin
  begin
    insert into public.jobs(client_id,title,description,budget)
    values(auth.uid(),'Reduced quota job','Current lower allowance must apply',10);
    raise exception 'A reduced catalog quota must stop extra usage';
  exception when check_violation then null;
  end;
  if not exists (select 1 from public.membership_entitlements where user_id=auth.uid()
     and period_credit_limit=30 and credits_used=2) then
    raise exception 'Quota changes must preserve the stored allowance and actual usage';
  end if;
end;
$$;

reset role;
update public.membership_plans set is_active=false, included_usage_credits=30 where account_type='client' and slug='gold';
set local role authenticated;
do $$
begin
  begin
    insert into public.jobs(client_id,title,description,budget)
    values(auth.uid(),'Disabled plan job','Role Free cap must apply',10);
    raise exception 'A disabled plan must use the Free quota without resetting usage';
  exception when check_violation then null;
  end;
end;
$$;

reset role;
update public.membership_plans set is_active=true where account_type='client' and slug='gold';
update public.membership_entitlements set period_ends_at=now()
where user_id='c1711111-1111-4111-8111-111111111111';
set local role authenticated;
select public.techkarvo_sandbox_activate_plan('free');
do $$
begin
  if (select credits_used from public.membership_entitlements where user_id=auth.uid())<>2 then
    raise exception 'An early expiry during the same month must preserve usage';
  end if;
end;
$$;

reset role;
update public.financial_sandbox_config set sandbox_enabled=true where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub','c1733333-3333-4333-8333-333333333333',true);
insert into public.jobs(client_id,title,description,budget)
values(auth.uid(),'Funded renewal job','A new simulated cycle renews once',10);
do $$
begin
  if (public.techkarvo_sandbox_activate_plan('plus')->>'already_processed') is distinct from 'true' then
    raise exception 'Selecting the already renewed plan must not charge again';
  end if;
  begin
    perform public.techkarvo_sandbox_activate_plan('gold');
    raise exception 'Paid purchases after renewal must not debit a second plan';
  exception when check_violation then null;
  end;
  if (public.techkarvo_sandbox_wallet()->>'available_kav')::numeric<>40.01
     or (select credits_used from public.membership_entitlements where user_id=auth.uid())<>1 then
    raise exception 'One paid renewal must preserve the new cycle counter and deduct its price once';
  end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.ledger_transactions)<>4
     or (select count(*) from public.ledger_entries)<>8 then
    raise exception 'Only one renewal journal is expected in addition to the fixture deposits';
  end if;
end;
$$;
rollback;
