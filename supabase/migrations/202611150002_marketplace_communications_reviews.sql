-- TechKarvo messaging, notifications, portfolio work, and mutual reviews.
-- This migration only adds tables, indexes, policies, and notification triggers.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  application_id text not null unique,
  job_id text not null,
  client_id uuid not null references public.profiles(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (client_id <> freelancer_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 3000),
  project_url text not null check (project_url ~ '^https?://'),
  image_url text check (image_url is null or image_url ~ '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  application_id text not null,
  job_id text not null,
  reviewer_id uuid not null references public.profiles(id),
  reviewee_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (length(body) <= 3000),
  created_at timestamptz not null default now(),
  unique (application_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create or replace view public.freelancer_public_profiles
with (security_barrier = true)
as
select id, full_name, account_type, country, professional_title, bio, skills, experience, portfolio_url
from public.profiles
where account_type = 'freelancer';

create or replace view public.client_public_profiles
with (security_barrier = true)
as
select id, full_name, account_type, country
from public.profiles
where account_type = 'client';

revoke insert, update, delete on public.freelancer_public_profiles from anon, authenticated;
revoke insert, update, delete on public.client_public_profiles from anon, authenticated;
grant select on public.freelancer_public_profiles, public.client_public_profiles to authenticated;

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists portfolio_items_freelancer_created_idx
  on public.portfolio_items (freelancer_id, created_at desc);
create index if not exists reviews_reviewee_created_idx
  on public.reviews (reviewee_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.reviews enable row level security;

revoke all on table public.conversations, public.messages, public.notifications,
  public.portfolio_items, public.reviews from public, anon, authenticated;

grant select, insert on public.conversations to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.portfolio_items to authenticated;
grant select, insert on public.reviews to authenticated;
grant select on public.reviews to anon;

create or replace function public.techkarvo_is_accepted_freelancer(p_job_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.job_applications a
    where a.job_id::text = p_job_id
      and a.freelancer_id = auth.uid()
      and a.status = 'Accepted'
  );
$$;

revoke all on function public.techkarvo_is_accepted_freelancer(text) from public;
grant execute on function public.techkarvo_is_accepted_freelancer(text) to anon, authenticated;

drop policy if exists "TechKarvo open jobs are public" on public.jobs;
create policy "TechKarvo open jobs are public"
  on public.jobs for select to anon, authenticated
  using (
    status = 'open'
    or client_id = (select auth.uid())
    or (status = 'completed' and public.techkarvo_is_accepted_freelancer(id::text))
  );

drop policy if exists "TechKarvo job read boundary" on public.jobs;
create policy "TechKarvo job read boundary"
  on public.jobs as restrictive for select to anon, authenticated
  using (
    status = 'open'
    or client_id = (select auth.uid())
    or (status = 'completed' and public.techkarvo_is_accepted_freelancer(id::text))
  );

drop policy if exists "Conversation participants can read" on public.conversations;
create policy "Conversation participants can read"
  on public.conversations for select to authenticated
  using (client_id = (select auth.uid()) or freelancer_id = (select auth.uid()));

drop policy if exists "Participants can start an application conversation" on public.conversations;
create policy "Participants can start an application conversation"
  on public.conversations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (client_id = (select auth.uid()) or freelancer_id = (select auth.uid()))
    and exists (
      select 1 from public.job_applications a
      where a.id::text = conversations.application_id
        and a.job_id::text = conversations.job_id
        and a.client_id = conversations.client_id
        and a.freelancer_id = conversations.freelancer_id
        and a.status in ('Pending', 'Accepted')
    )
  );

drop policy if exists "Conversation participant boundary" on public.conversations;
create policy "Conversation participant boundary"
  on public.conversations as restrictive for all to authenticated
  using (client_id = (select auth.uid()) or freelancer_id = (select auth.uid()))
  with check (client_id = (select auth.uid()) or freelancer_id = (select auth.uid()));

drop policy if exists "Conversation insert boundary" on public.conversations;
create policy "Conversation insert boundary"
  on public.conversations as restrictive for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.job_applications a
      where a.id::text = conversations.application_id
        and a.job_id::text = conversations.job_id
        and a.client_id = conversations.client_id
        and a.freelancer_id = conversations.freelancer_id
        and a.status in ('Pending', 'Accepted')
    )
  );

drop policy if exists "Anonymous users cannot access conversations" on public.conversations;
create policy "Anonymous users cannot access conversations"
  on public.conversations as restrictive for all to anon
  using (false) with check (false);

drop policy if exists "Conversation updates are unavailable" on public.conversations;
create policy "Conversation updates are unavailable"
  on public.conversations as restrictive for update to authenticated
  using (false) with check (false);

drop policy if exists "Conversation deletes are unavailable" on public.conversations;
create policy "Conversation deletes are unavailable"
  on public.conversations as restrictive for delete to authenticated
  using (false);

drop policy if exists "Conversation participants can read messages" on public.messages;
create policy "Conversation participants can read messages"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.client_id = (select auth.uid()) or c.freelancer_id = (select auth.uid()))
  ));

drop policy if exists "Conversation message read boundary" on public.messages;
create policy "Conversation message read boundary"
  on public.messages as restrictive for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.client_id = (select auth.uid()) or c.freelancer_id = (select auth.uid()))
  ));

drop policy if exists "Conversation participants can send messages" on public.messages;
create policy "Conversation participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.client_id = (select auth.uid()) or c.freelancer_id = (select auth.uid()))
    )
  );

drop policy if exists "Conversation message insert boundary" on public.messages;
create policy "Conversation message insert boundary"
  on public.messages as restrictive for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.client_id = (select auth.uid()) or c.freelancer_id = (select auth.uid()))
    )
  );

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
    or new.created_at is distinct from old.created_at then
    raise exception 'Messages cannot be edited';
  end if;

  select case when c.client_id = old.sender_id then c.freelancer_id else c.client_id end
    into recipient_id
  from public.conversations c where c.id = old.conversation_id;

  if auth.uid() is distinct from recipient_id or new.read_at is null then
    raise exception 'Only the recipient may mark a message as read';
  end if;

  return new;
end;
$$;

drop trigger if exists techkarvo_protect_message_read_before_update on public.messages;
create trigger techkarvo_protect_message_read_before_update
  before update on public.messages
  for each row execute function public.techkarvo_protect_message_read_update();

drop policy if exists "Message recipients can mark messages read" on public.messages;
create policy "Message recipients can mark messages read"
  on public.messages for update to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and ((c.client_id = (select auth.uid()) and messages.sender_id = c.freelancer_id)
        or (c.freelancer_id = (select auth.uid()) and messages.sender_id = c.client_id))
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and ((c.client_id = (select auth.uid()) and messages.sender_id = c.freelancer_id)
        or (c.freelancer_id = (select auth.uid()) and messages.sender_id = c.client_id))
  ));

drop policy if exists "Message recipient update boundary" on public.messages;
create policy "Message recipient update boundary"
  on public.messages as restrictive for update to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and ((c.client_id = (select auth.uid()) and messages.sender_id = c.freelancer_id)
        or (c.freelancer_id = (select auth.uid()) and messages.sender_id = c.client_id))
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and ((c.client_id = (select auth.uid()) and messages.sender_id = c.freelancer_id)
        or (c.freelancer_id = (select auth.uid()) and messages.sender_id = c.client_id))
  ));

drop policy if exists "Message deletes are unavailable" on public.messages;
create policy "Message deletes are unavailable"
  on public.messages as restrictive for delete to authenticated
  using (false);

drop policy if exists "Anonymous users cannot access messages" on public.messages;
create policy "Anonymous users cannot access messages"
  on public.messages as restrictive for all to anon
  using (false) with check (false);

drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Notification owner read boundary" on public.notifications;
create policy "Notification owner read boundary"
  on public.notifications as restrictive for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can mark their notifications read" on public.notifications;
create policy "Users can mark their notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Notification owner update boundary" on public.notifications;
create policy "Notification owner update boundary"
  on public.notifications as restrictive for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Notification inserts are unavailable" on public.notifications;
create policy "Notification inserts are unavailable"
  on public.notifications as restrictive for insert to authenticated
  with check (false);

drop policy if exists "Notification deletes are unavailable" on public.notifications;
create policy "Notification deletes are unavailable"
  on public.notifications as restrictive for delete to authenticated
  using (false);

drop policy if exists "Anonymous users cannot access notifications" on public.notifications;
create policy "Anonymous users cannot access notifications"
  on public.notifications as restrictive for all to anon
  using (false) with check (false);

create or replace function public.techkarvo_protect_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.kind is distinct from old.kind
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.data is distinct from old.data
    or new.created_at is distinct from old.created_at then
    raise exception 'Notifications cannot be edited';
  end if;
  if new.read_at is null then
    raise exception 'Notifications may only be marked read';
  end if;
  return new;
end;
$$;

drop trigger if exists techkarvo_protect_notification_before_update on public.notifications;
create trigger techkarvo_protect_notification_before_update
  before update on public.notifications
  for each row execute function public.techkarvo_protect_notification_update();

drop policy if exists "Freelancers can read portfolios" on public.portfolio_items;
create policy "Freelancers can read portfolios"
  on public.portfolio_items for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'client'
  ) or freelancer_id = (select auth.uid()));

drop policy if exists "Portfolio read boundary" on public.portfolio_items;
create policy "Portfolio read boundary"
  on public.portfolio_items as restrictive for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'client'
  ) or freelancer_id = (select auth.uid()));

drop policy if exists "Freelancers manage their own portfolio" on public.portfolio_items;
create policy "Freelancers manage their own portfolio"
  on public.portfolio_items for insert to authenticated
  with check (
    freelancer_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'freelancer')
  );

drop policy if exists "Portfolio insert boundary" on public.portfolio_items;
create policy "Portfolio insert boundary"
  on public.portfolio_items as restrictive for insert to authenticated
  with check (
    freelancer_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'freelancer')
  );

drop policy if exists "Freelancers update their own portfolio" on public.portfolio_items;
create policy "Freelancers update their own portfolio"
  on public.portfolio_items for update to authenticated
  using (freelancer_id = (select auth.uid()))
  with check (freelancer_id = (select auth.uid()));

drop policy if exists "Portfolio update boundary" on public.portfolio_items;
create policy "Portfolio update boundary"
  on public.portfolio_items as restrictive for update to authenticated
  using (freelancer_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'freelancer'
  ))
  with check (freelancer_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'freelancer'
  ));

drop policy if exists "Freelancers delete their own portfolio" on public.portfolio_items;
create policy "Freelancers delete their own portfolio"
  on public.portfolio_items for delete to authenticated
  using (freelancer_id = (select auth.uid()));

drop policy if exists "Portfolio delete boundary" on public.portfolio_items;
create policy "Portfolio delete boundary"
  on public.portfolio_items as restrictive for delete to authenticated
  using (freelancer_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'freelancer'
  ));

drop policy if exists "Anonymous users cannot access portfolios" on public.portfolio_items;
create policy "Anonymous users cannot access portfolios"
  on public.portfolio_items as restrictive for all to anon
  using (false) with check (false);

create or replace function public.techkarvo_is_application_participant(p_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.job_applications a
    join public.jobs j on j.id = a.job_id
    where a.id::text = p_application_id
      and a.status = 'Accepted'
      and j.status = 'completed'
      and (a.client_id = auth.uid() or a.freelancer_id = auth.uid())
  );
$$;

revoke all on function public.techkarvo_is_application_participant(text) from public;
grant execute on function public.techkarvo_is_application_participant(text) to authenticated;

drop policy if exists "Completed job participants can read reviews" on public.reviews;
create policy "Completed job participants can read reviews"
  on public.reviews for select to anon, authenticated
  using (true);

drop policy if exists "Public review read boundary" on public.reviews;
create policy "Public review read boundary"
  on public.reviews as restrictive for select to anon, authenticated
  using (true);

drop policy if exists "Participants can create one review after completion" on public.reviews;
create policy "Participants can create one review after completion"
  on public.reviews for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and public.techkarvo_is_application_participant(application_id)
    and exists (
      select 1 from public.job_applications a
      where a.id::text = reviews.application_id
        and a.job_id::text = reviews.job_id
        and (
          (a.client_id = (select auth.uid()) and a.freelancer_id = reviews.reviewee_id)
          or (a.freelancer_id = (select auth.uid()) and a.client_id = reviews.reviewee_id)
        )
    )
  );

drop policy if exists "Review insert boundary" on public.reviews;
create policy "Review insert boundary"
  on public.reviews as restrictive for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and public.techkarvo_is_application_participant(application_id)
    and exists (
      select 1 from public.job_applications a
      where a.id::text = reviews.application_id
        and a.job_id::text = reviews.job_id
        and (
          (a.client_id = (select auth.uid()) and a.freelancer_id = reviews.reviewee_id)
          or (a.freelancer_id = (select auth.uid()) and a.client_id = reviews.reviewee_id)
        )
    )
  );

drop policy if exists "Anonymous review writes are unavailable" on public.reviews;
create policy "Anonymous review writes are unavailable"
  on public.reviews as restrictive for insert to anon
  with check (false);

drop policy if exists "Review updates are unavailable" on public.reviews;
create policy "Review updates are unavailable"
  on public.reviews as restrictive for update to authenticated
  using (false) with check (false);

drop policy if exists "Review deletes are unavailable" on public.reviews;
create policy "Review deletes are unavailable"
  on public.reviews as restrictive for delete to authenticated
  using (false);

drop policy if exists "Anonymous review updates are unavailable" on public.reviews;
create policy "Anonymous review updates are unavailable"
  on public.reviews as restrictive for update to anon
  using (false) with check (false);

drop policy if exists "Anonymous review deletes are unavailable" on public.reviews;
create policy "Anonymous review deletes are unavailable"
  on public.reviews as restrictive for delete to anon
  using (false);

create or replace function public.techkarvo_validate_job_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    update public.job_applications
    set status = 'Rejected'
    where job_id::text = new.id::text
      and client_id = new.client_id
      and status = 'Pending';

    if coalesce(auth.role(), '') <> 'service_role'
      and not exists (
        select 1 from public.job_applications a
        where a.job_id::text = new.id::text
          and a.client_id = auth.uid()
          and a.status = 'Accepted'
      ) then
      raise exception 'A project needs an accepted freelancer before completion'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists techkarvo_validate_job_completion_before_update on public.jobs;
create trigger techkarvo_validate_job_completion_before_update
  before update of status on public.jobs
  for each row execute function public.techkarvo_validate_job_completion();

create or replace function public.techkarvo_notify_marketplace_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
  message_title text;
  message_body text;
  event_kind text;
begin
  if tg_table_name = 'job_applications' then
    if tg_op = 'INSERT' then
      recipient_id := new.client_id;
      event_kind := 'application_received';
      message_title := 'New job application';
      message_body := coalesce(new.full_name, 'A freelancer') || ' applied for your job.';
    elsif new.status is distinct from old.status then
      recipient_id := new.freelancer_id;
      event_kind := 'application_' || lower(new.status);
      message_title := 'Application ' || lower(new.status);
      message_body := 'Your application status changed to ' || lower(new.status) || '.';
    else
      return new;
    end if;
    insert into public.notifications (user_id, kind, title, body, data)
    values (recipient_id, event_kind, message_title, message_body,
      jsonb_build_object('application_id', new.id::text, 'job_id', new.job_id::text));
  elsif tg_table_name = 'messages' then
    select case when c.client_id = new.sender_id then c.freelancer_id else c.client_id end
      into recipient_id
    from public.conversations c where c.id = new.conversation_id;
    insert into public.notifications (user_id, kind, title, body, data)
    values (recipient_id, 'new_message', 'New message', 'You received a new message.',
      jsonb_build_object('conversation_id', new.conversation_id));
  end if;
  return new;
end;
$$;

drop trigger if exists techkarvo_application_notification on public.job_applications;
create trigger techkarvo_application_notification
  after insert or update of status on public.job_applications
  for each row execute function public.techkarvo_notify_marketplace_activity();

drop trigger if exists techkarvo_message_notification on public.messages;
create trigger techkarvo_message_notification
  after insert on public.messages
  for each row execute function public.techkarvo_notify_marketplace_activity();
