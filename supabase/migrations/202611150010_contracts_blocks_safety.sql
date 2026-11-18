-- Contracts, account privacy controls, user safety, and conversation retention.
-- Additive only; never deletes applications, jobs, conversations, messages, or reviews.
-- Apply to staging only after a separate approval and target/schema review.

begin;

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.job_applications(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  freelancer_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'completed', 'disputed', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (client_id <> freelancer_id),
  check ((status = 'completed') = (completed_at is not null))
);

create index contracts_client_status_idx on public.contracts (client_id, status, created_at desc);
create index contracts_freelancer_status_idx on public.contracts (freelancer_id, status, created_at desc);
alter table public.contracts enable row level security;
revoke all on table public.contracts from public, anon, authenticated;
grant select on public.contracts to authenticated;
grant select, insert, update, delete on public.contracts to service_role;

create policy "Contract participants can read their contracts"
  on public.contracts for select to authenticated
  using (client_id = (select auth.uid()) or freelancer_id = (select auth.uid()));
create policy "Contract participant read boundary"
  on public.contracts as restrictive for select to authenticated
  using (client_id = (select auth.uid()) or freelancer_id = (select auth.uid()));
create policy "Contract inserts require trusted workflow"
  on public.contracts as restrictive for insert to authenticated with check (false);
create policy "Contract updates require trusted workflow"
  on public.contracts as restrictive for update to authenticated using (false) with check (false);
create policy "Contract deletes require trusted workflow"
  on public.contracts as restrictive for delete to authenticated using (false);
create policy "Anonymous users cannot access contracts"
  on public.contracts as restrictive for all to anon using (false) with check (false);

create or replace function public.techkarvo_start_contract_on_hire()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status and new.status = 'Accepted' then
    insert into public.contracts (application_id, job_id, client_id, freelancer_id)
    values (new.id, new.job_id, new.client_id, new.freelancer_id)
    on conflict (application_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.techkarvo_start_contract_on_hire() from public, anon, authenticated;
drop trigger if exists techkarvo_start_contract_after_hire on public.job_applications;
create trigger techkarvo_start_contract_after_hire
  after update of status on public.job_applications for each row
  execute function public.techkarvo_start_contract_on_hire();

create or replace function public.techkarvo_complete_contract_with_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status and new.status = 'completed' then
    update public.contracts set status = 'completed', completed_at = now()
    where job_id = new.id and client_id = new.client_id and status = 'active';
  end if;
  return new;
end;
$$;
revoke all on function public.techkarvo_complete_contract_with_job() from public, anon, authenticated;
drop trigger if exists techkarvo_complete_contract_after_job on public.jobs;
create trigger techkarvo_complete_contract_after_job
  after update of status on public.jobs for each row
  execute function public.techkarvo_complete_contract_with_job();

create or replace function public.techkarvo_has_active_work(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
    where c.status in ('active', 'disputed')
      and ((c.client_id = p_user_a and c.freelancer_id = p_user_b)
        or (c.client_id = p_user_b and c.freelancer_id = p_user_a))
  ) or exists (
    -- Preserve the block safeguard for accepted projects hired before this
    -- contract table existed. Completion is still governed by the jobs table.
    select 1 from public.job_applications a
    join public.jobs j on j.id = a.job_id
    where a.status = 'Accepted' and j.status = 'open'
      and ((a.client_id = p_user_a and a.freelancer_id = p_user_b)
        or (a.client_id = p_user_b and a.freelancer_id = p_user_a))
  );
$$;
revoke all on function public.techkarvo_has_active_work(uuid, uuid) from public, anon, authenticated;
grant execute on function public.techkarvo_has_active_work(uuid, uuid) to authenticated;

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id, created_at desc);
alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from public, anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant all on table public.user_blocks to service_role;

create or replace function public.techkarvo_is_blocked_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_other_user_id is not null and p_other_user_id <> auth.uid() and exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_other_user_id)
      or (b.blocker_id = p_other_user_id and b.blocked_id = auth.uid()));
$$;
revoke all on function public.techkarvo_is_blocked_with(uuid) from public, anon, authenticated;
grant execute on function public.techkarvo_is_blocked_with(uuid) to authenticated;

create policy "Users see their own block list"
  on public.user_blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy "Block list owner read boundary"
  on public.user_blocks as restrictive for select to authenticated using (blocker_id = (select auth.uid()));
create policy "Users block marketplace members"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()) and not public.techkarvo_has_active_work(blocker_id, blocked_id));
create policy "Block owner insert boundary"
  on public.user_blocks as restrictive for insert to authenticated
  with check (blocker_id = (select auth.uid()) and blocker_id <> blocked_id
    and not public.techkarvo_has_active_work(blocker_id, blocked_id));
create policy "Users remove their own blocks"
  on public.user_blocks for delete to authenticated using (blocker_id = (select auth.uid()));
create policy "Block owner delete boundary"
  on public.user_blocks as restrictive for delete to authenticated using (blocker_id = (select auth.uid()));
create policy "Anonymous users cannot access blocks"
  on public.user_blocks as restrictive for all to anon using (false) with check (false);

create table public.muted_users (
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_user_id),
  check (user_id <> muted_user_id)
);
alter table public.muted_users enable row level security;
revoke all on table public.muted_users from public, anon, authenticated;
grant select, insert, delete on public.muted_users to authenticated;
grant all on table public.muted_users to service_role;
create policy "Users manage their own mute list"
  on public.muted_users for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and user_id <> muted_user_id);
create policy "Mute owner boundary"
  on public.muted_users as restrictive for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and user_id <> muted_user_id);
create policy "Anonymous users cannot access mutes"
  on public.muted_users as restrictive for all to anon using (false) with check (false);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  reported_user_id uuid not null references public.profiles(id) on delete restrict,
  category text not null check (category in ('harassment', 'fraud', 'spam', 'safety', 'other')),
  details text not null default '' check (length(details) <= 4000),
  application_id uuid references public.job_applications(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);
create index user_reports_created_idx on public.user_reports (created_at desc);
alter table public.user_reports enable row level security;
revoke all on table public.user_reports from public, anon, authenticated;
grant select, insert on public.user_reports to authenticated;
grant select, insert, update on public.user_reports to service_role;
create policy "Reporters can read their own reports"
  on public.user_reports for select to authenticated using (reporter_id = (select auth.uid()));
create policy "Report owner read boundary"
  on public.user_reports as restrictive for select to authenticated using (reporter_id = (select auth.uid()));
create policy "Authenticated users can report a member"
  on public.user_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and reporter_id <> reported_user_id and status = 'pending');
create policy "Report insert boundary"
  on public.user_reports as restrictive for insert to authenticated
  with check (reporter_id = (select auth.uid()) and reporter_id <> reported_user_id and status = 'pending'
    and (application_id is null or exists (select 1 from public.job_applications a
      where a.id = application_id
        and ((a.client_id = reporter_id and a.freelancer_id = reported_user_id)
          or (a.freelancer_id = reporter_id and a.client_id = reported_user_id)))));
create policy "Reports cannot be changed by users"
  on public.user_reports as restrictive for update to authenticated using (false) with check (false);
create policy "Reports cannot be deleted by users"
  on public.user_reports as restrictive for delete to authenticated using (false);
create policy "Anonymous users cannot access reports"
  on public.user_reports as restrictive for all to anon using (false) with check (false);

create table public.conversation_hides (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_hides enable row level security;
revoke all on table public.conversation_hides from public, anon, authenticated;
grant select, insert, delete on public.conversation_hides to authenticated;
grant all on table public.conversation_hides to service_role;
create policy "Users see their own hidden conversations"
  on public.conversation_hides for select to authenticated using (user_id = (select auth.uid()));
create policy "Conversation hide owner boundary"
  on public.conversation_hides as restrictive for select to authenticated using (user_id = (select auth.uid()));
create policy "Participants hide conversations for themselves"
  on public.conversation_hides for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.conversations c where c.id = conversation_id
      and (c.client_id = (select auth.uid()) or c.freelancer_id = (select auth.uid()))
  ));
create policy "Conversation hide insert boundary"
  on public.conversation_hides as restrictive for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.conversations c where c.id = conversation_id
      and (c.client_id = (select auth.uid()) or c.freelancer_id = (select auth.uid()))
  ));
create policy "Users unhide their own conversations"
  on public.conversation_hides for delete to authenticated using (user_id = (select auth.uid()));
create policy "Conversation hide delete boundary"
  on public.conversation_hides as restrictive for delete to authenticated using (user_id = (select auth.uid()));
create policy "Anonymous users cannot access hidden conversations"
  on public.conversation_hides as restrictive for all to anon using (false) with check (false);

create table public.message_redactions (
  message_id uuid primary key references public.messages(id) on delete restrict,
  original_body text not null,
  original_shared_post_id uuid,
  redacted_by uuid not null references public.profiles(id) on delete restrict,
  redacted_at timestamptz not null default now()
);
alter table public.message_redactions enable row level security;
revoke all on table public.message_redactions from public, anon, authenticated;
grant all on table public.message_redactions to service_role;
create policy "Message redactions are never client-readable"
  on public.message_redactions as restrictive for all to anon, authenticated
  using (false) with check (false);

alter table public.messages
  add column deleted_for_everyone_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete restrict;

-- Keep read receipts available while forcing redaction through the audited RPC.
revoke update on table public.messages from authenticated;
grant update (read_at) on table public.messages to authenticated;

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
    or new.created_at is distinct from old.created_at then
    raise exception 'Message identity and history cannot be changed';
  end if;

  if new.deleted_for_everyone_at is distinct from old.deleted_for_everyone_at
    or new.deleted_by is distinct from old.deleted_by then
    if auth.uid() is distinct from old.sender_id
      or old.deleted_for_everyone_at is not null
      or new.deleted_for_everyone_at is null
      or new.deleted_by is distinct from old.sender_id
      or new.body <> '[Message removed]'
      or new.shared_post_id is not null
      or new.read_at is distinct from old.read_at then
      raise exception 'Only a sender may redact their message through the authorized workflow';
    end if;
    return new;
  end if;

  if new.body is distinct from old.body or new.shared_post_id is distinct from old.shared_post_id then
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

create or replace function public.techkarvo_delete_message_for_everyone(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.messages%rowtype;
begin
  select * into target from public.messages where id = p_message_id for update;
  if not found or target.sender_id is distinct from auth.uid() then
    raise exception 'Message not found or you are not its sender';
  end if;
  if target.deleted_for_everyone_at is not null then return false; end if;
  if target.created_at < now() - interval '15 minutes' then
    raise exception 'Messages can only be removed for everyone within 15 minutes';
  end if;
  insert into public.message_redactions (message_id, original_body, original_shared_post_id, redacted_by)
  values (target.id, target.body, target.shared_post_id, auth.uid());
  update public.messages set body = '[Message removed]', shared_post_id = null,
    deleted_for_everyone_at = now(), deleted_by = auth.uid()
  where id = target.id;
  return true;
end;
$$;
revoke all on function public.techkarvo_delete_message_for_everyone(uuid) from public, anon;
grant execute on function public.techkarvo_delete_message_for_everyone(uuid) to authenticated;

create or replace function public.techkarvo_can_connect(p_requester_id uuid, p_recipient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_requester_id = auth.uid()
    and p_requester_id <> p_recipient_id
    and not exists (select 1 from public.user_blocks b
      where (b.blocker_id = p_requester_id and b.blocked_id = p_recipient_id)
        or (b.blocker_id = p_recipient_id and b.blocked_id = p_requester_id))
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

create policy "Blocked members cannot accept personal connections"
  on public.connections as restrictive for update to authenticated
  using (not public.techkarvo_is_blocked_with(case when connections.requester_id = (select auth.uid())
    then connections.recipient_id else connections.requester_id end))
  with check (not public.techkarvo_is_blocked_with(case when connections.requester_id = (select auth.uid())
    then connections.recipient_id else connections.requester_id end));

drop policy if exists "Messages require an active application or accepted connection" on public.messages;
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
              and not public.techkarvo_is_blocked_with(case when c.client_id = (select auth.uid())
                then c.freelancer_id else c.client_id end)
          )
        )
    )
  );

create policy "Blocked members cannot read personal conversations"
  on public.conversations as restrictive for select to authenticated
  using (
    application_id not like 'connection:%'
    or not public.techkarvo_is_blocked_with(case when client_id = (select auth.uid())
      then freelancer_id else client_id end)
  );

create policy "Blocked members cannot read personal messages"
  on public.messages as restrictive for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.application_id not like 'connection:%'
        or not public.techkarvo_is_blocked_with(case when c.client_id = (select auth.uid())
          then c.freelancer_id else c.client_id end))
  ));

create policy "Blocked members cannot update personal message receipts"
  on public.messages as restrictive for update to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.application_id not like 'connection:%'
        or not public.techkarvo_is_blocked_with(case when c.client_id = (select auth.uid())
          then c.freelancer_id else c.client_id end))
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.application_id not like 'connection:%'
        or not public.techkarvo_is_blocked_with(case when c.client_id = (select auth.uid())
          then c.freelancer_id else c.client_id end))
  ));

drop policy if exists "Post reader boundary" on public.posts;
create policy "Post reader boundary"
  on public.posts as restrictive for select to authenticated
  using (not public.techkarvo_is_blocked_with(posts.author_id)
    and not exists (select 1 from public.muted_users m
      where m.user_id = (select auth.uid()) and m.muted_user_id = posts.author_id));

drop policy if exists "Post comment read boundary" on public.post_comments;
create policy "Post comment read boundary"
  on public.post_comments as restrictive for select to authenticated
  using (not public.techkarvo_is_blocked_with(post_comments.author_id)
    and exists (select 1 from public.posts p where p.id = post_comments.post_id
      and not public.techkarvo_is_blocked_with(p.author_id)));

create policy "Blocked members cannot read post likes"
  on public.post_likes as restrictive for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_likes.post_id));

create policy "Blocked members cannot like posts"
  on public.post_likes as restrictive for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_likes.post_id));

create policy "Post comments cannot target blocked members"
  on public.post_comments as restrictive for insert to authenticated
  with check (author_id = (select auth.uid())
    and not public.techkarvo_is_blocked_with(post_comments.author_id)
    and exists (select 1 from public.posts p where p.id = post_comments.post_id
      and not public.techkarvo_is_blocked_with(p.author_id)));

create or replace function public.techkarvo_is_application_participant(p_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
    where c.application_id::text = p_application_id
      and c.status = 'completed'
      and (c.client_id = auth.uid() or c.freelancer_id = auth.uid())
  ) or exists (
    -- Keep review eligibility for work completed before contract records were introduced.
    select 1 from public.job_applications a
    join public.jobs j on j.id = a.job_id
    where a.id::text = p_application_id
      and a.status = 'Accepted'
      and j.status = 'completed'
      and (a.client_id = auth.uid() or a.freelancer_id = auth.uid())
  );
$$;
revoke all on function public.techkarvo_is_application_participant(text) from public, anon, authenticated;
grant execute on function public.techkarvo_is_application_participant(text) to authenticated;

commit;
