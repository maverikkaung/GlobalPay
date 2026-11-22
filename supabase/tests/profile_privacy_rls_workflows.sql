begin;
\ir profile_privacy_fixture.sql

do $$
begin
  if exists (
    select 1 from (values
      ('client_public_profiles', 'id,full_name,account_type,country,professional_title,bio,skills,experience,portfolio_url,avatar_path,cover_path'),
      ('freelancer_public_profiles', 'id,full_name,account_type,country,professional_title,bio,skills,experience,portfolio_url,avatar_path,cover_path,is_profile_boosted'),
      ('reviews_public', 'id,reviewee_id,rating,body,created_at')
    ) as expected(view_name, columns)
    where expected.columns is distinct from (
      select string_agg(column_name::text, ',' order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public' and table_name = expected.view_name
    )
  ) then raise exception 'Discovery projection columns changed'; end if;

  if has_table_privilege('anon', 'public.freelancer_public_profiles', 'SELECT')
    or has_table_privilege('anon', 'public.client_public_profiles', 'SELECT')
    or has_table_privilege('anon', 'public.reviews_public', 'SELECT')
    or has_function_privilege('anon', 'public.techkarvo_my_blocked_member_labels()', 'EXECUTE')
    or has_function_privilege('anon', 'public.techkarvo_has_active_work(uuid,uuid)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.ledger_entries', 'SELECT')
    or has_column_privilege('authenticated', 'public.reviews', 'body', 'SELECT')
  then raise exception 'A protected surface has a browser grant'; end if;
end $$;

set local role authenticated;
do $$
begin
  if exists (select 1 from public.freelancer_public_profiles)
    or exists (select 1 from public.client_public_profiles)
    or exists (select 1 from public.reviews_public)
    or exists (select 1 from public.portfolio_items)
    or exists (select 1 from public.connections)
    or exists (select 1 from public.techkarvo_my_blocked_member_labels())
  then raise exception 'An authenticated role without a user identity could read private discovery data'; end if;
end $$;

select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);
do $$
begin
  update public.portfolio_items set title = 'Edited by owner' where title = 'Fixture project';
  if not found then raise exception 'Owner lost portfolio editing'; end if;
  update public.profiles set professional_title = 'Updated by owner' where id = auth.uid();
  if not found then raise exception 'Owner lost profile editing'; end if;
  if not exists (select 1 from public.freelancer_public_profiles where id = auth.uid())
    or not exists (select 1 from public.reviews_public where reviewee_id = auth.uid())
    or not exists (select 1 from public.techkarvo_my_blocked_member_labels() where full_name = 'Blocked Client')
    or not exists (select 1 from public.portfolio_items where title = 'Edited by owner')
  then raise exception 'Owner lost legitimate profile, reviews, portfolio or safety-label access'; end if;
  if exists (select 1 from public.client_public_profiles where full_name = 'Blocked Client')
    or exists (select 1 from public.reviews_public where body = 'Helpful handoff')
    or exists (select 1 from public.connections where requester_id = '94000000-0000-4000-8000-000000000003')
  then raise exception 'Blocker can read blocked discovery data'; end if;
  if public.techkarvo_has_active_work('94000000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000004')
  then raise exception 'An unrelated member could read active work metadata'; end if;
end $$;

select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000002', true);
do $$
begin
  if not exists (select 1 from public.freelancer_public_profiles where full_name = 'Fixture Freelancer')
    or not exists (select 1 from public.portfolio_items where title = 'Edited by owner')
    or not exists (select 1 from public.reviews_public where body = 'Clear communication')
    or not exists (select 1 from public.connections where requester_id = auth.uid())
  then raise exception 'Unblocked client lost expected discovery access'; end if;
  update public.portfolio_items set title = 'Client edit';
  if found then raise exception 'Client can edit another member''s portfolio'; end if;
  if exists (select 1 from public.profiles where id <> auth.uid())
    or exists (select 1 from public.connections where requester_id <> auth.uid())
    or exists (select 1 from public.techkarvo_my_blocked_member_labels())
  then raise exception 'An unrelated client could read private records'; end if;
  if not public.techkarvo_has_active_work(auth.uid(), '94000000-0000-4000-8000-000000000004') then
    raise exception 'A participant lost the active-work safeguard';
  end if;
  begin
    insert into public.user_blocks (blocker_id, blocked_id)
    values (auth.uid(), '94000000-0000-4000-8000-000000000004');
    raise exception 'The block safeguard allowed a block during active work';
  exception when insufficient_privilege then
    null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000003', true);
do $$
begin
  if exists (select 1 from public.freelancer_public_profiles where full_name = 'Fixture Freelancer')
    or exists (select 1 from public.portfolio_items)
    or exists (select 1 from public.reviews_public where body = 'Clear communication')
    or exists (select 1 from public.connections)
    or exists (select 1 from public.techkarvo_my_blocked_member_labels())
  then raise exception 'Blocked client can read protected discovery or block-list data'; end if;
  if not exists (select 1 from public.client_public_profiles where id = auth.uid()) then
    raise exception 'Blocked client lost access to their own profile';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000004', true);
do $$
begin
  if not exists (select 1 from public.freelancer_public_profiles where full_name = 'Fixture Freelancer')
    or not exists (select 1 from public.reviews_public where body = 'Clear communication')
    or exists (select 1 from public.portfolio_items)
    or exists (select 1 from public.connections)
  then raise exception 'Unrelated freelancer visibility does not match the role boundary'; end if;
end $$;

select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);
delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = '94000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000003', true);
do $$
begin
  if not exists (select 1 from public.connections where requester_id = auth.uid())
    or not exists (select 1 from public.freelancer_public_profiles where full_name = 'Fixture Freelancer')
    or not exists (select 1 from public.portfolio_items where title = 'Edited by owner')
  then raise exception 'Unblocking did not restore existing data visibility'; end if;
end $$;
rollback;
