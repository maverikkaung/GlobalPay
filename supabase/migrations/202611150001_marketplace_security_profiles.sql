-- TechKarvo marketplace foundation.
-- This migration is additive and keeps existing users, jobs, and applications.

alter table public.profiles
  add column if not exists country text,
  add column if not exists professional_title text,
  add column if not exists bio text,
  add column if not exists skills text,
  add column if not exists experience text,
  add column if not exists portfolio_url text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.jobs
  add column if not exists category text not null default 'Other',
  add column if not exists skills text not null default '',
  add column if not exists currency text not null default 'USD',
  add column if not exists payment_type text not null default 'Fixed Price',
  add column if not exists status text not null default 'open',
  add column if not exists created_at timestamptz not null default now();

alter table public.job_applications
  add column if not exists client_id uuid,
  add column if not exists full_name text not null default '',
  add column if not exists email text not null default '',
  add column if not exists country text not null default '',
  add column if not exists professional_title text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists skills text not null default '',
  add column if not exists experience text not null default '',
  add column if not exists cover_letter text not null default '',
  add column if not exists expected_salary numeric,
  add column if not exists salary_type text not null default 'Fixed Price',
  add column if not exists portfolio text not null default '',
  add column if not exists status text not null default 'Pending',
  add column if not exists applied_at timestamptz not null default now();

insert into public.profiles (id, full_name, account_type)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case
    when u.raw_user_meta_data ->> 'account_type' in ('client', 'freelancer')
      then u.raw_user_meta_data ->> 'account_type'
    else 'freelancer'
  end
from auth.users u
on conflict (id) do nothing;

update public.job_applications a
set client_id = j.client_id
from public.jobs j
where a.job_id = j.id and a.client_id is null;

create index if not exists jobs_client_id_idx on public.jobs (client_id);
create index if not exists jobs_status_created_at_idx on public.jobs (status, created_at desc);
create index if not exists applications_client_id_status_idx on public.job_applications (client_id, status);
create index if not exists applications_freelancer_id_applied_at_idx on public.job_applications (freelancer_id, applied_at desc);

create or replace function public.techkarvo_create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when new.raw_user_meta_data ->> 'account_type' in ('client', 'freelancer')
        then new.raw_user_meta_data ->> 'account_type'
      else 'freelancer'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists techkarvo_create_profile_after_signup on auth.users;
create trigger techkarvo_create_profile_after_signup
  after insert on auth.users
  for each row execute function public.techkarvo_create_profile();

create or replace function public.techkarvo_protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and new.account_type is distinct from old.account_type then
    raise exception 'Account type cannot be changed by the account owner';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists techkarvo_protect_profile_role_before_update on public.profiles;
create trigger techkarvo_protect_profile_role_before_update
  before update on public.profiles
  for each row execute function public.techkarvo_protect_profile_role();

create or replace function public.techkarvo_protect_application_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and auth.uid() is distinct from old.client_id then
    raise exception 'Only the job owner may update an application';
  end if;

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
    raise exception 'Clients may update only the application status';
  end if;

  if old.status <> 'Pending' or new.status not in ('Accepted', 'Rejected') then
    raise exception 'This application status transition is not allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists techkarvo_protect_application_update_before_update on public.job_applications;
create trigger techkarvo_protect_application_update_before_update
  before update on public.job_applications
  for each row execute function public.techkarvo_protect_application_update();

create or replace function public.techkarvo_prevent_duplicate_application()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(new.job_id::text || ':' || new.freelancer_id::text, 0)
  );

  if exists (
    select 1 from public.job_applications a
    where a.job_id::text = new.job_id::text
      and a.freelancer_id = new.freelancer_id
  ) then
    raise exception 'A freelancer can apply to a job only once'
      using errcode = '23505', constraint = 'job_applications_job_freelancer_key';
  end if;

  return new;
end;
$$;

drop trigger if exists techkarvo_prevent_duplicate_application_before_insert on public.job_applications;
create trigger techkarvo_prevent_duplicate_application_before_insert
  before insert on public.job_applications
  for each row execute function public.techkarvo_prevent_duplicate_application();

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_applications enable row level security;

grant select, update on public.profiles to authenticated;
grant select on public.jobs to anon, authenticated;
grant insert, update, delete on public.jobs to authenticated;
grant select, insert, delete on public.job_applications to authenticated;
revoke update on public.job_applications from public, anon, authenticated;
grant update (status) on public.job_applications to authenticated;

drop policy if exists "TechKarvo profile owner can read" on public.profiles;
create policy "TechKarvo profile owner can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "TechKarvo profile owner can update" on public.profiles;
create policy "TechKarvo profile owner can update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Restrictive policies also constrain any older permissive policies left by
-- earlier deployments; PostgreSQL combines restrictive rules with AND.
drop policy if exists "TechKarvo profile owner boundary" on public.profiles;
create policy "TechKarvo profile owner boundary"
  on public.profiles as restrictive for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke insert, delete on public.profiles from anon, authenticated;

drop policy if exists "TechKarvo open jobs are public" on public.jobs;
create policy "TechKarvo open jobs are public"
  on public.jobs for select to anon, authenticated
  using (status = 'open' or client_id = (select auth.uid()));

drop policy if exists "TechKarvo clients can create their jobs" on public.jobs;
create policy "TechKarvo clients can create their jobs"
  on public.jobs for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'client'
    )
  );

drop policy if exists "TechKarvo clients can update their jobs" on public.jobs;
create policy "TechKarvo clients can update their jobs"
  on public.jobs for update to authenticated
  using (client_id = (select auth.uid()))
  with check (
    client_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'client')
  );

drop policy if exists "TechKarvo clients can delete their jobs" on public.jobs;
create policy "TechKarvo clients can delete their jobs"
  on public.jobs for delete to authenticated
  using (
    client_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'client')
  );

drop policy if exists "TechKarvo job read boundary" on public.jobs;
create policy "TechKarvo job read boundary"
  on public.jobs as restrictive for select to anon, authenticated
  using (status = 'open' or client_id = (select auth.uid()));

drop policy if exists "TechKarvo job insert boundary" on public.jobs;
create policy "TechKarvo job insert boundary"
  on public.jobs as restrictive for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'client'
    )
  );

drop policy if exists "TechKarvo job update boundary" on public.jobs;
create policy "TechKarvo job update boundary"
  on public.jobs as restrictive for update to authenticated
  using (client_id = (select auth.uid()))
  with check (
    client_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'client')
  );

drop policy if exists "TechKarvo job delete boundary" on public.jobs;
create policy "TechKarvo job delete boundary"
  on public.jobs as restrictive for delete to authenticated
  using (
    client_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'client')
  );

drop policy if exists "TechKarvo participants can read applications" on public.job_applications;
create policy "TechKarvo participants can read applications"
  on public.job_applications for select to authenticated
  using (
    freelancer_id = (select auth.uid())
    or exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id and j.client_id = (select auth.uid())
    )
  );

drop policy if exists "TechKarvo freelancers can apply to open jobs" on public.job_applications;
create policy "TechKarvo freelancers can apply to open jobs"
  on public.job_applications for insert to authenticated
  with check (
    freelancer_id = (select auth.uid())
    and status = 'Pending'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'freelancer'
    )
    and exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id
        and j.client_id = job_applications.client_id
        and j.status = 'open'
    )
  );

drop policy if exists "TechKarvo clients can decide applications" on public.job_applications;
create policy "TechKarvo clients can decide applications"
  on public.job_applications for update to authenticated
  using (
    client_id = (select auth.uid())
    and exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id and j.client_id = (select auth.uid())
    )
  )
  with check (
    client_id = (select auth.uid())
    and exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id and j.client_id = (select auth.uid())
    )
  );

drop policy if exists "TechKarvo freelancers can withdraw pending applications" on public.job_applications;
create policy "TechKarvo freelancers can withdraw pending applications"
  on public.job_applications for delete to authenticated
  using (freelancer_id = (select auth.uid()) and status = 'Pending');

drop policy if exists "TechKarvo application read boundary" on public.job_applications;
create policy "TechKarvo application read boundary"
  on public.job_applications as restrictive for select to authenticated
  using (
    freelancer_id = (select auth.uid())
    or exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id and j.client_id = (select auth.uid())
    )
  );

drop policy if exists "TechKarvo application insert boundary" on public.job_applications;
create policy "TechKarvo application insert boundary"
  on public.job_applications as restrictive for insert to authenticated
  with check (
    freelancer_id = (select auth.uid())
    and status = 'Pending'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'freelancer'
    )
    and exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id
        and j.client_id = job_applications.client_id
        and j.status = 'open'
    )
  );

drop policy if exists "TechKarvo application update boundary" on public.job_applications;
create policy "TechKarvo application update boundary"
  on public.job_applications as restrictive for update to authenticated
  using (
    client_id = (select auth.uid())
    and exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id and j.client_id = (select auth.uid())
    )
  )
  with check (
    client_id = (select auth.uid())
    and exists (
      select 1 from public.jobs j
      where j.id = job_applications.job_id and j.client_id = (select auth.uid())
    )
  );

drop policy if exists "TechKarvo application delete boundary" on public.job_applications;
create policy "TechKarvo application delete boundary"
  on public.job_applications as restrictive for delete to authenticated
  using (freelancer_id = (select auth.uid()) and status = 'Pending');
