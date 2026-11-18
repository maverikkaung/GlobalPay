do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'jobs', 'job_applications', 'conversations',
    'messages', 'notifications', 'portfolio_items', 'reviews',
    'posts', 'post_likes', 'post_comments', 'connections'
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
  if has_table_privilege('anon', 'public.reviews', 'SELECT')
    or has_table_privilege('authenticated', 'public.reviews', 'SELECT') then
    raise exception 'Reviews must not expose unrestricted base-table reads';
  end if;
  if has_column_privilege('authenticated', 'public.reviews', 'body', 'SELECT')
    or has_column_privilege('authenticated', 'public.reviews', 'job_id', 'SELECT')
    or has_column_privilege('authenticated', 'public.reviews', 'reviewee_id', 'SELECT') then
    raise exception 'Review content and relationship fields require the safe public view';
  end if;
  if not has_column_privilege('authenticated', 'public.reviews', 'application_id', 'SELECT')
    or not has_column_privilege('authenticated', 'public.reviews', 'reviewer_id', 'SELECT') then
    raise exception 'Review authors need their own review identifiers';
  end if;
  if not has_table_privilege('authenticated', 'public.reviews_public', 'SELECT')
    or has_table_privilege('anon', 'public.reviews_public', 'SELECT') then
    raise exception 'Only authenticated users should read the public review projection';
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.reviews_public'::regclass
      and attname in ('application_id', 'reviewer_id', 'job_id')
      and attnum > 0 and not attisdropped
  ) then
    raise exception 'The public review projection must omit application and author identifiers';
  end if;
  if has_table_privilege('authenticated', 'public.job_applications', 'UPDATE') then
    raise exception 'Authenticated users must not have table-wide application UPDATE';
  end if;
  if has_table_privilege('authenticated', 'public.job_applications', 'DELETE') then
    raise exception 'Application withdrawals must preserve history instead of deleting rows';
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
  if has_table_privilege('anon', 'public.posts', 'SELECT')
    or has_table_privilege('anon', 'public.connections', 'SELECT')
    or has_table_privilege('anon', 'public.post_comments', 'INSERT') then
    raise exception 'Anonymous users must not access authenticated social data';
  end if;
  if has_table_privilege('authenticated', 'public.connections', 'DELETE')
    or has_table_privilege('authenticated', 'public.connections', 'UPDATE') then
    raise exception 'Connection responses should only permit status updates, never deletion/table-wide edits';
  end if;
  if not has_column_privilege('authenticated', 'public.connections', 'status', 'UPDATE') then
    raise exception 'Connection recipients need status updates to accept or decline';
  end if;
  if not has_column_privilege('authenticated', 'public.messages', 'shared_post_id', 'INSERT') then
    raise exception 'Authenticated participants need the rich post preview field';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name in ('freelancer_public_profiles', 'client_public_profiles') and column_name = 'email') then
    raise exception 'Public profile views must not expose email addresses';
  end if;
  if not exists (select 1 from storage.buckets where id = 'techkarvo-marketplace'
    and public = true and file_size_limit = 5242880
    and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]) then
    raise exception 'Public marketplace image bucket must enforce the 5 MiB image-only policy';
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
    and exists (select 1 from unnest(array['posts', 'post_likes', 'post_comments', 'connections']) as t(social_table)
      where not exists (select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t.social_table)) then
    raise exception 'Social marketplace tables should be in the Supabase Realtime publication';
  end if;
end;
$$;
