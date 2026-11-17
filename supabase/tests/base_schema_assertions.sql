do $$
declare
  table_name text;
begin
  if exists (
    select required.table_name, required.column_name
    from (values
      ('profiles', 'id'), ('profiles', 'full_name'), ('profiles', 'account_type'),
      ('jobs', 'id'), ('jobs', 'client_id'), ('jobs', 'title'), ('jobs', 'description'),
      ('jobs', 'budget'), ('jobs', 'category'), ('jobs', 'skills'), ('jobs', 'currency'),
      ('jobs', 'payment_type'), ('jobs', 'status'), ('jobs', 'created_at'),
      ('job_applications', 'id'), ('job_applications', 'job_id'),
      ('job_applications', 'client_id'), ('job_applications', 'freelancer_id'),
      ('job_applications', 'full_name'), ('job_applications', 'email'),
      ('job_applications', 'country'), ('job_applications', 'professional_title'),
      ('job_applications', 'bio'), ('job_applications', 'skills'),
      ('job_applications', 'experience'), ('job_applications', 'cover_letter'),
      ('job_applications', 'expected_salary'), ('job_applications', 'salary_type'),
      ('job_applications', 'portfolio'), ('job_applications', 'status'),
      ('job_applications', 'applied_at')
    ) as required(table_name, column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = required.table_name
        and c.column_name = required.column_name
    )
  ) then
    raise exception 'A required marketplace base column is missing';
  end if;

  foreach table_name in array array['profiles', 'jobs', 'job_applications'] loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = table_name and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', table_name;
    end if;
  end loop;

  if not has_table_privilege('anon', 'public.jobs', 'SELECT')
    or has_table_privilege('anon', 'public.profiles', 'SELECT')
    or has_table_privilege('anon', 'public.job_applications', 'SELECT') then
    raise exception 'Anonymous grants do not match the public marketplace boundary';
  end if;
  if has_table_privilege('authenticated', 'public.job_applications', 'DELETE')
    or has_column_privilege('authenticated', 'public.job_applications', 'cover_letter', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.job_applications', 'status', 'UPDATE') then
    raise exception 'Application privileges are broader or narrower than intended';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'account_type', 'UPDATE') then
    raise exception 'Base profile grants must permit only full-name updates';
  end if;
  if not has_table_privilege('service_role', 'public.profiles', 'SELECT')
    or not has_table_privilege('service_role', 'public.jobs', 'INSERT')
    or not has_table_privilege('service_role', 'public.job_applications', 'UPDATE') then
    raise exception 'The Supabase service role is missing expected table privileges';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.jobs'::regclass and contype = 'f'
      and confrelid = 'public.profiles'::regclass
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.job_applications'::regclass and contype = 'f'
      and confrelid = 'public.jobs'::regclass
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.job_applications'::regclass and contype = 'f'
      and confrelid = 'public.profiles'::regclass
  ) then
    raise exception 'A required Auth, job, or profile foreign key is missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.job_applications'::regclass
      and conname = 'job_applications_job_owner_fkey'
      and contype = 'f' and cardinality(conkey) = 2
  ) then
    raise exception 'Applications must reference the owning client and job as a pair';
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_account_type_check')
    or not exists (select 1 from pg_constraint where conname = 'jobs_budget_check')
    or not exists (select 1 from pg_constraint where conname = 'job_applications_status_check')
    or not exists (select 1 from pg_constraint where conname = 'job_applications_job_freelancer_key') then
    raise exception 'A required role, budget, application status, or uniqueness constraint is missing';
  end if;

  if to_regclass('public.jobs_client_id_idx') is null
    or to_regclass('public.jobs_status_created_at_idx') is null
    or to_regclass('public.applications_client_id_status_idx') is null
    or to_regclass('public.applications_freelancer_id_applied_at_idx') is null then
    raise exception 'A required marketplace lookup index is missing';
  end if;
end;
$$;
