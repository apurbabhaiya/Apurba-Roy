alter table public.booking_custom_settings add column allowed_cities text[] not null default array['ময়মনসিংহ'], add column payment_accounts jsonb not null default '{}', add column bank_details text not null default '',add column prebook_amount numeric(12,2) not null default 2000 check(prebook_amount>0),add column half_due_days integer not null default 60 check(half_due_days in (30,60));
create table public.booking_package_catalog (id text primary key,details jsonb not null,active boolean not null default true);
alter table public.booking_package_catalog enable row level security;
revoke all on public.booking_package_catalog from anon,authenticated;
insert into public.booking_package_catalog(id,details) values('regular-basic','{"tier":"Essential","name":"Regular Basic","price":15000,"coverage":"4 hours coverage","crew":["1 Photographer","1 Cinematographer","Drone operator not included"],"deliverables":["All usable edited photos","1 Reel","1 Full Video","1 Trailer"],"physical":["Photobook not included","Pendrive not included"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('regular-standard','{"tier":"Best Value","name":"Regular Standard","price":23000,"badge":"Most Popular","coverage":"6 hours coverage","crew":["2 Photographers","1 Cinematographer","Drone operator not included"],"deliverables":["All usable edited photos","1 Reel","1 Full Video","1 Trailer"],"physical":["Photobook not included","Pendrive not included"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('regular-storytelling','{"tier":"Signature","name":"Regular Storytelling","price":55000,"coverage":"6 hours coverage","crew":["1 Candid Photographer","1 Senior Photographer","2 Cinematographers"],"deliverables":["All usable edited photos","1 Reel","1 Full Video","1 Trailer"],"physical":["Premium album options available","Pendrive available"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('outdoor-essentials','{"tier":"Budget / Essential","name":"Outdoor Essentials","price":13000,"coverage":"2–4 hours outdoor coverage","crew":["1 Photographer","1 Senior Cinematographer","Drone operator not included"],"deliverables":["Approx. 100 selected edited photos","1 Trailer"],"physical":["Photobook not included","Pendrive not included"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('outdoor-cinematic','{"tier":"Best Value","name":"Outdoor Cinematic","price":23000,"badge":"Most Popular","coverage":"4–6 hours outdoor coverage","crew":["1 Senior Photographer","1 Senior Cinematographer","1 Drone Operator"],"deliverables":["All usable edited photos","1 Full Video","1 Trailer"],"physical":["Photobook not included","Pendrive not included"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('outdoor-signature','{"tier":"Premium / Signature","name":"Outdoor Signature","price":47000,"coverage":"6–8 hours outdoor coverage","crew":["1 Candid Photographer","1 Senior Photographer","1 Senior Cinematographer","1 Drone Operator"],"deliverables":["All usable edited photos","1 Reel","1 Full Video","1 Trailer"],"physical":["Exclusive photobook available","Pendrive available"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-both-side-signature','{"tier":"Signature","name":"Sonaton Both Side Signature","price":124000,"coverage":"Bride + groom side traditional wedding coverage","crew":["1 Photographer + 1 Cinematographer on each side"],"deliverables":["Pre-Wedding","Holud for Bride","Holud for Groom","Bride & Groom side rituals","Reception"],"physical":["Standard Photobook","Pendrive"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-both-side-prestige','{"tier":"Prestige","name":"Sonaton Both Side Prestige","price":184000,"badge":"Most Popular","coverage":"Extended both-side multi-event coverage","crew":["2 Photographers","1 Cinematographer","1 Drone Operator on each side where applicable"],"deliverables":["Pre-Wedding","Holud for Bride","Holud for Groom","Bride & Groom side rituals","Reception"],"physical":["Standard Photobook","Pendrive"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-both-side-storytelling','{"tier":"Storytelling","name":"Sonaton Both Side Storytelling","price":339000,"coverage":"Complete both-side wedding storytelling","crew":["2 Photographers","1–2 Cinematographers","1 Drone Operator on each side where applicable"],"deliverables":["Engagement","Pre-Wedding","Mehendi","Colour Fest","Holud for Bride","Holud for Groom","Bride & Groom side rituals","Reception","Post-Wedding"],"physical":["Premium Photobook","Pendrive"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-bride-side-signature','{"tier":"Signature","name":"Sonaton Bride Side Signature","price":44000,"coverage":"Bride-side focused traditional wedding coverage","crew":["1 Photographer","1 Cinematographer"],"deliverables":["Holud for Bride","Bride-side rituals","Wedding Night / Bidaay"],"physical":["Photobook not included","Pendrive not included"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-bride-side-prestige','{"tier":"Prestige","name":"Sonaton Bride Side Prestige","price":89000,"badge":"Most Popular","coverage":"Extended bride-side multi-event coverage","crew":["2 Photographers","1 Cinematographer","1 Drone Operator"],"deliverables":["Holud for Bride","Bride-side rituals","Wedding Night / Bidaay"],"physical":["Standard Photobook","Pendrive"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-bride-side-storytelling','{"tier":"Storytelling","name":"Sonaton Bride Side Storytelling","price":219000,"coverage":"Complete bride-side storytelling coverage","crew":["2 Photographers","1–2 Cinematographers","1 Drone Operator"],"deliverables":["Pre-Wedding","Mehendi","Colour Fest","Holud for Bride","Bride-side rituals","Wedding Night / Bidaay"],"physical":["Exclusive Photobook","Pendrive"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-groom-side-signature','{"tier":"Signature","name":"Sonaton Groom Side Signature","price":63000,"coverage":"Groom-side focused traditional wedding coverage","crew":["1 Photographer","1 Cinematographer"],"deliverables":["Holud for Groom","Groom-side rituals","Reception / Vat Kapor"],"physical":["Photobook not included","Pendrive not included"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-groom-side-prestige','{"tier":"Prestige","name":"Sonaton Groom Side Prestige","price":134000,"badge":"Most Popular","coverage":"Extended groom-side multi-event coverage","crew":["2 Photographers","1 Cinematographer","1 Drone Operator"],"deliverables":["Holud for Groom","Groom-side rituals","Reception / Vat Kapor"],"physical":["Standard Photobook","Pendrive"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-groom-side-storytelling','{"tier":"Storytelling","name":"Sonaton Groom Side Storytelling","price":209000,"coverage":"Complete groom-side storytelling coverage","crew":["2 Photographers","2 Cinematographers","1 Drone Operator"],"deliverables":["Pre-Wedding","Holud for Groom","Groom-side rituals","Reception / Vat Kapor"],"physical":["Exclusive Photobook","Pendrive"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-wedding-day-signature','{"tier":"Signature","name":"Sonaton Wedding Day Signature","price":34000,"coverage":"Wedding-day focused ceremonial coverage","crew":["1 Photographer","1 Cinematographer"],"deliverables":["Odhivash Outdoor","Home Rituals","Wedding Night"],"physical":["Photobook not included","Pendrive not included"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-wedding-day-prestige','{"tier":"Prestige","name":"Sonaton Wedding Day Prestige","price":55000,"badge":"Most Popular","coverage":"Extended wedding-day coverage","crew":["2 Photographers","1 Cinematographer","1 Drone Operator"],"deliverables":["Odhivash Outdoor","Home Rituals","Wedding Night"],"physical":["Standard Photobook","Pendrive"]}'::jsonb);
insert into public.booking_package_catalog(id,details) values('sonaton-wedding-day-storytelling','{"tier":"Storytelling","name":"Sonaton Wedding Day Storytelling","price":109000,"coverage":"Premium wedding-day storytelling coverage","crew":["2 Photographers","2 Cinematographers","1 Drone Operator"],"deliverables":["Pre-Wedding","Odhivash Outdoor","Home Rituals","Wedding Night"],"physical":["Exclusive Photobook","Pendrive"]}'::jsonb);
create function public.booking_package_catalog_list() returns jsonb language sql security definer set search_path='' as $$ select coalesce(jsonb_agg(details||jsonb_build_object('id',id) order by (details->>'price')::numeric),'[]') from public.booking_package_catalog where active; $$;
revoke all on function public.booking_package_catalog_list() from public;
grant execute on function public.booking_package_catalog_list() to anon,authenticated;

alter function public.booking_custom_save_config(text,jsonb,integer) rename to booking_custom_save_config_base;
revoke all on function public.booking_custom_save_config_base(text,jsonb,integer) from public,anon,authenticated;
create function public.booking_custom_save_config(p_token text,p_config jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.booking_custom_save_config_base(p_token,p_config,p_revision);
 if jsonb_typeof(p_config->'allowed_cities') is distinct from 'array' or jsonb_array_length(p_config->'allowed_cities')>100 then raise exception 'Set allowed cities'; end if;
 if jsonb_typeof(p_config->'payment_accounts') is distinct from 'object' then raise exception 'Invalid payment accounts'; end if;
 if exists(select 1 from jsonb_each_text(p_config->'payment_accounts') where key not in ('BKASH','NAGAD','ROCKET','BANK') or length(value)>200) then raise exception 'Invalid payment account'; end if;
 update public.booking_custom_settings set allowed_cities=array(select trim(value) from jsonb_array_elements_text(p_config->'allowed_cities') where trim(value)<>''),payment_accounts=p_config->'payment_accounts',bank_details=left(coalesce(p_config->>'bank_details',''),2000),prebook_amount=(p_config->>'prebook_amount')::numeric,half_due_days=(p_config->>'half_due_days')::integer where id=true;
 return public.booking_custom_config();
end; $$;
revoke all on function public.booking_custom_save_config(text,jsonb,integer) from public;
grant execute on function public.booking_custom_save_config(text,jsonb,integer) to anon,authenticated;

alter function public.booking_custom_quote(jsonb,jsonb) rename to booking_custom_quote_base;
revoke all on function public.booking_custom_quote_base(jsonb,jsonb) from public,anon,authenticated;
create function public.booking_custom_quote(p_events jsonb,p_options jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare q jsonb;s public.booking_custom_settings;
begin
 select * into strict s from public.booking_custom_settings where id=true;
 if not coalesce(p_options->>'city','')=any(s.allowed_cities) then raise exception 'Select an admin-approved city for the custom package'; end if;
 q:=public.booking_custom_quote_base(p_events,p_options);
 return q||jsonb_build_object('city',p_options->>'city');
end; $$;
revoke all on function public.booking_custom_quote(jsonb,jsonb) from public;
grant execute on function public.booking_custom_quote(jsonb,jsonb) to anon,authenticated;

create table public.booking_payment_requests (
 id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.booking_clients(id),amount numeric(12,2) not null check(amount>0),method text not null check(method in ('BKASH','NAGAD','ROCKET','BANK')),transaction_id text not null check(length(transaction_id) between 4 and 100),payer_phone text not null default '',status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now(),reviewed_at timestamptz,payment_id uuid references public.booking_payments(id),unique(method,transaction_id)
);
alter table public.booking_payment_requests enable row level security;
revoke all on public.booking_payment_requests from anon,authenticated;

create function public.submit_package_booking(p_payload jsonb,p_options jsonb,p_expected_total numeric,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
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
 result:=public.submit_client_booking(payload);
 proof:=p_options->'payment_proof';
 if proof is not null and proof<>'null'::jsonb then
  if nullif(trim(s.payment_accounts->>(proof->>'method')),'') is null then raise exception 'Payment method is not configured'; end if;
  if coalesce((proof->>'amount')::numeric,0)<initial or (proof->>'amount')::numeric>total then raise exception 'Check the payment amount against the payment plan'; end if;
  insert into public.booking_payment_requests(booking_id,amount,method,transaction_id,payer_phone) values((result->>'id')::uuid,(proof->>'amount')::numeric,proof->>'method',upper(trim(proof->>'transaction_id')),left(coalesce(proof->>'payer_phone',''),30));
 end if;
 return result||jsonb_build_object('payment_plan',payload->'payment_plan','quote',q);
end; $$;
revoke all on function public.submit_package_booking(jsonb,jsonb,numeric,integer) from public;
grant execute on function public.submit_package_booking(jsonb,jsonb,numeric,integer) to anon,authenticated;

create function public.booking_admin_payment_requests(p_token text,p_booking_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]') from public.booking_payment_requests r where booking_id=p_booking_id);
end; $$;
create function public.booking_admin_review_payment(p_token text,p_request_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.booking_payment_requests;pid uuid;
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 select * into strict r from public.booking_payment_requests where id=p_request_id for update;
 if r.status<>'pending' then raise exception 'This payment was already reviewed'; end if;
 if p_approve then
  if not exists(select 1 from public.booking_clients where id=r.booking_id and deleted_at is null) then raise exception 'Restore the booking before approving payment'; end if;
  insert into public.booking_payments(booking_id,amount,paid_on,method,note) values(r.booking_id,r.amount,(now() at time zone 'Asia/Dhaka')::date,r.method,'Verified transaction: '||r.transaction_id) returning id into pid;
 end if;
 update public.booking_payment_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_at=now(),payment_id=pid where id=r.id;
end; $$;
revoke all on function public.booking_admin_payment_requests(text,uuid),public.booking_admin_review_payment(text,uuid,boolean) from public;
grant execute on function public.booking_admin_payment_requests(text,uuid),public.booking_admin_review_payment(text,uuid,boolean) to anon,authenticated;
