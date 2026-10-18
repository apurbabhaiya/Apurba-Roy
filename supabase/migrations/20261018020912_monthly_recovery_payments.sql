alter table public.delivery_recovery_policies
 add column monthly_recovery_fee numeric(12,2) check(monthly_recovery_fee>=0),
 add column recovery_start_days integer not null default 30 check(recovery_start_days between 1 and 3650),
 add column payment_accounts jsonb not null default '{}'::jsonb check(jsonb_typeof(payment_accounts)='object'),
 add column bank_details text not null default '' check(length(bank_details)<=1000);
alter table public.delivery_payment_submissions drop constraint delivery_payment_submissions_payment_type_check;
alter table public.delivery_payment_submissions add constraint delivery_payment_submissions_payment_type_check check(payment_type in ('PACKAGE','ACCESS','RECOVERY'));
alter table public.delivery_payment_submissions add column request_metadata jsonb not null default '{}'::jsonb;

alter function public.delivery_admin_save_recovery_policy(text,uuid,jsonb) rename to _delivery_admin_save_recovery_policy_v1;
revoke all on function public._delivery_admin_save_recovery_policy_v1(text,uuid,jsonb) from public,anon,authenticated;
create function public.delivery_admin_save_recovery_policy(p_token text,p_portal_id uuid,p_policy jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare accounts jsonb:=coalesce(p_policy->'payment_accounts','{}'::jsonb); v text;
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 if jsonb_typeof(accounts)<>'object' or length(accounts::text)>1500 then raise exception 'Invalid payment accounts'; end if;
 for v in select jsonb_object_keys(accounts) loop
  if v not in ('BKASH','NAGAD','ROCKET','DBBL') or jsonb_typeof(accounts->v)<>'string' or length(accounts->>v)>200 then raise exception 'Invalid payment account'; end if;
 end loop;
 perform public._delivery_admin_save_recovery_policy_v1(p_token,p_portal_id,p_policy);
 update public.delivery_recovery_policies set monthly_recovery_fee=nullif(p_policy->>'monthly_recovery_fee','')::numeric,recovery_start_days=coalesce((p_policy->>'recovery_start_days')::integer,30),payment_accounts=accounts,bank_details=coalesce(p_policy->>'bank_details',''),updated_at=now() where portal_id=p_portal_id;
 return true;
end $$;
revoke all on function public.delivery_admin_save_recovery_policy(text,uuid,jsonb) from public;
grant execute on function public.delivery_admin_save_recovery_policy(text,uuid,jsonb) to anon,authenticated;

create or replace function public.get_delivery_recovery_policy(p_portal_id uuid,p_client_token text default null,p_admin_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.delivery_portals; q public.delivery_recovery_policies; admin_ok boolean; periods integer:=0; age_days integer:=0; recovery_at timestamptz; quote numeric;
begin
 admin_ok:=coalesce(public._booking_admin_valid(p_admin_token),false);
 select * into p from public.delivery_portals where id=p_portal_id and deleted_at is null;
 if not found then return null; end if;
 if not admin_ok and not coalesce(p.is_published and (p.secure_token=p_client_token or (p.public_listed and p.preview_enabled)),false) then return null; end if;
 select * into q from public.delivery_recovery_policies where portal_id=p.id;
 if not found or (not admin_ok and not q.enabled) then return null; end if;
 recovery_at:=q.recovery_after; quote:=q.recovery_fee;
 if q.monthly_recovery_fee is not null then
  quote:=null;
  if p.final_delivery_at is not null then
   age_days:=greatest(0,floor(extract(epoch from (now()-p.final_delivery_at))/86400)::integer);
   recovery_at:=p.final_delivery_at+make_interval(days=>q.recovery_start_days);
   if now()>=recovery_at then periods:=1+floor(extract(epoch from(now()-recovery_at))/(30*86400))::integer;quote:=periods*q.monthly_recovery_fee;end if;
  end if;
 end if;
 return jsonb_build_object('enabled',q.enabled,'reopen_fee',q.reopen_fee,'recovery_fee',quote,'recovery_after',recovery_at,'reopen_hours',q.reopen_hours,'payment_method',q.payment_method,'payment_number',q.payment_number,'whatsapp_number',q.whatsapp_number,'expires_at',p.download_window_ends_at,'monthly_recovery_fee',q.monthly_recovery_fee,'recovery_start_days',q.recovery_start_days,'recovery_periods',periods,'delivery_age_days',age_days,'payment_accounts',q.payment_accounts,'bank_details',q.bank_details,'server_now',now());
end $$;

create function public.submit_delivery_recovery_payment(p_portal_id uuid,p_client_token text,p_method text,p_payer_phone text,p_transaction_id text,p_amount numeric,p_proof_path text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy jsonb; sid uuid; expected numeric; account text;
begin
 policy:=public.get_delivery_recovery_policy(p_portal_id,p_client_token,null);
 if policy is null then raise exception 'This delivery is not available'; end if;
 if policy->>'recovery_after' is null or now()<(policy->>'recovery_after')::timestamptz then raise exception 'Recovery payment is not due'; end if;
 expected:=(policy->>'recovery_fee')::numeric;
 if expected is null or expected<=0 or p_amount is null or p_amount<>expected then raise exception 'Recovery amount changed; refresh before paying'; end if;
 if p_method not in ('BKASH','NAGAD','ROCKET','DBBL') then raise exception 'Invalid payment method'; end if;
 account:=nullif(trim(policy->'payment_accounts'->>p_method),'');
 if account is null and p_method=(case when policy->>'payment_method'='BANK' then 'DBBL' else policy->>'payment_method' end) then account:=nullif(policy->>'payment_number','');end if;
 if account is null then raise exception 'This payment method is not configured';end if;
 if p_payer_phone is null or p_payer_phone !~ '^\+?[0-9]{7,15}$' or p_transaction_id is null or length(trim(p_transaction_id)) not between 3 and 100 then raise exception 'Valid payer number and transaction ID are required';end if;
 if p_proof_path is null or split_part(p_proof_path,'/',1)<>p_portal_id::text or not exists(select 1 from storage.objects where bucket_id='delivery-payment-proofs' and name=p_proof_path) then raise exception 'Payment screenshot is required';end if;
 if (select count(*) from public.delivery_payment_submissions where portal_id=p_portal_id and status='SUBMITTED' and payment_type='RECOVERY')>=3 then raise exception 'A recovery request is awaiting review; contact support';end if;
 insert into public.delivery_payment_submissions(portal_id,payment_type,payment_method,payer_phone,transaction_id,amount,proof_storage_path,request_metadata)
 values(p_portal_id,'RECOVERY',p_method,p_payer_phone,trim(p_transaction_id),expected,p_proof_path,jsonb_build_object('recovery_periods',policy->'recovery_periods','monthly_recovery_fee',policy->'monthly_recovery_fee','reopen_hours',policy->'reopen_hours','quoted_at',now(),'payment_account',account)) returning id into sid;
 return jsonb_build_object('success',true,'id',sid,'status','SUBMITTED');
end $$;
revoke all on function public.submit_delivery_recovery_payment(uuid,text,text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.submit_delivery_recovery_payment(uuid,text,text,text,text,numeric,text) to service_role;

alter function public.delivery_admin_review_payment(text,uuid,text) rename to _delivery_admin_review_payment_before_recovery;
revoke all on function public._delivery_admin_review_payment_before_recovery(text,uuid,text) from public,anon,authenticated;
create function public.delivery_admin_review_payment(p_token text,p_submission_id uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.delivery_payment_submissions;
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 select * into s from public.delivery_payment_submissions where id=p_submission_id for update;
 if not found then raise exception 'Payment not found';end if;
 if s.payment_type<>'RECOVERY' then return public._delivery_admin_review_payment_before_recovery(p_token,p_submission_id,p_decision);end if;
 if s.status<>'SUBMITTED' then raise exception 'Payment already reviewed';end if;
 if upper(coalesce(p_decision,'')) not in ('VERIFY','REJECT') then raise exception 'Invalid decision';end if;
 update public.delivery_payment_submissions set status=case when upper(p_decision)='VERIFY' then 'VERIFIED' else 'REJECTED' end,verified_at=now() where id=s.id;
 insert into public.delivery_audit_logs(portal_id,submission_id,action,details) values(s.portal_id,s.id,case when upper(p_decision)='VERIFY' then 'RECOVERY_PAYMENT_VERIFIED' else 'RECOVERY_PAYMENT_REJECTED' end,jsonb_build_object('amount',s.amount,'access_renewal','manual','quote',s.request_metadata));
 return jsonb_build_object('success',true,'status',case when upper(p_decision)='VERIFY' then 'VERIFIED' else 'REJECTED' end,'access_renewal','manual');
end $$;
revoke all on function public.delivery_admin_review_payment(text,uuid,text) from public;
grant execute on function public.delivery_admin_review_payment(text,uuid,text) to anon,authenticated;

-- Apply the owner's requested policy to current deliveries; no payment or access changes.
insert into public.delivery_recovery_policies(portal_id,enabled,reopen_fee,recovery_fee,reopen_hours,payment_method,payment_number,whatsapp_number,monthly_recovery_fee,recovery_start_days,payment_accounts)
select id,true,null,null,48,'BKASH','01776044951','8801776044951',5000,30,'{"BKASH":"01776044951"}'::jsonb from public.delivery_portals where deleted_at is null
on conflict(portal_id) do update set enabled=true,monthly_recovery_fee=5000,recovery_start_days=30,payment_method='BKASH',payment_number='01776044951',whatsapp_number='8801776044951',payment_accounts=public.delivery_recovery_policies.payment_accounts||'{"BKASH":"01776044951"}'::jsonb,updated_at=now();
