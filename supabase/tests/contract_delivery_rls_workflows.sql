-- Run on isolated PostgreSQL after migration 018. Bucket and object bytes are
-- represented by a compatibility fixture; no live Storage API is used.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('techkarvo-contract-deliveries', 'techkarvo-contract-deliveries', false, 5242880,
  array['application/pdf','image/png','image/jpeg']);
insert into auth.users (id, raw_user_meta_data) values
  ('83000000-0000-4000-8000-000000000001', '{"account_type":"client","full_name":"Delivery Client"}'),
  ('83000000-0000-4000-8000-000000000002', '{"account_type":"freelancer","full_name":"Delivery Freelancer"}'),
  ('83000000-0000-4000-8000-000000000003', '{"account_type":"freelancer","full_name":"Outsider"}');
insert into public.jobs (id, client_id, title, description, budget)
values ('83000000-0000-4000-8000-000000000004','83000000-0000-4000-8000-000000000001','Delivery workflow','Fixture',100);
insert into public.job_applications (id, job_id, client_id, freelancer_id, full_name, email)
values ('83000000-0000-4000-8000-000000000005','83000000-0000-4000-8000-000000000004',
  '83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002','Fixture','delivery@example.invalid');
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
set local role authenticated;
update public.job_applications set status = 'Accepted' where id = '83000000-0000-4000-8000-000000000005';
select set_config('delivery.contract', (select id::text from public.contracts where application_id = '83000000-0000-4000-8000-000000000005'), true);
select set_config('delivery.request', '83000000-0000-4000-8000-000000000006', true);
select set_config('delivery.path', concat(current_setting('delivery.contract'),
  '/83000000-0000-4000-8000-000000000002/', current_setting('delivery.request'), '/1.pdf'), true);
do $$
begin
  begin
    perform public.techkarvo_submit_delivery(current_setting('delivery.contract')::uuid, gen_random_uuid(), null, 'Client write', null, '{}');
    raise exception 'Client submitted a delivery';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('techkarvo-contract-deliveries', current_setting('delivery.path'), auth.uid()::text);
    raise exception 'Client uploaded a delivery';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000002', true);
do $$
declare
  cid uuid := current_setting('delivery.contract')::uuid;
  rid uuid := current_setting('delivery.request')::uuid;
  path text := current_setting('delivery.path');
  delivery uuid;
begin
  begin
    perform public.techkarvo_submit_delivery(cid, rid, null, 'Initial version', null, array[path]);
    raise exception 'Submitted a delivery with a nonexistent object';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id)
    values ('techkarvo-contract-deliveries', replace(path, '/1.pdf', '/1.svg'), auth.uid()::text);
    raise exception 'Uploaded unsupported extension';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('techkarvo-contract-deliveries', path, gen_random_uuid()::text);
    raise exception 'Uploaded with spoofed owner';
  exception when insufficient_privilege then null;
  end;
  insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('techkarvo-contract-deliveries', path, auth.uid()::text, '{"size":120,"mimetype":"application/pdf"}');
  if exists (select 1 from storage.objects where name = path) then raise exception 'Uncommitted object is readable'; end if;
  begin
    perform public.techkarvo_submit_delivery(cid, rid, null, 'Initial version', 'https://user@example.invalid', array[path]);
    raise exception 'Accepted a project URL with credentials';
  exception when invalid_parameter_value then null;
  end;
  delivery := public.techkarvo_submit_delivery(cid, rid, null, 'Initial version', 'https://example.invalid/work', array[path]);
  perform set_config('delivery.first', delivery::text, true);
  if public.techkarvo_submit_delivery(cid, rid, null, 'Initial version', 'https://example.invalid/work', array[path]) <> delivery then
    raise exception 'Submission retry did not return the stored delivery';
  end if;
  if (select count(*) from public.contract_deliveries) <> 1 or not exists (select 1 from storage.objects where name = path) then
    raise exception 'Delivery or committed object unavailable to freelancer';
  end if;
  begin
    perform public.techkarvo_submit_delivery(cid, rid, null, 'Changed payload', null, '{}');
    raise exception 'Reused idempotency key for a different payload';
  exception when sqlstate 'PT409' then null;
  end;
  begin
    perform public.techkarvo_decide_delivery(cid, delivery, 'approved', null);
    raise exception 'Freelancer approved own delivery';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.contract_deliveries set status = 'approved' where id = delivery;
    raise exception 'Browser wrote directly to delivery history';
  exception when insufficient_privilege then null;
  end;
  update storage.objects set metadata = '{}' where name = path;
  if found then raise exception 'Committed attachment was mutable'; end if;
  delete from storage.objects where name = path;
  if found then raise exception 'Committed attachment was deletable'; end if;
end $$;

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000003', true);
do $$
begin
  if exists (select 1 from public.contract_deliveries) or exists (
    select 1 from storage.objects where bucket_id = 'techkarvo-contract-deliveries') then
    raise exception 'Outsider accessed private work';
  end if;
  begin
    perform public.techkarvo_decide_delivery(current_setting('delivery.contract')::uuid, current_setting('delivery.first')::uuid, 'approved', null);
    raise exception 'Outsider approved private work';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if has_function_privilege('public.techkarvo_submit_delivery(uuid,uuid,uuid,text,text,text[])','execute')
    or has_function_privilege('public.techkarvo_decide_delivery(uuid,uuid,text,text)','execute')
    or exists (select 1 from storage.objects where bucket_id = 'techkarvo-contract-deliveries') then
    raise exception 'Anonymous delivery access';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
do $$
declare
  cid uuid := current_setting('delivery.contract')::uuid;
  first_id uuid := current_setting('delivery.first')::uuid;
begin
  if not exists (select 1 from storage.objects where name = current_setting('delivery.path')) then
    raise exception 'Client cannot read committed attachment';
  end if;
  begin
    perform public.techkarvo_decide_delivery(cid, first_id, 'revision_requested', '  ');
    raise exception 'Blank revision feedback accepted';
  exception when invalid_parameter_value then null;
  end;
  perform public.techkarvo_decide_delivery(cid, first_id, 'revision_requested', 'Please revise the layout');
  if public.techkarvo_decide_delivery(cid, first_id, 'revision_requested', 'Please revise the layout') <> first_id then
    raise exception 'Decision retry returned wrong delivery';
  end if;
  begin
    perform public.techkarvo_decide_delivery(cid, first_id, 'approved', null);
    raise exception 'Conflicting decision overwrote revision request';
  exception when sqlstate 'PT409' then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000002', true);
do $$
declare
  cid uuid := current_setting('delivery.contract')::uuid;
  first_id uuid := current_setting('delivery.first')::uuid;
  rid uuid := gen_random_uuid();
  path text := format('%s/%s/%s/1.png', cid, auth.uid(), rid);
begin
  begin
    perform public.techkarvo_submit_delivery(cid, gen_random_uuid(), null, 'Stale draft', null, '{}');
    raise exception 'Stale version was accepted';
  exception when sqlstate 'PT409' then null;
  end;
  insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('techkarvo-contract-deliveries', path, auth.uid()::text, '{"size":5242881,"mimetype":"image/png"}');
  begin
    perform public.techkarvo_submit_delivery(cid, rid, first_id, 'Revised work', null, array[path]);
    raise exception 'Oversized attachment was accepted';
  exception when invalid_parameter_value then null;
  end;
  perform set_config('delivery.second', public.techkarvo_submit_delivery(cid, gen_random_uuid(), first_id, 'Revised work', null, '{}')::text, true);
  if (select count(*) from public.contract_deliveries where contract_id = cid) <> 2
    or not exists (select 1 from public.contract_deliveries where id = first_id and version = 1
      and status = 'revision_requested' and feedback = 'Please revise the layout') then
    raise exception 'Revision history was not retained';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
do $$
declare
  cid uuid := current_setting('delivery.contract')::uuid;
begin
  begin
    perform public.techkarvo_decide_delivery(cid, current_setting('delivery.first')::uuid, 'approved', null);
    raise exception 'Old version was approved';
  exception when sqlstate 'PT409' then null;
  end;
  perform public.techkarvo_decide_delivery(cid, current_setting('delivery.second')::uuid, 'approved', null);
  if not exists (select 1 from public.contracts where id = cid and status = 'active' and completed_at is null)
    or exists (select 1 from public.contract_milestones where contract_id = cid) then
    raise exception 'Approval changed contract or financial milestone state';
  end if;
  begin
    insert into public.reviews (application_id,job_id,reviewer_id,reviewee_id,rating,body)
    values ('83000000-0000-4000-8000-000000000005','83000000-0000-4000-8000-000000000004',auth.uid(),
      '83000000-0000-4000-8000-000000000002',5,'Early review');
    raise exception 'Approval alone unlocked review';
  exception when insufficient_privilege then null;
  end;
end $$;
update public.jobs set status = 'completed' where id = '83000000-0000-4000-8000-000000000004';
insert into public.reviews (application_id,job_id,reviewer_id,reviewee_id,rating,body)
values ('83000000-0000-4000-8000-000000000005','83000000-0000-4000-8000-000000000004',auth.uid(),
  '83000000-0000-4000-8000-000000000002',5,'Client review');
do $$
begin
  begin
    insert into public.reviews (application_id,job_id,reviewer_id,reviewee_id,rating,body)
    values ('83000000-0000-4000-8000-000000000005','83000000-0000-4000-8000-000000000004',auth.uid(),
      '83000000-0000-4000-8000-000000000002',5,'Duplicate review');
    raise exception 'Duplicate review accepted';
  exception when unique_violation then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000002', true);
insert into public.reviews (application_id,job_id,reviewer_id,reviewee_id,rating,body)
values ('83000000-0000-4000-8000-000000000005','83000000-0000-4000-8000-000000000004',auth.uid(),
  '83000000-0000-4000-8000-000000000001',5,'Freelancer review');
do $$
begin
  begin
    perform public.techkarvo_submit_delivery(current_setting('delivery.contract')::uuid, gen_random_uuid(),
      current_setting('delivery.second')::uuid, 'Late version', null, '{}');
    raise exception 'Completed contract accepted a new delivery';
  exception when sqlstate 'PT409' then null;
  end;
end $$;
rollback;
