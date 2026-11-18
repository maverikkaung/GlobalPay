begin;

insert into auth.users (id, raw_user_meta_data) values
  ('71111111-1111-4111-8111-111111111111', '{"full_name":"Social Client","account_type":"client"}'),
  ('72222222-2222-4222-8222-222222222222', '{"full_name":"Social Freelancer","account_type":"freelancer"}'),
  ('73333333-3333-4333-8333-333333333333', '{"full_name":"Other Client","account_type":"client"}');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
insert into public.posts (id, author_id, post_type, body, image_path)
values ('74444444-4444-4444-8444-444444444444', auth.uid(), 'service',
  'A professional service showcase', auth.uid()::text || '/service.webp');
insert into public.post_likes (post_id, user_id)
values ('74444444-4444-4444-8444-444444444444', auth.uid());
insert into storage.objects (bucket_id, name)
values ('techkarvo-marketplace', auth.uid()::text || '/work.webp');

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'freelancer_public_profiles' and column_name = 'email') then
    raise exception 'Public profile projection must not expose email';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
do $$
declare
  changed_rows integer;
  unauthorized_upload_blocked boolean := false;
begin
  if not exists (select 1 from public.posts where id = '74444444-4444-4444-8444-444444444444') then
    raise exception 'Marketplace members should read professional posts';
  end if;
  update public.posts set body = 'unauthorized' where id = '74444444-4444-4444-8444-444444444444';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then raise exception 'A user edited another author''s post'; end if;
  insert into public.post_likes (post_id, user_id)
  values ('74444444-4444-4444-8444-444444444444', auth.uid());
  insert into public.post_comments (id, post_id, author_id, body)
  values ('75555555-5555-4555-8555-555555555555', '74444444-4444-4444-8444-444444444444', auth.uid(), 'Interested');
  insert into public.connections (id, requester_id, recipient_id)
  values ('76666666-6666-4666-8666-666666666666', auth.uid(), '72222222-2222-4222-8222-222222222222');
  insert into storage.objects (bucket_id, name)
  values ('techkarvo-marketplace', auth.uid()::text || '/client.webp');
  begin
    insert into storage.objects (bucket_id, name)
    values ('techkarvo-marketplace', '72222222-2222-4222-8222-222222222222/blocked.webp');
  exception when insufficient_privilege then
    unauthorized_upload_blocked := true;
  end;
  if not unauthorized_upload_blocked then raise exception 'Users cannot upload to another member''s folder'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
update public.connections set status = 'Accepted'
where id = '76666666-6666-4666-8666-666666666666';
do $$
declare
  thread_id uuid;
begin
  select id into thread_id from public.conversations
  where application_id = 'connection:76666666-6666-4666-8666-666666666666';
  if thread_id is null then raise exception 'Accepted connection should open a conversation'; end if;
  insert into public.messages (conversation_id, sender_id, body, shared_post_id)
  values (thread_id, auth.uid(), 'Sharing my service', '74444444-4444-4444-8444-444444444444');
  if not exists (select 1 from public.messages where conversation_id = thread_id
    and shared_post_id = '74444444-4444-4444-8444-444444444444') then
    raise exception 'Direct chat should allow a rich post preview';
  end if;
  if not exists (select 1 from public.notifications where user_id = auth.uid()
    and kind = 'post_liked' and data ->> 'post_id' = '74444444-4444-4444-8444-444444444444') then
    raise exception 'Post likes should create notifications';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
do $$
begin
  if exists (select 1 from public.conversations where application_id = 'connection:76666666-6666-4666-8666-666666666666')
    or exists (select 1 from public.messages where shared_post_id = '74444444-4444-4444-8444-444444444444') then
    raise exception 'Non-participants must not read private conversation messages';
  end if;
end;
$$;

reset role;
rollback;
