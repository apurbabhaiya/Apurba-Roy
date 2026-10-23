create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create table public.booking_push_settings(id boolean primary key default true check(id),public_key text,private_key text,dispatch_secret text not null default encode(extensions.gen_random_bytes(32),'hex'));
insert into public.booking_push_settings(id) values(true);
create table public.booking_push_devices(id uuid primary key default gen_random_uuid(),endpoint text unique not null,subscription jsonb not null,active boolean not null default true,updated_at timestamptz not null default now());
create table public.booking_push_jobs(id uuid primary key default gen_random_uuid(),device_id uuid not null references public.booking_push_devices(id) on delete cascade,payload jsonb not null,created_at timestamptz not null default now(),attempts integer not null default 0,locked_until timestamptz,delivered_at timestamptz,last_status integer);
create index booking_push_pending on public.booking_push_jobs(created_at) where delivered_at is null and attempts<5;
alter table public.booking_push_settings enable row level security;
alter table public.booking_push_devices enable row level security;
alter table public.booking_push_jobs enable row level security;
revoke all on public.booking_push_settings,public.booking_push_devices,public.booking_push_jobs from public,anon,authenticated;
grant all on public.booking_push_settings,public.booking_push_devices,public.booking_push_jobs to service_role;
create function public.booking_admin_push(p_token text,p_action text,p_subscription jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare ep text:=p_subscription->>'endpoint';device uuid;is_active boolean;
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 if p_action='authorize' then return '{"authorized":true}'::jsonb; end if;
 if p_action='status' then
 select active into is_active from public.booking_push_devices where endpoint=ep;
 return jsonb_build_object('active',coalesce(is_active,false));
 end if;
 if p_action='subscribe' then
 if ep is null or length(ep)>4096 or ep !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/' or length(coalesce(p_subscription->'keys'->>'p256dh','')) not between 60 and 200 or length(coalesce(p_subscription->'keys'->>'auth','')) not between 16 and 100 then raise exception 'Invalid push subscription'; end if;
 insert into public.booking_push_devices(endpoint,subscription) values(ep,p_subscription) on conflict(endpoint) do update set subscription=excluded.subscription,active=true,updated_at=now() returning id into device;
 return jsonb_build_object('active',true);
 elsif p_action='unsubscribe' then
 update public.booking_push_devices set active=false,updated_at=now() where endpoint=ep;
 return '{"active":false}'::jsonb;
 elsif p_action='test' then
 select id into device from public.booking_push_devices where endpoint=ep and active;
 if device is null then raise exception 'Enable notifications on this device first'; end if;
 if exists(select 1 from public.booking_push_jobs where device_id=device and created_at>now()-interval '30 seconds' and payload->>'tag'='booking-test') then raise exception 'Wait 30 seconds before testing again'; end if;
 insert into public.booking_push_jobs(device_id,payload) values(device,'{"title":"রম্যছবি · পরীক্ষা","body":"এই ফোনে নোটিফিকেশন সংযোগ কাজ করছে।","url":"/booking/admin","tag":"booking-test"}');
 return '{"queued":true}'::jsonb;
 end if;
 raise exception 'Invalid action';
end $$;
revoke all on function public.booking_admin_push(text,text,jsonb) from public;
grant execute on function public.booking_admin_push(text,text,jsonb) to anon,authenticated,service_role;
create function public.booking_push_enqueue() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.booking_push_jobs(device_id,payload) select id,jsonb_build_object('title','রম্যছবি · নতুন আবেদন','body',case when tg_table_name='booking_discussions' then 'নতুন আলোচনার অনুরোধ এসেছে। অ্যাডমিন প্যানেলে দেখুন।' else 'নতুন বুকিং আবেদন এসেছে। অ্যাডমিন প্যানেলে দেখুন।' end,'url','/booking/admin','tag',tg_table_name||':'||new.id::text) from public.booking_push_devices where active;
 return new;
end $$;
revoke all on function public.booking_push_enqueue() from public,anon,authenticated;
create trigger booking_push_new_client after insert on public.booking_clients for each row execute function public.booking_push_enqueue();
create trigger booking_push_new_discussion after insert on public.booking_discussions for each row execute function public.booking_push_enqueue();
create function public.booking_push_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with picked as (select j.id from public.booking_push_jobs j join public.booking_push_devices d on d.id=j.device_id where j.delivered_at is null and j.attempts<5 and (j.locked_until is null or j.locked_until<now()) and d.active order by j.created_at limit 100 for update of j skip locked),claimed as(update public.booking_push_jobs j set attempts=j.attempts+1,locked_until=now()+interval '2 minutes' from picked p where j.id=p.id returning j.*)
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('subscription',d.subscription)),'[]'::jsonb) into result from claimed c join public.booking_push_devices d on d.id=c.device_id;
 return result;
end $$;
revoke all on function public.booking_push_claim() from public,anon,authenticated;
grant execute on function public.booking_push_claim() to service_role;
create function public.booking_push_dispatch() returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.booking_push_jobs j join public.booking_push_devices d on d.id=j.device_id where d.active and j.delivered_at is null and j.attempts<5 and coalesce(j.locked_until,now())<=now()) then
 perform net.http_post(url:='https://izfmwvqveiphyuufvxoq.supabase.co/functions/v1/booking-admin-push',headers:=jsonb_build_object('Content-Type','application/json','x-booking-dispatch',(select dispatch_secret from public.booking_push_settings where id)),body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=10000);
 end if;
end $$;
revoke all on function public.booking_push_dispatch() from public,anon,authenticated;
select cron.schedule('booking-admin-push-dispatch','* * * * *','select public.booking_push_dispatch()');
