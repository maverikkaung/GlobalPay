-- Isolated PostgreSQL CI only: no live Supabase project is used by this file.
begin;
insert into auth.users(id,raw_user_meta_data) values
  ('a1111111-1111-4111-8111-111111111111','{"full_name":"Sandbox Client","account_type":"client"}'),
  ('a2222222-2222-4222-8222-222222222222','{"full_name":"Sandbox Freelancer","account_type":"freelancer"}');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);

do $$
declare wallet jsonb; first_tx jsonb; retry_tx jsonb; second_activation_denied boolean := false; direct_access_denied boolean := false; over_limit_denied boolean := false;
begin
  if not exists(select 1 from public.membership_entitlements where user_id=auth.uid()) then
    raise exception 'New profiles need a default membership entitlement';
  end if;
  if (select count(*) from public.membership_plans where account_type='client' and is_active) <> 4 then
    raise exception 'Client role must see four active simulation plans';
  end if;
  if (select count(*) from public.membership_plans where account_type='freelancer') <> 0 then
    raise exception 'Client must not read freelancer-specific plans';
  end if;
  insert into public.jobs(id,client_id,title,description,budget) values
    ('a3111111-1111-4111-8111-111111111111',auth.uid(),'Credit job 1','Monthly credit trigger fixture',10),
    ('a3222222-2222-4222-8222-222222222222',auth.uid(),'Credit job 2','Monthly credit trigger fixture',10),
    ('a3333333-3333-4333-8333-333333333333',auth.uid(),'Credit job 3','Monthly credit trigger fixture',10);
  begin
    insert into public.jobs(id,client_id,title,description,budget) values
      ('a3444444-4444-4444-8444-444444444444',auth.uid(),'Credit job 4','Should exceed Free plan quota',10);
  exception when check_violation then over_limit_denied := true;
  end;
  if not over_limit_denied then raise exception 'Free client job-post quota must be enforced in the database'; end if;
  if (select credits_used from public.membership_entitlements where user_id=auth.uid())<>3 then raise exception 'Failed over-limit posting must not consume another credit'; end if;
  wallet := public.techkarvo_sandbox_wallet();
  if (wallet->>'available_kav')::bigint <> 0 or wallet->>'simulation_only' <> 'true' then
    raise exception 'New wallet must start at zero and be explicitly simulated';
  end if;
  first_tx := public.techkarvo_sandbox_deposit(25,'deposit-client-0001');
  retry_tx := public.techkarvo_sandbox_deposit(25,'deposit-client-0001');
  if first_tx->>'transaction_id' <> retry_tx->>'transaction_id' or retry_tx->>'already_processed' <> 'true' then
    raise exception 'Deposit retries must be idempotent';
  end if;
  wallet := public.techkarvo_sandbox_wallet();
  if (wallet->>'available_kav')::bigint <> 25 then raise exception 'Retry must not duplicate the simulated credit'; end if;
  perform public.techkarvo_sandbox_withdraw(5,'withdraw-client-0001');
  wallet := public.techkarvo_sandbox_wallet();
  if (wallet->>'available_kav')::bigint <> 20 then raise exception 'Simulated withdrawal should journal a balanced debit'; end if;
  perform public.techkarvo_sandbox_activate_plan('plus');
  begin
    perform public.techkarvo_sandbox_activate_plan('premium');
  exception when check_violation then second_activation_denied := true;
  end;
  if not second_activation_denied then raise exception 'Membership switching must not reset credits multiple times in one cycle'; end if;
  begin
    perform * from public.ledger_entries;
  exception when insufficient_privilege then direct_access_denied := true;
  end;
  if not direct_access_denied then raise exception 'Authenticated members must not query raw ledger entries'; end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a2222222-2222-4222-8222-222222222222',true);
do $$
declare wrong_role_denied boolean := false; other_wallet_denied boolean := false; job_id uuid; owner_id uuid;
begin
  if (select count(*) from public.membership_plans where account_type='freelancer' and is_active) <> 4 then
    raise exception 'Freelancer role must see its own plans';
  end if;
  begin
    perform public.techkarvo_sandbox_activate_plan('not-a-plan');
  exception when invalid_parameter_value then wrong_role_denied := true;
  end;
  if not wrong_role_denied then raise exception 'A role must not activate another role plan'; end if;
  select id,client_id into job_id,owner_id from public.jobs where title='Credit job 1';
  insert into public.job_applications(job_id,client_id,freelancer_id,full_name,cover_letter)
    values(job_id,owner_id,auth.uid(),'Sandbox Freelancer','Testing application usage credit');
  if (select credits_used from public.membership_entitlements where user_id=auth.uid())<>1 then raise exception 'Freelancer applications must consume server-enforced usage credits'; end if;
  begin
    perform 1 from public.membership_entitlements where user_id='a1111111-1111-4111-8111-111111111111';
  exception when insufficient_privilege then other_wallet_denied := true;
  end;
  if not other_wallet_denied and exists(select 1 from public.membership_entitlements where user_id='a1111111-1111-4111-8111-111111111111') then
    raise exception 'Membership entitlements must be owner scoped';
  end if;
end;
$$;
rollback;
