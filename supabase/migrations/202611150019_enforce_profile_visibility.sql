-- Preserve the authenticated projections and owner-only source table while
-- enforcing the same bilateral block boundary for all discovery reads.
create or replace view public.freelancer_public_profiles
with (security_barrier = true) as
select u.id, u.full_name, u.account_type, u.country, u.professional_title, u.bio,
  u.skills, u.experience, u.portfolio_url, u.avatar_path, u.cover_path,
  (u.profile_boost_until > now() and exists (
    select 1 from public.membership_entitlements e
    join public.membership_plans p on p.id = e.plan_id and p.account_type = u.account_type
    where e.user_id = u.id and e.period_started_at <= now() and e.period_ends_at > now()
      and p.is_active and p.is_simulation_only and p.entitlements->'profile_boost' = 'true'::jsonb
  )) is true as is_profile_boosted
from public.profiles u
where u.account_type = 'freelancer'
  and (select auth.uid()) is not null
  and not public.techkarvo_is_blocked_with(u.id);

create or replace view public.client_public_profiles
with (security_barrier = true) as
select u.id, u.full_name, u.account_type, u.country, u.professional_title, u.bio,
  u.skills, u.experience, u.portfolio_url, u.avatar_path, u.cover_path
from public.profiles u
where u.account_type = 'client'
  and (select auth.uid()) is not null
  and not public.techkarvo_is_blocked_with(u.id);

create or replace view public.reviews_public
with (security_barrier = true) as
select r.id, r.reviewee_id, r.rating, r.body, r.created_at
from public.reviews r
where (select auth.uid()) is not null
  and not public.techkarvo_is_blocked_with(r.reviewee_id)
  and not public.techkarvo_is_blocked_with(r.reviewer_id);

revoke all on table public.freelancer_public_profiles, public.client_public_profiles, public.reviews_public
  from public, anon, authenticated;
grant select on table public.freelancer_public_profiles, public.client_public_profiles, public.reviews_public
  to authenticated;

create policy "Portfolio read excludes blocked relationships"
  on public.portfolio_items as restrictive for select to authenticated
  using (not public.techkarvo_is_blocked_with(freelancer_id));

create policy "Connection read excludes blocked relationships"
  on public.connections as restrictive for select to authenticated
  using (
    case
      when requester_id = (select auth.uid()) then not public.techkarvo_is_blocked_with(recipient_id)
      when recipient_id = (select auth.uid()) then not public.techkarvo_is_blocked_with(requester_id)
      else false
    end
  );

-- The existing block safeguard also appears in the REST schema because the
-- policy executes it as the caller. Only the pair's participants need its result.
create or replace function public.techkarvo_has_active_work(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) in (p_user_a, p_user_b) then
    exists (
      select 1 from public.contracts c
      where c.status in ('active', 'disputed')
        and ((c.client_id = p_user_a and c.freelancer_id = p_user_b)
          or (c.client_id = p_user_b and c.freelancer_id = p_user_a))
    ) or exists (
      select 1 from public.job_applications a
      join public.jobs j on j.id = a.job_id
      where a.status = 'Accepted' and j.status = 'open'
        and ((a.client_id = p_user_a and a.freelancer_id = p_user_b)
          or (a.client_id = p_user_b and a.freelancer_id = p_user_a))
    )
  else false end;
$$;

-- Safety Settings needs a label to let the blocker identify and remove an
-- entry. Expose only labels on blocks the caller personally created.
create function public.techkarvo_my_blocked_member_labels()
returns table(id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.user_blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid());
$$;

revoke all on function public.techkarvo_my_blocked_member_labels() from public, anon, authenticated;
grant execute on function public.techkarvo_my_blocked_member_labels() to authenticated;
