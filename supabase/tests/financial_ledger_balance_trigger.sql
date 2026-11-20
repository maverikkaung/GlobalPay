-- Isolated PostgreSQL CI only. Force deferred constraints to execute before rollback.
begin;
insert into auth.users(id,raw_user_meta_data) values
  ('c1111111-1111-4111-8111-111111111111','{"full_name":"Ledger Trigger QA","account_type":"client"}');

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='techkarvo_assert_balanced_transaction' and p.prosecdef
  ) then raise exception 'Deferred journal verifier must run with narrowly scoped definer rights'; end if;
  if has_function_privilege('authenticated','public.techkarvo_assert_balanced_transaction()','execute') then
    raise exception 'Authenticated users must not invoke the internal ledger trigger function';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);

do $$
begin
  perform public.techkarvo_sandbox_deposit(3.25,'trigger-deposit-001');
  perform public.techkarvo_sandbox_withdraw(1.25,'trigger-withdraw-001');
end;
$$;

-- The migration's original deferred trigger bug was invisible to rollback-only
-- workflow tests. Force both trigger event queues to validate this journal.
set constraints ledger_transaction_balance_check, ledger_entry_balance_check immediate;
reset role;

do $$
begin
  if exists (
    select 1 from public.ledger_transactions t
    where t.actor_id='c1111111-1111-4111-8111-111111111111'
      and ((select count(*) from public.ledger_entries e where e.transaction_id=t.id)<2
        or (select coalesce(sum(e.amount_kav),0) from public.ledger_entries e where e.transaction_id=t.id)<>0)
  ) then raise exception 'Deferred ledger trigger allowed an unbalanced test transaction'; end if;
  if (select (public.techkarvo_sandbox_wallet()->>'available_kav')::numeric)<>2 then
    raise exception 'Balanced ledger trigger test produced an unexpected wallet balance';
  end if;
end;
$$;

rollback;
