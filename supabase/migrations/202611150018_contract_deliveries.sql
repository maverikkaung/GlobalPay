-- Additive delivery workflow. Provision its private bucket separately via the
-- Storage API after this migration is approved, applied, and verified.
begin;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'techkarvo-contract-deliveries') then
    raise exception 'Delivery bucket already exists; verify provisioning separately';
  end if;
end;
$$;

create table public.contract_deliveries (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  version integer not null check (version > 0),
  request_id uuid not null,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  description text not null check (length(description) between 1 and 5000),
  project_url text check (length(project_url) <= 2048 and project_url ~* '^https?://[^/@?#[:space:]]+([/?#][^[:space:]]*)?$'),
  attachment_paths text[] not null default '{}' check (cardinality(attachment_paths) <= 3),
  submitted_at timestamptz not null default clock_timestamp(),
  status text not null default 'submitted' check (status in ('submitted', 'revision_requested', 'approved')),
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  feedback text,
  unique (contract_id, version),
  unique (contract_id, request_id),
  check ((status = 'submitted' and decided_by is null and decided_at is null)
    or (status <> 'submitted' and decided_by is not null and decided_at is not null)),
  check ((status = 'revision_requested' and feedback is not null and length(feedback) between 1 and 3000)
    or (status <> 'revision_requested' and feedback is null))
);

alter table public.contract_deliveries enable row level security;
revoke all on public.contract_deliveries from public, anon, authenticated;
grant select on public.contract_deliveries to authenticated;
create policy "Contract participants read delivery history"
  on public.contract_deliveries for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id
    and (select auth.uid()) in (c.client_id, c.freelancer_id)));
create policy "Delivery history participant boundary"
  on public.contract_deliveries as restrictive for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id
    and (select auth.uid()) in (c.client_id, c.freelancer_id)));
create policy "Delivery history browser writes are unavailable"
  on public.contract_deliveries as restrictive for all to authenticated using (true) with check (false);
create policy "Delivery history browser deletes are unavailable"
  on public.contract_deliveries as restrictive for delete to authenticated using (false);
create policy "Anonymous users cannot access delivery history"
  on public.contract_deliveries as restrictive for all to anon using (false) with check (false);

create function public.techkarvo_submit_delivery(
  p_contract_id uuid, p_request_id uuid, p_expected_latest uuid,
  p_description text, p_project_url text, p_attachment_paths text[]
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  agreement public.contracts%rowtype;
  latest public.contract_deliveries%rowtype;
  prior public.contract_deliveries%rowtype;
  delivery_id uuid;
  description text := nullif(btrim(p_description, E' \n\r\t'), '');
  project_url text := nullif(btrim(p_project_url), '');
  paths text[] := coalesce(p_attachment_paths, '{}'::text[]);
  object_path text;
  mime text;
  position integer := 0;
begin
  if actor is null then raise insufficient_privilege using message = 'Delivery unavailable'; end if;
  select * into agreement from public.contracts c where c.id = p_contract_id and c.freelancer_id = actor for update;
  if not found then raise insufficient_privilege using message = 'Delivery unavailable'; end if;
  select * into prior from public.contract_deliveries d where d.contract_id = p_contract_id and d.request_id = p_request_id;
  if found then
    if prior.description is not distinct from description and prior.project_url is not distinct from project_url
      and prior.attachment_paths = paths and prior.submitted_by = actor then return prior.id; end if;
    raise sqlstate 'PT409' using message = 'Delivery request already used';
  end if;
  if agreement.status <> 'active' then raise sqlstate 'PT409' using message = 'Contract is not active'; end if;
  select * into latest from public.contract_deliveries d where d.contract_id = p_contract_id order by version desc limit 1;
  if latest.id is distinct from p_expected_latest or (latest.id is not null and latest.status <> 'revision_requested') then
    raise sqlstate 'PT409' using message = 'Delivery version changed';
  end if;
  if p_request_id is null or description is null or length(description) > 5000 or cardinality(paths) > 3
    or coalesce(array_ndims(paths), 1) <> 1 or (project_url is not null and
    (length(project_url) > 2048 or strpos(project_url, chr(92)) > 0 or project_url !~* '^https?://[^/@?#[:space:]]+([/?#][^[:space:]]*)?$')) then
    raise invalid_parameter_value using message = 'Invalid delivery details';
  end if;
  foreach object_path in array paths loop
    position := position + 1;
    mime := case split_part(object_path, '.', 2)
      when 'pdf' then 'application/pdf' when 'png' then 'image/png' when 'jpg' then 'image/jpeg' end;
    if mime is null or object_path <> format('%s/%s/%s/%s.%s', p_contract_id, actor, p_request_id, position, split_part(object_path, '.', 2))
      or not exists (select 1 from storage.objects o where o.bucket_id = 'techkarvo-contract-deliveries'
        and o.name = object_path and o.owner_id = actor::text and o.metadata->>'mimetype' = mime
        and case when o.metadata->>'size' ~ '^[0-9]{1,7}$' then (o.metadata->>'size')::integer between 1 and 5242880 else false end) then
      raise invalid_parameter_value using message = 'Attachment unavailable or invalid';
    end if;
  end loop;
  insert into public.contract_deliveries (contract_id, version, request_id, submitted_by, description, project_url, attachment_paths)
  values (p_contract_id, coalesce(latest.version, 0) + 1, p_request_id, actor, description, project_url, paths)
  returning id into delivery_id;
  return delivery_id;
end;
$$;

create function public.techkarvo_decide_delivery(p_contract_id uuid, p_delivery_id uuid, p_decision text, p_feedback text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  agreement public.contracts%rowtype;
  latest public.contract_deliveries%rowtype;
  revision_feedback text := nullif(btrim(p_feedback, E' \n\r\t'), '');
begin
  if actor is null then raise insufficient_privilege using message = 'Delivery unavailable'; end if;
  select * into agreement from public.contracts c where c.id = p_contract_id and c.client_id = actor for update;
  if not found then raise insufficient_privilege using message = 'Delivery unavailable'; end if;
  if p_decision is null or p_decision not in ('approved', 'revision_requested')
    or (p_decision = 'approved' and revision_feedback is not null)
    or (p_decision = 'revision_requested' and (revision_feedback is null or length(revision_feedback) > 3000)) then
    raise invalid_parameter_value using message = 'Invalid delivery decision';
  end if;
  select * into latest from public.contract_deliveries d where d.contract_id = p_contract_id order by version desc limit 1;
  if latest.id = p_delivery_id and latest.status = p_decision and latest.feedback is not distinct from revision_feedback
    and latest.decided_by = actor then return latest.id; end if;
  if agreement.status <> 'active' or p_delivery_id is null or latest.id is distinct from p_delivery_id or latest.status <> 'submitted' then
    raise sqlstate 'PT409' using message = 'Delivery is no longer awaiting review';
  end if;
  update public.contract_deliveries set status = p_decision, decided_by = actor,
    decided_at = clock_timestamp(), feedback = revision_feedback where id = latest.id;
  return latest.id;
end;
$$;

revoke all on function public.techkarvo_submit_delivery(uuid,uuid,uuid,text,text,text[]),
  public.techkarvo_decide_delivery(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.techkarvo_submit_delivery(uuid,uuid,uuid,text,text,text[]),
  public.techkarvo_decide_delivery(uuid,uuid,text,text) to authenticated;

-- Storage policies protect the new bucket even in the presence of permissive
-- policies for other product surfaces. Uncommitted files cannot be read.
create function public.techkarvo_delivery_object_allowed(p_path text, p_upload boolean)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
    where c.id::text = split_part(p_path, '/', 1)
    and case when p_upload then
      c.status = 'active' and c.freelancer_id = (select auth.uid())
      and split_part(p_path, '/', 2) = c.freelancer_id::text
      and p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-3][.](pdf|png|jpg)$'
      and not exists (select 1 from public.contract_deliveries d where d.contract_id = c.id
        and d.request_id::text = split_part(p_path, '/', 3))
      and coalesce((select d.status from public.contract_deliveries d where d.contract_id = c.id order by d.version desc limit 1),
        'revision_requested') = 'revision_requested'
    else
      (select auth.uid()) in (c.client_id, c.freelancer_id)
      and exists (select 1 from public.contract_deliveries d where d.contract_id = c.id and p_path = any(d.attachment_paths))
    end
  );
$$;
revoke all on function public.techkarvo_delivery_object_allowed(text,boolean) from public, anon, authenticated;
grant execute on function public.techkarvo_delivery_object_allowed(text,boolean) to authenticated;

create policy "Delivery participants read committed objects" on storage.objects for select to authenticated
  using (bucket_id = 'techkarvo-contract-deliveries' and public.techkarvo_delivery_object_allowed(name, false));
create policy "Delivery object read boundary" on storage.objects as restrictive for select to authenticated
  using (case when bucket_id = 'techkarvo-contract-deliveries' then public.techkarvo_delivery_object_allowed(name, false) else true end);
create policy "Contract freelancer adds delivery objects" on storage.objects for insert to authenticated
  with check (bucket_id = 'techkarvo-contract-deliveries' and owner_id = (select auth.uid()::text)
    and public.techkarvo_delivery_object_allowed(name, true));
create policy "Delivery object insert boundary" on storage.objects as restrictive for insert to authenticated
  with check (case when bucket_id = 'techkarvo-contract-deliveries' then owner_id = (select auth.uid()::text)
    and public.techkarvo_delivery_object_allowed(name, true) else true end);
create policy "Delivery objects cannot be replaced" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'techkarvo-contract-deliveries') with check (bucket_id <> 'techkarvo-contract-deliveries');
create policy "Delivery objects cannot be deleted" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'techkarvo-contract-deliveries');
create policy "Anonymous users cannot access delivery objects" on storage.objects as restrictive for all to anon
  using (bucket_id <> 'techkarvo-contract-deliveries') with check (bucket_id <> 'techkarvo-contract-deliveries');

-- Preserve existing review eligibility for legacy hires predating contracts.
-- Existing review policies still require a completed job, accepted application,
-- correct reviewer/reviewee pair, and the existing unique key.
create policy "Linked contract must be completed before review"
  on public.reviews as restrictive for insert to authenticated
  with check (not exists (select 1 from public.contracts c
    where c.application_id::text = reviews.application_id and c.status <> 'completed'));

commit;
