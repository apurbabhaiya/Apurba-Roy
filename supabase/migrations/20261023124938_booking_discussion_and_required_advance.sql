-- Discussion is a contact enquiry, never a signed or paid booking.
create table public.booking_discussions (
 id uuid primary key default gen_random_uuid(),reference_no text not null unique default ('RC-DISC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),client_name text not null check(length(client_name) between 2 and 200),phone text not null check(length(phone) between 7 and 30),package_id text references public.booking_package_catalog(id),preferred_date date,notes text not null default '',status text not null default 'new' check(status in ('new','contacted','closed')),deleted_at timestamptz,created_at timestamptz not null default now()
);
alter table public.booking_discussions enable row level security;
revoke all on public.booking_discussions from anon,authenticated;
create function public.submit_booking_discussion(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.booking_discussions;
begin
 if not coalesce((p_payload->>'consent')::boolean,false) then raise exception 'Consent to be contacted is required'; end if;
 insert into public.booking_discussions(client_name,phone,package_id,preferred_date,notes) values(trim(p_payload->>'client_name'),trim(p_payload->>'phone'),nullif(p_payload->>'package_id',''),nullif(p_payload->>'preferred_date','')::date,left(coalesce(p_payload->>'notes',''),4000)) returning * into r;
 return jsonb_build_object('reference_no',r.reference_no,'id',r.id);
end; $$;
create function public.booking_admin_discussions(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc),'[]') from (select * from public.booking_discussions order by created_at desc limit 500) d);
end; $$;
create function public.booking_admin_update_discussion(p_token text,p_id uuid,p_status text default null,p_deleted boolean default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 update public.booking_discussions set status=coalesce(p_status,status),deleted_at=case when p_deleted is null then deleted_at when p_deleted then now() else null end where id=p_id;
 return found;
end; $$;
revoke all on function public.submit_booking_discussion(jsonb),public.booking_admin_discussions(text),public.booking_admin_update_discussion(text,uuid,text,boolean) from public;
grant execute on function public.submit_booking_discussion(jsonb),public.booking_admin_discussions(text),public.booking_admin_update_discussion(text,uuid,text,boolean) to anon,authenticated;
create or replace function public.submit_package_booking(p_payload jsonb,p_options jsonb,p_expected_total numeric,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.booking_custom_settings;q jsonb;pkg jsonb;payload jsonb;result jsonb;total numeric;fee numeric;first_date date;due_date date;initial numeric;half numeric;proof jsonb;
begin
 select * into strict s from public.booking_custom_settings where id=true;
 if p_revision<>s.revision then raise exception 'Settings changed. Reload and review before submitting.'; end if;
 if not coalesce((p_options->>'terms_advance')::boolean,false) or not coalesce((p_options->>'terms_half')::boolean,false) or not coalesce((p_options->>'terms_final')::boolean,false) then raise exception 'Accept all payment terms'; end if;
 if p_options->>'mode'='custom' then
  q:=public.booking_custom_quote(p_payload->'events',p_options);
 else
  select details into pkg from public.booking_package_catalog where id=p_options->>'package_id' and active;
  if pkg is null then raise exception 'Select an available package'; end if;
  q:=jsonb_build_object('total',(pkg->>'price')::numeric,'package',pkg,'revision',s.revision);
 end if;
 fee:=case when coalesce((p_options->>'allow_publish')::boolean,true) then 0 else 10000 end;
 total:=(q->>'total')::numeric+fee;
 if abs(total-p_expected_total)>0.001 then raise exception 'Price changed. Review the updated total.'; end if;
 select min((v->>'event_date')::date) into first_date from jsonb_array_elements(p_payload->'events') v;
 if first_date is null or first_date<(now() at time zone 'Asia/Dhaka')::date then raise exception 'Select a valid upcoming event date'; end if;
 due_date:=first_date-s.half_due_days;half:=round(total/2,2);
 initial:=least(total,greatest(2000,case when due_date<=(now() at time zone 'Asia/Dhaka')::date then half else s.prebook_amount end));
 payload:=p_payload||jsonb_build_object('package_name',case when pkg is null then 'Custom package - office verification required' else pkg->>'name' end,'package_amount',(q->>'total')::numeric,'client_extra_charge',fee,'discount',0,'advance_paid',0,'custom_quote',case when pkg is null then q else null end,'package_selection',pkg,'booking_options',(p_options-'payment_proof')||jsonb_build_object('booking_intent','confirm'),'payment_plan',jsonb_build_object('initial',initial,'half_total',half,'half_due_date',due_date,'event_date',first_date,'total',total,'policy_revision',s.revision),'client_notes',coalesce(p_payload->>'client_notes','')||E'\nPayment terms accepted: pre-booking advance counts toward 50%; 50% due '||due_date::text||'; balance due on event day. All payments require office verification.');
 if p_options->>'payment_method'='CASH' and not s.cash_enabled then raise exception 'Cash payments are disabled'; end if;
 result:=public.submit_client_booking(payload);
 proof:=p_options->'payment_proof';
 if proof is null or proof='null'::jsonb then raise exception 'An advance payment and reference are required for confirmed booking requests'; end if;
 if length(trim(coalesce(proof->>'transaction_id','')))<4 then raise exception 'Enter a transaction ID or cash office receipt number'; end if;
 if coalesce(p_options->>'payment_method',proof->>'method') is distinct from proof->>'method' then raise exception 'Payment method does not match the receipt'; end if;
 if proof is not null and proof<>'null'::jsonb then
  if proof->>'method'='CASH' then
   if not s.cash_enabled then raise exception 'Cash payments are disabled'; end if;
  elsif nullif(trim(s.payment_accounts->>(proof->>'method')),'') is null then raise exception 'Payment method is not configured'; end if;
  if coalesce((proof->>'amount')::numeric,0)<initial or (proof->>'amount')::numeric>total then raise exception 'Check the payment amount against the payment plan'; end if;
  insert into public.booking_payment_requests(booking_id,amount,method,transaction_id,payer_phone) values((result->>'id')::uuid,(proof->>'amount')::numeric,proof->>'method',upper(trim(proof->>'transaction_id')),left(coalesce(proof->>'payer_phone',''),30));
 end if;
 return result||jsonb_build_object('payment_plan',payload->'payment_plan','quote',q);
end; $$;

-- Preserve the existing admin operation while guarding confirmation of new requests.
alter function public.booking_admin_update_booking(text,uuid,text,text) rename to booking_admin_update_booking_base;
revoke all on function public.booking_admin_update_booking_base(text,uuid,text,text) from public,anon,authenticated;
create function public.booking_admin_update_booking(p_token text,p_booking_id uuid,p_status text default null,p_internal_notes text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare b public.booking_clients;plan jsonb;paid numeric;required numeric;
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 if p_status in ('booked','confirmed') then
  select * into b from public.booking_clients where id=p_booking_id for update;
  if b.contract_snapshot->'booking_options'->>'booking_intent'='confirm' then
   plan:=b.contract_snapshot->'payment_plan';required:=(plan->>'initial')::numeric;
   if (now() at time zone 'Asia/Dhaka')::date>=(plan->>'half_due_date')::date then required:=greatest(required,(plan->>'half_total')::numeric); end if;
   if (now() at time zone 'Asia/Dhaka')::date>=(plan->>'event_date')::date then required:=(plan->>'total')::numeric; end if;
   select coalesce(sum(amount),0)+b.advance_paid into paid from public.booking_payments where booking_id=p_booking_id;
   if paid<required then raise exception 'Verify the required advance payment before confirming this booking'; end if;
  end if;
 end if;
 return public.booking_admin_update_booking_base(p_token,p_booking_id,p_status,p_internal_notes);
end; $$;
revoke all on function public.booking_admin_update_booking(text,uuid,text,text) from public;
grant execute on function public.booking_admin_update_booking(text,uuid,text,text) to anon,authenticated;
