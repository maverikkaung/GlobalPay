-- Allow post deletion to clear a shared-post reference via its FK action.
-- The messages trigger still rejects direct client edits; authenticated users
-- have UPDATE permission only on read_at, not shared_post_id.
begin;

create or replace function public.techkarvo_protect_message_read_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Message identity and history cannot be changed';
  end if;

  -- ON DELETE SET NULL performs a nested UPDATE when a post referenced by a
  -- shared message is removed. Permit only that FK-generated reference clear;
  -- do not permit a body, receipt, or retention-field change in this path.
  if pg_trigger_depth() > 1
    and old.shared_post_id is not null
    and new.shared_post_id is null
    and new.body is not distinct from old.body
    and new.read_at is not distinct from old.read_at
    and new.deleted_for_everyone_at is not distinct from old.deleted_for_everyone_at
    and new.deleted_by is not distinct from old.deleted_by then
    return new;
  end if;

  if new.deleted_for_everyone_at is distinct from old.deleted_for_everyone_at
    or new.deleted_by is distinct from old.deleted_by then
    if auth.uid() is distinct from old.sender_id
      or old.deleted_for_everyone_at is not null
      or new.deleted_for_everyone_at is null
      or new.deleted_by is distinct from old.sender_id
      or new.body <> '[Message removed]'
      or new.shared_post_id is not null
      or new.read_at is distinct from old.read_at then
      raise exception 'Only a sender may redact their message through the authorized workflow';
    end if;
    return new;
  end if;

  if new.body is distinct from old.body or new.shared_post_id is distinct from old.shared_post_id then
    raise exception 'Messages and shared post previews cannot be edited';
  end if;
  select case when c.client_id = old.sender_id then c.freelancer_id else c.client_id end
    into recipient_id from public.conversations c where c.id = old.conversation_id;
  if auth.uid() is distinct from recipient_id or new.read_at is null then
    raise exception 'Only the recipient may mark a message as read';
  end if;
  return new;
end;
$$;

revoke all on function public.techkarvo_protect_message_read_update() from public, anon, authenticated;

commit;
