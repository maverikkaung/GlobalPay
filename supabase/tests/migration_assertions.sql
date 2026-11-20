do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'jobs', 'job_applications', 'conversations',
    'messages', 'notifications', 'portfolio_items', 'reviews',
    'posts', 'post_likes', 'post_comments', 'connections', 'platform_admins',
    'platform_settings', 'membership_tiers', 'support_cases', 'admin_audit_log'
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
  if has_function_privilege('anon', 'public.techkarvo_can_connect(uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.techkarvo_can_connect(uuid,uuid)', 'EXECUTE') then
    raise exception 'Only authenticated members may use the non-disclosing connection-role check';
  end if;
  if not has_column_privilege('authenticated', 'public.messages', 'shared_post_id', 'INSERT') then
    raise exception 'Authenticated participants need the rich post preview field';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name in ('freelancer_public_profiles', 'client_public_profiles') and column_name = 'email') then
    raise exception 'Public profile views must not expose email addresses';
  end if;
  if has_table_privilege('anon', 'public.freelancer_public_profiles', 'SELECT')
    or has_table_privilege('anon', 'public.client_public_profiles', 'SELECT')
    or not has_table_privilege('authenticated', 'public.freelancer_public_profiles', 'SELECT')
    or not has_table_privilege('authenticated', 'public.client_public_profiles', 'SELECT') then
    raise exception 'Public profile projections must be readable only by authenticated marketplace members';
  end if;
  if has_table_privilege('anon', 'public.platform_admins', 'SELECT')
    or has_table_privilege('authenticated', 'public.platform_admins', 'SELECT')
    or has_table_privilege('authenticated', 'public.admin_audit_log', 'INSERT')
    or has_table_privilege('authenticated', 'public.admin_audit_log', 'UPDATE')
    or has_table_privilege('authenticated', 'public.admin_audit_log', 'DELETE') then
    raise exception 'Admin identities and audit writes must remain privileged';
  end if;
  if has_table_privilege('anon', 'public.support_cases', 'SELECT')
    or has_table_privilege('anon', 'public.membership_tiers', 'SELECT')
    or has_table_privilege('anon', 'public.platform_settings', 'SELECT') then
    raise exception 'Anonymous users must not read support or product configuration';
  end if;
  if not has_column_privilege('authenticated', 'public.support_cases', 'subject', 'INSERT')
    or has_column_privilege('authenticated', 'public.support_cases', 'status', 'INSERT')
    or has_column_privilege('authenticated', 'public.support_cases', 'assigned_admin_id', 'INSERT') then
    raise exception 'Members may open only constrained support requests';
  end if;
  if not has_function_privilege('authenticated', 'public.techkarvo_is_platform_admin()', 'EXECUTE')
    or has_function_privilege('anon', 'public.techkarvo_is_platform_admin()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.techkarvo_admin_review_report(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.techkarvo_admin_review_report(uuid,text,text)', 'EXECUTE') then
    raise exception 'Admin functions must be callable only by authenticated members';
  end if;
  if exists (select 1 from public.membership_tiers where is_simulation_only is not true)
    or (select count(*) from public.membership_tiers) <> 4 then
    raise exception 'Membership catalog must be limited to the four simulation-only tiers';
  end if;
  if not has_table_privilege('anon', 'public.ledger_entries', 'SELECT')
      and not has_table_privilege('authenticated', 'public.ledger_entries', 'SELECT')
      and not has_table_privilege('authenticated', 'public.ledger_transactions', 'SELECT')
      and not has_table_privilege('authenticated', 'public.financial_sandbox_config', 'SELECT') then
    null;
  else
    raise exception 'Ledger and sandbox configuration tables must not be directly readable';
  end if;
  if not has_function_privilege('authenticated', 'public.techkarvo_sandbox_wallet()', 'EXECUTE')
      or not has_function_privilege('authenticated', 'public.techkarvo_sandbox_deposit(numeric,text)', 'EXECUTE')
      or has_function_privilege('anon', 'public.techkarvo_sandbox_deposit(numeric,text)', 'EXECUTE')
      or has_function_privilege('anon', 'public.techkarvo_sandbox_withdraw(numeric,text)', 'EXECUTE') then
    raise exception 'Financial sandbox RPC grants must be authenticated-only';
  end if;
  if not has_function_privilege('authenticated', 'public.techkarvo_set_membership_auto_renew(boolean)', 'EXECUTE')
    or has_function_privilege('anon', 'public.techkarvo_set_membership_auto_renew(boolean)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.techkarvo_has_membership_feature(text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.techkarvo_has_membership_feature(text)', 'EXECUTE') then
    raise exception 'Membership consent and entitlement checks must be authenticated-only';
  end if;
  if exists(select 1 from (values
      ('freelancer','free',0::numeric,5,1000),('freelancer','plus',4.99::numeric,30,800),
      ('freelancer','gold',9.99::numeric,80,600),('freelancer','premium',19.99::numeric,200,500),
      ('client','free',0::numeric,2,200),('client','plus',9.99::numeric,10,200),
      ('client','gold',19.99::numeric,30,150),('client','premium',39.99::numeric,100,100)
    ) expected(account_type,slug,price,credits,fee_bps)
    left join public.membership_plans p using(account_type,slug)
    where p.id is null or p.simulated_price_usdt<>expected.price or p.included_usage_credits<>expected.credits or p.fee_bps<>expected.fee_bps) then
    raise exception 'Role-specific KAV pricing, usage limits, and fee rates must match product configuration';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='membership_entitlements' and column_name='auto_renew' and column_default like '%false%')
    or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='ledger_entries' and column_name='amount_kav' and numeric_scale=2)
    or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='contract_milestones' and column_name='client_fee_bps') then
    raise exception 'Two-decimal ledger, explicit renewal consent, and fee snapshots are required';
  end if;
  if not exists(select 1 from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace
      where n.nspname='public' and r.relname='ledger_accounts' and pg_get_constraintdef(c.oid) like '%wallet_reward%')
    or not has_function_privilege('authenticated', 'public.techkarvo_set_profile_boost(boolean)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.techkarvo_user_analytics()', 'EXECUTE') then
    raise exception 'Reward separation and premium feature RPCs must be configured';
  end if;
  if (select entitlements->>'featured_jobs' from public.membership_plans where account_type='client' and slug='premium')<>'true'
    or (select entitlements->>'profile_boost' from public.membership_plans where account_type='freelancer' and slug='gold')<>'true'
    or (select entitlements->>'advanced_search' from public.membership_plans where account_type='freelancer' and slug='plus')<>'true'
    or (select entitlements->>'priority_support' from public.membership_plans where account_type='freelancer' and slug='gold')<>'true'
    or (select entitlements->>'analytics' from public.membership_plans where account_type='client' and slug='gold')<>'true'
    or (select entitlements->>'priority_support' from public.membership_plans where account_type='client' and slug='gold')<>'true'
    or (select entitlements->>'ad_rewards' from public.membership_plans where account_type='freelancer' and slug='plus')<>'true' then
    raise exception 'Membership benefit flags must match the product plan catalog';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('membership_entitlements','membership_credit_events','ledger_accounts',
      'ledger_transactions','ledger_entries','contract_milestones','financial_disputes','milestone_events','sandbox_ad_reward_claims')
      and not c.relrowsecurity) then
    raise exception 'Every private sandbox and ledger table must enforce RLS';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public'
      and table_name in ('ledger_transactions','ledger_entries') and column_name in ('provider_key','wallet_address','payout_destination')) then
    raise exception 'Sandbox ledger schema must not store real provider credentials or payout destinations';
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
