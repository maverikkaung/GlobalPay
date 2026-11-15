-- Public profiles need public review content, while review authors need to
-- check their own application ids. Keep those projections separate so base
-- review rows never expose reviewer/application identifiers to other users.
revoke all on table public.reviews from public, anon, authenticated;
grant insert on table public.reviews to authenticated;
grant select (application_id, reviewer_id) on table public.reviews to authenticated;

drop policy if exists "Completed job participants can read reviews" on public.reviews;
create policy "Review authors can read their own records"
  on public.reviews for select to authenticated
  using (reviewer_id = (select auth.uid()));

drop policy if exists "Public review read boundary" on public.reviews;
create policy "Review author read boundary"
  on public.reviews as restrictive for select to authenticated
  using (reviewer_id = (select auth.uid()));

create or replace view public.reviews_public
with (security_barrier = true)
as
select id, reviewee_id, rating, body, created_at
from public.reviews;

revoke all on table public.reviews_public from public, anon, authenticated;
grant select on table public.reviews_public to authenticated;
