-- Authenticated contract and finance sandbox workflow coverage for disposable CI only.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('b1111111-1111-4111-8111-111111111111','{"full_name":"Flow Client","account_type":"client"}'),
 ('b2222222-2222-4222-8222-222222222222','{"full_name":"Flow Freelancer","account_type":"freelancer"}'),
 ('b3333333-3333-4333-8333-333333333333','{"full_name":"Flow Admin","account_type":"client"}');
set local role service_role;
insert into public.platform_admins(user_id) values('b3333333-3333-4333-8333-333333333333');
insert into public.jobs(id,client_id,title,description,budget) values
 ('b4444444-4444-4444-8444-444444444444','b1111111-1111-4111-8111-111111111111','Sandbox contract','Test-only job description',200);
insert into public.job_applications(id,job_id,client_id,freelancer_id,status)
 values('b5555555-5555-4555-8555-555555555555','b4444444-4444-4444-8444-444444444444','b1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222','Pending');
update public.job_applications set status='Accepted' where id='b5555555-5555-4555-8555-555555555555';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
do $$
declare contract_id uuid; milestone_id uuid; result jsonb;
begin
  select id into contract_id from public.contracts where application_id='b5555555-5555-4555-8555-555555555555';
  if contract_id is null then raise exception 'Hiring an application must create a contract'; end if;
  perform public.techkarvo_sandbox_deposit(200,'client-contract-seed-001');
  milestone_id := public.techkarvo_sandbox_create_milestone(contract_id,'Design delivery',100,'client-ms-create-001');
  perform public.techkarvo_sandbox_fund_milestone(milestone_id);
  if (public.techkarvo_sandbox_wallet()->>'held_kav')::bigint <> 100 then raise exception 'Client funding should transfer sample value to a held account'; end if;
  perform set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
  perform public.techkarvo_sandbox_milestone_action(milestone_id,'submit','');
  perform set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
  result := public.techkarvo_sandbox_milestone_action(milestone_id,'release','');
  if not (result->>'simulation_only')::boolean then raise exception 'Release must be simulation-only'; end if;
  if (public.techkarvo_sandbox_wallet()->>'available_kav')::bigint <> 100 then raise exception 'Client should have the remaining simulated balance'; end if;
  if (select sum(amount_kav) from public.ledger_entries where account_key='platform:simulated_commission') <> 10 then raise exception 'Sample platform commission must match configured bps'; end if;

  milestone_id := public.techkarvo_sandbox_create_milestone(contract_id,'Revision round',20,'client-ms-create-002');
  perform public.techkarvo_sandbox_fund_milestone(milestone_id);
  perform set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
  result := public.techkarvo_sandbox_milestone_action(milestone_id,'dispute','Test dispute reason for CI');
  if result->>'dispute_id' is null then raise exception 'Disputing a milestone should create a dispute record'; end if;
  perform set_config('request.jwt.claim.sub','b3333333-3333-4333-8333-333333333333',true);
  perform public.techkarvo_sandbox_resolve_dispute((result->>'dispute_id')::uuid,'refund','Reviewed in isolated CI test');
  if exists(select 1 from public.financial_disputes where id=(result->>'dispute_id')::uuid and status<>'resolved_refund') then
    raise exception 'Admin refund decision must close the dispute';
  end if;
  if exists(select 1 from public.contracts where id=contract_id and status<>'active') then raise exception 'Contract should resume once its only dispute is resolved'; end if;
  if not exists(select 1 from public.admin_audit_log where action='sandbox.dispute.resolve') then raise exception 'Admin financial decision must be audited'; end if;
  perform public.techkarvo_admin_update_financial_config(true,1000,1,1,1000,1000);
  perform public.techkarvo_admin_upsert_membership_plan('client','plus','Client Plus Sample','Editable sandbox plan',12,null,'["12 sample credits"]'::jsonb,true,1);
  if public.techkarvo_admin_financial_summary()->>'real_money_enabled'<>'false' then raise exception 'Admin analytics must declare that real money is disabled'; end if;
  if not exists(select 1 from public.admin_audit_log where action='sandbox.configuration.update') then raise exception 'Sandbox configuration change must be audited'; end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$
declare reward jsonb; denied boolean := false;
begin
  reward := public.techkarvo_sandbox_claim_ad_reward();
  if not (reward->>'simulation_only')::boolean then raise exception 'Ad reward must be simulated'; end if;
  begin
    perform public.techkarvo_sandbox_claim_ad_reward();
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'Daily sandbox advertisement rewards must respect the configured limit'; end if;
  denied := false;
  begin
    perform public.techkarvo_admin_financial_summary();
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Non-admin must not access financial admin reports'; end if;
  if exists(select 1 from public.contract_milestones where created_by='b1111111-1111-4111-8111-111111111111') then
    raise exception 'Freelancer must not read client-created milestone rows';
  end if;
end;
$$;
rollback;
