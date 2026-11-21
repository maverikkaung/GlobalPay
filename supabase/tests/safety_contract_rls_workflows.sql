-- Exercises contracts, user blocks/mutes/reports, conversation visibility,
-- message redaction, and review authorization in disposable PostgreSQL CI only.
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('81111111-1111-4111-8111-111111111111', '{"full_name":"Safety Client","account_type":"client"}'),
  ('82222222-2222-4222-8222-222222222222', '{"full_name":"Safety Freelancer","account_type":"freelancer"}'),
  ('83333333-3333-4333-8333-333333333333', '{"full_name":"Personal Client","account_type":"client"}'),
  ('84444444-4444-4444-8444-444444444444', '{"full_name":"Personal Freelancer","account_type":"freelancer"}');

insert into public.jobs (id, client_id, title, description, budget) values
  ('85555555-5555-4555-8555-555555555555', '81111111-1111-4111-8111-111111111111', 'Contract workflow', 'Security test', 250);
insert into public.job_applications (id, job_id, client_id, freelancer_id, full_name, email)
values ('86666666-6666-4666-8666-666666666666', '85555555-5555-4555-8555-555555555555',
  '81111111-1111-4111-8111-111111111111', '82222222-2222-4222-8222-222222222222',
  'Safety Freelancer', 'safety@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '81111111-1111-4111-8111-111111111111', true);

update public.job_applications set status = 'Accepted'
where id = '86666666-6666-4666-8666-666666666666';

do $$
declare
  block_denied boolean := false;
  contract_write_denied boolean := false;
begin
  if not exists (select 1 from public.contracts where application_id = '86666666-6666-4666-8666-666666666666' and status = 'active') then
    raise exception 'Accepting an applicant must create an unpaid active contract record';
  end if;
  begin
    insert into public.user_blocks (blocker_id, blocked_id)
    values (auth.uid(), '82222222-2222-4222-8222-222222222222');
  exception when insufficient_privilege then block_denied := true;
  end;
  if not block_denied then raise exception 'Blocking an active-contract participant must be denied'; end if;
  begin
    insert into public.contracts (application_id, job_id, client_id, freelancer_id)
    values ('86666666-6666-4666-8666-666666666666', '85555555-5555-4555-8555-555555555555',
      auth.uid(), '82222222-2222-4222-8222-222222222222');
  exception when insufficient_privilege or unique_violation then contract_write_denied := true;
  end;
  if not contract_write_denied then raise exception 'Users must not create contract rows directly'; end if;
end;
$$;

update public.jobs set status = 'completed'
where id = '85555555-5555-4555-8555-555555555555';
do $$
begin
  if not exists (select 1 from public.contracts where application_id = '86666666-6666-4666-8666-666666666666'
    and status = 'completed' and completed_at is not null) then
    raise exception 'Completing the project must complete its contract';
  end if;
end;
$$;

insert into public.reviews (application_id, job_id, reviewer_id, reviewee_id, rating, body)
values ('86666666-6666-4666-8666-666666666666', '85555555-5555-4555-8555-555555555555',
  auth.uid(), '82222222-2222-4222-8222-222222222222', 5, 'Verified completed work');
insert into public.user_blocks (blocker_id, blocked_id)
values (auth.uid(), '82222222-2222-4222-8222-222222222222');
do $$
begin
  if public.techkarvo_can_connect(auth.uid(), '82222222-2222-4222-8222-222222222222') then
    raise exception 'Blocked members must not start a new personal connection';
  end if;
end;
$$;

insert into public.conversations (application_id, job_id, client_id, freelancer_id, created_by)
values ('86666666-6666-4666-8666-666666666666', '85555555-5555-4555-8555-555555555555',
  auth.uid(), '82222222-2222-4222-8222-222222222222', auth.uid());
insert into public.messages (id, conversation_id, sender_id, body, created_at)
select '87777777-7777-4777-8777-777777777777', id, auth.uid(), 'Private test text', now()
from public.conversations where application_id = '86666666-6666-4666-8666-666666666666';
do $$
declare
  direct_redaction_denied boolean := false;
begin
  begin
    update public.messages set body = '[Message removed]', deleted_for_everyone_at = now(),
      deleted_by = auth.uid() where id = '87777777-7777-4777-8777-777777777777';
  exception when insufficient_privilege then direct_redaction_denied := true;
  end;
  if not direct_redaction_denied then raise exception 'Message redaction must require the audited RPC'; end if;
  if not public.techkarvo_delete_message_for_everyone('87777777-7777-4777-8777-777777777777') then
    raise exception 'New message should be redacted for everyone';
  end if;
  if not exists (select 1 from public.messages where id = '87777777-7777-4777-8777-777777777777'
    and body = '[Message removed]' and deleted_for_everyone_at is not null) then
    raise exception 'Redaction must preserve the message row and expose only the redacted body';
  end if;
  if has_table_privilege('authenticated', 'public.message_redactions', 'SELECT') then
    raise exception 'Participants must not read retained redaction evidence';
  end if;
end;
$$;
insert into public.conversation_hides (conversation_id, user_id)
select id, auth.uid() from public.conversations where application_id = '86666666-6666-4666-8666-666666666666';
select set_config('request.jwt.claim.sub', '82222222-2222-4222-8222-222222222222', true);
do $$
begin
  if exists (select 1 from public.conversation_hides where conversation_id in (
    select id from public.conversations where application_id = '86666666-6666-4666-8666-666666666666'
  )) then
    raise exception 'The other participant cannot see the owner''s conversation hide';
  end if;
  delete from public.conversation_hides where conversation_id in (
    select id from public.conversations where application_id = '86666666-6666-4666-8666-666666666666'
  );
  if found then raise exception 'The other participant cannot remove the owner''s conversation hide'; end if;
end;
$$;
select set_config('request.jwt.claim.sub', '81111111-1111-4111-8111-111111111111', true);
do $$
begin
  if not exists (select 1 from public.conversation_hides where user_id = auth.uid()) then
    raise exception 'A conversation participant can hide a thread for themselves';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '83333333-3333-4333-8333-333333333333', true);

insert into public.connections (id, requester_id, recipient_id)
values ('89999999-9999-4999-8999-999999999999', auth.uid(), '84444444-4444-4444-8444-444444444444');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '84444444-4444-4444-8444-444444444444', true);
update public.connections set status = 'Accepted' where id = '89999999-9999-4999-8999-999999999999';
reset role;
insert into public.jobs (id, client_id, title, description, budget)
values ('9aaa9999-9999-4999-8999-999999999999', '83333333-3333-4333-8333-333333333333',
  'Job chat retained', 'Existing job conversation test', 100);
insert into public.job_applications (id, job_id, client_id, freelancer_id, status)
values ('9bbb9999-9999-4999-8999-999999999999', '9aaa9999-9999-4999-8999-999999999999',
  '83333333-3333-4333-8333-333333333333', '84444444-4444-4444-8444-444444444444', 'Pending');
insert into public.conversations (id, application_id, job_id, client_id, freelancer_id, created_by)
values ('9ccc9999-9999-4999-8999-999999999999', '9bbb9999-9999-4999-8999-999999999999',
  '9aaa9999-9999-4999-8999-999999999999', '83333333-3333-4333-8333-333333333333',
  '84444444-4444-4444-8444-444444444444', '83333333-3333-4333-8333-333333333333');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '84444444-4444-4444-8444-444444444444', true);
select set_config('techkarvo.test_conversation_id',
  (select id::text from public.conversations where application_id = 'connection:89999999-9999-4999-8999-999999999999'), true);
insert into public.posts (id, author_id, body)
values ('88888888-8888-4888-8888-888888888889', auth.uid(), 'Shared post deletion test');
insert into public.messages (id, conversation_id, sender_id, body, shared_post_id)
values ('87777777-7777-4777-8777-777777777778',
  current_setting('techkarvo.test_conversation_id')::uuid, auth.uid(), 'Shared post preview retained',
  '88888888-8888-4888-8888-888888888889');
do $$
declare
  direct_reference_edit_denied boolean := false;
begin
  begin
    update public.messages set shared_post_id = null where id = '87777777-7777-4777-8777-777777777778';
  exception when insufficient_privilege then direct_reference_edit_denied := true;
  end;
  if not direct_reference_edit_denied then
    raise exception 'Authenticated users must not directly edit shared-post references';
  end if;
end;
$$;
delete from public.posts where id = '88888888-8888-4888-8888-888888888889';
do $$
begin
  if exists (select 1 from public.posts where id = '88888888-8888-4888-8888-888888888889') then
    raise exception 'A post owner must be able to remove their post';
  end if;
  if not exists (select 1 from public.messages where id = '87777777-7777-4777-8777-777777777778'
    and body = 'Shared post preview retained' and shared_post_id is null and deleted_for_everyone_at is null) then
    raise exception 'Deleting a shared post must clear only its preview reference and retain the message';
  end if;
end;
$$;

insert into public.posts (id, author_id, body)
values ('88888888-8888-4888-8888-888888888888', auth.uid(), 'Blocked member post');
insert into public.post_likes (post_id, user_id)
values ('88888888-8888-4888-8888-888888888888', auth.uid());
insert into public.post_comments (post_id, author_id, body)
values ('88888888-8888-4888-8888-888888888888', auth.uid(), 'Visible before block');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '83333333-3333-4333-8333-333333333333', true);
insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), '84444444-4444-4444-8444-444444444444');
do $$
declare
  blocked_message_denied boolean := false;
  blocked_post_hidden boolean := false;
  blocked_comment_hidden boolean := false;
  blocked_likes_hidden boolean := false;
begin
  if exists (select 1 from public.posts where id = '88888888-8888-4888-8888-888888888888') then
    blocked_post_hidden := false;
  else
    blocked_post_hidden := true;
  end if;
  if not blocked_post_hidden then raise exception 'Blocked users must not see one another''s social content'; end if;
  select not exists (select 1 from public.post_comments where post_id = '88888888-8888-4888-8888-888888888888')
    into blocked_comment_hidden;
  select not exists (select 1 from public.post_likes where post_id = '88888888-8888-4888-8888-888888888888')
    into blocked_likes_hidden;
  if not blocked_comment_hidden or not blocked_likes_hidden then
    raise exception 'Blocked users must not see engagement on hidden posts';
  end if;
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (current_setting('techkarvo.test_conversation_id')::uuid, auth.uid(), 'Blocked personal message');
  exception when insufficient_privilege then blocked_message_denied := true;
  end;
  if not blocked_message_denied then raise exception 'Blocked users must not send personal messages'; end if;
  insert into public.muted_users (user_id, muted_user_id) values (auth.uid(), '82222222-2222-4222-8222-222222222222');
  insert into public.user_reports (reporter_id, reported_user_id, category, details)
  values (auth.uid(), '84444444-4444-4444-8444-444444444444', 'harassment', 'Safety test report');
  if not exists (select 1 from public.user_reports where reporter_id = auth.uid()) then
    raise exception 'A reporter can read their own safety report';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '84444444-4444-4444-8444-444444444444', true);
do $$
begin
  if exists (select 1 from public.conversations where application_id = 'connection:89999999-9999-4999-8999-999999999999') then
    raise exception 'A blocked participant must not read the personal conversation';
  end if;
  if exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
    where c.application_id = 'connection:89999999-9999-4999-8999-999999999999') then
    raise exception 'A blocked participant must not read personal messages';
  end if;
  if not exists (select 1 from public.conversations where application_id = '9bbb9999-9999-4999-8999-999999999999') then
    raise exception 'Blocking must preserve existing job-related conversations';
  end if;
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (current_setting('techkarvo.test_conversation_id')::uuid, auth.uid(), 'Blocked personal message from recipient');
    raise exception 'Blocked users must not send personal messages';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.user_reports where reported_user_id = auth.uid()) then
    raise exception 'Reported members must not read private report details';
  end if;
  if exists (select 1 from public.conversation_hides) then
    raise exception 'Conversation visibility rows must be private to their owner';
  end if;
end;
$$;

reset role;
rollback;
