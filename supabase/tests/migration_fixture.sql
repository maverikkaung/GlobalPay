-- Supabase Auth compatibility primitives for a fresh disposable PostgreSQL
-- database used only by GitHub Actions. The base migration creates the app
-- tables; this fixture is not connected to any TechKarvo Supabase project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create publication supabase_realtime;

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

grant usage on schema public, auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;

-- Minimal Supabase Storage compatibility fixture used only by isolated CI.
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner_id text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create function storage.foldername(path text)
returns text[] language sql immutable strict
as $$ select (string_to_array(path, '/'))[1:greatest(array_length(string_to_array(path, '/'), 1) - 1, 0)] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
