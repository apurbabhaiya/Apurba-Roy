create table if not exists public.booking_admin_general_costs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid null references public.booking_clients(id) on delete set null,
  cost_type text not null check (cost_type in ('freelancer','editing','travel','album','equipment','office','other')),
  amount numeric(12,2) not null check (amount >= 0),
  vendor text,
  vendor_phone text,
  paid_on date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_admin_calendar_notes (
  id uuid primary key default gen_random_uuid(),
  note_date date not null,
  title text not null check (length(trim(title)) between 1 and 180),
  note text not null check (length(trim(note)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_admin_general_costs_paid_on_idx on public.booking_admin_general_costs(paid_on);
create index if not exists booking_admin_general_costs_booking_id_idx on public.booking_admin_general_costs(booking_id);
create index if not exists booking_admin_calendar_notes_note_date_idx on public.booking_admin_calendar_notes(note_date);

alter table public.booking_admin_general_costs enable row level security;
alter table public.booking_admin_calendar_notes enable row level security;
revoke all on public.booking_admin_general_costs from anon, authenticated, public;
revoke all on public.booking_admin_calendar_notes from anon, authenticated, public;
grant all on public.booking_admin_general_costs to service_role;
grant all on public.booking_admin_calendar_notes to service_role;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.booking_finance_workspace(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Unauthorized'; end if;
  return jsonb_build_object(
    'general_costs', coalesce((select jsonb_agg(to_jsonb(c) order by c.paid_on desc nulls last, c.created_at desc) from public.booking_admin_general_costs c), '[]'::jsonb),
    'calendar_notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.note_date desc, n.created_at desc) from public.booking_admin_calendar_notes n), '[]'::jsonb)
  );
end; $$;

create or replace function private.booking_finance_save_general_cost(p_token text,p_id uuid,p_booking_id uuid,p_amount numeric,p_paid_on date,p_method text,p_cost_type text,p_vendor text,p_vendor_phone text,p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Unauthorized'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Amount must be zero or greater'; end if;
  if p_cost_type not in ('freelancer','editing','travel','album','equipment','office','other') then raise exception 'Invalid cost type'; end if;
  if p_booking_id is not null and not exists(select 1 from public.booking_clients b where b.id=p_booking_id) then raise exception 'Booking not found'; end if;
  if p_id is null then
    insert into public.booking_admin_general_costs(booking_id,cost_type,amount,vendor,vendor_phone,paid_on,note) values(p_booking_id,p_cost_type,p_amount,p_vendor,p_vendor_phone,p_paid_on,p_note) returning id into v_id;
  else
    update public.booking_admin_general_costs set booking_id=p_booking_id,cost_type=p_cost_type,amount=p_amount,vendor=p_vendor,vendor_phone=p_vendor_phone,paid_on=p_paid_on,note=p_note,updated_at=now() where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Cost record not found'; end if;
  end if;
  return v_id;
end; $$;

create or replace function private.booking_finance_save_cost(p_token text,p_id uuid,p_booking_id uuid,p_amount numeric,p_paid_on date,p_method text,p_cost_type text,p_vendor text,p_vendor_phone text,p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Unauthorized'; end if;
  if p_booking_id is null or p_amount is null or p_amount < 0 then raise exception 'Booking and valid amount are required'; end if;
  if not exists(select 1 from public.booking_clients b where b.id=p_booking_id) then raise exception 'Booking not found'; end if;
  if p_cost_type not in ('freelancer','editing','travel','album','equipment','office','other') then raise exception 'Invalid cost type'; end if;
  if p_id is null then
    insert into public.booking_costs(booking_id,cost_type,amount,vendor,paid_on,note) values(p_booking_id,p_cost_type,p_amount,p_vendor,p_paid_on,p_note) returning id into v_id;
  else
    update public.booking_costs set booking_id=p_booking_id,cost_type=p_cost_type,amount=p_amount,vendor=p_vendor,paid_on=p_paid_on,note=p_note where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Cost record not found'; end if;
  end if;
  return v_id;
end; $$;

create or replace function private.booking_finance_delete_general_cost(p_token text,p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Unauthorized'; end if;
  delete from public.booking_admin_general_costs where id=p_id;
  return found;
end; $$;

create or replace function private.booking_finance_delete_cost(p_token text,p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Unauthorized'; end if;
  delete from public.booking_costs where id=p_id;
  return found;
end; $$;

create or replace function private.booking_finance_save_payment(p_token text,p_id uuid,p_booking_id uuid,p_amount numeric,p_paid_on date,p_method text,p_cost_type text,p_vendor text,p_vendor_phone text,p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Unauthorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_booking_id is null or not exists(select 1 from public.booking_clients b where b.id=p_booking_id) then raise exception 'Booking is required'; end if;
  if p_id is null then
    insert into public.booking_payments(booking_id,amount,paid_on,method,note) values(p_booking_id,p_amount,p_paid_on,coalesce(nullif(p_method,''),'CASH'),p_note) returning id into v_id;
  else
    update public.booking_payments set booking_id=p_booking_id,amount=p_amount,paid_on=p_paid_on,method=coalesce(nullif(p_method,''),'CASH'),note=p_note where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Payment record not found'; end if;
  end if;
  return v_id;
end; $$;

create or replace function private.booking_finance_save_calendar_note(p_token text,p_id uuid,p_note_date date,p_title text,p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Unauthorized'; end if;
  if p_note_date is null or nullif(trim(p_title),'') is null or nullif(trim(p_note),'') is null then raise exception 'Date, title and note are required'; end if;
  if p_id is null then insert into public.booking_admin_calendar_notes(note_date,title,note) values(p_note_date,trim(p_title),trim(p_note)) returning id into v_id;
  else update public.booking_admin_calendar_notes set note_date=p_note_date,title=trim(p_title),note=trim(p_note),updated_at=now() where id=p_id returning id into v_id; if v_id is null then raise exception 'Calendar note not found'; end if; end if;
  return v_id;
end; $$;

create or replace function private.booking_finance_delete_calendar_note(p_token text,p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Unauthorized'; end if;
  delete from public.booking_admin_calendar_notes where id=p_id;
  return found;
end; $$;

create or replace function private.booking_finance_update_booking(p_token text,p_booking_id uuid,p_package_amount numeric,p_client_extra_charge numeric,p_discount numeric,p_advance_paid numeric)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Unauthorized'; end if;
  if p_package_amount<0 or p_client_extra_charge<0 or p_discount<0 or p_advance_paid<0 then raise exception 'Amounts must be zero or greater'; end if;
  update public.booking_clients set package_amount=p_package_amount,client_extra_charge=p_client_extra_charge,discount=p_discount,advance_paid=p_advance_paid where id=p_booking_id;
  return found;
end; $$;

create or replace function public.booking_admin_finance_workspace(p_token text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.booking_finance_workspace(p_token); $$;
create or replace function public.booking_admin_finance_save_general_cost(p_token text,p_id uuid,p_booking_id uuid,p_amount numeric,p_paid_on date,p_method text,p_cost_type text,p_vendor text,p_vendor_phone text,p_note text)
returns uuid language sql security invoker set search_path = '' as $$ select private.booking_finance_save_general_cost(p_token,p_id,p_booking_id,p_amount,p_paid_on,p_method,p_cost_type,p_vendor,p_vendor_phone,p_note); $$;
create or replace function public.booking_admin_finance_save_cost(p_token text,p_id uuid,p_booking_id uuid,p_amount numeric,p_paid_on date,p_method text,p_cost_type text,p_vendor text,p_vendor_phone text,p_note text)
returns uuid language sql security invoker set search_path = '' as $$ select private.booking_finance_save_cost(p_token,p_id,p_booking_id,p_amount,p_paid_on,p_method,p_cost_type,p_vendor,p_vendor_phone,p_note); $$;
create or replace function public.booking_admin_finance_delete_general_cost(p_token text,p_id uuid)
returns boolean language sql security invoker set search_path = '' as $$ select private.booking_finance_delete_general_cost(p_token,p_id); $$;
create or replace function public.booking_admin_finance_delete_cost(p_token text,p_id uuid)
returns boolean language sql security invoker set search_path = '' as $$ select private.booking_finance_delete_cost(p_token,p_id); $$;
create or replace function public.booking_admin_finance_save_payment(p_token text,p_id uuid,p_booking_id uuid,p_amount numeric,p_paid_on date,p_method text,p_cost_type text,p_vendor text,p_vendor_phone text,p_note text)
returns uuid language sql security invoker set search_path = '' as $$ select private.booking_finance_save_payment(p_token,p_id,p_booking_id,p_amount,p_paid_on,p_method,p_cost_type,p_vendor,p_vendor_phone,p_note); $$;
create or replace function public.booking_admin_finance_save_calendar_note(p_token text,p_id uuid,p_note_date date,p_title text,p_note text)
returns uuid language sql security invoker set search_path = '' as $$ select private.booking_finance_save_calendar_note(p_token,p_id,p_note_date,p_title,p_note); $$;
create or replace function public.booking_admin_finance_delete_calendar_note(p_token text,p_id uuid)
returns boolean language sql security invoker set search_path = '' as $$ select private.booking_finance_delete_calendar_note(p_token,p_id); $$;
create or replace function public.booking_admin_finance_update_booking(p_token text,p_booking_id uuid,p_package_amount numeric,p_client_extra_charge numeric,p_discount numeric,p_advance_paid numeric)
returns boolean language sql security invoker set search_path = '' as $$ select private.booking_finance_update_booking(p_token,p_booking_id,p_package_amount,p_client_extra_charge,p_discount,p_advance_paid); $$;

revoke all on all functions in schema private from public;
grant execute on function private.booking_finance_workspace(text),private.booking_finance_save_general_cost(text,uuid,uuid,numeric,date,text,text,text,text,text),private.booking_finance_save_cost(text,uuid,uuid,numeric,date,text,text,text,text,text),private.booking_finance_delete_general_cost(text,uuid),private.booking_finance_delete_cost(text,uuid),private.booking_finance_save_payment(text,uuid,uuid,numeric,date,text,text,text,text,text),private.booking_finance_save_calendar_note(text,uuid,date,text,text),private.booking_finance_delete_calendar_note(text,uuid),private.booking_finance_update_booking(text,uuid,numeric,numeric,numeric,numeric) to anon,authenticated;
revoke all on function public.booking_admin_finance_workspace(text),public.booking_admin_finance_save_general_cost(text,uuid,uuid,numeric,date,text,text,text,text,text),public.booking_admin_finance_save_cost(text,uuid,uuid,numeric,date,text,text,text,text,text),public.booking_admin_finance_delete_general_cost(text,uuid),public.booking_admin_finance_delete_cost(text,uuid),public.booking_admin_finance_save_payment(text,uuid,uuid,numeric,date,text,text,text,text,text),public.booking_admin_finance_save_calendar_note(text,uuid,date,text,text),public.booking_admin_finance_delete_calendar_note(text,uuid),public.booking_admin_finance_update_booking(text,uuid,numeric,numeric,numeric,numeric) from public;
grant execute on function public.booking_admin_finance_workspace(text),public.booking_admin_finance_save_general_cost(text,uuid,uuid,numeric,date,text,text,text,text,text),public.booking_admin_finance_save_cost(text,uuid,uuid,numeric,date,text,text,text,text,text),public.booking_admin_finance_delete_general_cost(text,uuid),public.booking_admin_finance_delete_cost(text,uuid),public.booking_admin_finance_save_payment(text,uuid,uuid,numeric,date,text,text,text,text,text),public.booking_admin_finance_save_calendar_note(text,uuid,date,text,text),public.booking_admin_finance_delete_calendar_note(text,uuid),public.booking_admin_finance_update_booking(text,uuid,numeric,numeric,numeric,numeric) to anon,authenticated;
