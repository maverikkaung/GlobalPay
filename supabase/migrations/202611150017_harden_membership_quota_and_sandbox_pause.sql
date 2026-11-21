-- Apply current catalog limits without resetting usage. Pause new paid membership
-- journal entries while allowing ordinary Free marketplace activity.

begin;

create or replace function public.techkarvo_sandbox_activate_plan(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  account_kind text;
  plan_row public.membership_plans%rowtype;
  event_id bigint;
  existing_event public.membership_credit_events%rowtype;
  balance numeric(14,2);
  txn uuid;
  amount_kav numeric(14,2);
  cycle_key text;
  cycle_start timestamptz;
  used_this_cycle integer;
  sandbox_enabled boolean;
  renewal_plan_id text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select account_type into account_kind from public.profiles where id=actor;
  if account_kind is null then raise exception 'A supported marketplace profile is required' using errcode='42501'; end if;
  select * into plan_row from public.membership_plans where account_type=account_kind and slug=p_slug and is_active and is_simulation_only;
  if plan_row.id is null then raise exception 'This simulation plan is unavailable for this account type' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  cycle_start := date_trunc('month',now());
  cycle_key := cycle_start::date::text;
  select * into existing_event from public.membership_credit_events
    where user_id=actor and idempotency_key='plan-selection:'||cycle_key;
  if existing_event.id is not null then
    if existing_event.reference_id=plan_row.id::text then
      return jsonb_build_object('plan',plan_row.slug,'credits',plan_row.included_usage_credits,
        'already_processed',true,'simulation_only',true);
    end if;
    raise exception 'Only one simulated membership purchase or selection is allowed per cycle' using errcode='23514';
  end if;
  -- Plan selection changes the allowance, while usage belongs to the calendar cycle.
  select coalesce((
    select credits_used from public.membership_entitlements
      where user_id=actor and period_started_at=cycle_start
  ),0) into used_this_cycle;
  if used_this_cycle > plan_row.included_usage_credits then
    raise exception 'This plan has fewer credits than already used this cycle' using errcode='23514';
  end if;
  if plan_row.slug <> 'free' then
    select reference_id into renewal_plan_id from public.ledger_transactions
      where actor_id=actor and idempotency_key='membership-renewal:'||cycle_key
        and transaction_type='sandbox_membership_renewal';
    if renewal_plan_id is not null then
      if renewal_plan_id=plan_row.id::text then
        return jsonb_build_object('plan',plan_row.slug,'credits',plan_row.included_usage_credits,
          'already_processed',true,'simulation_only',true);
      end if;
      raise exception 'Only one simulated paid membership charge is allowed per cycle' using errcode='23514';
    end if;
    select c.sandbox_enabled into sandbox_enabled from public.financial_sandbox_config c
      where c.singleton for share;
    if not coalesce(sandbox_enabled,false) then
      raise exception 'Financial sandbox is paused' using errcode='55000';
    end if;
    amount_kav := plan_row.simulated_price_usdt;
    perform public.techkarvo_ensure_wallet_accounts(actor);
    select coalesce(sum(e.amount_kav),0) into balance from public.ledger_entries e
      where e.account_key='user:'||actor::text||':available';
    if balance < amount_kav then raise exception 'Insufficient simulated KAV balance for this plan' using errcode='23514'; end if;
    insert into public.ledger_transactions(actor_id,transaction_type,idempotency_key,amount_kav,reference_type,reference_id,note)
      values(actor,'sandbox_membership_purchase','membership-purchase:'||cycle_key,amount_kav,
        'membership',plan_row.id::text,'Simulated membership purchase; no real payment') returning id into txn;
    insert into public.ledger_entries(transaction_id,account_key,amount_kav) values
      (txn,'user:'||actor::text||':available',-amount_kav),(txn,'sandbox:clearing',amount_kav);
  end if;
  insert into public.membership_credit_events(user_id,actor_id,event_type,delta,idempotency_key,reference_id)
    values(actor,actor,'plan_activation',plan_row.included_usage_credits,
      'plan-selection:'||cycle_key,plan_row.id::text)
    on conflict(user_id,idempotency_key) do nothing returning id into event_id;
  if event_id is null then raise exception 'Membership selection already processed' using errcode='23514'; end if;
  insert into public.membership_entitlements(user_id,plan_id,period_started_at,period_ends_at,period_credit_limit,credits_used,auto_renew)
    values(actor,plan_row.id,cycle_start,cycle_start+interval '1 month',plan_row.included_usage_credits,used_this_cycle,false)
    on conflict(user_id) do update set plan_id=excluded.plan_id,period_started_at=excluded.period_started_at,
      period_ends_at=excluded.period_ends_at,period_credit_limit=excluded.period_credit_limit,credits_used=excluded.credits_used,auto_renew=false,updated_at=now();
  return jsonb_build_object('plan',plan_row.slug,'credits',plan_row.included_usage_credits,
    'transaction_id',txn,'amount_kav',amount_kav,'simulation_only',true);
end;
$$;

create or replace function public.techkarvo_consume_usage_credit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  actor_kind text;
  entitlement public.membership_entitlements%rowtype;
  selected_plan public.membership_plans%rowtype;
  free_plan public.membership_plans%rowtype;
  cycle_start timestamptz := date_trunc('month',now());
  catalog_limit integer;
  event_key text;
  balance numeric(14,2);
  txn uuid;
  renewal_price numeric(14,2);
  renewal_event text;
  sandbox_enabled boolean;
  original_plan_id uuid;
begin
  if tg_table_name='jobs' then
    actor := new.client_id;
    actor_kind := 'client';
  elsif tg_table_name='job_applications' then
    actor := new.freelancer_id;
    actor_kind := 'freelancer';
  else
    raise exception 'Unexpected membership usage trigger table' using errcode='55000';
  end if;
  if not exists (select 1 from public.profiles where id=actor and account_type=actor_kind) then
    raise exception 'A matching marketplace profile is required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
  select * into entitlement from public.membership_entitlements where user_id=actor for update;
  if entitlement.user_id is null then raise exception 'Membership entitlement is not configured' using errcode='55000'; end if;
  if entitlement.period_ends_at<=now() and entitlement.period_started_at<cycle_start then
    original_plan_id := entitlement.plan_id;
    select * into selected_plan from public.membership_plans
      where id=entitlement.plan_id and account_type=actor_kind and is_active and is_simulation_only;
    select * into free_plan from public.membership_plans
      where account_type=actor_kind and slug='free' and is_active and is_simulation_only;
    if free_plan.id is null then raise exception 'No active Free fallback plan is configured' using errcode='55000'; end if;
    if entitlement.auto_renew and selected_plan.slug<>'free' then
      select c.sandbox_enabled into sandbox_enabled from public.financial_sandbox_config c
        where c.singleton for share;
    end if;
    if coalesce(sandbox_enabled,false) then
      renewal_price := selected_plan.simulated_price_usdt;
      perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
      perform public.techkarvo_ensure_wallet_accounts(actor);
      select coalesce(sum(amount_kav),0) into balance from public.ledger_entries
        where account_key='user:'||actor::text||':available';
      if balance >= renewal_price then
        insert into public.ledger_transactions(actor_id,transaction_type,idempotency_key,amount_kav,reference_type,reference_id,note)
          values(actor,'sandbox_membership_renewal','membership-renewal:'||date_trunc('month',now())::date,
            renewal_price,'membership',selected_plan.id::text,'Simulated membership renewal; no real payment') returning id into txn;
        insert into public.ledger_entries(transaction_id,account_key,amount_kav) values
          (txn,'user:'||actor::text||':available',-renewal_price),(txn,'sandbox:clearing',renewal_price);
      else
        selected_plan := free_plan;
      end if;
    else
      selected_plan := free_plan;
    end if;
    update public.membership_entitlements set plan_id=selected_plan.id,
      period_started_at=cycle_start,period_ends_at=cycle_start+interval '1 month',
      period_credit_limit=selected_plan.included_usage_credits,credits_used=0,
      auto_renew=case when selected_plan.slug='free' then false else entitlement.auto_renew end,updated_at=now()
      where user_id=actor returning * into entitlement;
    renewal_event := case when selected_plan.id=free_plan.id and original_plan_id<>free_plan.id then 'cycle_downgrade' else 'cycle_renewal' end;
    insert into public.membership_credit_events(user_id,event_type,delta,idempotency_key,reference_id)
      values(actor,renewal_event,entitlement.period_credit_limit,'cycle:'||date_trunc('month',now())::date,selected_plan.id::text);
  end if;
  -- Apply catalog reductions immediately without rewriting issued limits or used credits.
  select p.included_usage_credits into catalog_limit from public.membership_plans p
    where p.id=entitlement.plan_id and p.account_type=actor_kind and p.is_active and p.is_simulation_only
      and entitlement.period_started_at<=now() and entitlement.period_ends_at>now();
  if catalog_limit is null then
    select p.included_usage_credits into catalog_limit from public.membership_plans p
      where p.account_type=actor_kind and p.slug='free' and p.is_active and p.is_simulation_only;
  end if;
  if catalog_limit is null then raise exception 'No active Free fallback plan is configured' using errcode='55000'; end if;
  if entitlement.credits_used>=least(entitlement.period_credit_limit,catalog_limit) then
    raise exception 'No usage credits remain in this simulated membership cycle' using errcode='23514';
  end if;
  update public.membership_entitlements set credits_used=credits_used+1,updated_at=now() where user_id=actor;
  event_key := case when tg_table_name='jobs' then 'job:'||new.id::text else 'application:'||new.id::text end;
  insert into public.membership_credit_events(user_id,event_type,delta,idempotency_key,reference_id)
    values(actor,case when tg_table_name='jobs' then 'job_post' else 'job_application' end,-1,event_key,new.id::text);
  return new;
end;
$$;

commit;
