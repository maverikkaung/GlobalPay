-- Persistent, authenticated sandbox ledger and role-specific plan entitlements.
-- Every financial record is simulation-only. This migration creates no live
-- provider integration, redeemable balance, payout destination, or real-money
-- transfer path. Do not apply to a hosted project without separate approval.
begin;

create table public.financial_sandbox_config (
  singleton boolean primary key default true check (singleton),
  sandbox_enabled boolean not null default true,
  commission_bps integer not null default 1000 check (commission_bps between 0 and 9999),
  ad_reward_kav bigint not null default 1 check (ad_reward_kav between 1 and 1000),
  ad_rewards_per_day integer not null default 5 check (ad_rewards_per_day between 0 and 100),
  max_deposit_usdt bigint not null default 1000 check (max_deposit_usdt between 1 and 1000000),
  max_withdrawal_kav bigint not null default 1000 check (max_withdrawal_kav between 1 and 1000000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.financial_sandbox_config(singleton) values (true);
alter table public.financial_sandbox_config enable row level security;
revoke all on public.financial_sandbox_config from public, anon, authenticated;
grant all on public.financial_sandbox_config to service_role;

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('client', 'freelancer')),
  slug text not null check (slug in ('free', 'plus', 'gold', 'premium')),
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  description text not null default '' check (length(description) <= 500),
  included_usage_credits integer not null check (included_usage_credits between 0 and 100000),
  simulated_price_usdt numeric check (simulated_price_usdt is null or (simulated_price_usdt > 0 and simulated_price_usdt < 1000000000 and trunc(simulated_price_usdt)=simulated_price_usdt and simulated_price_usdt::text not in ('NaN','Infinity','-Infinity'))),
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  is_active boolean not null default false,
  is_simulation_only boolean not null default true check (is_simulation_only),
  display_order integer not null default 0 check (display_order between 0 and 1000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (account_type, slug),
  check (octet_length(features::text) <= 16384),
  check (slug <> 'free' or simulated_price_usdt is null)
);
insert into public.membership_plans(account_type,slug,display_name,description,included_usage_credits,simulated_price_usdt,features,is_active,display_order)
values
 ('client','free','Free Client','Sample monthly job-post credits; no payment required.',3,null,'["3 job posts per cycle"]',true,0),
 ('client','plus','Plus Client','Sandbox plan. Configure sample pricing before buyer deployment.',10,null,'["10 job posts per cycle"]',true,1),
 ('client','gold','Gold Client','Sandbox plan. Configure sample pricing before buyer deployment.',30,null,'["30 job posts per cycle"]',true,2),
 ('client','premium','Premium Client','Sandbox plan. Configure sample pricing before buyer deployment.',100,null,'["100 job posts per cycle"]',true,3),
 ('freelancer','free','Free Freelancer','Sample monthly application credits; no payment required.',5,null,'["5 applications per cycle"]',true,0),
 ('freelancer','plus','Plus Freelancer','Sandbox plan. Configure sample pricing before buyer deployment.',20,null,'["20 applications per cycle"]',true,1),
 ('freelancer','gold','Gold Freelancer','Sandbox plan. Configure sample pricing before buyer deployment.',50,null,'["50 applications per cycle"]',true,2),
 ('freelancer','premium','Premium Freelancer','Sandbox plan. Configure sample pricing before buyer deployment.',100,null,'["100 applications per cycle"]',true,3);
alter table public.membership_plans enable row level security;
revoke all on public.membership_plans from public, anon, authenticated;
grant select on public.membership_plans to authenticated;
grant all on public.membership_plans to service_role;
create policy "Members can read active role-specific sandbox plans"
  on public.membership_plans for select to authenticated
  using (is_active and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type=membership_plans.account_type));
create policy "Admins can read all role-specific sandbox plans"
  on public.membership_plans for select to authenticated using ((select public.techkarvo_is_platform_admin()));
create policy "Membership plan read boundary"
  on public.membership_plans as restrictive for select to authenticated
  using ((is_active and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type=membership_plans.account_type)) or (select public.techkarvo_is_platform_admin()));
create policy "Anonymous users cannot access sandbox plans"
  on public.membership_plans as restrictive for all to anon using (false) with check (false);

create table public.membership_entitlements (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.membership_plans(id) on delete restrict,
  period_started_at timestamptz not null default now(),
  period_ends_at timestamptz not null,
  period_credit_limit integer not null check (period_credit_limit between 0 and 100000),
  credits_used integer not null default 0 check (credits_used between 0 and 100000),
  updated_at timestamptz not null default now(),
  check (credits_used <= period_credit_limit)
);
alter table public.membership_entitlements enable row level security;
revoke all on public.membership_entitlements from public, anon, authenticated;
grant select on public.membership_entitlements to authenticated;
grant all on public.membership_entitlements to service_role;
create policy "Members can read their own sandbox entitlement"
  on public.membership_entitlements for select to authenticated using (user_id=(select auth.uid()));
create policy "Admins can read sandbox entitlements"
  on public.membership_entitlements for select to authenticated using ((select public.techkarvo_is_platform_admin()));
create policy "Sandbox entitlement read boundary"
  on public.membership_entitlements as restrictive for select to authenticated
  using (user_id=(select auth.uid()) or (select public.techkarvo_is_platform_admin()));
create policy "Anonymous users cannot access sandbox entitlements"
  on public.membership_entitlements as restrictive for all to anon using (false) with check (false);

create table public.membership_credit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('cycle_grant','cycle_renewal','cycle_downgrade','plan_activation','job_post','job_application','admin_adjustment')),
  delta integer not null check (delta <> 0 and delta between -100000 and 100000),
  idempotency_key text not null check (length(idempotency_key) between 1 and 160),
  reference_id text not null default '' check (length(reference_id) <= 120),
  created_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);
create index membership_credit_events_user_created_idx on public.membership_credit_events(user_id,created_at desc);
alter table public.membership_credit_events enable row level security;
revoke all on public.membership_credit_events from public, anon, authenticated;
grant all on public.membership_credit_events to service_role;

create table public.ledger_accounts (
  account_key text primary key check (length(account_key) between 3 and 160),
  owner_id uuid references public.profiles(id) on delete restrict,
  account_kind text not null check (account_kind in ('wallet_available','wallet_held','sandbox_clearing','sandbox_withdrawal','platform_commission','sandbox_ad_reward_pool')),
  currency text not null default 'KAV' check (currency='KAV'),
  created_at timestamptz not null default now(),
  check ((owner_id is null and account_kind in ('sandbox_clearing','sandbox_withdrawal','platform_commission','sandbox_ad_reward_pool'))
      or (owner_id is not null and account_kind in ('wallet_available','wallet_held')))
);
create unique index ledger_user_account_kind_unique on public.ledger_accounts(owner_id,account_kind) where owner_id is not null;
insert into public.ledger_accounts(account_key,account_kind) values
 ('sandbox:clearing','sandbox_clearing'),('sandbox:withdrawal','sandbox_withdrawal'),
 ('platform:simulated_commission','platform_commission'),('sandbox:ad_reward_pool','sandbox_ad_reward_pool');
alter table public.ledger_accounts enable row level security;
revoke all on public.ledger_accounts from public, anon, authenticated;
grant all on public.ledger_accounts to service_role;

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('sandbox_deposit','sandbox_withdrawal','sandbox_membership_purchase','sandbox_membership_renewal','sandbox_milestone_hold','sandbox_milestone_release','sandbox_milestone_refund','sandbox_ad_reward')),
  idempotency_key text not null check (length(idempotency_key) between 8 and 160),
  amount_kav bigint not null check (amount_kav > 0 and amount_kav <= 1000000000),
  reference_type text not null default '' check (length(reference_type) <= 60),
  reference_id text not null default '' check (length(reference_id) <= 120),
  note text not null default '' check (length(note) <= 500),
  simulated boolean not null default true check (simulated),
  created_at timestamptz not null default now(),
  unique(actor_id,idempotency_key)
);
create index ledger_transactions_actor_created_idx on public.ledger_transactions(actor_id,created_at desc);
create index ledger_transactions_reference_idx on public.ledger_transactions(reference_type,reference_id);
alter table public.ledger_transactions enable row level security;
revoke all on public.ledger_transactions from public, anon, authenticated;
grant all on public.ledger_transactions to service_role;

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.ledger_transactions(id) on delete restrict,
  account_key text not null references public.ledger_accounts(account_key) on delete restrict,
  amount_kav bigint not null check (amount_kav <> 0),
  created_at timestamptz not null default now()
);
create index ledger_entries_transaction_idx on public.ledger_entries(transaction_id);
create index ledger_entries_account_created_idx on public.ledger_entries(account_key,created_at desc);
alter table public.ledger_entries enable row level security;
revoke all on public.ledger_entries from public, anon, authenticated;
grant all on public.ledger_entries to service_role;

create table public.contract_milestones (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(btrim(title)) between 3 and 160),
  amount_kav bigint not null check (amount_kav between 1 and 1000000000),
  status text not null default 'draft' check (status in ('draft','funded','submitted','disputed','released','refunded')),
  idempotency_key text not null check (length(idempotency_key) between 8 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(created_by,idempotency_key)
);
create index contract_milestones_contract_status_idx on public.contract_milestones(contract_id,status,created_at);
alter table public.contract_milestones enable row level security;
revoke all on public.contract_milestones from public, anon, authenticated;
grant select on public.contract_milestones to authenticated;
grant all on public.contract_milestones to service_role;
create policy "Contract participants can read milestones" on public.contract_milestones for select to authenticated
  using (exists(select 1 from public.contracts c where c.id=contract_milestones.contract_id and (c.client_id=(select auth.uid()) or c.freelancer_id=(select auth.uid()))));
create policy "Milestone read boundary" on public.contract_milestones as restrictive for select to authenticated
  using ((exists(select 1 from public.contracts c where c.id=contract_milestones.contract_id and (c.client_id=(select auth.uid()) or c.freelancer_id=(select auth.uid())))) or (select public.techkarvo_is_platform_admin()));
create policy "Admins can inspect milestone records" on public.contract_milestones for select to authenticated
  using ((select public.techkarvo_is_platform_admin()));

create table public.financial_disputes (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null unique references public.contract_milestones(id) on delete restrict,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 10 and 4000),
  status text not null default 'open' check (status in ('open','resolved_refund','resolved_release')),
  resolution_note text not null default '' check (length(resolution_note) <= 4000),
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index financial_disputes_status_created_idx on public.financial_disputes(status,created_at desc);
alter table public.financial_disputes enable row level security;
revoke all on public.financial_disputes from public, anon, authenticated;
grant select on public.financial_disputes to authenticated;
grant all on public.financial_disputes to service_role;
create policy "Contract participants can read their disputes" on public.financial_disputes for select to authenticated
  using (exists(select 1 from public.contract_milestones m join public.contracts c on c.id=m.contract_id where m.id=financial_disputes.milestone_id and (c.client_id=(select auth.uid()) or c.freelancer_id=(select auth.uid()))));
create policy "Dispute read boundary" on public.financial_disputes as restrictive for select to authenticated
  using ((exists(select 1 from public.contract_milestones m join public.contracts c on c.id=m.contract_id where m.id=financial_disputes.milestone_id and (c.client_id=(select auth.uid()) or c.freelancer_id=(select auth.uid())))) or (select public.techkarvo_is_platform_admin()));
create policy "Admins can read sandbox dispute queue" on public.financial_disputes for select to authenticated
  using ((select public.techkarvo_is_platform_admin()));

create table public.milestone_events (
  id bigint generated always as identity primary key,
  milestone_id uuid not null references public.contract_milestones(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created','funded','submitted','disputed','released','refunded')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);
create index milestone_events_created_idx on public.milestone_events(milestone_id,created_at);
alter table public.milestone_events enable row level security;
revoke all on public.milestone_events from public, anon, authenticated;
grant select on public.milestone_events to authenticated;
grant all on public.milestone_events to service_role;
create policy "Contract participants can read milestone history" on public.milestone_events for select to authenticated
  using (exists(select 1 from public.contract_milestones m join public.contracts c on c.id=m.contract_id where m.id=milestone_events.milestone_id and (c.client_id=(select auth.uid()) or c.freelancer_id=(select auth.uid()))));
create policy "Milestone history read boundary" on public.milestone_events as restrictive for select to authenticated
  using (exists(select 1 from public.contract_milestones m join public.contracts c on c.id=m.contract_id where m.id=milestone_events.milestone_id and (c.client_id=(select auth.uid()) or c.freelancer_id=(select auth.uid()))));

create table public.sandbox_ad_reward_claims (
  user_id uuid not null references public.profiles(id) on delete restrict,
  claim_date date not null,
  claim_number integer not null check (claim_number between 1 and 100),
  transaction_id uuid not null unique references public.ledger_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(user_id,claim_date,claim_number)
);
alter table public.sandbox_ad_reward_claims enable row level security;
revoke all on public.sandbox_ad_reward_claims from public, anon, authenticated;
grant all on public.sandbox_ad_reward_claims to service_role;

create or replace function public.techkarvo_reject_ledger_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Posted financial records are immutable; use a linked corrective transaction' using errcode='55000';
end;
$$;
revoke all on function public.techkarvo_reject_ledger_mutation() from public, anon, authenticated;
create trigger ledger_transactions_immutable before update or delete on public.ledger_transactions
  for each row execute function public.techkarvo_reject_ledger_mutation();
create trigger ledger_entries_immutable before update or delete on public.ledger_entries
  for each row execute function public.techkarvo_reject_ledger_mutation();
create trigger membership_credit_events_immutable before update or delete on public.membership_credit_events
  for each row execute function public.techkarvo_reject_ledger_mutation();
create trigger milestone_events_immutable before update or delete on public.milestone_events
  for each row execute function public.techkarvo_reject_ledger_mutation();

create or replace function public.techkarvo_assert_balanced_transaction()
returns trigger language plpgsql set search_path = '' as $$
declare txn_id uuid;
begin
  txn_id := case when tg_table_name='ledger_transactions' then new.id else new.transaction_id end;
  if (select count(*) from public.ledger_entries e where e.transaction_id=txn_id) < 2
     or (select coalesce(sum(e.amount_kav),0) from public.ledger_entries e where e.transaction_id=txn_id) <> 0
     or exists (
       select 1 from public.ledger_entries e join public.ledger_accounts a using(account_key)
       where e.transaction_id=txn_id and a.currency <> 'KAV'
     ) then
    raise exception 'Every sandbox ledger transaction must have at least two balanced KAV entries' using errcode='23514';
  end if;
  return null;
end;
$$;
revoke all on function public.techkarvo_assert_balanced_transaction() from public, anon, authenticated;
create constraint trigger ledger_transaction_balance_check after insert on public.ledger_transactions
  deferrable initially deferred for each row execute function public.techkarvo_assert_balanced_transaction();
create constraint trigger ledger_entry_balance_check after insert on public.ledger_entries
  deferrable initially deferred for each row execute function public.techkarvo_assert_balanced_transaction();

-- Never expose ledger writes or wallet account identifiers directly to clients.
-- Authenticated operations are exposed only as security-definer RPCs.

create or replace function public.techkarvo_assign_free_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare free_plan uuid;
begin
  select id into free_plan from public.membership_plans
    where account_type = new.account_type and slug = 'free' and is_active;
  if free_plan is null then raise exception 'No active Free plan is configured' using errcode='55000'; end if;
  insert into public.membership_entitlements(user_id,plan_id,period_started_at,period_ends_at,period_credit_limit)
  values (new.id,free_plan,date_trunc('month',now()),date_trunc('month',now()) + interval '1 month',
    (select included_usage_credits from public.membership_plans where id=free_plan))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.techkarvo_assign_free_membership() from public, anon, authenticated;
create trigger techkarvo_assign_free_membership_after_profile
  after insert on public.profiles for each row execute function public.techkarvo_assign_free_membership();
insert into public.membership_entitlements(user_id,plan_id,period_started_at,period_ends_at,period_credit_limit)
select p.id, mp.id, date_trunc('month',now()), date_trunc('month',now()) + interval '1 month', mp.included_usage_credits
from public.profiles p join public.membership_plans mp on mp.account_type=p.account_type and mp.slug='free' and mp.is_active
on conflict (user_id) do nothing;

create or replace function public.techkarvo_ensure_wallet_accounts(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ledger_accounts(account_key,owner_id,account_kind)
    values ('user:'||p_user::text||':available',p_user,'wallet_available'),
           ('user:'||p_user::text||':held',p_user,'wallet_held')
    on conflict do nothing;
end;
$$;
revoke all on function public.techkarvo_ensure_wallet_accounts(uuid) from public, anon, authenticated;

create or replace function public.techkarvo_sandbox_wallet()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); available bigint; held bigint; recent jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.techkarvo_ensure_wallet_accounts(actor);
  select coalesce(sum(e.amount_kav),0) into available from public.ledger_entries e where e.account_key='user:'||actor::text||':available';
  select coalesce(sum(e.amount_kav),0) into held from public.ledger_entries e where e.account_key='user:'||actor::text||':held';
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into recent from (
    select t.id,t.transaction_type,t.amount_kav,t.note,t.created_at from public.ledger_transactions t
    where t.actor_id=actor or exists(select 1 from public.ledger_entries e where e.transaction_id=t.id and e.account_key in ('user:'||actor::text||':available','user:'||actor::text||':held'))
    order by t.created_at desc limit 50
  ) x;
  return jsonb_build_object('currency','KAV','available_kav',available,'held_kav',held,
    'reference_rate','1 USDT = 1 KAV','simulation_only',true,'transactions',recent);
end;
$$;

create or replace function public.techkarvo_sandbox_deposit(p_usdt bigint,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); txn uuid; max_amount bigint; enabled boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_usdt is null or p_usdt < 1 or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9:_-]{8,160}$' then raise exception 'Invalid simulated deposit request' using errcode='22023'; end if;
  select sandbox_enabled,max_deposit_usdt into enabled,max_amount from public.financial_sandbox_config where singleton;
  if not coalesce(enabled,false) then raise exception 'Financial sandbox is paused' using errcode='55000'; end if;
  if p_usdt > max_amount then raise exception 'Simulated deposit exceeds configured limit' using errcode='22023'; end if;
  perform public.techkarvo_ensure_wallet_accounts(actor);
  insert into public.ledger_transactions(actor_id,transaction_type,idempotency_key,amount_kav,note)
    values(actor,'sandbox_deposit',p_idempotency_key,p_usdt,'Simulated deposit; no funds moved')
    on conflict(actor_id,idempotency_key) do nothing returning id into txn;
  if txn is null then
    select id into txn from public.ledger_transactions where actor_id=actor and idempotency_key=p_idempotency_key;
    return jsonb_build_object('transaction_id',txn,'already_processed',true,'simulation_only',true);
  end if;
  insert into public.ledger_entries(transaction_id,account_key,amount_kav) values
    (txn,'sandbox:clearing',-p_usdt),(txn,'user:'||actor::text||':available',p_usdt);
  return jsonb_build_object('transaction_id',txn,'amount_kav',p_usdt,'already_processed',false,'simulation_only',true);
end;
$$;

create or replace function public.techkarvo_sandbox_withdraw(p_amount_kav bigint,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); txn uuid; max_amount bigint; enabled boolean; balance bigint;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_amount_kav is null or p_amount_kav < 1 or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9:_-]{8,160}$' then raise exception 'Invalid simulated withdrawal request' using errcode='22023'; end if;
  select sandbox_enabled,max_withdrawal_kav into enabled,max_amount from public.financial_sandbox_config where singleton;
  if not coalesce(enabled,false) then raise exception 'Financial sandbox is paused' using errcode='55000'; end if;
  if p_amount_kav > max_amount then raise exception 'Simulated withdrawal exceeds configured limit' using errcode='22023'; end if;
  perform public.techkarvo_ensure_wallet_accounts(actor);
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select id into txn from public.ledger_transactions where actor_id=actor and idempotency_key=p_idempotency_key;
  if txn is not null then return jsonb_build_object('transaction_id',txn,'already_processed',true,'simulation_only',true); end if;
  select coalesce(sum(amount_kav),0) into balance from public.ledger_entries where account_key='user:'||actor::text||':available';
  if balance < p_amount_kav then raise exception 'Insufficient simulated KAV balance' using errcode='23514'; end if;
  insert into public.ledger_transactions(actor_id,transaction_type,idempotency_key,amount_kav,note)
    values(actor,'sandbox_withdrawal',p_idempotency_key,p_amount_kav,'Simulated withdrawal request; no payout occurs') returning id into txn;
  insert into public.ledger_entries(transaction_id,account_key,amount_kav) values
    (txn,'user:'||actor::text||':available',-p_amount_kav),(txn,'sandbox:withdrawal',p_amount_kav);
  return jsonb_build_object('transaction_id',txn,'amount_kav',p_amount_kav,'already_processed',false,'simulation_only',true);
end;
$$;

create or replace function public.techkarvo_sandbox_activate_plan(p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); account_kind text; plan_row public.membership_plans%rowtype; event_id bigint;
  existing_event public.membership_credit_events%rowtype; balance bigint; txn uuid; amount_kav bigint; cycle_key text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select account_type into account_kind from public.profiles where id=actor;
  if account_kind is null then raise exception 'A supported marketplace profile is required' using errcode='42501'; end if;
  select * into plan_row from public.membership_plans where account_type=account_kind and slug=p_slug and is_active and is_simulation_only;
  if plan_row.id is null then raise exception 'This simulation plan is unavailable for this account type' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  cycle_key := date_trunc('month',now())::date::text;
  select * into existing_event from public.membership_credit_events
    where user_id=actor and idempotency_key='plan-selection:'||cycle_key;
  if existing_event.id is not null then
    if existing_event.reference_id=plan_row.id::text then
      return jsonb_build_object('plan',plan_row.slug,'credits',plan_row.included_usage_credits,
        'already_processed',true,'simulation_only',true);
    end if;
    raise exception 'Only one simulated membership purchase or selection is allowed per cycle' using errcode='23514';
  end if;
  if plan_row.slug <> 'free' then
    if plan_row.simulated_price_usdt is null then
      raise exception 'Set a sample whole-USDT price before purchasing this simulation plan' using errcode='22023';
    end if;
    amount_kav := plan_row.simulated_price_usdt::bigint;
    perform public.techkarvo_ensure_wallet_accounts(actor);
    select coalesce(sum(amount_kav),0) into balance from public.ledger_entries
      where account_key='user:'||actor::text||':available';
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
  insert into public.membership_entitlements(user_id,plan_id,period_started_at,period_ends_at,period_credit_limit,credits_used)
    values(actor,plan_row.id,date_trunc('month',now()),date_trunc('month',now())+interval '1 month',plan_row.included_usage_credits,0)
    on conflict(user_id) do update set plan_id=excluded.plan_id,period_started_at=excluded.period_started_at,
      period_ends_at=excluded.period_ends_at,period_credit_limit=excluded.period_credit_limit,credits_used=0,updated_at=now();
  return jsonb_build_object('plan',plan_row.slug,'credits',plan_row.included_usage_credits,
    'transaction_id',txn,'amount_kav',amount_kav,'simulation_only',true);
end;
$$;

create or replace function public.techkarvo_consume_usage_credit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid; ent public.membership_entitlements%rowtype; event_key text;
  selected_plan public.membership_plans%rowtype; free_plan public.membership_plans%rowtype;
  balance bigint; txn uuid; renewal_price bigint; renewal_event text; original_plan_id uuid;
begin
  if tg_table_name='jobs' then actor := new.client_id;
  else actor := new.freelancer_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
  select * into ent from public.membership_entitlements where user_id=actor for update;
  if ent.user_id is null then raise exception 'Membership entitlement is not configured' using errcode='55000'; end if;
  if ent.period_ends_at <= now() then
    original_plan_id := ent.plan_id;
    select * into selected_plan from public.membership_plans where id=ent.plan_id;
    select * into free_plan from public.membership_plans
      where account_type=selected_plan.account_type and slug='free' and is_active;
    if free_plan.id is null then raise exception 'No active Free fallback plan is configured' using errcode='55000'; end if;
    if selected_plan.slug <> 'free' and selected_plan.is_active and selected_plan.simulated_price_usdt is not null then
      renewal_price := selected_plan.simulated_price_usdt::bigint;
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
      period_started_at=date_trunc('month',now()),period_ends_at=date_trunc('month',now())+interval '1 month',
      period_credit_limit=selected_plan.included_usage_credits,credits_used=0,updated_at=now()
      where user_id=actor returning * into ent;
    renewal_event := case when selected_plan.id=free_plan.id and original_plan_id<>free_plan.id then 'cycle_downgrade' else 'cycle_renewal' end;
    insert into public.membership_credit_events(user_id,event_type,delta,idempotency_key,reference_id)
      values(actor,renewal_event,ent.period_credit_limit,'cycle:'||date_trunc('month',now())::date,selected_plan.id::text);
  end if;
  if ent.credits_used >= ent.period_credit_limit then raise exception 'No usage credits remain in this simulated membership cycle' using errcode='23514'; end if;
  update public.membership_entitlements set credits_used=credits_used+1,updated_at=now() where user_id=actor;
  event_key := case when tg_table_name='jobs' then 'job:'||new.id::text else 'application:'||new.id::text end;
  insert into public.membership_credit_events(user_id,event_type,delta,idempotency_key,reference_id)
    values(actor,case when tg_table_name='jobs' then 'job_post' else 'job_application' end,-1,event_key,new.id::text);
  return new;
end;
$$;
create trigger techkarvo_job_usage_credit before insert on public.jobs for each row execute function public.techkarvo_consume_usage_credit();
create trigger techkarvo_application_usage_credit before insert on public.job_applications for each row execute function public.techkarvo_consume_usage_credit();
revoke all on function public.techkarvo_consume_usage_credit() from public, anon, authenticated;

create or replace function public.techkarvo_sandbox_create_milestone(p_contract_id uuid,p_title text,p_amount_kav bigint,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); client uuid; milestone_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select c.client_id into client from public.contracts c where c.id=p_contract_id and c.status='active' and c.client_id=actor;
  if client is null then raise exception 'Only the hiring client can add a milestone to an active contract' using errcode='42501'; end if;
  insert into public.contract_milestones(contract_id,created_by,title,amount_kav,idempotency_key)
    values(p_contract_id,actor,p_title,p_amount_kav,p_idempotency_key) returning id into milestone_id;
  insert into public.milestone_events(milestone_id,actor_id,event_type) values(milestone_id,actor,'created');
  return milestone_id;
end;
$$;

create or replace function public.techkarvo_sandbox_fund_milestone(p_milestone_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); m public.contract_milestones%rowtype; c public.contracts%rowtype; balance bigint; txn uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into m from public.contract_milestones where id=p_milestone_id for update;
  select * into c from public.contracts where id=m.contract_id;
  if c.client_id is distinct from actor or c.status <> 'active' then raise exception 'Only the hiring client can fund an active contract milestone' using errcode='42501'; end if;
  if m.status='funded' then return jsonb_build_object('milestone_id',m.id,'already_processed',true,'simulation_only',true); end if;
  if m.status <> 'draft' then raise exception 'This milestone is not fundable' using errcode='23514'; end if;
  perform public.techkarvo_ensure_wallet_accounts(actor);
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select coalesce(sum(amount_kav),0) into balance from public.ledger_entries where account_key='user:'||actor::text||':available';
  if balance < m.amount_kav then raise exception 'Insufficient simulated KAV balance' using errcode='23514'; end if;
  insert into public.ledger_transactions(actor_id,transaction_type,idempotency_key,amount_kav,reference_type,reference_id,note)
    values(actor,'sandbox_milestone_hold','milestone-fund:'||m.id,m.amount_kav,'milestone',m.id::text,'Simulated milestone hold; no funds secured') returning id into txn;
  insert into public.ledger_entries(transaction_id,account_key,amount_kav) values
    (txn,'user:'||actor::text||':available',-m.amount_kav),(txn,'user:'||actor::text||':held',m.amount_kav);
  update public.contract_milestones set status='funded',updated_at=now() where id=m.id;
  insert into public.milestone_events(milestone_id,actor_id,event_type) values(m.id,actor,'funded');
  return jsonb_build_object('milestone_id',m.id,'transaction_id',txn,'simulation_only',true);
end;
$$;

create or replace function public.techkarvo_sandbox_milestone_action(p_milestone_id uuid,p_action text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); m public.contract_milestones%rowtype; c public.contracts%rowtype;
  target text; event_kind text; txn uuid; fee bigint; rate integer; dispute_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_action not in ('submit','release','refund','dispute') then raise exception 'Unsupported milestone action' using errcode='22023'; end if;
  select * into m from public.contract_milestones where id=p_milestone_id for update;
  if m.id is null then raise exception 'Milestone not found' using errcode='P0002'; end if;
  select * into c from public.contracts where id=m.contract_id;
  if c.id is null or actor not in (c.client_id,c.freelancer_id) then raise exception 'Contract participant access required' using errcode='42501'; end if;
  if p_action='submit' then
    if actor<>c.freelancer_id or c.status<>'active' or m.status<>'funded' then raise exception 'Only the freelancer can submit a funded milestone on an active contract' using errcode='42501'; end if;
    update public.contract_milestones set status='submitted',updated_at=now() where id=m.id;
    event_kind := 'submitted';
  elsif p_action='dispute' then
    if c.status<>'active' or m.status not in ('funded','submitted') or length(btrim(coalesce(p_reason,'')))<10 then raise exception 'An active contract milestone needs a 10-character dispute reason' using errcode='23514'; end if;
    update public.contract_milestones set status='disputed',updated_at=now() where id=m.id;
    update public.contracts set status='disputed' where id=c.id and status='active';
    insert into public.financial_disputes(milestone_id,opened_by,reason) values(m.id,actor,btrim(p_reason)) returning id into dispute_id;
    event_kind := 'disputed';
  elsif p_action='release' then
    if actor<>c.client_id or c.status<>'active' or m.status<>'submitted' then raise exception 'Only the hiring client can release a submitted milestone on an active contract' using errcode='42501'; end if;
    select commission_bps into rate from public.financial_sandbox_config where singleton and sandbox_enabled;
    if rate is null then raise exception 'Financial sandbox is paused' using errcode='55000'; end if;
    fee := floor((m.amount_kav::numeric*rate)/10000)::bigint;
    perform public.techkarvo_ensure_wallet_accounts(c.freelancer_id);
    insert into public.ledger_transactions(actor_id,transaction_type,idempotency_key,amount_kav,reference_type,reference_id,note)
      values(actor,'sandbox_milestone_release','milestone-release:'||m.id,m.amount_kav,'milestone',m.id::text,'Simulated release; no payout occurs') returning id into txn;
    insert into public.ledger_entries(transaction_id,account_key,amount_kav) values
      (txn,'user:'||c.client_id::text||':held',-m.amount_kav),
      (txn,'user:'||c.freelancer_id::text||':available',m.amount_kav-fee);
    if fee>0 then insert into public.ledger_entries(transaction_id,account_key,amount_kav) values(txn,'platform:simulated_commission',fee); end if;
    update public.contract_milestones set status='released',updated_at=now() where id=m.id;
    event_kind := 'released';
  else
    if actor<>c.client_id or c.status<>'active' or m.status<>'funded' then raise exception 'Only the hiring client may refund a funded milestone outside a dispute' using errcode='42501'; end if;
    insert into public.ledger_transactions(actor_id,transaction_type,idempotency_key,amount_kav,reference_type,reference_id,note)
      values(actor,'sandbox_milestone_refund','milestone-refund:'||m.id,m.amount_kav,'milestone',m.id::text,'Simulated refund; no funds moved') returning id into txn;
    insert into public.ledger_entries(transaction_id,account_key,amount_kav) values
      (txn,'user:'||c.client_id::text||':held',-m.amount_kav),
      (txn,'user:'||c.client_id::text||':available',m.amount_kav);
    update public.contract_milestones set status='refunded',updated_at=now() where id=m.id;
    update public.financial_disputes set status='resolved_refund',resolved_by=actor,resolved_at=now() where milestone_id=m.id and status='open';
    update public.contracts set status='active' where id=c.id and status='disputed'
      and not exists(select 1 from public.financial_disputes fd join public.contract_milestones fm on fm.id=fd.milestone_id where fm.contract_id=c.id and fd.status='open' and fd.id<>coalesce(dispute_id,'00000000-0000-0000-0000-000000000000'::uuid));
    event_kind := 'refunded';
  end if;
  insert into public.milestone_events(milestone_id,actor_id,event_type,details)
    values(m.id,actor,event_kind,case when p_action='dispute' then jsonb_build_object('dispute_id',dispute_id) else '{}'::jsonb end);
  return jsonb_build_object('milestone_id',m.id,'action',p_action,'transaction_id',txn,'dispute_id',dispute_id,'simulation_only',true);
end;
$$;

create or replace function public.techkarvo_sandbox_resolve_dispute(p_dispute_id uuid,p_resolution text,p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); d public.financial_disputes%rowtype; m public.contract_milestones%rowtype; c public.contracts%rowtype;
  txn uuid; fee bigint; rate integer; tx_type text; from_acct text; to_acct text;
begin
  if actor is null or not public.techkarvo_is_platform_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_resolution not in ('refund','release') or length(btrim(coalesce(p_note,'')))<5 then raise exception 'Select a valid simulated resolution and add a review note' using errcode='22023'; end if;
  select * into d from public.financial_disputes where id=p_dispute_id for update;
  if d.status<>'open' then raise exception 'Dispute is already resolved' using errcode='23514'; end if;
  select * into m from public.contract_milestones where id=d.milestone_id for update;
  select * into c from public.contracts where id=m.contract_id;
  if p_resolution='refund' then
    tx_type:='sandbox_milestone_refund'; from_acct:='user:'||c.client_id::text||':held'; to_acct:='user:'||c.client_id::text||':available';
  else
    select commission_bps into rate from public.financial_sandbox_config where singleton and sandbox_enabled;
    if rate is null then raise exception 'Financial sandbox is paused' using errcode='55000'; end if;
    fee:=floor((m.amount_kav::numeric*rate)/10000)::bigint;
    perform public.techkarvo_ensure_wallet_accounts(c.freelancer_id);
  end if;
  tx_type:=case when p_resolution='refund' then 'sandbox_milestone_refund' else 'sandbox_milestone_release' end;
  insert into public.ledger_transactions(actor_id,transaction_type,idempotency_key,amount_kav,reference_type,reference_id,note)
    values(actor,tx_type,'dispute-resolution:'||d.id,m.amount_kav,'dispute',d.id::text,'Admin simulated resolution: '||left(btrim(p_note),300)) returning id into txn;
  if p_resolution='refund' then
    insert into public.ledger_entries(transaction_id,account_key,amount_kav) values(txn,from_acct,-m.amount_kav),(txn,to_acct,m.amount_kav);
    update public.contract_milestones set status='refunded',updated_at=now() where id=m.id;
    update public.financial_disputes set status='resolved_refund',resolution_note=left(btrim(p_note),4000),resolved_by=actor,resolved_at=now() where id=d.id;
    update public.contracts set status='active' where id=c.id and status='disputed'
      and not exists(select 1 from public.financial_disputes fd join public.contract_milestones fm on fm.id=fd.milestone_id where fm.contract_id=c.id and fd.status='open' and fd.id<>d.id);
    insert into public.milestone_events(milestone_id,actor_id,event_type,details) values(m.id,actor,'refunded',jsonb_build_object('dispute_id',d.id));
  else
    insert into public.ledger_entries(transaction_id,account_key,amount_kav) values
      (txn,'user:'||c.client_id::text||':held',-m.amount_kav),
      (txn,'user:'||c.freelancer_id::text||':available',m.amount_kav-fee);
    if fee>0 then insert into public.ledger_entries(transaction_id,account_key,amount_kav) values(txn,'platform:simulated_commission',fee); end if;
    update public.contract_milestones set status='released',updated_at=now() where id=m.id;
    update public.financial_disputes set status='resolved_release',resolution_note=left(btrim(p_note),4000),resolved_by=actor,resolved_at=now() where id=d.id;
    update public.contracts set status='active' where id=c.id and status='disputed'
      and not exists(select 1 from public.financial_disputes fd join public.contract_milestones fm on fm.id=fd.milestone_id where fm.contract_id=c.id and fd.status='open' and fd.id<>d.id);
    insert into public.milestone_events(milestone_id,actor_id,event_type,details) values(m.id,actor,'released',jsonb_build_object('dispute_id',d.id));
  end if;
  insert into public.admin_audit_log(actor_id,action,resource_type,resource_id,details)
    values(actor,'sandbox.dispute.resolve','financial_dispute',d.id::text,jsonb_build_object('resolution',p_resolution,'transaction_id',txn));
  return jsonb_build_object('transaction_id',txn,'resolution',p_resolution,'simulation_only',true);
end;
$$;

create or replace function public.techkarvo_sandbox_claim_ad_reward()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); reward bigint; limit_per_day integer; enabled boolean; claim_count integer; txn uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select sandbox_enabled,ad_reward_kav,ad_rewards_per_day into enabled,reward,limit_per_day from public.financial_sandbox_config where singleton;
  if not coalesce(enabled,false) or limit_per_day < 1 then raise exception 'Simulated rewards are paused' using errcode='55000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||current_date::text,2));
  select count(*) into claim_count from public.sandbox_ad_reward_claims where user_id=actor and claim_date=current_date;
  if claim_count>=limit_per_day then raise exception 'Daily simulated reward limit reached' using errcode='23514'; end if;
  perform public.techkarvo_ensure_wallet_accounts(actor);
  insert into public.ledger_transactions(actor_id,transaction_type,idempotency_key,amount_kav,note)
    values(actor,'sandbox_ad_reward','ad-reward:'||current_date::text||':'||(claim_count+1),reward,'Simulated ad reward; no advertisement network or funds') returning id into txn;
  insert into public.ledger_entries(transaction_id,account_key,amount_kav) values
    (txn,'sandbox:ad_reward_pool',-reward),(txn,'user:'||actor::text||':available',reward);
  insert into public.sandbox_ad_reward_claims(user_id,claim_date,claim_number,transaction_id)
    values(actor,current_date,claim_count+1,txn);
  return jsonb_build_object('transaction_id',txn,'reward_kav',reward,'remaining_today',limit_per_day-claim_count-1,'simulation_only',true);
end;
$$;

create or replace function public.techkarvo_admin_upsert_membership_plan(
  p_account_type text,p_slug text,p_display_name text,p_description text,p_credits integer,
  p_sample_price numeric,p_features jsonb,p_active boolean,p_display_order integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); plan_uuid uuid;
begin
  if actor is null or not public.techkarvo_is_platform_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_account_type not in ('client','freelancer') or p_slug not in ('free','plus','gold','premium')
    or p_display_name is null or length(btrim(p_display_name)) not between 1 and 60
    or p_description is null or length(p_description)>500 or p_credits not between 1 and 100000
    or (p_sample_price is not null and (p_sample_price<=0 or p_sample_price>=1000000000 or trunc(p_sample_price)<>p_sample_price or p_sample_price::text in ('NaN','Infinity','-Infinity')))
    or (p_slug='free' and p_sample_price is not null)
    or p_active is null or p_display_order not between 0 and 1000 then raise exception 'Invalid role-specific sample membership plan' using errcode='22023'; end if;
  if p_features is null or jsonb_typeof(p_features) is distinct from 'array' then
    raise exception 'Membership benefits must be a JSON list' using errcode='22023';
  end if;
  if jsonb_array_length(p_features)>30 or exists (
    select 1 from jsonb_array_elements(p_features) feature(value)
    where jsonb_typeof(feature.value)<>'string' or length(btrim(feature.value#>>'{}')) not between 1 and 240
  ) then raise exception 'Membership benefits must contain up to 30 short text values' using errcode='22023'; end if;
  if p_slug='free' and not p_active then raise exception 'The Free sample plan must remain available' using errcode='23514'; end if;
  insert into public.membership_plans(account_type,slug,display_name,description,included_usage_credits,simulated_price_usdt,features,is_active,display_order,updated_by,updated_at)
    values(p_account_type,p_slug,p_display_name,btrim(p_description),p_credits,p_sample_price,p_features,p_active,p_display_order,actor,now())
    on conflict(account_type,slug) do update set display_name=excluded.display_name,description=excluded.description,
      included_usage_credits=excluded.included_usage_credits,simulated_price_usdt=excluded.simulated_price_usdt,
      features=excluded.features,is_active=excluded.is_active,display_order=excluded.display_order,updated_by=actor,updated_at=now()
    returning id into plan_uuid;
  insert into public.admin_audit_log(actor_id,action,resource_type,resource_id,details)
    values(actor,'sandbox.membership_plan.update','membership_plan',p_account_type||':'||p_slug,
      jsonb_build_object('credits',p_credits,'active',p_active,'simulation_only',true));
  return plan_uuid;
end;
$$;

create or replace function public.techkarvo_admin_update_financial_config(
  p_sandbox_enabled boolean,p_commission_bps integer,p_ad_reward_kav bigint,p_ad_rewards_per_day integer,
  p_max_deposit_usdt bigint,p_max_withdrawal_kav bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not public.techkarvo_is_platform_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_commission_bps not between 0 and 9999 or p_ad_reward_kav not between 1 and 1000
    or p_ad_rewards_per_day not between 0 and 100 or p_max_deposit_usdt not between 1 and 1000000
    or p_max_withdrawal_kav not between 1 and 1000000 then raise exception 'Financial simulation setting is out of bounds' using errcode='22023'; end if;
  update public.financial_sandbox_config set sandbox_enabled=p_sandbox_enabled,commission_bps=p_commission_bps,
    ad_reward_kav=p_ad_reward_kav,ad_rewards_per_day=p_ad_rewards_per_day,max_deposit_usdt=p_max_deposit_usdt,
    max_withdrawal_kav=p_max_withdrawal_kav,updated_by=actor,updated_at=now() where singleton;
  insert into public.admin_audit_log(actor_id,action,resource_type,resource_id,details)
    values(actor,'sandbox.configuration.update','financial_sandbox_config','singleton',
      jsonb_build_object('enabled',p_sandbox_enabled,'commission_bps',p_commission_bps,'ad_reward_kav',p_ad_reward_kav,
        'ad_rewards_per_day',p_ad_rewards_per_day,'max_deposit_usdt',p_max_deposit_usdt,'max_withdrawal_kav',p_max_withdrawal_kav,
        'real_money_enabled',false));
end;
$$;

create or replace function public.techkarvo_admin_financial_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.techkarvo_is_platform_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  select jsonb_build_object('simulated_transaction_count',count(*),'simulated_gross_kav',coalesce(sum(amount_kav),0),
    'open_disputes',(select count(*) from public.financial_disputes where status='open'),
    'unbalanced_journals',(select count(*) from public.ledger_transactions t where
      (select count(*) from public.ledger_entries e where e.transaction_id=t.id)<2 or
      (select coalesce(sum(e.amount_kav),0) from public.ledger_entries e where e.transaction_id=t.id)<>0),
    'simulated_commission_kav',coalesce((select sum(e.amount_kav) from public.ledger_entries e where e.account_key='platform:simulated_commission'),0),
    'outstanding_held_kav',coalesce((select sum(e.amount_kav) from public.ledger_entries e where e.account_key like 'user:%:held'),0),
    'real_money_enabled',false)
    into result from public.ledger_transactions;
  return result;
end;
$$;

create or replace function public.techkarvo_admin_financial_configuration()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.techkarvo_is_platform_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  select jsonb_build_object('sandbox_enabled',sandbox_enabled,'commission_bps',commission_bps,
    'ad_reward_kav',ad_reward_kav,'ad_rewards_per_day',ad_rewards_per_day,'max_deposit_usdt',max_deposit_usdt,
    'max_withdrawal_kav',max_withdrawal_kav,'simulation_only',true) into result
    from public.financial_sandbox_config where singleton;
  return result;
end;
$$;

revoke all on function public.techkarvo_sandbox_wallet() from public, anon, authenticated;
revoke all on function public.techkarvo_sandbox_deposit(bigint,text) from public, anon, authenticated;
revoke all on function public.techkarvo_sandbox_withdraw(bigint,text) from public, anon, authenticated;
revoke all on function public.techkarvo_sandbox_activate_plan(text) from public, anon, authenticated;
revoke all on function public.techkarvo_sandbox_create_milestone(uuid,text,bigint,text) from public, anon, authenticated;
revoke all on function public.techkarvo_sandbox_fund_milestone(uuid) from public, anon, authenticated;
revoke all on function public.techkarvo_sandbox_milestone_action(uuid,text,text) from public, anon, authenticated;
revoke all on function public.techkarvo_sandbox_resolve_dispute(uuid,text,text) from public, anon, authenticated;
revoke all on function public.techkarvo_sandbox_claim_ad_reward() from public, anon, authenticated;
revoke all on function public.techkarvo_admin_upsert_membership_plan(text,text,text,text,integer,numeric,jsonb,boolean,integer) from public, anon, authenticated;
revoke all on function public.techkarvo_admin_update_financial_config(boolean,integer,bigint,integer,bigint,bigint) from public, anon, authenticated;
revoke all on function public.techkarvo_admin_financial_summary() from public, anon, authenticated;
revoke all on function public.techkarvo_admin_financial_configuration() from public, anon, authenticated;
grant execute on function public.techkarvo_sandbox_wallet() to authenticated;
grant execute on function public.techkarvo_sandbox_deposit(bigint,text) to authenticated;
grant execute on function public.techkarvo_sandbox_withdraw(bigint,text) to authenticated;
grant execute on function public.techkarvo_sandbox_activate_plan(text) to authenticated;
grant execute on function public.techkarvo_sandbox_create_milestone(uuid,text,bigint,text) to authenticated;
grant execute on function public.techkarvo_sandbox_fund_milestone(uuid) to authenticated;
grant execute on function public.techkarvo_sandbox_milestone_action(uuid,text,text) to authenticated;
grant execute on function public.techkarvo_sandbox_resolve_dispute(uuid,text,text) to authenticated;
grant execute on function public.techkarvo_sandbox_claim_ad_reward() to authenticated;
grant execute on function public.techkarvo_admin_upsert_membership_plan(text,text,text,text,integer,numeric,jsonb,boolean,integer) to authenticated;
grant execute on function public.techkarvo_admin_update_financial_config(boolean,integer,bigint,integer,bigint,bigint) to authenticated;
grant execute on function public.techkarvo_admin_financial_summary() to authenticated;
grant execute on function public.techkarvo_admin_financial_configuration() to authenticated;

commit;
