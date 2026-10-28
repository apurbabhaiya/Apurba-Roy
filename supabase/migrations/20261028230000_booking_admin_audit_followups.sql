create table if not exists public.booking_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  reference_no text,
  client_name text,
  record_type text not null,
  record_id uuid,
  action text not null check (action in ('insert','update','delete')),
  details jsonb not null default '{}'::jsonb,
  performed_by text not null default 'Admin panel',
  created_at timestamptz not null default now()
);

create index if not exists booking_admin_audit_logs_created_idx
  on public.booking_admin_audit_logs(created_at desc);
create index if not exists booking_admin_audit_logs_booking_idx
  on public.booking_admin_audit_logs(booking_id, created_at desc);

alter table public.booking_admin_audit_logs enable row level security;
revoke all on public.booking_admin_audit_logs from anon, authenticated, public;
grant all on public.booking_admin_audit_logs to service_role;

create table if not exists public.booking_admin_followups (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_clients(id) on delete cascade,
  due_on date not null,
  note text not null check (length(trim(note)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending','done')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booking_admin_followups_due_idx
  on public.booking_admin_followups(status, due_on);
create index if not exists booking_admin_followups_booking_idx
  on public.booking_admin_followups(booking_id, due_on desc);
alter table public.booking_admin_followups enable row level security;
revoke all on public.booking_admin_followups from anon, authenticated, public;
grant all on public.booking_admin_followups to service_role;

create or replace function private.booking_admin_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_details jsonb := '{}'::jsonb;
  v_booking_id uuid;
  v_record_id uuid;
  v_reference_no text;
  v_client_name text;
begin
  if TG_OP = 'DELETE' then
    v_row := to_jsonb(OLD);
    v_old := v_row;
    v_record_id := nullif(v_row->>'id','')::uuid;
  else
    v_row := to_jsonb(NEW);
    v_new := v_row;
    v_record_id := nullif(v_row->>'id','')::uuid;
  end if;

  if TG_TABLE_NAME = 'booking_clients' then
    v_booking_id := v_record_id;
    v_reference_no := v_row->>'reference_no';
    v_client_name := v_row->>'client_name';
  else
    v_booking_id := nullif(v_row->>'booking_id','')::uuid;
    if v_booking_id is not null then
      select b.reference_no, b.client_name into v_reference_no, v_client_name
        from public.booking_clients b where b.id = v_booking_id;
    end if;
  end if;

  foreach v_key in array TG_ARGV loop
    if TG_OP = 'INSERT' then
      if v_new ? v_key then
        v_details := v_details || jsonb_build_object(v_key, jsonb_build_object('after', v_new->v_key));
      end if;
    elsif TG_OP = 'DELETE' then
      if v_old ? v_key then
        v_details := v_details || jsonb_build_object(v_key, jsonb_build_object('before', v_old->v_key));
      end if;
    elsif v_old->v_key is distinct from v_new->v_key then
      v_details := v_details || jsonb_build_object(v_key, jsonb_build_object('before', v_old->v_key, 'after', v_new->v_key));
    end if;
  end loop;

  insert into public.booking_admin_audit_logs(
    booking_id, reference_no, client_name, record_type, record_id, action, details
  ) values (
    v_booking_id,
    v_reference_no,
    v_client_name,
    TG_TABLE_NAME,
    v_record_id,
    lower(TG_OP),
    v_details
  );

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

revoke all on function private.booking_admin_audit_trigger() from public, anon, authenticated;

drop trigger if exists booking_clients_admin_audit on public.booking_clients;
create trigger booking_clients_admin_audit
  after insert or update or delete on public.booking_clients
  for each row execute function private.booking_admin_audit_trigger(
    'package_amount','client_extra_charge','discount','advance_paid','status','deleted_at'
  );

drop trigger if exists booking_payments_admin_audit on public.booking_payments;
create trigger booking_payments_admin_audit
  after insert or update or delete on public.booking_payments
  for each row execute function private.booking_admin_audit_trigger(
    'amount','paid_on','method','note'
  );

drop trigger if exists booking_costs_admin_audit on public.booking_costs;
create trigger booking_costs_admin_audit
  after insert or update or delete on public.booking_costs
  for each row execute function private.booking_admin_audit_trigger(
    'cost_type','amount','vendor','paid_on','note'
  );

drop trigger if exists booking_admin_general_costs_admin_audit on public.booking_admin_general_costs;
create trigger booking_admin_general_costs_admin_audit
  after insert or update or delete on public.booking_admin_general_costs
  for each row execute function private.booking_admin_audit_trigger(
    'cost_type','amount','vendor','paid_on','note'
  );

drop trigger if exists booking_payment_requests_admin_audit on public.booking_payment_requests;
create trigger booking_payment_requests_admin_audit
  after insert or update or delete on public.booking_payment_requests
  for each row execute function private.booking_admin_audit_trigger(
    'amount','method','transaction_id','status','reviewed_at','payment_id'
  );

drop trigger if exists booking_events_admin_audit on public.booking_events;
create trigger booking_events_admin_audit
  after insert or update or delete on public.booking_events
  for each row execute function private.booking_admin_audit_trigger(
    'event_name','event_date','start_time','end_time','venue','location'
  );

create or replace function private.booking_finance_save_followup(
  p_token text, p_id uuid, p_booking_id uuid, p_due_on date, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then raise exception 'Admin session expired'; end if;
  if p_booking_id is null or p_due_on is null or nullif(trim(p_note),'') is null then
    raise exception 'বুকিং, তারিখ ও ফলো-আপের নোট দিন';
  end if;
  if not exists(select 1 from public.booking_clients b where b.id=p_booking_id and b.deleted_at is null) then
    raise exception 'সক্রিয় বুকিং পাওয়া যায়নি';
  end if;

  if p_id is null then
    insert into public.booking_admin_followups(booking_id,due_on,note)
    values(p_booking_id,p_due_on,trim(p_note)) returning id into v_id;
  else
    update public.booking_admin_followups
       set booking_id=p_booking_id,due_on=p_due_on,note=trim(p_note),updated_at=now()
     where id=p_id and status='pending'
     returning id into v_id;
    if v_id is null then raise exception 'ফলো-আপ পাওয়া যায়নি বা এটি সম্পন্ন হয়েছে'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function private.booking_finance_complete_followup(p_token text,p_id uuid,p_completed boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then raise exception 'Admin session expired'; end if;
  if p_completed is null then raise exception 'Completion state is required'; end if;
  update public.booking_admin_followups
     set status=case when p_completed then 'done' else 'pending' end,
         completed_at=case when p_completed then now() else null end,
         updated_at=now()
   where id=p_id;
  return found;
end;
$$;

create or replace function private.booking_finance_workspace(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then raise exception 'Unauthorized'; end if;
  return jsonb_build_object(
    'general_costs', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.paid_on desc nulls last, c.created_at desc)
      from public.booking_admin_general_costs c
    ), '[]'::jsonb),
    'calendar_notes', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.note_date desc, n.created_at desc)
      from public.booking_admin_calendar_notes n
    ), '[]'::jsonb),
    'audit_logs', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from (
        select * from public.booking_admin_audit_logs
        order by created_at desc limit 200
      ) a
    ), '[]'::jsonb),
    'followups', coalesce((
      select jsonb_agg(
        to_jsonb(f) || jsonb_build_object(
          'reference_no', b.reference_no,
          'client_name', b.client_name,
          'phone', b.phone,
          'contract_total', greatest(0, coalesce(b.package_amount,0) + coalesce(b.client_extra_charge,0) - coalesce(b.discount,0)),
          'paid_total', coalesce(b.advance_paid,0) + coalesce((
            select sum(p.amount) from public.booking_payments p where p.booking_id=b.id
          ),0)
        )
        order by f.due_on asc, f.created_at desc
      )
      from public.booking_admin_followups f
      join public.booking_clients b on b.id=f.booking_id
      where b.deleted_at is null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.booking_admin_finance_save_followup(p_token text,p_id uuid,p_booking_id uuid,p_due_on date,p_note text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.booking_finance_save_followup(p_token,p_id,p_booking_id,p_due_on,p_note);
$$;

create or replace function public.booking_admin_finance_complete_followup(p_token text,p_id uuid,p_completed boolean)
returns boolean language sql security invoker set search_path = '' as $$
  select private.booking_finance_complete_followup(p_token,p_id,p_completed);
$$;

revoke all on function private.booking_finance_save_followup(text,uuid,uuid,date,text) from public;
revoke all on function private.booking_finance_complete_followup(text,uuid,boolean) from public;
revoke all on function private.booking_finance_workspace(text) from public;
grant execute on function private.booking_finance_save_followup(text,uuid,uuid,date,text) to anon,authenticated;
grant execute on function private.booking_finance_complete_followup(text,uuid,boolean) to anon,authenticated;
grant execute on function private.booking_finance_workspace(text) to anon,authenticated;
revoke all on function public.booking_admin_finance_save_followup(text,uuid,uuid,date,text) from public;
revoke all on function public.booking_admin_finance_complete_followup(text,uuid,boolean) from public;
grant execute on function public.booking_admin_finance_save_followup(text,uuid,uuid,date,text) to anon,authenticated;
grant execute on function public.booking_admin_finance_complete_followup(text,uuid,boolean) to anon,authenticated;
