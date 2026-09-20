-- AbisoTrack wireframe parity: reminders and SMS reply acknowledgement.
-- Safe to run more than once after the base schema and SMS gateway migration.

create or replace function public.queue_alert_reminders(p_alert_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Administrator sign-in required'; end if;
  if not exists (select 1 from public.alerts where id = p_alert_id and status = 'active') then
    raise exception 'Only active alerts can be reminded';
  end if;

  insert into public.sms_logs (alert_id, contact_id, status)
  select ar.alert_id, ar.contact_id, 'queued'
  from public.alert_recipients ar
  join public.contacts c on c.id = ar.contact_id
  where ar.alert_id = p_alert_id
    and ar.acknowledged_at is null
    and c.consent and c.phone_normalized <> ''
    and not exists (
      select 1 from public.sms_logs s
      where s.alert_id = ar.alert_id and s.contact_id = ar.contact_id
        and s.status in ('queued', 'sending')
    );
  get diagnostics v_count = row_count;
  insert into public.audit_entries (actor, action)
  values (coalesce(auth.jwt() ->> 'email', 'Administrator'), 'Queued ' || v_count || ' SMS reminder(s)');
  return v_count;
end;
$$;

create or replace function public.student_queue_reminders(p_token text, p_alert_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_contact public.contacts;
  v_count integer;
begin
  select c.* into v_contact
  from public.student_sessions s
  join public.contacts c on c.id = s.contact_id
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.expires_at > now();

  if v_contact.id is null then raise exception 'Student session expired'; end if;
  if v_contact.role !~* '(officer|dean|faculty|administrator)' then raise exception 'Class officer access required'; end if;
  if not exists (
    select 1 from public.alert_recipients ar join public.alerts a on a.id = ar.alert_id
    where ar.alert_id = p_alert_id and ar.contact_id = v_contact.id and a.status = 'active'
  ) then raise exception 'Active alert not available'; end if;

  insert into public.sms_logs (alert_id, contact_id, status)
  select ar.alert_id, ar.contact_id, 'queued'
  from public.alert_recipients ar
  join public.contacts c on c.id = ar.contact_id
  where ar.alert_id = p_alert_id
    and ar.acknowledged_at is null
    and c.unit = v_contact.unit
    and c.id <> v_contact.id
    and c.consent and c.phone_normalized <> ''
    and not exists (
      select 1 from public.sms_logs s
      where s.alert_id = ar.alert_id and s.contact_id = ar.contact_id
        and s.status in ('queued', 'sending')
    );
  get diagnostics v_count = row_count;
  insert into public.audit_entries (actor, action)
  values (v_contact.name, 'Queued ' || v_count || ' classmate SMS reminder(s)');
  return v_count;
end;
$$;

create or replace function public.gateway_acknowledge_by_sms(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_contact public.contacts;
  v_alert public.alerts;
begin
  if auth.uid() is null then raise exception 'Gateway sign-in required'; end if;

  select * into v_contact from public.contacts
  where right(phone_normalized, 10) = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)
  limit 1;
  if v_contact.id is null then return jsonb_build_object('acknowledged', false, 'reason', 'unknown_sender'); end if;

  select a.* into v_alert
  from public.alert_recipients ar
  join public.alerts a on a.id = ar.alert_id
  where ar.contact_id = v_contact.id and ar.acknowledged_at is null and a.status = 'active'
  order by a.sent_at desc nulls last, a.created_at desc
  limit 1;
  if v_alert.id is null then return jsonb_build_object('acknowledged', false, 'reason', 'no_pending_alert'); end if;

  update public.alert_recipients set acknowledged_at = now()
  where alert_id = v_alert.id and contact_id = v_contact.id and acknowledged_at is null;
  insert into public.audit_entries (actor, action)
  values (v_contact.name, 'Acknowledged alert by SMS reply: ' || v_alert.title);
  return jsonb_build_object('acknowledged', true, 'contact', v_contact.name, 'alert', v_alert.title);
end;
$$;

-- Refresh the outbound format so recipients know how to acknowledge without the app.
create or replace function public.gateway_claim_sms(p_gateway_id text, p_limit integer default 5)
returns table (job_id uuid, phone text, message text, attempt integer)
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 10);
begin
  if auth.uid() is null then raise exception 'Gateway sign-in required'; end if;
  if trim(coalesce(p_gateway_id, '')) = '' then raise exception 'Gateway ID is required'; end if;
  return query
  with candidates as (
    select s.id from public.sms_logs s
    where s.attempts < 3 and (s.status = 'queued' or (s.status = 'sending' and s.claimed_at < now() - interval '5 minutes'))
    order by s.created_at for update skip locked limit v_limit
  ), claimed as (
    update public.sms_logs s set status = 'sending', attempts = s.attempts + 1,
      gateway_id = trim(p_gateway_id), claimed_at = now(), error_message = null, updated_at = now()
    from candidates c where s.id = c.id returning s.id, s.alert_id, s.contact_id, s.attempts
  )
  select c.id, ct.phone, 'ABISOTRACK: ' || a.title || E'\n' || a.message || E'\nReply 1 to acknowledge.', c.attempts
  from claimed c join public.contacts ct on ct.id = c.contact_id join public.alerts a on a.id = c.alert_id
  order by c.id;
end;
$$;

revoke all on function public.queue_alert_reminders(uuid) from public;
revoke all on function public.student_queue_reminders(text,uuid) from public;
revoke all on function public.gateway_acknowledge_by_sms(text) from public;
grant execute on function public.queue_alert_reminders(uuid) to authenticated;
grant execute on function public.student_queue_reminders(text,uuid) to anon, authenticated;
grant execute on function public.gateway_acknowledge_by_sms(text) to authenticated;
