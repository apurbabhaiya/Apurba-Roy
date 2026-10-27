-- Exercises the real RPC as anon with a transaction-only synthetic admin session.
-- ROLLBACK removes all fixtures, payments, audit records and the test session.
begin;
do $$ declare t text := encode(extensions.gen_random_bytes(32),'hex'); begin
  insert into public.booking_admin_sessions(token_hash,expires_at) values(encode(extensions.digest(t,'sha256'),'hex'),now()+interval '5 minutes');
  perform set_config('test.manual_delivery_token',t,true);
end $$;
set local role anon;
do $$
declare
  t text := current_setting('test.manual_delivery_token');
  i uuid := gen_random_uuid();
  j uuid := gen_random_uuid();
  p jsonb;
  r jsonb;
  row_data jsonb;
  matched integer;
begin
  p:=jsonb_build_object('request_id',i,'client_name','Manual RPC test','phone','০১৭১২৩৪৫৬৭৮','event_date','2025-01-01','event_name','Historical event','total',250,'paid',100,'delivered',false);
  begin
    perform public.delivery_admin_create_manual_client('invalid-test-token',p);
    raise exception 'FAIL: invalid session accepted';
  exception when others then if sqlerrm not like 'Admin session expired%' then raise; end if; end;
  r:=public.delivery_admin_create_manual_client(t,p);
  if (r->>'remaining_due')::numeric<>150 then raise exception 'FAIL: opening balance'; end if;
  perform public.delivery_admin_create_manual_client(t,p);
  select count(*) into matched from jsonb_array_elements(public.delivery_admin_dashboard(t)->'portals') x where x->>'id'=i::text;
  if matched<>1 then raise exception 'FAIL: idempotent retry'; end if;
  select x into row_data from jsonb_array_elements(public.delivery_admin_dashboard(t)->'portals') x where x->>'id'=i::text;
  if row_data->>'client_phone'<>'01712345678' or row_data->>'delivery_status'<>'READY' or (row_data->>'is_published')::boolean or row_data->>'booking_id' is not null then raise exception 'FAIL: manual client defaults'; end if;
  perform public.delivery_admin_add_payment(t,i,'2026-10-27','CASH',50,null,'Test only','VERIFIED');
  select x into row_data from jsonb_array_elements(public.delivery_admin_dashboard(t)->'portals') x where x->>'id'=i::text;
  if (row_data->>'total_paid')::numeric<>150 or (row_data->>'remaining_due')::numeric<>100 then raise exception 'FAIL: opening amount counted twice'; end if;
  begin
    perform public.delivery_admin_create_manual_client(t,p||jsonb_build_object('request_id',j,'paid',251));
    raise exception 'FAIL: overpayment accepted';
  exception when others then if sqlerrm not like 'Enter valid amounts%' then raise; end if; end;
  begin
    perform public.delivery_admin_create_manual_client(t,p||jsonb_build_object('request_id',j,'delivered',true));
    raise exception 'FAIL: unpaid full delivery accepted';
  exception when others then if sqlerrm not like 'Clear the remaining bill%' then raise; end if; end;
  perform public.delivery_admin_create_manual_client(t,p||jsonb_build_object('request_id',j,'paid',250,'delivered',true));
  select x into row_data from jsonb_array_elements(public.delivery_admin_dashboard(t)->'portals') x where x->>'id'=j::text;
  if row_data->>'delivery_status'<>'FINAL_DELIVERED' or row_data->>'payment_status'<>'FULLY_PAID' or (row_data->>'remaining_due')::numeric<>0 or (row_data->>'is_published')::boolean or (row_data->>'late_fee_enabled')::boolean or row_data->>'final_delivery_at' is null then raise exception 'FAIL: completed delivery'; end if;
  perform public.delivery_admin_add_payment(t,i,'2026-10-27','CASH',100,null,'Test remaining bill','VERIFIED');
  select x into row_data from jsonb_array_elements(public.delivery_admin_dashboard(t)->'portals') x where x->>'id'=i::text;
  if row_data->>'payment_status'<>'FULLY_PAID' or row_data->>'delivery_status'<>'READY' or row_data->>'final_delivery_at' is not null then raise exception 'FAIL: full payment incorrectly marked manual delivery completed'; end if;
  perform public.delivery_admin_activate_final_delivery(t,i);
  select x into row_data from jsonb_array_elements(public.delivery_admin_dashboard(t)->'portals') x where x->>'id'=i::text;
  if row_data->>'delivery_status'<>'FINAL_DELIVERED' then raise exception 'FAIL: explicit activation'; end if;
  begin
    perform public.delivery_admin_create_manual_client(t,p||jsonb_build_object('paid',101));
    raise exception 'FAIL: changed retry accepted';
  exception when others then if sqlerrm not like 'This form was already saved%' then raise; end if; end;
end $$;
reset role;
rollback;
select 'PASS: auth, anon RPC, partial and full balances, no duplicate, later payment, invalid amounts and draft defaults; fixtures rolled back' as verification;
