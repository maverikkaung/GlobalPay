-- Keep withdrawn applications as historical records. This preserves their
-- relationship to jobs and conversations and prevents reapplication loops.
create or replace function public.techkarvo_protect_application_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.job_id is distinct from old.job_id
    or new.client_id is distinct from old.client_id
    or new.freelancer_id is distinct from old.freelancer_id
    or new.full_name is distinct from old.full_name
    or new.email is distinct from old.email
    or new.country is distinct from old.country
    or new.professional_title is distinct from old.professional_title
    or new.bio is distinct from old.bio
    or new.skills is distinct from old.skills
    or new.experience is distinct from old.experience
    or new.cover_letter is distinct from old.cover_letter
    or new.expected_salary is distinct from old.expected_salary
    or new.salary_type is distinct from old.salary_type
    or new.portfolio is distinct from old.portfolio
    or new.applied_at is distinct from old.applied_at then
    raise exception 'Application details cannot be changed after submission';
  end if;

  if old.status <> 'Pending' then
    raise exception 'Only pending applications can change status'
      using errcode = '23514';
  end if;

  if coalesce(auth.role(), '') = 'service_role' then
    if new.status not in ('Accepted', 'Rejected', 'Withdrawn') then
      raise exception 'This application status transition is not allowed'
        using errcode = '23514';
    end if;
  elsif auth.uid() = old.client_id and new.status in ('Accepted', 'Rejected') then
    if not exists (
      select 1 from public.jobs j
      where j.id = old.job_id and j.client_id = old.client_id and j.status = 'open'
    ) then
      raise exception 'Applications can only be decided while the job is open'
        using errcode = '23514';
    end if;
  elsif auth.uid() = old.freelancer_id and new.status = 'Withdrawn' then
    null;
  else
    raise exception 'This application status transition is not allowed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop policy if exists "TechKarvo freelancers can withdraw pending applications" on public.job_applications;
create policy "TechKarvo freelancers can withdraw pending applications"
  on public.job_applications for update to authenticated
  using (freelancer_id = (select auth.uid()) and status = 'Pending')
  with check (freelancer_id = (select auth.uid()) and status = 'Withdrawn');

drop policy if exists "TechKarvo application update boundary" on public.job_applications;
create policy "TechKarvo application update boundary"
  on public.job_applications as restrictive for update to authenticated
  using (
    (client_id = (select auth.uid()) and status = 'Pending'
      and exists (select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.account_type = 'client')
      and exists (select 1 from public.jobs j
        where j.id = job_applications.job_id and j.client_id = (select auth.uid())))
    or
    (freelancer_id = (select auth.uid()) and status = 'Pending'
      and exists (select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.account_type = 'freelancer'))
  )
  with check (
    (client_id = (select auth.uid()) and status in ('Accepted', 'Rejected')
      and exists (select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.account_type = 'client')
      and exists (select 1 from public.jobs j
        where j.id = job_applications.job_id and j.client_id = (select auth.uid())))
    or
    (freelancer_id = (select auth.uid()) and status = 'Withdrawn'
      and exists (select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.account_type = 'freelancer'))
  );

drop policy if exists "TechKarvo application delete boundary" on public.job_applications;
create policy "TechKarvo application delete boundary"
  on public.job_applications as restrictive for delete to authenticated
  using (false);
revoke delete on table public.job_applications from public, anon, authenticated;

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
      if new.status = 'Withdrawn' then
        recipient_id := new.client_id;
        message_title := 'Application withdrawn';
        message_body := coalesce(new.full_name, 'A freelancer') || ' withdrew from your job.';
      else
        recipient_id := new.freelancer_id;
        message_title := 'Application ' || lower(new.status);
        message_body := 'Your application status changed to ' || lower(new.status) || '.';
      end if;
      event_kind := 'application_' || lower(new.status);
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

revoke all on function public.techkarvo_notify_marketplace_activity() from public, anon, authenticated;

