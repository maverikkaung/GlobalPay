-- Minimal disposable Supabase-like schema used only by GitHub Actions.
-- This fixture is not connected to the TechKarvo production project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create function auth.role()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  account_type text not null default 'freelancer'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  title text not null,
  description text not null,
  budget numeric not null
);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  freelancer_id uuid not null
);

grant usage on schema public, auth to anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles, public.jobs, public.job_applications to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
