begin;

-- The previous trigger used CASE against two different trigger-row shapes and
-- ran as the invoker. Use explicit table branches and a tightly scoped definer
-- so deferred checks can safely inspect tables unavailable to authenticated roles.
create or replace function public.techkarvo_assert_balanced_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  txn_id uuid;
  entry_count bigint;
  net_amount numeric(14,2);
begin
  if tg_table_schema <> 'public' then
    raise exception 'Unexpected ledger trigger schema' using errcode='55000';
  end if;

  if tg_table_name = 'ledger_transactions' then
    txn_id := new.id;
  elsif tg_table_name = 'ledger_entries' then
    txn_id := new.transaction_id;
  else
    raise exception 'Unexpected ledger trigger table' using errcode='55000';
  end if;

  select count(*), coalesce(sum(e.amount_kav),0)
    into entry_count, net_amount
    from public.ledger_entries e
    where e.transaction_id = txn_id;

  if entry_count < 2 or net_amount <> 0 then
    raise exception 'Every sandbox ledger transaction must have at least two balanced KAV entries'
      using errcode='23514';
  end if;
  return null;
end;
$$;

revoke all on function public.techkarvo_assert_balanced_transaction() from public, anon, authenticated;

commit;
