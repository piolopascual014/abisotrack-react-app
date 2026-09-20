-- AbisoTrack SMS Gateway upgrade
-- Run once in Supabase Dashboard > SQL Editor before deploying the updated web app.

alter table public.sms_logs add column if not exists attempts integer not null default 0;
alter table public.sms_logs add column if not exists gateway_id text;
alter table public.sms_logs add column if not exists claimed_at timestamptz;
alter table public.sms_logs add column if not exists sent_at timestamptz;
alter table public.sms_logs add column if not exists delivered_at timestamptz;
alter table public.sms_logs add column if not exists error_message text;
alter table public.sms_logs add column if not exists updated_at timestamptz not null default now();
alter table public.sms_logs drop constraint if exists sms_logs_status_check;
alter table public.sms_logs add constraint sms_logs_status_check
  check (status in ('queued', 'sending', 'sent', 'delivered', 'failed'));
create index if not exists sms_logs_gateway_queue_idx on public.sms_logs (status, created_at);

create or replace function public.save_alert(
  p_title text,
  p_type text,
  p_message text,
  p_all_contacts boolean,
  p_scope_node_ids uuid[],
  p_channels text[],
  p_send boolean
) returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Administrator sign-in required'; end if;
  if trim(coalesce(p_title, '')) = '' or trim(coalesce(p_message, '')) = '' then raise exception 'Title and message are required'; end if;

  insert into public.alerts (title, type, message, all_contacts, status, sent_at)
  values (trim(p_title), coalesce(p_type, 'General'), trim(p_message), coalesce(p_all_contacts, true), case when p_send then 'active' else 'draft' end, case when p_send then now() else null end)
  returning id into v_id;

  insert into public.alert_scopes (alert_id, node_id)
  select v_id, value from unnest(coalesce(p_scope_node_ids, '{}'::uuid[])) as value;

  insert into public.alert_channels (alert_id, channel)
  select v_id, value from unnest(coalesce(p_channels, array['app']::text[])) as value;

  insert into public.alert_recipients (alert_id, contact_id)
  select v_id, c.id
  from public.contacts c
  where p_all_contacts
     or c.unit in (select n.name from public.tree_nodes n where n.id = any(coalesce(p_scope_node_ids, '{}'::uuid[])));

  if p_send and 'sms' = any(coalesce(p_channels, '{}'::text[])) then
    insert into public.sms_logs (alert_id, contact_id, status)
    select v_id, ar.contact_id, 'queued'
    from public.alert_recipients ar
    join public.contacts c on c.id = ar.contact_id
    where ar.alert_id = v_id and c.consent and c.phone_normalized <> '';
  end if;

  insert into public.audit_entries (actor, action)
  values (coalesce(auth.jwt() ->> 'email', 'Administrator'), (case when p_send then 'Sent' else 'Saved draft' end) || ' alert: ' || trim(p_title));
  return v_id;
end;
$$;

create or replace function public.gateway_claim_sms(
  p_gateway_id text,
  p_limit integer default 5
) returns table (job_id uuid, phone text, message text, attempt integer)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 10);
begin
  if auth.uid() is null then raise exception 'Gateway sign-in required'; end if;
  if trim(coalesce(p_gateway_id, '')) = '' then raise exception 'Gateway ID is required'; end if;

  return query
  with candidates as (
    select s.id
    from public.sms_logs s
    where s.attempts < 3
      and (s.status = 'queued' or (s.status = 'sending' and s.claimed_at < now() - interval '5 minutes'))
    order by s.created_at
    for update skip locked
    limit v_limit
  ), claimed as (
    update public.sms_logs s
    set status = 'sending', attempts = s.attempts + 1,
        gateway_id = trim(p_gateway_id), claimed_at = now(),
        error_message = null, updated_at = now()
    from candidates c
    where s.id = c.id
    returning s.id, s.alert_id, s.contact_id, s.attempts
  )
  select c.id, ct.phone, 'ABISOTRACK: ' || a.title || E'\n' || a.message || E'\nReply 1 to acknowledge.', c.attempts
  from claimed c
  join public.contacts ct on ct.id = c.contact_id
  join public.alerts a on a.id = c.alert_id
  order by c.id;
end;
$$;

create or replace function public.gateway_update_sms(
  p_job_id uuid,
  p_gateway_id text,
  p_status text,
  p_error text default null
) returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_updated integer;
begin
  if auth.uid() is null then raise exception 'Gateway sign-in required'; end if;
  if p_status not in ('sent', 'delivered', 'failed') then raise exception 'Invalid SMS status'; end if;

  update public.sms_logs
  set status = p_status,
      sent_at = case when p_status in ('sent', 'delivered') then coalesce(sent_at, now()) else sent_at end,
      delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
      error_message = case when p_status = 'failed' then left(coalesce(p_error, 'SMS send failed'), 500) else null end,
      updated_at = now()
  where id = p_job_id and gateway_id = trim(p_gateway_id);
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.gateway_claim_sms(text,integer) from public;
revoke all on function public.gateway_update_sms(uuid,text,text,text) from public;
grant execute on function public.gateway_claim_sms(text,integer) to authenticated;
grant execute on function public.gateway_update_sms(uuid,text,text,text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sms_logs'
  ) then
    alter publication supabase_realtime add table public.sms_logs;
  end if;
end $$;
