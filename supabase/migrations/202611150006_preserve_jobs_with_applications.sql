-- Preserve job/application history and related conversations/reviews. Clients
-- may delete only jobs that have never received an application.
drop policy if exists "TechKarvo job delete boundary" on public.jobs;
create policy "TechKarvo job delete boundary"
  on public.jobs as restrictive for delete to authenticated
  using (
    client_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'client'
    )
    and not exists (
      select 1 from public.job_applications a
      where a.job_id = jobs.id
    )
  );
