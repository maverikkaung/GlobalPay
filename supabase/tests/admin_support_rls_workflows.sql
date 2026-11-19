-- Exercises admin isolation, support ownership, moderation RPCs, audit access,
-- and simulation-only membership catalog in disposable PostgreSQL CI.
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('91111111-1111-4111-8111-111111111111', '{"full_name":"Admin Fixture Client","account_type":"client"}'),
  ('92222222-2222-4222-8222-222222222222', '{"full_name":"Support Fixture Freelancer","account_type":"freelancer"}');

set local role service_role;
insert into public.platform_admins (user_id, created_by)
values ('91111111-1111-4111-8111-111111111111', '91111111-1111-4111-8111-111111111111');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '91111111-1111-4111-8111-111111111111', true);

insert into public.support_cases (requester_id, subject, description, category)
values ('91111111-1111-4111-8111-111111111111', 'Need account help', 'Test-only support request', 'account');
insert into public.user_reports (reporter_id, reported_user_id, category, details)
values ('91111111-1111-4111-8111-111111111111', '92222222-2222-4222-8222-222222222222', 'other', 'Test-only moderation item');

do $$
declare
  support_id uuid;
  report_id uuid;
  denied boolean := false;
begin
  if not public.techkarvo_is_platform_admin() then raise exception 'Seeded administrator was not recognized'; end if;
  if (select count(*) from public.membership_tiers) <> 4 then raise exception 'Admin must see all four tiers'; end if;
  if (select count(*) from public.support_cases) <> 1 then raise exception 'Admin must see the support queue'; end if;
  if (select count(*) from public.user_reports) <> 1 then raise exception 'Admin must see the moderation queue'; end if;

  select id into support_id from public.support_cases limit 1;
  select id into report_id from public.user_reports limit 1;
  perform public.techkarvo_admin_set_product_setting('brand.name', '"TechKarvo Buyer"'::jsonb, true);
  perform public.techkarvo_admin_upsert_membership_tier('plus', 'Plus', 'Simulation only', '[]'::jsonb, 5, false, 1);
  perform public.techkarvo_admin_update_support_case(support_id, 'triaged', 'normal', null);
  perform public.techkarvo_admin_review_report(report_id, 'reviewing', 'Reviewed in isolated CI fixture');
  if not exists (select 1 from public.admin_audit_log where actor_id = auth.uid()) then
    raise exception 'Admin actions must create audit events';
  end if;
  perform * from public.techkarvo_admin_marketplace_summary();

  begin
    insert into public.platform_admins (user_id) values (auth.uid());
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Members must not self-assign administrator access'; end if;
  denied := false;
  begin
    insert into public.admin_audit_log (actor_id, action, resource_type, resource_id)
    values (auth.uid(), 'forged', 'case', '0');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Members must not write audit rows directly'; end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '92222222-2222-4222-8222-222222222222', true);

do $$
declare
  denied boolean := false;
begin
  if public.techkarvo_is_platform_admin() then raise exception 'Non-admin member was recognized as an administrator'; end if;
  if (select count(*) from public.support_cases) <> 0 then raise exception 'Support cases leaked across accounts'; end if;
  if (select count(*) from public.user_reports) <> 0 then raise exception 'Moderation reports leaked to the reported member'; end if;
  if (select count(*) from public.admin_audit_log) <> 0 then raise exception 'Admin audit log leaked to a member'; end if;
  if (select count(*) from public.membership_tiers) <> 1 then raise exception 'Members must see only the active catalog tier'; end if;
  if (select setting_value from public.platform_settings where setting_key = 'brand.name') <> '"TechKarvo Buyer"'::jsonb then
    raise exception 'Public buyer branding setting was not exposed';
  end if;
  begin
    perform * from public.techkarvo_admin_marketplace_summary();
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Non-admin must not access admin analytics'; end if;
  denied := false;
  begin
    perform public.techkarvo_admin_review_report(gen_random_uuid(), 'resolved', '');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Non-admin must not moderate reports'; end if;
end;
$$;

rollback;
