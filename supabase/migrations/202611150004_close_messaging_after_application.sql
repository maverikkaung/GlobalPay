-- Keep closed application conversations available as read-only history.
-- Restrictive RLS applies even if an older permissive insert policy remains.
drop policy if exists "Messages require an active application" on public.messages;
create policy "Messages require an active application"
  on public.messages as restrictive for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      join public.job_applications a on a.id::text = c.application_id
      where c.id = messages.conversation_id
        and a.job_id::text = c.job_id
        and a.client_id = c.client_id
        and a.freelancer_id = c.freelancer_id
        and a.status in ('Pending', 'Accepted')
    )
  );
