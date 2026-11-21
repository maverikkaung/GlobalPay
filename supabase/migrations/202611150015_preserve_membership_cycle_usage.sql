-- Preserve current-period usage when an authenticated member selects a plan.
-- This replaces one RPC without modifying existing entitlements or ledger records.

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
      where user_id=actor and period_started_at=cycle_start and period_ends_at>now()
  ),0) into used_this_cycle;
  if used_this_cycle > plan_row.included_usage_credits then
    raise exception 'This plan has fewer credits than already used this cycle' using errcode='23514';
  end if;
  if plan_row.slug <> 'free' then
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

commit;
