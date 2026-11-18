-- TechKarvo social marketplace: public profile media, professional posts,
-- engagement, opt-in connections, direct chats, and public-work image storage.
-- Additive only. Apply to a reviewed staging project after explicit approval.

begin;

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists cover_path text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_path_owner_folder_check') then
    alter table public.profiles add constraint profiles_avatar_path_owner_folder_check
      check (avatar_path is null or avatar_path like id::text || '/%');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cover_path_owner_folder_check') then
    alter table public.profiles add constraint profiles_cover_path_owner_folder_check
      check (cover_path is null or cover_path like id::text || '/%');
  end if;
end;
$$;

-- These views are the only public profile projections. Do not expose auth email,
-- application contact data, or other private profile fields through them.
create or replace view public.freelancer_public_profiles
with (security_barrier = true)
as
select id, full_name, account_type, country, professional_title, bio,
  skills, experience, portfolio_url, avatar_path, cover_path
from public.profiles
where account_type = 'freelancer';

create or replace view public.client_public_profiles
with (security_barrier = true)
as
select id, full_name, account_type, country, professional_title, bio,
  skills, experience, portfolio_url, avatar_path, cover_path
from public.profiles
where account_type = 'client';

revoke all on public.freelancer_public_profiles, public.client_public_profiles from public, anon, authenticated;
grant select on public.freelancer_public_profiles, public.client_public_profiles to authenticated;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  post_type text not null default 'professional'
    check (post_type in ('professional', 'service')),
  body text not null default '' check (length(body) <= 5000),
  image_path text,
  portfolio_item_id uuid references public.portfolio_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_body_or_image_check check (length(btrim(body)) > 0 or image_path is not null),
  constraint posts_image_owner_folder_check check (image_path is null or image_path like author_id::text || '/%')
);

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Declined')),
  member_low uuid generated always as (least(requester_id, recipient_id)) stored,
  member_high uuid generated always as (greatest(requester_id, recipient_id)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connections_different_users check (requester_id <> recipient_id),
  constraint connections_unique_pair unique (member_low, member_high)
);

alter table public.messages
  add column if not exists shared_post_id uuid references public.posts(id) on delete set null;

create index posts_author_created_idx on public.posts (author_id, created_at desc);
create index post_comments_post_created_idx on public.post_comments (post_id, created_at);
create index post_likes_user_created_idx on public.post_likes (user_id, created_at desc);
create index connections_recipient_status_idx on public.connections (recipient_id, status, created_at desc);
create index connections_requester_status_idx on public.connections (requester_id, status, created_at desc);
create index messages_shared_post_idx on public.messages (shared_post_id) where shared_post_id is not null;

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.connections enable row level security;

revoke all on table public.posts, public.post_likes, public.post_comments, public.connections
  from public, anon, authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, update, delete on public.post_comments to authenticated;
grant select, insert on public.connections to authenticated;
grant update (status) on public.connections to authenticated;
grant select (shared_post_id) on public.messages to authenticated;
grant insert (shared_post_id) on public.messages to authenticated;

drop policy if exists "Authenticated users can read professional posts" on public.posts;
create policy "Authenticated users can read professional posts"
  on public.posts for select to authenticated using (true);
drop policy if exists "Post reader boundary" on public.posts;
create policy "Post reader boundary"
  on public.posts as restrictive for select to authenticated using (true);
drop policy if exists "Users publish their own professional posts" on public.posts;
create policy "Users publish their own professional posts"
  on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid())
      and p.account_type in ('client', 'freelancer'))
    and (post_type <> 'service' or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'freelancer'
    ))
    and (portfolio_item_id is null or exists (
      select 1 from public.portfolio_items pi where pi.id = portfolio_item_id and pi.freelancer_id = (select auth.uid())
    ))
  );
drop policy if exists "Post insert boundary" on public.posts;
create policy "Post insert boundary"
  on public.posts as restrictive for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (image_path is null or image_path like (select auth.uid())::text || '/%')
  );
drop policy if exists "Authors manage their posts" on public.posts;
create policy "Authors manage their posts"
  on public.posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
drop policy if exists "Post update boundary" on public.posts;
create policy "Post update boundary"
  on public.posts as restrictive for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid())
    and (image_path is null or image_path like (select auth.uid())::text || '/%')
    and (post_type <> 'service' or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'freelancer'
    ))
    and (portfolio_item_id is null or exists (
      select 1 from public.portfolio_items pi where pi.id = portfolio_item_id and pi.freelancer_id = (select auth.uid())
    )));
drop policy if exists "Authors delete their posts" on public.posts;
create policy "Authors delete their posts"
  on public.posts for delete to authenticated using (author_id = (select auth.uid()));
drop policy if exists "Post delete boundary" on public.posts;
create policy "Post delete boundary"
  on public.posts as restrictive for delete to authenticated using (author_id = (select auth.uid()));
drop policy if exists "Anonymous users cannot access posts" on public.posts;
create policy "Anonymous users cannot access posts"
  on public.posts as restrictive for all to anon using (false) with check (false);

drop policy if exists "Authenticated users can read post likes" on public.post_likes;
create policy "Authenticated users can read post likes"
  on public.post_likes for select to authenticated using (true);
drop policy if exists "Post like read boundary" on public.post_likes;
create policy "Post like read boundary"
  on public.post_likes as restrictive for select to authenticated using (true);
drop policy if exists "Users like posts as themselves" on public.post_likes;
create policy "Users like posts as themselves"
  on public.post_likes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Post like insert boundary" on public.post_likes;
create policy "Post like insert boundary"
  on public.post_likes as restrictive for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users remove their likes" on public.post_likes;
create policy "Users remove their likes"
  on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Post like delete boundary" on public.post_likes;
create policy "Post like delete boundary"
  on public.post_likes as restrictive for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Anonymous users cannot access post likes" on public.post_likes;
create policy "Anonymous users cannot access post likes"
  on public.post_likes as restrictive for all to anon using (false) with check (false);

drop policy if exists "Authenticated users can read post comments" on public.post_comments;
create policy "Authenticated users can read post comments"
  on public.post_comments for select to authenticated using (true);
drop policy if exists "Post comment read boundary" on public.post_comments;
create policy "Post comment read boundary"
  on public.post_comments as restrictive for select to authenticated using (true);
drop policy if exists "Users comment as themselves" on public.post_comments;
create policy "Users comment as themselves"
  on public.post_comments for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "Post comment insert boundary" on public.post_comments;
create policy "Post comment insert boundary"
  on public.post_comments as restrictive for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "Authors edit their comments" on public.post_comments;
create policy "Authors edit their comments"
  on public.post_comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
drop policy if exists "Post comment update boundary" on public.post_comments;
create policy "Post comment update boundary"
  on public.post_comments as restrictive for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create or replace function public.techkarvo_protect_post_comment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.post_id is distinct from old.post_id
    or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Comment ownership and post association cannot be changed';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.techkarvo_protect_post_comment_update() from public, anon, authenticated;
drop trigger if exists techkarvo_protect_post_comment_before_update on public.post_comments;
create trigger techkarvo_protect_post_comment_before_update
  before update on public.post_comments for each row
  execute function public.techkarvo_protect_post_comment_update();
drop policy if exists "Authors delete their comments" on public.post_comments;
create policy "Authors delete their comments"
  on public.post_comments for delete to authenticated using (author_id = (select auth.uid()));
drop policy if exists "Post comment delete boundary" on public.post_comments;
create policy "Post comment delete boundary"
  on public.post_comments as restrictive for delete to authenticated using (author_id = (select auth.uid()));
drop policy if exists "Anonymous users cannot access post comments" on public.post_comments;
create policy "Anonymous users cannot access post comments"
  on public.post_comments as restrictive for all to anon using (false) with check (false);

drop policy if exists "Connection participants can read requests" on public.connections;
create policy "Connection participants can read requests"
  on public.connections for select to authenticated
  using (requester_id = (select auth.uid()) or recipient_id = (select auth.uid()));
drop policy if exists "Connection read boundary" on public.connections;
create policy "Connection read boundary"
  on public.connections as restrictive for select to authenticated
  using (requester_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- Profile rows are intentionally private. Use a narrow, non-disclosing helper
-- to validate that connection requests cross the client/freelancer boundary.
create or replace function public.techkarvo_can_connect(p_requester_id uuid, p_recipient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_requester_id = auth.uid()
    and p_requester_id <> p_recipient_id
    and exists (
      select 1 from public.profiles requester, public.profiles recipient
      where requester.id = p_requester_id and recipient.id = p_recipient_id
        and requester.account_type in ('client', 'freelancer')
        and recipient.account_type in ('client', 'freelancer')
        and requester.account_type <> recipient.account_type
    );
$$;
revoke all on function public.techkarvo_can_connect(uuid, uuid) from public, anon, authenticated;
grant execute on function public.techkarvo_can_connect(uuid, uuid) to authenticated;

drop policy if exists "Users can request a connection" on public.connections;
create policy "Users can request a connection"
  on public.connections for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and public.techkarvo_can_connect(requester_id, recipient_id)
  );
drop policy if exists "Connection insert boundary" on public.connections;
create policy "Connection insert boundary"
  on public.connections as restrictive for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'Pending');
drop policy if exists "Recipients answer connection requests" on public.connections;
create policy "Recipients answer connection requests"
  on public.connections for update to authenticated
  using (recipient_id = (select auth.uid()) and status = 'Pending')
  with check (recipient_id = (select auth.uid()) and status in ('Accepted', 'Declined'));
drop policy if exists "Connection update boundary" on public.connections;
create policy "Connection update boundary"
  on public.connections as restrictive for update to authenticated
  using (recipient_id = (select auth.uid()) and status = 'Pending')
  with check (recipient_id = (select auth.uid()) and status in ('Accepted', 'Declined'));
drop policy if exists "Anonymous users cannot access connections" on public.connections;
create policy "Anonymous users cannot access connections"
  on public.connections as restrictive for all to anon using (false) with check (false);

create or replace function public.techkarvo_protect_connection_response()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.requester_id is distinct from old.requester_id
    or new.recipient_id is distinct from old.recipient_id
    or new.created_at is distinct from old.created_at
    or old.status <> 'Pending'
    or new.status not in ('Accepted', 'Declined')
    or auth.uid() is distinct from old.recipient_id then
    raise exception 'Only the recipient may accept or decline a pending connection request';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.techkarvo_protect_connection_response() from public, anon, authenticated;
drop trigger if exists techkarvo_protect_connection_response_before_update on public.connections;
create trigger techkarvo_protect_connection_response_before_update
  before update on public.connections for each row execute function public.techkarvo_protect_connection_response();

create or replace function public.techkarvo_open_connection_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  client_user uuid;
  freelancer_user uuid;
begin
  if old.status <> 'Pending' or new.status <> 'Accepted' then return new; end if;
  select case when requester.account_type = 'client' then new.requester_id else new.recipient_id end,
    case when requester.account_type = 'freelancer' then new.requester_id else new.recipient_id end
    into client_user, freelancer_user
  from public.profiles requester where requester.id = new.requester_id;
  if client_user is null or freelancer_user is null then
    raise exception 'The connection participants need valid marketplace profiles';
  end if;
  insert into public.conversations (application_id, job_id, client_id, freelancer_id, created_by)
  values ('connection:' || new.id::text, 'connection:' || new.id::text,
    client_user, freelancer_user, new.recipient_id)
  on conflict (application_id) do nothing;
  insert into public.notifications (user_id, kind, title, body, data)
  values (new.requester_id, 'connection_accepted', 'Connection accepted',
    'Your connection request was accepted. You can now message this member.',
    jsonb_build_object('connection_id', new.id::text));
  return new;
end;
$$;
revoke all on function public.techkarvo_open_connection_conversation() from public, anon, authenticated;
drop trigger if exists techkarvo_open_connection_after_accept on public.connections;
create trigger techkarvo_open_connection_after_accept
  after update of status on public.connections for each row
  execute function public.techkarvo_open_connection_conversation();

create or replace function public.techkarvo_notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_name text;
begin
  select coalesce(p.full_name, 'A TechKarvo member') into requester_name
    from public.profiles p where p.id = new.requester_id;
  insert into public.notifications (user_id, kind, title, body, data)
  values (new.recipient_id, 'connection_request', 'New connection request',
    coalesce(requester_name, 'A TechKarvo member') || ' would like to connect with you.',
    jsonb_build_object('connection_id', new.id::text));
  return new;
end;
$$;
revoke all on function public.techkarvo_notify_connection_request() from public, anon, authenticated;
drop trigger if exists techkarvo_notify_connection_after_insert on public.connections;
create trigger techkarvo_notify_connection_after_insert
  after insert on public.connections for each row execute function public.techkarvo_notify_connection_request();

create or replace function public.techkarvo_notify_post_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author uuid;
  actor_name text;
  event_title text;
  event_body text;
begin
  select p.author_id into post_author from public.posts p where p.id = new.post_id;
  if post_author is null or post_author = auth.uid() then return new; end if;
  select coalesce(p.full_name, 'A TechKarvo member') into actor_name
    from public.profiles p where p.id = auth.uid();
  if tg_table_name = 'post_likes' then
    event_title := 'New reaction on your post';
    event_body := coalesce(actor_name, 'A TechKarvo member') || ' liked your post.';
  else
    event_title := 'New comment on your post';
    event_body := coalesce(actor_name, 'A TechKarvo member') || ' commented on your post.';
  end if;
  insert into public.notifications (user_id, kind, title, body, data)
  values (post_author, case when tg_table_name = 'post_likes' then 'post_liked' else 'post_commented' end,
    event_title, event_body, jsonb_build_object('post_id', new.post_id::text));
  return new;
end;
$$;
revoke all on function public.techkarvo_notify_post_activity() from public, anon, authenticated;
drop trigger if exists techkarvo_notify_post_like_after_insert on public.post_likes;
create trigger techkarvo_notify_post_like_after_insert after insert on public.post_likes
  for each row execute function public.techkarvo_notify_post_activity();
drop trigger if exists techkarvo_notify_post_comment_after_insert on public.post_comments;
create trigger techkarvo_notify_post_comment_after_insert after insert on public.post_comments
  for each row execute function public.techkarvo_notify_post_activity();

-- A connection request is the only route to a new non-application conversation.
-- Once accepted, existing participant/read-receipt policies continue to protect it.
create or replace function public.techkarvo_protect_message_read_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.shared_post_id is distinct from old.shared_post_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Messages and shared post previews cannot be edited';
  end if;
  select case when c.client_id = old.sender_id then c.freelancer_id else c.client_id end
    into recipient_id from public.conversations c where c.id = old.conversation_id;
  if auth.uid() is distinct from recipient_id or new.read_at is null then
    raise exception 'Only the recipient may mark a message as read';
  end if;
  return new;
end;
$$;
revoke all on function public.techkarvo_protect_message_read_update() from public, anon, authenticated;

drop policy if exists "Messages require an active application" on public.messages;
create policy "Messages require an active application or accepted connection"
  on public.messages as restrictive for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          exists (
            select 1 from public.job_applications a
            where a.id::text = c.application_id and a.job_id::text = c.job_id
              and a.client_id = c.client_id and a.freelancer_id = c.freelancer_id
              and a.status in ('Pending', 'Accepted')
          )
          or exists (
            select 1 from public.connections connection_request
            where c.application_id = 'connection:' || connection_request.id::text
              and c.job_id = 'connection:' || connection_request.id::text
              and connection_request.status = 'Accepted'
              and ((c.client_id = connection_request.requester_id and c.freelancer_id = connection_request.recipient_id)
                or (c.client_id = connection_request.recipient_id and c.freelancer_id = connection_request.requester_id))
          )
        )
    )
  );

-- This public bucket is exclusively for profile photos, covers, and professional
-- post images. Never store private message attachments or sensitive documents
-- here. Restrict uploads to owner/<random filename>, 5 MiB, and image-only MIME types.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'techkarvo-marketplace') then
    if exists (select 1 from storage.objects where bucket_id = 'techkarvo-marketplace') then
      raise exception 'techkarvo-marketplace bucket already contains objects; review it before migration';
    end if;
    if not exists (select 1 from storage.buckets where id = 'techkarvo-marketplace'
      and public = true and file_size_limit = 5242880
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]) then
      raise exception 'techkarvo-marketplace bucket exists with unexpected settings; review it before migration';
    end if;
  else
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('techkarvo-marketplace', 'techkarvo-marketplace', true, 5242880,
      array['image/jpeg', 'image/png', 'image/webp']::text[]);
  end if;
end;
$$;

drop policy if exists "TechKarvo marketplace media is publicly readable" on storage.objects;
create policy "TechKarvo marketplace media is publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'techkarvo-marketplace');
drop policy if exists "Users upload their own marketplace images" on storage.objects;
create policy "Users upload their own marketplace images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'techkarvo-marketplace'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users update their own marketplace images" on storage.objects;
create policy "Users update their own marketplace images"
  on storage.objects for update to authenticated
  using (bucket_id = 'techkarvo-marketplace'
    and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'techkarvo-marketplace'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete their own marketplace images" on storage.objects;
create policy "Users delete their own marketplace images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'techkarvo-marketplace'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Supabase Realtime does not automatically include newly created tables.
-- Add only these public social tables when the standard publication exists.
do $$
declare
  table_to_publish text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach table_to_publish in array array['posts', 'post_likes', 'post_comments', 'connections'] loop
      if not exists (select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_to_publish) then
        execute format('alter publication supabase_realtime add table public.%I', table_to_publish);
      end if;
    end loop;
  end if;
end;
$$;

commit;
