-- Additive admin/support/catalog foundation. No existing marketplace rows are
-- changed or deleted. Catalog values are simulation-only; this creates no
-- balances, billing, escrow, payment integration, or money movement.
-- Do not apply to a shared database without separate explicit approval.
begin;

create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from public, anon, authenticated;
grant all on table public.platform_admins to service_role;

create or replace function public.techkarvo_is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())); $$;
revoke all on function public.techkarvo_is_platform_admin() from public, anon, authenticated;
grant execute on function public.techkarvo_is_platform_admin() to authenticated;

create table public.platform_settings (
  setting_key text primary key check (setting_key ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  setting_value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (octet_length(setting_value::text) <= 65536)
);
alter table public.platform_settings enable row level security;
revoke all on table public.platform_settings from public, anon, authenticated;
grant select on table public.platform_settings to authenticated;
grant all on table public.platform_settings to service_role;
create policy "Public product settings are readable by members"
  on public.platform_settings for select to authenticated using (is_public);
create policy "Admins can read all product settings"
  on public.platform_settings for select to authenticated using ((select public.techkarvo_is_platform_admin()));
create policy "Product settings read boundary"
  on public.platform_settings as restrictive for select to authenticated
  using (is_public or (select public.techkarvo_is_platform_admin()));
create policy "Anonymous users cannot access product settings"
  on public.platform_settings as restrictive for all to anon using (false) with check (false);

create table public.membership_tiers (
  slug text primary key check (slug ~ '^[a-z][a-z0-9_-]{1,39}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  description text not null default '' check (length(description) <= 500),
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  simulation_price_usdt numeric check (simulation_price_usdt is null or simulation_price_usdt >= 0),
  is_active boolean not null default false,
  display_order integer not null default 0 check (display_order between 0 and 1000),
  is_simulation_only boolean not null default true check (is_simulation_only),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (octet_length(features::text) <= 16384)
);
alter table public.membership_tiers enable row level security;
revoke all on table public.membership_tiers from public, anon, authenticated;
grant select on table public.membership_tiers to authenticated;
grant all on table public.membership_tiers to service_role;
create policy "Members can read active membership catalog"
  on public.membership_tiers for select to authenticated using (is_active);
create policy "Admins can read complete membership catalog"
  on public.membership_tiers for select to authenticated using ((select public.techkarvo_is_platform_admin()));
create policy "Membership catalog read boundary"
  on public.membership_tiers as restrictive for select to authenticated
  using (is_active or (select public.techkarvo_is_platform_admin()));
create policy "Anonymous users cannot access membership catalog"
  on public.membership_tiers as restrictive for all to anon using (false) with check (false);
insert into public.membership_tiers
  (slug, display_name, description, features, simulation_price_usdt, is_active, display_order)
values
  ('free', 'Free', 'Buyer-configured demo catalog entry.', '[]'::jsonb, 0, true, 0),
  ('plus', 'Plus', 'Configure this demo tier before presenting it.', '[]'::jsonb, null, false, 1),
  ('gold', 'Gold', 'Configure this demo tier before presenting it.', '[]'::jsonb, null, false, 2),
  ('premium', 'Premium', 'Configure this demo tier before presenting it.', '[]'::jsonb, null, false, 3);

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (length(btrim(subject)) between 3 and 160),
  description text not null check (length(btrim(description)) between 1 and 8000),
  category text not null check (category in ('account', 'technical', 'safety', 'billing_question', 'other')),
  status text not null default 'open' check (status in ('open', 'triaged', 'waiting_on_user', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  assigned_admin_id uuid references public.platform_admins(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_cases_requester_created_idx on public.support_cases (requester_id, created_at desc);
create index support_cases_queue_idx on public.support_cases (status, priority, created_at desc);
alter table public.support_cases enable row level security;
revoke all on table public.support_cases from public, anon, authenticated;
grant select on table public.support_cases to authenticated;
grant insert (requester_id, subject, description, category) on table public.support_cases to authenticated;
grant all on table public.support_cases to service_role;
create policy "Requesters can read their support cases"
  on public.support_cases for select to authenticated using (requester_id = (select auth.uid()));
create policy "Admins can read support queue"
  on public.support_cases for select to authenticated using ((select public.techkarvo_is_platform_admin()));
create policy "Support case read boundary"
  on public.support_cases as restrictive for select to authenticated
  using (requester_id = (select auth.uid()) or (select public.techkarvo_is_platform_admin()));
create policy "Members can open their own support case"
  on public.support_cases for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'open' and priority = 'normal' and assigned_admin_id is null);
create policy "Support case insert boundary"
  on public.support_cases as restrictive for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'open' and priority = 'normal' and assigned_admin_id is null);
create policy "Support cases cannot be deleted by members"
  on public.support_cases as restrictive for delete to authenticated using (false);
create policy "Anonymous users cannot access support cases"
  on public.support_cases as restrictive for all to anon using (false) with check (false);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (length(btrim(action)) between 1 and 100),
  resource_type text not null check (length(btrim(resource_type)) between 1 and 60),
  resource_id text not null check (length(resource_id) <= 120),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  check (octet_length(details::text) <= 8192)
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_resource_idx on public.admin_audit_log (resource_type, resource_id, created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select on table public.admin_audit_log to authenticated;
grant all on table public.admin_audit_log to service_role;
create policy "Admins can read audit log"
  on public.admin_audit_log for select to authenticated using ((select public.techkarvo_is_platform_admin()));
create policy "Audit log read boundary"
  on public.admin_audit_log as restrictive for select to authenticated
  using ((select public.techkarvo_is_platform_admin()));
create policy "Anonymous users cannot access audit log"
  on public.admin_audit_log as restrictive for all to anon using (false) with check (false);

create or replace function public.techkarvo_admin_set_product_setting(p_key text, p_value jsonb, p_is_public boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.techkarvo_is_platform_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_key is null or p_key !~ '^[a-z][a-z0-9_.-]{1,79}$' or p_value is null or octet_length(p_value::text) > 65536 then
    raise exception 'Invalid product setting';
  end if;
  insert into public.platform_settings (setting_key, setting_value, is_public, updated_by, updated_at)
  values (p_key, p_value, coalesce(p_is_public, false), auth.uid(), now())
  on conflict (setting_key) do update set setting_value = excluded.setting_value, is_public = excluded.is_public,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into public.admin_audit_log (actor_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'setting.upsert', 'platform_setting', p_key, jsonb_build_object('is_public', coalesce(p_is_public, false)));
end;
$$;
revoke all on function public.techkarvo_admin_set_product_setting(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.techkarvo_admin_set_product_setting(text, jsonb, boolean) to authenticated;

create or replace function public.techkarvo_admin_upsert_membership_tier(
  p_slug text, p_display_name text, p_description text, p_features jsonb,
  p_simulation_price_usdt numeric, p_is_active boolean, p_display_order integer
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.techkarvo_is_platform_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_slug is null or p_slug !~ '^[a-z][a-z0-9_-]{1,39}$'
    or p_display_name is null or length(btrim(p_display_name)) not between 1 and 60
    or length(coalesce(p_description, '')) > 500 or p_features is null or jsonb_typeof(p_features) <> 'array'
    or octet_length(p_features::text) > 16384
    or (p_simulation_price_usdt is not null and p_simulation_price_usdt < 0)
    or p_display_order is null or p_display_order not between 0 and 1000 then
    raise exception 'Invalid membership catalog entry';
  end if;
  insert into public.membership_tiers
    (slug, display_name, description, features, simulation_price_usdt, is_active, display_order, updated_by, updated_at)
  values (p_slug, btrim(p_display_name), coalesce(p_description, ''), p_features,
    p_simulation_price_usdt, coalesce(p_is_active, false), p_display_order, auth.uid(), now())
  on conflict (slug) do update set display_name = excluded.display_name, description = excluded.description,
    features = excluded.features, simulation_price_usdt = excluded.simulation_price_usdt, is_active = excluded.is_active,
    display_order = excluded.display_order, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into public.admin_audit_log (actor_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'membership_tier.upsert', 'membership_tier', p_slug,
    jsonb_build_object('active', coalesce(p_is_active, false), 'simulation_only', true));
end;
$$;
revoke all on function public.techkarvo_admin_upsert_membership_tier(text, text, text, jsonb, numeric, boolean, integer) from public, anon, authenticated;
grant execute on function public.techkarvo_admin_upsert_membership_tier(text, text, text, jsonb, numeric, boolean, integer) to authenticated;

create or replace function public.techkarvo_admin_update_support_case(p_case_id uuid, p_status text, p_priority text, p_assigned_admin_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare changed public.support_cases%rowtype;
begin
  if not public.techkarvo_is_platform_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_status not in ('open', 'triaged', 'waiting_on_user', 'resolved', 'closed') or p_priority not in ('normal', 'urgent') then
    raise exception 'Invalid support case status or priority';
  end if;
  if p_assigned_admin_id is not null and not exists (select 1 from public.platform_admins where user_id = p_assigned_admin_id) then
    raise exception 'Support assignee must be an administrator';
  end if;
  update public.support_cases set status = p_status, priority = p_priority,
    assigned_admin_id = p_assigned_admin_id, updated_at = now()
    where id = p_case_id returning * into changed;
  if not found then raise exception 'Support case not found'; end if;
  insert into public.admin_audit_log (actor_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'support_case.update', 'support_case', changed.id::text,
    jsonb_build_object('status', changed.status, 'priority', changed.priority, 'assigned', changed.assigned_admin_id is not null));
end;
$$;
revoke all on function public.techkarvo_admin_update_support_case(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.techkarvo_admin_update_support_case(uuid, text, text, uuid) to authenticated;

create or replace function public.techkarvo_admin_review_report(p_report_id uuid, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare changed public.user_reports%rowtype;
begin
  if not public.techkarvo_is_platform_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_status not in ('reviewing', 'resolved', 'dismissed') or length(coalesce(p_note, '')) > 2000 then
    raise exception 'Invalid moderation status or note';
  end if;
  update public.user_reports set status = p_status where id = p_report_id returning * into changed;
  if not found then raise exception 'Report not found'; end if;
  insert into public.admin_audit_log (actor_id, action, resource_type, resource_id, details)
  values (auth.uid(), 'report.review', 'user_report', changed.id::text,
    jsonb_build_object('status', changed.status, 'note', coalesce(p_note, '')));
end;
$$;
revoke all on function public.techkarvo_admin_review_report(uuid, text, text) from public, anon, authenticated;
grant execute on function public.techkarvo_admin_review_report(uuid, text, text) to authenticated;

create or replace function public.techkarvo_admin_marketplace_summary()
returns table (total_clients bigint, total_freelancers bigint, open_jobs bigint, total_applications bigint,
  active_contracts bigint, completed_contracts bigint, pending_reports bigint, open_support_cases bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.techkarvo_is_platform_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return query select
    (select count(*) from public.profiles p where p.account_type = 'client'),
    (select count(*) from public.profiles p where p.account_type = 'freelancer'),
    (select count(*) from public.jobs j where j.status = 'open'),
    (select count(*) from public.job_applications),
    (select count(*) from public.contracts c where c.status = 'active'),
    (select count(*) from public.contracts c where c.status = 'completed'),
    (select count(*) from public.user_reports r where r.status = 'pending'),
    (select count(*) from public.support_cases s where s.status in ('open', 'triaged', 'waiting_on_user'));
end;
$$;
revoke all on function public.techkarvo_admin_marketplace_summary() from public, anon, authenticated;
grant execute on function public.techkarvo_admin_marketplace_summary() to authenticated;

drop policy "Report owner read boundary" on public.user_reports;
create policy "Report owner and admin read boundary"
  on public.user_reports as restrictive for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.techkarvo_is_platform_admin()));
create policy "Admins can read moderation queue"
  on public.user_reports for select to authenticated using ((select public.techkarvo_is_platform_admin()));
create policy "Reports remain read only to members"
  on public.user_reports as restrictive for update to authenticated using (false) with check (false);

commit;
