do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'jobs', 'job_applications', 'conversations',
    'messages', 'notifications', 'portfolio_items', 'reviews'
  ] loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', table_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.profiles', 'SELECT') then
    raise exception 'Anonymous users must not read private profiles directly';
  end if;
  if has_table_privilege('anon', 'public.jobs', 'INSERT')
    or has_table_privilege('anon', 'public.jobs', 'UPDATE')
    or has_table_privilege('anon', 'public.jobs', 'DELETE') then
    raise exception 'Anonymous users must not write jobs';
  end if;
  if has_table_privilege('anon', 'public.job_applications', 'SELECT')
    or has_table_privilege('anon', 'public.job_applications', 'INSERT') then
    raise exception 'Anonymous users must not access applications';
  end if;
  if has_table_privilege('authenticated', 'public.job_applications', 'UPDATE') then
    raise exception 'Authenticated users must not have table-wide application UPDATE';
  end if;
  if not has_column_privilege('authenticated', 'public.job_applications', 'status', 'UPDATE') then
    raise exception 'Authenticated users need application status UPDATE';
  end if;
  if has_column_privilege('authenticated', 'public.job_applications', 'cover_letter', 'UPDATE') then
    raise exception 'Authenticated users must not edit application content';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'techkarvo_prevent_duplicate_application_before_insert'
      and not tgisinternal
  ) then
    raise exception 'Duplicate application guard is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'techkarvo_validate_job_completion_before_update'
      and not tgisinternal
  ) then
    raise exception 'Job completion guard is missing';
  end if;
end;
$$;
