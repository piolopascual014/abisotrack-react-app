-- AbisoTrack shared demo database
-- Run this entire file once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  phone_normalized text not null unique,
  email text not null default '',
  role text not null default 'Student',
  unit text not null default '',
  consent boolean not null default false,
  app_installed boolean not null default false,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tree_nodes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null,
  parent_id uuid references public.tree_nodes(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'General',
  message text not null,
  all_contacts boolean not null default true,
  status text not null check (status in ('draft', 'active', 'closed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.alert_scopes (
  alert_id uuid not null references public.alerts(id) on delete cascade,
  node_id uuid not null references public.tree_nodes(id) on delete cascade,
  primary key (alert_id, node_id)
);

create table if not exists public.alert_channels (
  alert_id uuid not null references public.alerts(id) on delete cascade,
  channel text not null check (channel in ('app', 'sms', 'email')),
  primary key (alert_id, channel)
);

create table if not exists public.alert_recipients (
  alert_id uuid not null references public.alerts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  delivery_status text not null default 'available',
  acknowledged_at timestamptz,
  primary key (alert_id, contact_id)
);

create table if not exists public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'delivered', 'failed')),
  attempts integer not null default 0,
  gateway_id text,
  claimed_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Upgrade older demo databases without deleting their existing SMS history.
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

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  role text not null default 'Operator',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_entries (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor text not null,
  action text not null
);

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  institution_name text not null default '',
  sms_fallback boolean not null default false,
  email_copy boolean not null default false,
  escalation_minutes integer not null default 15 check (escalation_minutes between 1 and 120)
);

create table if not exists public.student_sessions (
  token_hash text primary key,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.contacts enable row level security;
alter table public.tree_nodes enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_scopes enable row level security;
alter table public.alert_channels enable row level security;
alter table public.alert_recipients enable row level security;
alter table public.sms_logs enable row level security;
alter table public.app_users enable row level security;
alter table public.audit_entries enable row level security;
alter table public.app_settings enable row level security;
alter table public.student_sessions enable row level security;

drop policy if exists "authenticated full access" on public.contacts;
create policy "authenticated full access" on public.contacts for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on public.tree_nodes;
create policy "authenticated full access" on public.tree_nodes for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on public.alerts;
create policy "authenticated full access" on public.alerts for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on public.alert_scopes;
create policy "authenticated full access" on public.alert_scopes for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on public.alert_channels;
create policy "authenticated full access" on public.alert_channels for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on public.alert_recipients;
create policy "authenticated full access" on public.alert_recipients for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on public.sms_logs;
create policy "authenticated full access" on public.sms_logs for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on public.app_users;
create policy "authenticated full access" on public.app_users for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on public.audit_entries;
create policy "authenticated full access" on public.audit_entries for all to authenticated using (true) with check (true);
drop policy if exists "authenticated full access" on public.app_settings;
create policy "authenticated full access" on public.app_settings for all to authenticated using (true) with check (true);

revoke all on public.contacts, public.tree_nodes, public.alerts, public.alert_scopes,
  public.alert_channels, public.alert_recipients, public.sms_logs, public.app_users,
  public.audit_entries, public.app_settings, public.student_sessions from anon;
grant select, insert, update, delete on public.contacts, public.tree_nodes, public.alerts,
  public.alert_scopes, public.alert_channels, public.alert_recipients, public.sms_logs,
  public.app_users, public.audit_entries, public.app_settings to authenticated;

create or replace function public.create_contact(
  p_name text,
  p_phone text,
  p_email text,
  p_role text,
  p_unit text,
  p_consent boolean,
  p_app_installed boolean,
  p_pin text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if auth.uid() is null then raise exception 'Administrator sign-in required'; end if;
  if trim(coalesce(p_name, '')) = '' or v_phone = '' then raise exception 'Name and phone are required'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4,8}$' then raise exception 'PIN must contain 4 to 8 digits'; end if;

  insert into public.contacts (name, phone, phone_normalized, email, role, unit, consent, app_installed, pin_hash)
  values (trim(p_name), trim(p_phone), v_phone, trim(coalesce(p_email, '')), coalesce(p_role, 'Student'), trim(coalesce(p_unit, '')), coalesce(p_consent, false), coalesce(p_app_installed, false), crypt(p_pin, gen_salt('bf')))
  returning id into v_id;

  insert into public.audit_entries (actor, action)
  values (coalesce(auth.jwt() ->> 'email', 'Administrator'), 'Added contact: ' || trim(p_name));
  return v_id;
end;
$$;

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

create or replace function public.student_login(p_phone text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_contact public.contacts;
  v_token text;
begin
  delete from public.student_sessions where expires_at <= now();
  select * into v_contact
  from public.contacts
  where phone_normalized = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
    and pin_hash = crypt(coalesce(p_pin, ''), pin_hash);

  if v_contact.id is null then return null; end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.student_sessions (token_hash, contact_id, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), v_contact.id, now() + interval '12 hours');
  return jsonb_build_object('token', v_token, 'contactId', v_contact.id);
end;
$$;

create or replace function public.student_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_contact public.contacts;
  v_alerts jsonb;
  v_nodes jsonb;
  v_settings jsonb;
begin
  select c.* into v_contact
  from public.student_sessions s
  join public.contacts c on c.id = s.contact_id
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.expires_at > now();
  if v_contact.id is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'title', a.title, 'type', a.type, 'message', a.message,
    'scopeNodeIds', coalesce((select jsonb_agg(s.node_id) from public.alert_scopes s where s.alert_id = a.id), '[]'::jsonb),
    'allContacts', a.all_contacts,
    'channels', coalesce((select jsonb_agg(ch.channel) from public.alert_channels ch where ch.alert_id = a.id), '[]'::jsonb),
    'status', a.status, 'createdAt', a.created_at, 'sentAt', a.sent_at,
    'acknowledgedContactIds', case when ar.acknowledged_at is null then '[]'::jsonb else jsonb_build_array(v_contact.id) end,
    'recipientContactIds', jsonb_build_array(v_contact.id)
  ) order by a.created_at desc), '[]'::jsonb) into v_alerts
  from public.alert_recipients ar
  join public.alerts a on a.id = ar.alert_id
  where ar.contact_id = v_contact.id and a.status <> 'draft';

  with recursive anchor as (
    select n.* from public.tree_nodes n
    where n.contact_id = v_contact.id or n.name = v_contact.unit
    order by (n.contact_id = v_contact.id) desc, n.created_at desc
    limit 1
  ), tree_path as (
    select * from anchor
    union all
    select parent.*
    from public.tree_nodes parent
    join tree_path child on child.parent_id = parent.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'name', n.name, 'level', n.level, 'parentId', n.parent_id, 'contactId', n.contact_id
  ) order by n.created_at), '[]'::jsonb) into v_nodes
  from tree_path n;

  select jsonb_build_object(
    'institutionName', institution_name, 'smsFallback', sms_fallback,
    'emailCopy', email_copy, 'escalationMinutes', escalation_minutes
  ) into v_settings from public.app_settings where id = 1;

  return jsonb_build_object(
    'contact', jsonb_build_object(
      'id', v_contact.id, 'name', v_contact.name, 'phone', v_contact.phone,
      'email', v_contact.email, 'role', v_contact.role, 'unit', v_contact.unit,
      'consent', v_contact.consent, 'appInstalled', v_contact.app_installed
    ),
    'alerts', v_alerts,
    'treeNodes', v_nodes,
    'settings', v_settings
  );
end;
$$;

create or replace function public.student_acknowledge(p_token text, p_alert_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_contact public.contacts;
  v_updated integer;
begin
  select c.* into v_contact
  from public.student_sessions s
  join public.contacts c on c.id = s.contact_id
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.expires_at > now();
  if v_contact.id is null then return false; end if;

  update public.alert_recipients
  set acknowledged_at = coalesce(acknowledged_at, now())
  where alert_id = p_alert_id and contact_id = v_contact.id;
  get diagnostics v_updated = row_count;
  if v_updated > 0 then
    insert into public.audit_entries (actor, action) values (v_contact.name, 'Acknowledged an alert');
  end if;
  return v_updated > 0;
end;
$$;

-- Atomically reserves a small SMS batch for one signed-in Android gateway.
-- Stale reservations are returned to the queue automatically after five minutes.
create or replace function public.gateway_claim_sms(
  p_gateway_id text,
  p_limit integer default 5
) returns table (
  job_id uuid,
  phone text,
  message text,
  attempt integer
)
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
  select c.id, ct.phone,
         'ABISOTRACK: ' || a.title || E'\n' || a.message || E'\nReply 1 to acknowledge.',
         c.attempts
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

-- Reminder and inbound SMS acknowledgement functions are also shipped as
-- supabase/migrations/20260921_wireframe_parity.sql for existing projects.
create or replace function public.queue_alert_reminders(p_alert_id uuid)
returns integer language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Administrator sign-in required'; end if;
  if not exists (select 1 from public.alerts where id = p_alert_id and status = 'active') then raise exception 'Only active alerts can be reminded'; end if;
  insert into public.sms_logs (alert_id, contact_id, status)
  select ar.alert_id, ar.contact_id, 'queued' from public.alert_recipients ar join public.contacts c on c.id = ar.contact_id
  where ar.alert_id = p_alert_id and ar.acknowledged_at is null and c.consent and c.phone_normalized <> ''
    and not exists (select 1 from public.sms_logs s where s.alert_id = ar.alert_id and s.contact_id = ar.contact_id and s.status in ('queued','sending'));
  get diagnostics v_count = row_count;
  insert into public.audit_entries (actor, action) values (coalesce(auth.jwt() ->> 'email', 'Administrator'), 'Queued ' || v_count || ' SMS reminder(s)');
  return v_count;
end; $$;

create or replace function public.student_queue_reminders(p_token text, p_alert_id uuid)
returns integer language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_contact public.contacts; v_count integer;
begin
  select c.* into v_contact from public.student_sessions s join public.contacts c on c.id = s.contact_id
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and s.expires_at > now();
  if v_contact.id is null then raise exception 'Student session expired'; end if;
  if v_contact.role !~* '(officer|dean|faculty|administrator)' then raise exception 'Class officer access required'; end if;
  if not exists (select 1 from public.alert_recipients ar join public.alerts a on a.id = ar.alert_id where ar.alert_id = p_alert_id and ar.contact_id = v_contact.id and a.status = 'active') then raise exception 'Active alert not available'; end if;
  insert into public.sms_logs (alert_id, contact_id, status)
  select ar.alert_id, ar.contact_id, 'queued' from public.alert_recipients ar join public.contacts c on c.id = ar.contact_id
  where ar.alert_id = p_alert_id and ar.acknowledged_at is null and c.unit = v_contact.unit and c.id <> v_contact.id and c.consent and c.phone_normalized <> ''
    and not exists (select 1 from public.sms_logs s where s.alert_id = ar.alert_id and s.contact_id = ar.contact_id and s.status in ('queued','sending'));
  get diagnostics v_count = row_count;
  insert into public.audit_entries (actor, action) values (v_contact.name, 'Queued ' || v_count || ' classmate SMS reminder(s)');
  return v_count;
end; $$;

create or replace function public.gateway_acknowledge_by_sms(p_phone text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_contact public.contacts; v_alert public.alerts;
begin
  if auth.uid() is null then raise exception 'Gateway sign-in required'; end if;
  select * into v_contact from public.contacts where right(phone_normalized, 10) = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10) limit 1;
  if v_contact.id is null then return jsonb_build_object('acknowledged', false, 'reason', 'unknown_sender'); end if;
  select a.* into v_alert from public.alert_recipients ar join public.alerts a on a.id = ar.alert_id
  where ar.contact_id = v_contact.id and ar.acknowledged_at is null and a.status = 'active' order by a.sent_at desc nulls last, a.created_at desc limit 1;
  if v_alert.id is null then return jsonb_build_object('acknowledged', false, 'reason', 'no_pending_alert'); end if;
  update public.alert_recipients set acknowledged_at = now() where alert_id = v_alert.id and contact_id = v_contact.id and acknowledged_at is null;
  insert into public.audit_entries (actor, action) values (v_contact.name, 'Acknowledged alert by SMS reply: ' || v_alert.title);
  return jsonb_build_object('acknowledged', true, 'contact', v_contact.name, 'alert', v_alert.title);
end; $$;

create or replace function public.reset_demo_data()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Administrator sign-in required'; end if;
  delete from public.audit_entries;
  delete from public.sms_logs;
  delete from public.alert_recipients;
  delete from public.alert_scopes;
  delete from public.alert_channels;
  delete from public.alerts;
  delete from public.tree_nodes;
  delete from public.student_sessions;
  delete from public.contacts;
  delete from public.app_users;
  update public.app_settings set institution_name = '', sms_fallback = false, email_copy = false, escalation_minutes = 15 where id = 1;
end;
$$;

revoke all on function public.create_contact(text,text,text,text,text,boolean,boolean,text) from public;
revoke all on function public.save_alert(text,text,text,boolean,uuid[],text[],boolean) from public;
revoke all on function public.student_login(text,text) from public;
revoke all on function public.student_snapshot(text) from public;
revoke all on function public.student_acknowledge(text,uuid) from public;
revoke all on function public.gateway_claim_sms(text,integer) from public;
revoke all on function public.gateway_update_sms(uuid,text,text,text) from public;
revoke all on function public.queue_alert_reminders(uuid) from public;
revoke all on function public.student_queue_reminders(text,uuid) from public;
revoke all on function public.gateway_acknowledge_by_sms(text) from public;
revoke all on function public.reset_demo_data() from public;
grant execute on function public.create_contact(text,text,text,text,text,boolean,boolean,text) to authenticated;
grant execute on function public.save_alert(text,text,text,boolean,uuid[],text[],boolean) to authenticated;
grant execute on function public.reset_demo_data() to authenticated;
grant execute on function public.student_login(text,text) to anon, authenticated;
grant execute on function public.student_snapshot(text) to anon, authenticated;
grant execute on function public.student_acknowledge(text,uuid) to anon, authenticated;
grant execute on function public.gateway_claim_sms(text,integer) to authenticated;
grant execute on function public.gateway_update_sms(uuid,text,text,text) to authenticated;
grant execute on function public.queue_alert_reminders(uuid) to authenticated;
grant execute on function public.student_queue_reminders(text,uuid) to anon, authenticated;
grant execute on function public.gateway_acknowledge_by_sms(text) to authenticated;

-- Enable live admin updates. Safe to rerun.
do $$
declare
  t text;
begin
  foreach t in array array['contacts','tree_nodes','alerts','alert_scopes','alert_channels','alert_recipients','sms_logs','app_users','audit_entries','app_settings']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
