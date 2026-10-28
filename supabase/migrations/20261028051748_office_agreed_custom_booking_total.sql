CREATE OR REPLACE FUNCTION public.submit_package_booking(p_payload jsonb, p_options jsonb, p_expected_total numeric, p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.booking_custom_settings;q jsonb;pkg jsonb;payload jsonb;result jsonb;total numeric;fee numeric;first_date date;due_date date;initial numeric;half numeric;proof jsonb;discount_amount numeric:=0;discount_percent numeric:=0;reported_team_paid numeric:=0;required_now numeric:=0;payment_calculation_mode text;pricing_mode text;custom_total numeric:=0;
begin
 select * into strict s from public.booking_custom_settings where id=true;
 if p_revision<>s.revision then raise exception 'Settings changed. Reload and review before submitting.'; end if;
 if p_options->>'mode'='mini' then
  if not coalesce((p_options->>'city_deposit_terms')::boolean,false) then raise exception 'Accept the city deposit and event-day balance terms'; end if;
 elsif not coalesce((p_options->>'terms_advance')::boolean,false) or not coalesce((p_options->>'terms_half')::boolean,false) or not coalesce((p_options->>'terms_final')::boolean,false) then raise exception 'Accept all payment terms'; end if;
 pricing_mode:=coalesce(p_options->>'pricing_mode','automatic');
 if pricing_mode not in ('automatic','office_custom') then raise exception 'Invalid pricing mode'; end if;
 if pricing_mode='office_custom' then
  if p_options->>'mode'='mini' then raise exception 'Custom budget is not available for city shoots'; end if;
  custom_total:=nullif(p_options->>'agreed_total','')::numeric;
  if custom_total is null or custom_total<=0 or custom_total>10000000 then raise exception 'Enter a valid office-agreed total'; end if;
  q:=jsonb_build_object('total',custom_total,'pricing_basis','office_agreed','revision',s.revision);
 elsif p_options->>'mode'='mini' then
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
 initial:=least(total,s.prebook_amount);
 if p_options->>'mode'='mini' then initial:=(q->>'initial')::numeric;half:=initial;due_date:=first_date; end if;
 payment_calculation_mode:=coalesce(p_options->>'payment_calculation_mode','standard');
 if p_options->>'mode'='mini' then payment_calculation_mode:='standard'; end if;
 if payment_calculation_mode not in ('standard','team') then raise exception 'Invalid payment calculation mode'; end if;
 if payment_calculation_mode='team' then reported_team_paid:=least(total,greatest(0,coalesce((p_options->>'prior_team_paid')::numeric,0))); end if;
 required_now:=case when payment_calculation_mode='team' then greatest(0,half-reported_team_paid) else initial end;
 payload:=p_payload||jsonb_build_object('package_name',case when p_options->>'mode'='mini' then 'City hourly photoshoot' when pricing_mode='office_custom' then 'Office-agreed custom budget - office verification required' when pkg is null then 'Custom package - office verification required' else pkg->>'name' end,'package_amount',(q->>'total')::numeric,'client_extra_charge',fee,'discount',discount_amount,'advance_paid',0,'custom_quote',case when pkg is null then q else null end,'package_selection',case when pkg is null then null else pkg||jsonb_build_object('discount_percent',discount_percent,'discount_amount',discount_amount,'gross_total',(q->>'total')::numeric,'net_total',(q->>'net_total')::numeric) end,'booking_options',(p_options-'payment_proof')||jsonb_build_object('booking_intent','confirm'),'payment_plan',jsonb_build_object('city_deposit',p_options->>'mode'='mini','full_advance',false,'initial',initial,'half_total',half,'half_due_date',due_date,'event_date',first_date,'total',total,'policy_revision',s.revision),'client_notes',coalesce(p_payload->>'client_notes','')||case when p_options->>'mode'='mini' then E'\nCity hourly photoshoot: city-specific pre-booking deposit due now; remaining shoot, editing and travel balance due on shoot day. Publication permission must be obtained separately. Office verifies payment and availability.' else E'\nPayment terms accepted: pre-booking advance counts toward 50%; 50% due '||due_date::text||'; balance due on event day. All payments require office verification.'  end||case when reported_team_paid>0 then E'\nClient-reported prior payment to team (unverified): ৳'||reported_team_paid::text else '' end);
 if p_options->>'payment_method'='CASH' and not s.cash_enabled then raise exception 'Cash payments are disabled'; end if;
 result:=public.submit_client_booking(payload);
 proof:=p_options->'payment_proof';
 if (proof is null or proof='null'::jsonb) and required_now>0 then raise exception 'An advance payment and reference are required for confirmed booking requests'; end if;
 if proof is not null and proof<>'null'::jsonb then
  if length(trim(coalesce(proof->>'transaction_id','')))<4 then raise exception 'Enter a transaction ID or cash office receipt number'; end if;
  if coalesce(p_options->>'payment_method',proof->>'method') is distinct from proof->>'method' then raise exception 'Payment method does not match the receipt'; end if;
 end if;
 if p_options->>'mode'='mini' and (proof->>'amount')::numeric<>initial then raise exception 'Pay exactly the displayed city pre-booking deposit'; end if;
 if proof is not null and proof<>'null'::jsonb then
  if proof->>'method'='CASH' then
   if not s.cash_enabled then raise exception 'Cash payments are disabled'; end if;
  elsif nullif(trim(s.payment_accounts->>(proof->>'method')),'') is null then raise exception 'Payment method is not configured'; end if;
  if coalesce((proof->>'amount')::numeric,0)<required_now or (proof->>'amount')::numeric>total then raise exception 'Check the payment amount against the payment plan'; end if;
  insert into public.booking_payment_requests(booking_id,amount,method,transaction_id,payer_phone) values((result->>'id')::uuid,(proof->>'amount')::numeric,proof->>'method',upper(trim(proof->>'transaction_id')),left(coalesce(proof->>'payer_phone',''),30));
 end if;
 return result||jsonb_build_object('payment_plan',payload->'payment_plan','quote',q);
end; $function$
