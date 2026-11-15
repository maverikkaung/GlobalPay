-- Prevent deleting a job that has application history. A SECURITY DEFINER
-- trigger avoids querying job_applications from a jobs RLS policy, which
-- would recurse because application policies also inspect jobs.
create or replace function public.techkarvo_prevent_job_history_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.job_applications a where a.job_id = old.id
  ) then
    raise exception 'Jobs with application history cannot be deleted'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

revoke all on function public.techkarvo_prevent_job_history_delete() from public, anon, authenticated;

drop trigger if exists techkarvo_prevent_job_history_delete_before_delete on public.jobs;
create trigger techkarvo_prevent_job_history_delete_before_delete
  before delete on public.jobs
  for each row execute function public.techkarvo_prevent_job_history_delete();
