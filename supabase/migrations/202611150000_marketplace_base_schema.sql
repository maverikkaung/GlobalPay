-- Initial marketplace schema for a fresh TechKarvo Supabase project.
-- Apply before the additive security and marketplace migrations.
-- This intentionally fails if any of these base tables already exist so a
-- legacy database cannot silently skip the constraints defined here.

begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  account_type text not null default 'freelancer'
    check (account_type in ('client', 'freelancer'))
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  title text not null check (length(btrim(title)) > 0),
  description text not null check (length(btrim(description)) > 0),
  budget numeric not null check (budget > 0),
  category text not null default 'Other',
  skills text not null default '',
  currency text not null default 'USD',
  payment_type text not null default 'Fixed Price',
  status text not null default 'open'
    check (status in ('open', 'completed')),
  created_at timestamptz not null default now(),
  constraint jobs_id_client_id_key unique (id, client_id)
);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  client_id uuid not null,
  freelancer_id uuid not null references public.profiles(id),
  full_name text not null default '',
  email text not null default '',
  country text not null default '',
  professional_title text not null default '',
  bio text not null default '',
  skills text not null default '',
  experience text not null default '',
  cover_letter text not null default '',
  expected_salary numeric check (expected_salary is null or expected_salary > 0),
  salary_type text not null default 'Fixed Price',
  portfolio text not null default '',
  status text not null default 'Pending'
    check (status in ('Pending', 'Accepted', 'Rejected', 'Withdrawn')),
  applied_at timestamptz not null default now(),
  constraint job_applications_job_owner_fkey
    foreign key (job_id, client_id) references public.jobs(id, client_id),
  constraint job_applications_job_freelancer_key unique (job_id, freelancer_id)
);

create index jobs_client_id_idx on public.jobs (client_id);
create index jobs_status_created_at_idx on public.jobs (status, created_at desc);
create index applications_client_id_status_idx on public.job_applications (client_id, status);
create index applications_freelancer_id_applied_at_idx
  on public.job_applications (freelancer_id, applied_at desc);

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_applications enable row level security;

grant usage on schema public to anon, authenticated, service_role;
revoke all on table public.profiles, public.jobs, public.job_applications
  from public, anon, authenticated;
grant all on table public.profiles, public.jobs, public.job_applications to service_role;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select on public.jobs to anon, authenticated;
grant insert, update, delete on public.jobs to authenticated;
grant select, insert on public.job_applications to authenticated;
grant update (status) on public.job_applications to authenticated;

create policy "TechKarvo profile owner can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "TechKarvo profile owner can update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "TechKarvo open jobs are public"
  on public.jobs for select to anon, authenticated
  using (status = 'open' or client_id = (select auth.uid()));
create policy "TechKarvo clients can create their jobs"
  on public.jobs for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'client')
  );
create policy "TechKarvo clients can update their jobs"
  on public.jobs for update to authenticated
  using (client_id = (select auth.uid()))
  with check (
    client_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'client')
  );
create policy "TechKarvo clients can delete their jobs"
  on public.jobs for delete to authenticated
  using (
    client_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'client')
  );

create policy "TechKarvo participants can read applications"
  on public.job_applications for select to authenticated
  using (
    freelancer_id = (select auth.uid())
    or exists (select 1 from public.jobs j
      where j.id = job_applications.job_id and j.client_id = (select auth.uid()))
  );
create policy "TechKarvo freelancers can apply to open jobs"
  on public.job_applications for insert to authenticated
  with check (
    freelancer_id = (select auth.uid())
    and status = 'Pending'
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'freelancer')
    and exists (select 1 from public.jobs j
      where j.id = job_applications.job_id
        and j.client_id = job_applications.client_id and j.status = 'open')
  );
create policy "TechKarvo clients can decide applications"
  on public.job_applications for update to authenticated
  using (
    client_id = (select auth.uid())
    and exists (select 1 from public.jobs j
      where j.id = job_applications.job_id and j.client_id = (select auth.uid()))
  )
  with check (
    client_id = (select auth.uid())
    and exists (select 1 from public.jobs j
      where j.id = job_applications.job_id and j.client_id = (select auth.uid()))
  );

commit;
