alter table public.booking_custom_settings add column mini_enabled boolean not null default true,add column mini_price numeric(12,2) not null default 1000 check(mini_price>0 and mini_price<=1000000);
create function public.booking_mini_quote(p_event jsonb,p_options jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.booking_custom_settings;st timestamp;en timestamp;d date;travel numeric:=0;amount numeric;days jsonb:='[]';
begin
 select * into strict s from public.booking_custom_settings where id=true;
 if not s.mini_enabled then raise exception 'City photoshoots are currently unavailable'; end if;
 if not coalesce(p_options->>'city','')=any(s.allowed_cities) then raise exception 'Select an available city'; end if;
 if coalesce(p_event->>'event_date','')='' or coalesce(p_event->>'start_time','')='' or coalesce(p_event->>'end_time','')='' then raise exception 'Select the date and one-hour time slot'; end if;
 st:=(p_event->>'event_date')::date+(p_event->>'start_time')::time;
 en:=coalesce(nullif(p_event->>'end_date',''),p_event->>'event_date')::date+(p_event->>'end_time')::time;
 if en-st<>interval '1 hour' then raise exception 'This package covers exactly one hour'; end if;
 if coalesce((p_event->>'photographers')::integer,0)<>1 or coalesce((p_event->>'cinematographers')::integer,0)<>0 or coalesce((p_event->>'drone')::boolean,false) or coalesce((p_event->>'special_photos')::integer,0)<>0 or coalesce((p_event->>'video_edit')::boolean,false) then raise exception 'City package includes one photographer only'; end if;
 for d in select generate_series(st::date,(en-interval '1 second')::date,'1 day')::date loop
  amount:=coalesce(nullif(p_options->'travel'->>d::text,'')::numeric,200);
  if amount<200 or amount>100000 then raise exception 'Daily travel must be between 200 and 100000'; end if;
  travel:=travel+round(amount,2);days:=days||to_jsonb(d);
 end loop;
 return jsonb_build_object('revision',s.revision,'rates',to_jsonb(s)-'id','city',p_options->>'city','lines',jsonb_build_array(jsonb_build_object('event_name','City one-hour photoshoot','minutes',60,'amount',s.mini_price)),'travel_days',days,'travel',travel,'total',s.mini_price+travel,'needs_review',false,'full_advance',true);
end; $$;
revoke all on function public.booking_mini_quote(jsonb,jsonb) from public;
grant execute on function public.booking_mini_quote(jsonb,jsonb) to anon,authenticated;
create or replace function public.booking_custom_save_config(p_token text,p_config jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.booking_custom_save_config_base(p_token,p_config,p_revision);
 if jsonb_typeof(p_config->'allowed_cities') is distinct from 'array' or jsonb_array_length(p_config->'allowed_cities')>100 then raise exception 'Set allowed cities'; end if;
 if jsonb_typeof(p_config->'payment_accounts') is distinct from 'object' then raise exception 'Invalid payment accounts'; end if;
 if exists(select 1 from jsonb_each_text(p_config->'payment_accounts') where key not in ('BKASH','NAGAD','ROCKET','BANK') or length(value)>200) then raise exception 'Invalid payment account'; end if;
 if (p_config->>'mini_price')::numeric<=0 or (p_config->>'mini_price')::numeric>1000000 then raise exception 'Set a valid city photoshoot price'; end if;
 update public.booking_custom_settings set mini_enabled=coalesce((p_config->>'mini_enabled')::boolean,true),mini_price=(p_config->>'mini_price')::numeric, allowed_cities=array(select trim(value) from jsonb_array_elements_text(p_config->'allowed_cities') where trim(value)<>''),payment_accounts=p_config->'payment_accounts',cash_enabled=coalesce((p_config->>'cash_enabled')::boolean,true),bank_details=left(coalesce(p_config->>'bank_details',''),2000),prebook_amount=(p_config->>'prebook_amount')::numeric,half_due_days=(p_config->>'half_due_days')::integer where id=true;
 return public.booking_custom_config();
end; $$;

create or replace function public.submit_package_booking(p_payload jsonb,p_options jsonb,p_expected_total numeric,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.booking_custom_settings;q jsonb;pkg jsonb;payload jsonb;result jsonb;total numeric;fee numeric;first_date date;due_date date;initial numeric;half numeric;proof jsonb;
begin
 select * into strict s from public.booking_custom_settings where id=true;
 if p_revision<>s.revision then raise exception 'Settings changed. Reload and review before submitting.'; end if;
 if p_options->>'mode'='mini' then
  if not coalesce((p_options->>'full_advance_terms')::boolean,false) then raise exception 'Accept the full-advance city photoshoot terms'; end if;
 elsif not coalesce((p_options->>'terms_advance')::boolean,false) or not coalesce((p_options->>'terms_half')::boolean,false) or not coalesce((p_options->>'terms_final')::boolean,false) then raise exception 'Accept all payment terms'; end if;
 if p_options->>'mode'='mini' then
  if jsonb_array_length(p_payload->'events')<>1 then raise exception 'City shoots cover one one-hour session'; end if;
  q:=public.booking_mini_quote(p_payload->'events'->0,p_options);
 elsif p_options->>'mode'='custom' then
  q:=public.booking_custom_quote(p_payload->'events',p_options);
 else
  select details into pkg from public.booking_package_catalog where id=p_options->>'package_id' and active;
  if pkg is null then raise exception 'Select an available package'; end if;
  q:=jsonb_build_object('total',(pkg->>'price')::numeric,'package',pkg,'revision',s.revision);
 end if;
 fee:=case when p_options->>'mode'='mini' then 0 when coalesce((p_options->>'allow_publish')::boolean,true) then 0 else 10000 end;
 total:=(q->>'total')::numeric+fee;
 if abs(total-p_expected_total)>0.001 then raise exception 'Price changed. Review the updated total.'; end if;
 select min((v->>'event_date')::date) into first_date from jsonb_array_elements(p_payload->'events') v;
 if first_date is null or first_date<(now() at time zone 'Asia/Dhaka')::date then raise exception 'Select a valid upcoming event date'; end if;
 due_date:=first_date-s.half_due_days;half:=round(total/2,2);
 initial:=least(total,greatest(2000,case when due_date<=(now() at time zone 'Asia/Dhaka')::date then half else s.prebook_amount end));
 if p_options->>'mode'='mini' then initial:=total;half:=total;due_date:=(now() at time zone 'Asia/Dhaka')::date; end if;
 payload:=p_payload||jsonb_build_object('package_name',case when p_options->>'mode'='mini' then 'City one-hour photoshoot' when pkg is null then 'Custom package - office verification required' else pkg->>'name' end,'package_amount',(q->>'total')::numeric,'client_extra_charge',fee,'discount',0,'advance_paid',0,'custom_quote',case when pkg is null then q else null end,'package_selection',pkg,'booking_options',(p_options-'payment_proof')||jsonb_build_object('booking_intent','confirm'),'payment_plan',jsonb_build_object('full_advance',p_options->>'mode'='mini','initial',initial,'half_total',half,'half_due_date',due_date,'event_date',first_date,'total',total,'policy_revision',s.revision),'client_notes',coalesce(p_payload->>'client_notes','')||case when p_options->>'mode'='mini' then E'\nCity one-hour photoshoot: full shoot and travel amount payable in advance. No additional 2000 pre-booking deposit. Publication permission must be obtained separately. Office verifies payment and availability.' else E'\nPayment terms accepted: pre-booking advance counts toward 50%; 50% due '||due_date::text||'; balance due on event day. All payments require office verification.' end);
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

