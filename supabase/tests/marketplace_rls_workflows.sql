-- Simulate legacy permissive policies; the migration's restrictive boundaries
-- must keep them from widening access.
create policy "CI legacy profile read" on public.profiles
  for select to authenticated using (true);
create policy "CI legacy profile update" on public.profiles
  for update to authenticated using (true) with check (true);
create policy "CI legacy job access" on public.jobs
  for all to anon, authenticated using (true) with check (true);
create policy "CI legacy application access" on public.job_applications
  for all to authenticated using (true) with check (true);
create policy "CI legacy conversation access" on public.conversations
  for all to authenticated using (true) with check (true);
create policy "CI legacy message access" on public.messages
  for all to authenticated using (true) with check (true);
create policy "CI legacy notification access" on public.notifications
  for all to authenticated using (true) with check (true);
create policy "CI legacy portfolio access" on public.portfolio_items
  for all to authenticated using (true) with check (true);
create policy "CI legacy review insert" on public.reviews
  for insert to authenticated with check (true);
create policy "CI legacy review read" on public.reviews
  for select to authenticated using (true);

begin;

insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', '{"full_name":"CI Client","account_type":"client"}'),
  ('22222222-2222-4222-8222-222222222222', '{"full_name":"CI Freelancer","account_type":"freelancer"}'),
  ('22222222-2222-4222-8222-222222222223', '{"full_name":"CI Second Freelancer","account_type":"freelancer"}');

insert into public.jobs (id, client_id, title, description, budget) values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Accepted project', 'Workflow fixture', 100),
  ('33333333-3333-4333-8333-333333333334', '11111111-1111-4111-8111-111111111111', 'Pending project', 'Workflow fixture', 50),
  ('33333333-3333-4333-8333-333333333335', '11111111-1111-4111-8111-111111111111', 'Empty project', 'Workflow fixture', 25);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

insert into public.job_applications (id, job_id, client_id, freelancer_id, full_name, email)
values ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  'CI Freelancer', 'ci-freelancer@example.invalid');

do $$
declare
  duplicate_blocked boolean := false;
begin
  begin
    insert into public.job_applications (id, job_id, client_id, freelancer_id, full_name, email)
    values ('44444444-4444-4444-8444-444444444445', '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
      'CI Freelancer', 'ci-freelancer@example.invalid');
  exception when unique_violation then
    duplicate_blocked := true;
  end;
  if not duplicate_blocked then
    raise exception 'Duplicate freelancer application was accepted';
  end if;

  begin
    update public.job_applications set status = 'Accepted'
    where id = '44444444-4444-4444-8444-444444444444';
  exception when raise_exception or insufficient_privilege then
    null;
  end;
  if not exists (
    select 1 from public.job_applications
    where id = '44444444-4444-4444-8444-444444444444' and status = 'Pending'
  ) then
    raise exception 'Freelancers must not change their own application decision';
  end if;

  if (select count(*) from public.profiles) <> 1 then
    raise exception 'A freelancer must only read their own profile';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', true);

insert into public.job_applications (id, job_id, client_id, freelancer_id, full_name, email)
values ('44444444-4444-4444-8444-444444444446', '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222223',
  'CI Second Freelancer', 'ci-second-freelancer@example.invalid');

insert into public.job_applications (id, job_id, client_id, freelancer_id, full_name, email)
values ('44444444-4444-4444-8444-444444444447', '33333333-3333-4333-8333-333333333334',
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222223',
  'CI Second Freelancer', 'ci-second-freelancer@example.invalid');

update public.job_applications set status = 'Withdrawn'
where id = '44444444-4444-4444-8444-444444444447'
  and freelancer_id = (select auth.uid()) and status = 'Pending';

do $$
declare
  duplicate_blocked boolean := false;
begin
  if not exists (
    select 1 from public.job_applications
    where id = '44444444-4444-4444-8444-444444444447' and status = 'Withdrawn'
  ) then
    raise exception 'Withdrawals must preserve the application as history';
  end if;

  begin
    insert into public.job_applications (id, job_id, client_id, freelancer_id, full_name, email)
    values ('44444444-4444-4444-8444-444444444448', '33333333-3333-4333-8333-333333333334',
      '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222223',
      'CI Second Freelancer', 'ci-second-freelancer@example.invalid');
  exception when unique_violation then
    duplicate_blocked := true;
  end;
  if not duplicate_blocked then
    raise exception 'A withdrawn application must still prevent duplicate applications';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

update public.profiles set full_name = 'CI Client Updated', country = 'Test City'
where id = (select auth.uid());

do $$
declare
  role_change_blocked boolean := false;
begin
  if not exists (
    select 1 from public.notifications
    where user_id = (select auth.uid())
      and kind = 'application_withdrawn'
      and data->>'application_id' = '44444444-4444-4444-8444-444444444447'
  ) then
    raise exception 'The client should be notified when a freelancer withdraws';
  end if;

  begin
    update public.profiles set account_type = 'freelancer'
    where id = (select auth.uid());
  exception when raise_exception then
    role_change_blocked := true;
  end;
  if not role_change_blocked then
    raise exception 'Users must not change their own account role';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and full_name = 'CI Client Updated'
      and country = 'Test City' and account_type = 'client'
  ) then
    raise exception 'Clients should be able to update their own public profile';
  end if;
end;
$$;

do $$
declare
  completion_blocked boolean := false;
begin
  begin
    update public.jobs set status = 'completed'
    where id = '33333333-3333-4333-8333-333333333334';
  exception when check_violation then
    completion_blocked := true;
  end;
  if not completion_blocked then
    raise exception 'A client completed a project with no accepted freelancer';
  end if;
end;
$$;

update public.job_applications set status = 'Accepted'
where id = '44444444-4444-4444-8444-444444444444';

insert into public.conversations (application_id, job_id, client_id, freelancer_id, created_by)
values ('44444444-4444-4444-8444-444444444446', '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222223',
  '11111111-1111-4111-8111-111111111111');

insert into public.messages (conversation_id, sender_id, body)
select id, '11111111-1111-4111-8111-111111111111', 'Let me know if you have any questions.'
from public.conversations where application_id = '44444444-4444-4444-8444-444444444446';

update public.jobs set status = 'completed'
where id = '33333333-3333-4333-8333-333333333333';

do $$
begin
  if not exists (
    select 1 from public.job_applications
    where id = '44444444-4444-4444-8444-444444444446' and status = 'Rejected'
  ) then
    raise exception 'Completing a project should close pending applications';
  end if;

  begin
    update public.job_applications set status = 'Accepted'
    where id = '44444444-4444-4444-8444-444444444446';
    raise exception 'A closed application must not be accepted afterward';
  exception when check_violation then
    null;
  end;
end;
$$;

insert into public.reviews (application_id, job_id, reviewer_id, reviewee_id, rating, body)
values ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 5, 'Great work');

insert into public.conversations (application_id, job_id, client_id, freelancer_id, created_by)
values ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111');

insert into public.messages (conversation_id, sender_id, body)
select id, '11111111-1111-4111-8111-111111111111', 'The completed work looks great.'
from public.conversations where application_id = '44444444-4444-4444-8444-444444444444';

do $$
declare
  deleted_rows integer;
  history_delete_blocked boolean := false;
begin
  begin
    delete from public.jobs where id = '33333333-3333-4333-8333-333333333333';
  exception when raise_exception then
    history_delete_blocked := true;
  end;
  if not history_delete_blocked then
    raise exception 'Jobs with application history must not be deleted';
  end if;

  delete from public.jobs where id = '33333333-3333-4333-8333-333333333335';
  get diagnostics deleted_rows = row_count;
  if deleted_rows <> 1 then
    raise exception 'Clients should be able to delete jobs without applications';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222223', true);

do $$
declare
  outsider_review_blocked boolean := false;
  closed_conversation_id uuid;
  closed_message_blocked boolean := false;
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'A legacy profile policy exposed another user profile';
  end if;
  if exists (
    select 1 from public.job_applications
    where freelancer_id <> (select auth.uid())
  ) then
    raise exception 'A legacy application policy exposed another freelancer application';
  end if;
  if exists (select 1 from public.jobs where status = 'completed') then
    raise exception 'A legacy jobs policy exposed a completed project to an outsider';
  end if;
  if (select count(*) from public.conversations) <> 1
    or exists (select 1 from public.conversations where application_id <> '44444444-4444-4444-8444-444444444446')
    or (select count(*) from public.messages) <> 1
    or (select count(*) from public.portfolio_items) <> 0 then
    raise exception 'A legacy policy exposed another user’s private marketplace data';
  end if;
  if exists (
    select 1 from public.notifications
    where user_id <> (select auth.uid())
  ) then
    raise exception 'A legacy notification policy exposed another user’s notifications';
  end if;
  if (select count(application_id) from public.reviews) <> 0
    or (select count(*) from public.reviews_public) <> 1 then
    raise exception 'Review authorship must stay private while public review content remains visible';
  end if;

  begin
    insert into public.reviews (application_id, job_id, reviewer_id, reviewee_id, rating, body)
    values ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333',
      (select auth.uid()), '11111111-1111-4111-8111-111111111111', 1, 'Unauthorized review');
    raise exception 'A legacy review policy allowed a non-participant to review';
  exception when insufficient_privilege then
    outsider_review_blocked := true;
  end;
  if not outsider_review_blocked then
    raise exception 'A non-participant review was not blocked';
  end if;

  select id into closed_conversation_id from public.conversations
  where application_id = '44444444-4444-4444-8444-444444444446';
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (closed_conversation_id, (select auth.uid()), 'Can you still read this?');
    raise exception 'Messaging was allowed after the application closed';
  exception when insufficient_privilege then
    closed_message_blocked := true;
  end;
  if not closed_message_blocked then
    raise exception 'Closed application messaging was not blocked';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

do $$
begin
  if not exists (
    select 1 from public.job_applications
    where id = '44444444-4444-4444-8444-444444444444' and status = 'Accepted'
  ) then
    raise exception 'The accepted freelancer should retain their accepted status';
  end if;
end;
$$;

update public.messages set read_at = now()
where conversation_id = (select id from public.conversations
  where application_id = '44444444-4444-4444-8444-444444444444');

update public.notifications set read_at = now()
where user_id = '22222222-2222-4222-8222-222222222222' and kind = 'new_message';

insert into public.reviews (application_id, job_id, reviewer_id, reviewee_id, rating, body)
values ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 5, 'Clear communication');

insert into public.portfolio_items (freelancer_id, title, project_url)
values ('22222222-2222-4222-8222-222222222222', 'CI portfolio', 'https://example.invalid/project');

update public.portfolio_items set title = 'Updated CI portfolio'
where freelancer_id = (select auth.uid());

do $$
begin
  if (select count(application_id) from public.reviews) <> 1
    or (select count(*) from public.reviews_public) <> 2 then
    raise exception 'Both project participants should submit reviews while public content stays visible';
  end if;
  if (select count(*) from public.portfolio_items) <> 1
    or not exists (select 1 from public.portfolio_items where title = 'Updated CI portfolio') then
    raise exception 'Freelancers should be able to update their own portfolios';
  end if;
  if not exists (
    select 1 from public.notifications where user_id = '22222222-2222-4222-8222-222222222222'
      and kind = 'new_message' and read_at is not null
  ) then
    raise exception 'Message notifications and read receipts should work';
  end if;
end;
$$;

delete from public.portfolio_items where freelancer_id = (select auth.uid());

do $$
begin
  if exists (select 1 from public.portfolio_items where freelancer_id = (select auth.uid())) then
    raise exception 'Freelancers should be able to delete their own portfolio items';
  end if;
end;
$$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.notifications
    where user_id = '22222222-2222-4222-8222-222222222223'
      and kind = 'application_rejected'
  ) then
    raise exception 'Closing a pending application should notify its freelancer';
  end if;
end;
$$;

rollback;
