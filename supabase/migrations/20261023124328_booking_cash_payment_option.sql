alter table public.booking_custom_settings add column cash_enabled boolean not null default true;
alter table public.booking_payment_requests drop constraint booking_payment_requests_method_check;
alter table public.booking_payment_requests add constraint booking_payment_requests_method_check check(method in ('CASH','BKASH','NAGAD','ROCKET','BANK'));
create or replace function public.booking_custom_save_config(p_token text,p_config jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.booking_custom_save_config_base(p_token,p_config,p_revision);
 if jsonb_typeof(p_config->'allowed_cities') is distinct from 'array' or jsonb_array_length(p_config->'allowed_cities')>100 then raise exception 'Set allowed cities'; end if;
 if jsonb_typeof(p_config->'payment_accounts') is distinct from 'object' then raise exception 'Invalid payment accounts'; end if;
 if exists(select 1 from jsonb_each_text(p_config->'payment_accounts') where key not in ('BKASH','NAGAD','ROCKET','BANK') or length(value)>200) then raise exception 'Invalid payment account'; end if;
 update public.booking_custom_settings set allowed_cities=array(select trim(value) from jsonb_array_elements_text(p_config->'allowed_cities') where trim(value)<>''),payment_accounts=p_config->'payment_accounts',cash_enabled=coalesce((p_config->>'cash_enabled')::boolean,true),bank_details=left(coalesce(p_config->>'bank_details',''),2000),prebook_amount=(p_config->>'prebook_amount')::numeric,half_due_days=(p_config->>'half_due_days')::integer where id=true;
 return public.booking_custom_config();
end; $$;

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
 initial:=case when due_date<=(now() at time zone 'Asia/Dhaka')::date then half else least(s.prebook_amount,total) end;
 payload:=p_payload||jsonb_build_object('package_name',case when pkg is null then 'Custom package - office verification required' else pkg->>'name' end,'package_amount',(q->>'total')::numeric,'client_extra_charge',fee,'discount',0,'advance_paid',0,'custom_quote',case when pkg is null then q else null end,'package_selection',pkg,'booking_options',p_options-'payment_proof','payment_plan',jsonb_build_object('initial',initial,'half_total',half,'half_due_date',due_date,'event_date',first_date,'total',total,'policy_revision',s.revision),'client_notes',coalesce(p_payload->>'client_notes','')||E'\nPayment terms accepted: pre-booking advance counts toward 50%; 50% due '||due_date::text||'; balance due on event day. All payments require office verification.');
 if p_options->>'payment_method'='CASH' and not s.cash_enabled then raise exception 'Cash payments are disabled'; end if;
 result:=public.submit_client_booking(payload);
 proof:=p_options->'payment_proof';
 if proof is not null and proof<>'null'::jsonb then
  if proof->>'method'='CASH' then
   if not s.cash_enabled then raise exception 'Cash payments are disabled'; end if;
   proof:=proof||jsonb_build_object('transaction_id','CASH-'||gen_random_uuid()::text);
  elsif nullif(trim(s.payment_accounts->>(proof->>'method')),'') is null then raise exception 'Payment method is not configured'; end if;
  if coalesce((proof->>'amount')::numeric,0)<initial or (proof->>'amount')::numeric>total then raise exception 'Check the payment amount against the payment plan'; end if;
  insert into public.booking_payment_requests(booking_id,amount,method,transaction_id,payer_phone) values((result->>'id')::uuid,(proof->>'amount')::numeric,proof->>'method',upper(trim(proof->>'transaction_id')),left(coalesce(proof->>'payer_phone',''),30));
 end if;
 return result||jsonb_build_object('payment_plan',payload->'payment_plan','quote',q);
end; $$;
