-- Remove inherited table grants from earlier deployments before assigning the
-- exact client-facing privileges required by the marketplace.
revoke all on table public.profiles, public.jobs, public.job_applications
  from public, anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.jobs to anon, authenticated;
grant insert, update, delete on public.jobs to authenticated;
grant select, insert, delete on public.job_applications to authenticated;
grant update (status) on public.job_applications to authenticated;

drop policy if exists "Anonymous profile access is unavailable" on public.profiles;
create policy "Anonymous profile access is unavailable"
  on public.profiles as restrictive for all to anon
  using (false) with check (false);

drop policy if exists "Anonymous job inserts are unavailable" on public.jobs;
create policy "Anonymous job inserts are unavailable"
  on public.jobs as restrictive for insert to anon
  with check (false);

drop policy if exists "Anonymous job updates are unavailable" on public.jobs;
create policy "Anonymous job updates are unavailable"
  on public.jobs as restrictive for update to anon
  using (false) with check (false);

drop policy if exists "Anonymous job deletes are unavailable" on public.jobs;
create policy "Anonymous job deletes are unavailable"
  on public.jobs as restrictive for delete to anon
  using (false);

drop policy if exists "Anonymous application access is unavailable" on public.job_applications;
create policy "Anonymous application access is unavailable"
  on public.job_applications as restrictive for all to anon
  using (false) with check (false);
