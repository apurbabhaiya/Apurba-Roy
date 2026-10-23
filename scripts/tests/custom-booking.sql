-- Run against the configured project. All test records and setting changes roll back.
begin;
do $$
declare events jsonb;opts jsonb;q jsonb;r jsonb;b uuid;request uuid;token text:=gen_random_uuid()::text;cfg jsonb;failed boolean;
begin
 assert jsonb_array_length(public.booking_package_catalog_list())=18,'Catalog must contain all published packages';
 events:='[{"event_name":"হলুদ","event_date":"2099-11-01","start_time":"16:00","end_time":"20:00","photographers":1,"cinematographers":0,"drone":false,"special_photos":50}]';
 opts:='{"city":"ময়মনসিংহ","travel":{}}';
 q:=public.booking_custom_quote(events,opts);assert (q->>'total')::numeric=5200,'Coverage + editing + travel';
 q:=public.booking_custom_quote(events||events,opts);assert (q->>'travel')::numeric=200,'Same day travel must not duplicate';
 q:=public.booking_custom_quote('[{"event_name":"Wedding","event_date":"2099-11-01","start_time":"22:00","end_date":"2099-11-02","end_time":"02:00","photographers":1,"cinematographers":0}]',opts);assert (q->>'total')::numeric=4400,'Overnight travel';
 failed:=false;begin perform public.booking_custom_quote(events,'{"city":"not allowed"}');exception when others then failed:=true;end;assert failed,'Unapproved city rejected';
 failed:=false;begin perform public.booking_custom_save_config('invalid','{}',1);exception when others then failed:=true;end;assert failed,'Rates require admin';
 assert not has_table_privilege('anon','public.booking_custom_settings','UPDATE'),'No direct settings writes';
 assert not has_table_privilege('anon','public.booking_payment_requests','SELECT'),'No public payment reads';
 insert into public.booking_admin_sessions(token_hash,expires_at) values(encode(extensions.digest(token,'sha256'),'hex'),now()+interval '1 minute');
 cfg:=public.booking_custom_config();cfg:=cfg||'{"payment_accounts":{"BKASH":"TEST_ONLY_NOT_A_REAL_ACCOUNT"}}';
 cfg:=public.booking_custom_save_config(token,cfg,(cfg->>'revision')::integer);
 opts:='{"mode":"fixed","package_id":"regular-basic","allow_publish":true,"terms_advance":true,"terms_half":true,"terms_final":true,"payment_proof":{"amount":2000,"method":"BKASH","transaction_id":"TEST_ROLLBACK_ONLY","payer_phone":"TEST"}}';
 r:=public.submit_package_booking(jsonb_build_object('client_name','TEST ROLLBACK','phone','00000000000','events',events,'signature_data',repeat('x',50),'signature_name','TEST','consent',true,'advance_paid',99999,'discount',99999,'package_amount',1),opts,15000,(cfg->>'revision')::integer);
 b:=(r->>'id')::uuid;assert (r->'payment_plan'->>'initial')::numeric=2000,'Long-term advance';assert (r->'payment_plan'->>'half_total')::numeric=7500,'50% includes initial';
 assert (select package_amount=15000 and advance_paid=0 and discount=0 from public.booking_clients where id=b),'Server overwrites client prices';
 assert (select count(*)=0 from public.booking_payments where booking_id=b),'Pending proof is not paid';
 select id into request from public.booking_payment_requests where booking_id=b;
 perform public.booking_admin_review_payment(token,request,true);
 assert (select sum(amount)=2000 from public.booking_payments where booking_id=b),'Approval records exactly one deposit';
 failed:=false;begin perform public.booking_admin_review_payment(token,request,true);exception when others then failed:=true;end;assert failed,'Cannot approve twice';
 failed:=false;begin perform public.submit_package_booking(jsonb_build_object('events',events),opts,1,(cfg->>'revision')::integer);exception when others then failed:=true;end;assert failed,'Tampered price rejected';
 failed:=false;begin perform public.submit_package_booking(jsonb_build_object('events',events),opts||'{"terms_half":false}',15000,(cfg->>'revision')::integer);exception when others then failed:=true;end;assert failed,'Payment terms required';

 opts:=opts||'{"payment_method":"CASH","payment_proof":null}';
 r:=public.submit_package_booking(jsonb_build_object('client_name','TEST CASH PLAN','phone','00000000000','events',events,'signature_data',repeat('x',50),'signature_name','TEST','consent',true),opts,15000,(cfg->>'revision')::integer);
 b:=(r->>'id')::uuid;
 assert (select count(*)=0 from public.booking_payment_requests where booking_id=b),'Cash intent is not a payment';
 assert (select advance_paid=0 from public.booking_clients where id=b),'Cash intent is not paid';
 opts:=opts||'{"payment_proof":{"method":"CASH","amount":2000}}';
 r:=public.submit_package_booking(jsonb_build_object('client_name','TEST CASH RECEIPT','phone','00000000000','events',events,'signature_data',repeat('x',50),'signature_name','TEST','consent',true),opts,15000,(cfg->>'revision')::integer);
 b:=(r->>'id')::uuid;
 select id into request from public.booking_payment_requests where booking_id=b and method='CASH';
 assert request is not null,'Cash accepts no client transaction ID';
 assert (select count(*)=0 from public.booking_payments where booking_id=b),'Cash claim awaits verification';
 perform public.booking_admin_review_payment(token,request,true);
 assert (select sum(amount)=2000 from public.booking_payments where booking_id=b and method='CASH'),'Verified cash records one deposit';
 cfg:=public.booking_custom_save_config(token,cfg||'{"cash_enabled":false}',(cfg->>'revision')::integer);
 failed:=false;begin perform public.submit_package_booking(jsonb_build_object('events',events),opts,15000,(cfg->>'revision')::integer);exception when others then failed:=true;end;assert failed,'Admin can disable cash';
end $$;
rollback;
