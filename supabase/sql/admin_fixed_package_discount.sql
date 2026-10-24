-- Default 0 means no price changes until the admin sets an offer.
alter table public.booking_custom_settings add column if not exists fixed_discount_percent numeric(5,2) not null default 0 check (fixed_discount_percent between 0 and 99);
create or replace function public.booking_custom_save_config(p_token text,p_config jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare city_rate record;deposit record;
begin
 perform public.booking_custom_save_config_base(p_token,p_config,p_revision);
 if jsonb_typeof(p_config->'allowed_cities') is distinct from 'array' or jsonb_array_length(p_config->'allowed_cities')>100 then raise exception 'Set allowed cities'; end if;
 if jsonb_typeof(p_config->'payment_accounts') is distinct from 'object' then raise exception 'Invalid payment accounts'; end if;
 if exists(select 1 from jsonb_each_text(p_config->'payment_accounts') where key not in ('BKASH','NAGAD','ROCKET','BANK') or length(value)>200) then raise exception 'Invalid payment account'; end if;
 if (p_config->>'mini_price')::numeric<=0 or (p_config->>'mini_price')::numeric>1000000 then raise exception 'Set a valid city photoshoot price'; end if;
 update public.booking_custom_settings set mini_enabled=coalesce((p_config->>'mini_enabled')::boolean,true),mini_price=(p_config->>'mini_price')::numeric, allowed_cities=array(select trim(value) from jsonb_array_elements_text(p_config->'allowed_cities') where trim(value)<>''),payment_accounts=p_config->'payment_accounts',cash_enabled=coalesce((p_config->>'cash_enabled')::boolean,true),bank_details=left(coalesce(p_config->>'bank_details',''),2000),prebook_amount=(p_config->>'prebook_amount')::numeric,half_due_days=(p_config->>'half_due_days')::integer where id=true;
 if jsonb_typeof(p_config->'mini_city_rates') is distinct from 'object' then raise exception 'Set city hourly and travel rates'; end if;
 for city_rate in select * from jsonb_each(p_config->'mini_city_rates') loop
 if jsonb_typeof(city_rate.value) is distinct from 'object' or coalesce((city_rate.value->>'hourly_rate')::numeric,0)<=0 or (city_rate.value->>'hourly_rate')::numeric>1000000 or coalesce((city_rate.value->>'travel')::numeric,0)<200 or (city_rate.value->>'travel')::numeric>100000 then raise exception 'Invalid city hourly or travel rate'; end if;
 end loop;
 update public.booking_custom_settings set mini_city_rates=p_config->'mini_city_rates' where id=true;
 if jsonb_typeof(p_config->'mini_city_deposits') is distinct from 'object' then raise exception 'Set city deposits'; end if;
 for deposit in select * from jsonb_each_text(p_config->'mini_city_deposits') loop
 if deposit.value::numeric<=0 or deposit.value::numeric>2000 then raise exception 'City pre-booking deposit must be between 1 and 2000'; end if;
 end loop;
 update public.booking_custom_settings set mini_city_deposits=p_config->'mini_city_deposits' where id=true;
 if p_config ? 'fixed_discount_percent' then
  if (p_config->>'fixed_discount_percent') is null or (p_config->>'fixed_discount_percent')::numeric not between 0 and 99 then raise exception 'Discount must be between 0 and 99 percent'; end if;
  update public.booking_custom_settings set fixed_discount_percent=round((p_config->>'fixed_discount_percent')::numeric,2) where id=true;
 end if;
 return public.booking_custom_config();
end; $$;


-- Apply with the matching frontend release. Version 1 clients keep their prior calculation.
create or replace function public.submit_package_booking(p_payload jsonb,p_options jsonb,p_expected_total numeric,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.booking_custom_settings;q jsonb;pkg jsonb;payload jsonb;result jsonb;total numeric;fee numeric;first_date date;due_date date;initial numeric;half numeric;proof jsonb;discount_amount numeric:=0;discount_percent numeric:=0;
begin
 select * into strict s from public.booking_custom_settings where id=true;
 if p_revision<>s.revision then raise exception 'Settings changed. Reload and review before submitting.'; end if;
 if p_options->>'mode'='mini' then
  if not coalesce((p_options->>'city_deposit_terms')::boolean,false) then raise exception 'Accept the city deposit and event-day balance terms'; end if;
 elsif not coalesce((p_options->>'terms_advance')::boolean,false) or not coalesce((p_options->>'terms_half')::boolean,false) or not coalesce((p_options->>'terms_final')::boolean,false) then raise exception 'Accept all payment terms'; end if;
 if p_options->>'mode'='mini' then
  if jsonb_array_length(p_payload->'events')<>1 then raise exception 'City shoots cover one session'; end if;
  q:=public.booking_mini_quote(p_payload->'events'->0,p_options);
 elsif p_options->>'mode'='custom' then
  q:=public.booking_custom_quote(p_payload->'events',p_options);
 else
  select details into pkg from public.booking_package_catalog where id=p_options->>'package_id' and active;
  if pkg is null then raise exception 'Select an available package'; end if;
  if coalesce((p_options->>'pricing_version')::integer,1)>=2 and p_options->>'package_id' in ('outdoor-essentials','regular-basic','regular-standard','outdoor-cinematic') then
   if jsonb_typeof(p_payload->'events') is distinct from 'array' then raise exception 'Provide event details'; end if;
   if jsonb_array_length(p_payload->'events') not between 1 and 20 then raise exception 'Select between 1 and 20 events'; end if;
   q:=jsonb_build_object('total',(pkg->>'price')::numeric*jsonb_array_length(p_payload->'events'),'unit_price',(pkg->>'price')::numeric,'event_count',jsonb_array_length(p_payload->'events'),'pricing_basis','per_event','package',pkg,'revision',s.revision);
  else
   q:=jsonb_build_object('total',(pkg->>'price')::numeric,'package',pkg,'revision',s.revision);
  end if;
 end if;
 fee:=case when p_options->>'mode'='mini' then 0 when coalesce((p_options->>'allow_publish')::boolean,true) then 0 else 10000 end;
 if pkg is not null and coalesce((p_options->>'discount_version')::integer,0)>=1 then
  discount_percent:=s.fixed_discount_percent;
  discount_amount:=round((q->>'total')::numeric*discount_percent/100,2);
 end if;
 q:=q||jsonb_build_object('discount_percent',discount_percent,'discount_amount',discount_amount,'net_total',(q->>'total')::numeric-discount_amount);
 total:=(q->>'total')::numeric-discount_amount+fee;
 if abs(total-p_expected_total)>0.001 then raise exception 'Price changed. Review the updated total.'; end if;
 select min((v->>'event_date')::date) into first_date from jsonb_array_elements(p_payload->'events') v;
 if first_date is null or first_date<(now() at time zone 'Asia/Dhaka')::date then raise exception 'Select a valid upcoming event date'; end if;
 due_date:=first_date-s.half_due_days;half:=round(total/2,2);
 initial:=least(total,greatest(2000,case when due_date<=(now() at time zone 'Asia/Dhaka')::date then half else s.prebook_amount end));
 if p_options->>'mode'='mini' then initial:=(q->>'initial')::numeric;half:=initial;due_date:=first_date; end if;
 payload:=p_payload||jsonb_build_object('package_name',case when p_options->>'mode'='mini' then 'City hourly photoshoot' when pkg is null then 'Custom package - office verification required' else pkg->>'name' end,'package_amount',(q->>'total')::numeric,'client_extra_charge',fee,'discount',discount_amount,'advance_paid',0,'custom_quote',case when pkg is null then q else null end,'package_selection',case when pkg is null then null else pkg||jsonb_build_object('discount_percent',discount_percent,'discount_amount',discount_amount,'gross_total',(q->>'total')::numeric,'net_total',(q->>'net_total')::numeric) end,'booking_options',(p_options-'payment_proof')||jsonb_build_object('booking_intent','confirm'),'payment_plan',jsonb_build_object('city_deposit',p_options->>'mode'='mini','full_advance',false,'initial',initial,'half_total',half,'half_due_date',due_date,'event_date',first_date,'total',total,'policy_revision',s.revision),'client_notes',coalesce(p_payload->>'client_notes','')||case when p_options->>'mode'='mini' then E'\nCity hourly photoshoot: city-specific pre-booking deposit due now; remaining shoot, editing and travel balance due on shoot day. Publication permission must be obtained separately. Office verifies payment and availability.' else E'\nPayment terms accepted: pre-booking advance counts toward 50%; 50% due '||due_date::text||'; balance due on event day. All payments require office verification.' end);
 if p_options->>'payment_method'='CASH' and not s.cash_enabled then raise exception 'Cash payments are disabled'; end if;
 result:=public.submit_client_booking(payload);
 proof:=p_options->'payment_proof';
 if proof is null or proof='null'::jsonb then raise exception 'An advance payment and reference are required for confirmed booking requests'; end if;
 if length(trim(coalesce(proof->>'transaction_id','')))<4 then raise exception 'Enter a transaction ID or cash office receipt number'; end if;
 if coalesce(p_options->>'payment_method',proof->>'method') is distinct from proof->>'method' then raise exception 'Payment method does not match the receipt'; end if;
 if p_options->>'mode'='mini' and (proof->>'amount')::numeric<>initial then raise exception 'Pay exactly the displayed city pre-booking deposit'; end if;
 if proof is not null and proof<>'null'::jsonb then
  if proof->>'method'='CASH' then
   if not s.cash_enabled then raise exception 'Cash payments are disabled'; end if;
  elsif nullif(trim(s.payment_accounts->>(proof->>'method')),'') is null then raise exception 'Payment method is not configured'; end if;
  if coalesce((proof->>'amount')::numeric,0)<initial or (proof->>'amount')::numeric>total then raise exception 'Check the payment amount against the payment plan'; end if;
  insert into public.booking_payment_requests(booking_id,amount,method,transaction_id,payer_phone) values((result->>'id')::uuid,(proof->>'amount')::numeric,proof->>'method',upper(trim(proof->>'transaction_id')),left(coalesce(proof->>'payer_phone',''),30));
 end if;
 return result||jsonb_build_object('payment_plan',payload->'payment_plan','quote',q);
end; $$;

