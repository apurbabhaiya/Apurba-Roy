create table if not exists public.spin_game_config (
  id integer primary key default 1 check (id = 1),
  smartphone_goal bigint not null default 10000000 check (smartphone_goal > 0),
  smartphone_label text not null default 'স্মার্টফোন',
  point_rewards integer[] not null default array[500,1000,2000,3000]::integer[],
  booking_points bigint not null default 0 check (booking_points >= 0),
  adsterra_url text not null default 'https://www.profitableratecpmnetwork.com/sejiqs7gh?key=3ced38f7fd6c41fd721c0ffa30fe4cf7',
  updated_at timestamptz not null default now(),
  constraint spin_game_config_point_rewards_length check (array_length(point_rewards,1) = 4),
  constraint spin_game_config_adsterra_url check (adsterra_url = '' or adsterra_url ~ '^https://')
);
insert into public.spin_game_config(id) values (1) on conflict (id) do nothing;

create table if not exists public.spin_points_wallets (
  phone_normalized text primary key check (phone_normalized ~ '^[0-9]{10,14}$'),
  points_balance bigint not null default 0 check (points_balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.spin_points_ledger (
  id uuid primary key default gen_random_uuid(),
  phone_normalized text not null references public.spin_points_wallets(phone_normalized) on delete cascade,
  points_delta bigint not null,
  balance_after bigint not null check (balance_after >= 0),
  source_type text not null check (source_type in ('spin','booking','smartphone_redemption')),
  source_id uuid not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique(source_type, source_id)
);

create table if not exists public.spin_smartphone_claims (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone_normalized text not null references public.spin_points_wallets(phone_normalized),
  address text not null,
  status text not null default 'pending' check (status in ('pending','verified','redeemed','rejected')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spin_result_draws
  add column if not exists points_awarded integer not null default 0;
alter table public.spin_result_draws
  drop constraint if exists spin_result_draws_prize_check;
alter table public.spin_result_draws
  add constraint spin_result_draws_prize_check
  check (prize in (
    'POINTS 500','POINTS 1000','POINTS 2000','POINTS 3000',
    '5% OFF','1 FREE EDIT','1 FREE PRINT','TRY AGAIN',
    '15 MIN FREE PHOTOSHOOT','GIFT 1','20% OFF','GIFT 2',
    '10% OFF','GIFT 3','25% OFF','2% OFF','8% OFF','CHOCOLATE'
  ));

alter table public.spin_game_config enable row level security;
alter table public.spin_points_wallets enable row level security;
alter table public.spin_points_ledger enable row level security;
alter table public.spin_smartphone_claims enable row level security;
revoke all on public.spin_game_config, public.spin_points_wallets, public.spin_points_ledger, public.spin_smartphone_claims from public, anon, authenticated;
grant all on public.spin_game_config, public.spin_points_wallets, public.spin_points_ledger, public.spin_smartphone_claims to service_role;

create or replace function public.spin_game_public_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'smartphoneGoal', c.smartphone_goal,
    'smartphoneLabel', c.smartphone_label,
    'pointRewards', c.point_rewards,
    'bookingPoints', c.booking_points,
    'adsterraUrl', c.adsterra_url
  )
  from public.spin_game_config c where c.id = 1;
$function$;

create or replace function public.spin_game_admin_config(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then raise exception 'Admin session expired'; end if;
  return public.spin_game_public_config();
end;
$function$;

create or replace function public.spin_game_admin_update(
  p_token text,
  p_smartphone_goal bigint,
  p_smartphone_label text,
  p_point_rewards integer[],
  p_booking_points bigint,
  p_adsterra_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_url text := btrim(coalesce(p_adsterra_url,''));
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then raise exception 'Admin session expired'; end if;
  if p_smartphone_goal < 1 then raise exception 'লক্ষ্য ১-এর বেশি হতে হবে।'; end if;
  if length(btrim(coalesce(p_smartphone_label,''))) not between 1 and 80 then raise exception 'পুরস্কারের নাম লিখুন।'; end if;
  if coalesce(array_length(p_point_rewards,1),0) <> 4 or exists (select 1 from unnest(p_point_rewards) as x(value) where x.value < 0 or x.value > 10000000) then raise exception 'চারটি সঠিক পয়েন্ট মান লিখুন।'; end if;
  if p_booking_points < 0 or p_booking_points > 10000000 then raise exception 'বুকিং পয়েন্ট ০ থেকে ১০,০০,০০০-এর মধ্যে দিন।'; end if;
  if v_url <> '' and (length(v_url) > 500 or v_url !~ '^https://') then raise exception 'সঠিক HTTPS Adsterra লিংক দিন।'; end if;
  update public.spin_game_config
     set smartphone_goal = p_smartphone_goal,
         smartphone_label = btrim(p_smartphone_label),
         point_rewards = p_point_rewards,
         booking_points = p_booking_points,
         adsterra_url = v_url,
         updated_at = now()
   where id = 1;
  return public.spin_game_public_config();
end;
$function$;

create or replace function public.spin_points_admin_wallet(p_token text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_phone text := regexp_replace(coalesce(p_phone,''),'\D','','g');
  v_wallet public.spin_points_wallets%rowtype;
  v_ledger jsonb;
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then raise exception 'Admin session expired'; end if;
  if length(v_phone) = 13 and left(v_phone,3) = '880' then v_phone := '0' || substr(v_phone,4); end if;
  if length(v_phone) not between 10 and 14 then raise exception 'সঠিক মোবাইল নম্বর লিখুন।'; end if;
  select * into v_wallet from public.spin_points_wallets where phone_normalized = v_phone;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_ledger
    from (select points_delta,balance_after,source_type,note,created_at from public.spin_points_ledger where phone_normalized=v_phone order by created_at desc limit 30) x;
  return jsonb_build_object('phone',v_phone,'pointsBalance',coalesce(v_wallet.points_balance,0),'updatedAt',v_wallet.updated_at,'ledger',v_ledger);
end;
$function$;

create or replace function public.spin_points_claim_smartphone(p_customer_name text, p_phone text, p_address text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_digits text := regexp_replace(coalesce(p_phone,''),'\D','','g');
  v_phone text;
  v_goal bigint;
  v_id uuid;
begin
  v_phone := case when length(v_digits)=13 and left(v_digits,3)='880' then '0'||substr(v_digits,4) else v_digits end;
  if length(v_phone) not between 10 and 14 then raise exception 'সঠিক মোবাইল নম্বর লিখুন।'; end if;
  if length(btrim(coalesce(p_customer_name,''))) not between 1 and 120 then raise exception 'নাম লিখুন।'; end if;
  if length(btrim(coalesce(p_address,''))) not between 1 and 500 then raise exception 'ঠিকানা লিখুন।'; end if;
  select smartphone_goal into v_goal from public.spin_game_config where id=1;
  if not exists(select 1 from public.spin_points_wallets where phone_normalized=v_phone and points_balance >= v_goal) then raise exception 'স্মার্টফোন পুরস্কারের পয়েন্ট লক্ষ্য পূরণ হয়নি।'; end if;
  if exists(select 1 from public.spin_smartphone_claims where phone_normalized=v_phone and status in ('pending','verified','redeemed')) then raise exception 'এই নম্বরে পুরস্কার দাবি আগে জমা হয়েছে।'; end if;
  insert into public.spin_smartphone_claims(customer_name,phone_normalized,address)
  values (btrim(p_customer_name),v_phone,btrim(p_address)) returning id into v_id;
  return jsonb_build_object('id',v_id,'status','pending');
end;
$function$;

create or replace function public.spin_points_admin_claims(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then raise exception 'Admin session expired'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.spin_smartphone_claims c),'[]'::jsonb);
end;
$function$;

create or replace function public.spin_points_admin_update_claim(p_token text,p_id uuid,p_status text,p_admin_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_claim public.spin_smartphone_claims%rowtype;
  v_goal bigint;
  v_balance bigint;
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then raise exception 'Admin session expired'; end if;
  if p_status not in ('pending','verified','redeemed','rejected') then raise exception 'Invalid claim status'; end if;
  if length(coalesce(p_admin_note,'')) > 2000 then raise exception 'Admin note is too long'; end if;
  select * into v_claim from public.spin_smartphone_claims where id=p_id for update;
  if not found then raise exception 'Smartphone claim not found'; end if;
  if v_claim.status='redeemed' and p_status <> 'redeemed' then raise exception 'Redeemed claims cannot be reopened'; end if;
  if p_status='redeemed' and v_claim.status <> 'redeemed' then
    select smartphone_goal into v_goal from public.spin_game_config where id=1;
    update public.spin_points_wallets set points_balance=points_balance-v_goal,updated_at=now()
      where phone_normalized=v_claim.phone_normalized and points_balance>=v_goal returning points_balance into v_balance;
    if not found then raise exception 'পয়েন্ট ব্যালেন্স লক্ষ্য থেকে কম।'; end if;
    insert into public.spin_points_ledger(phone_normalized,points_delta,balance_after,source_type,source_id,note)
    values(v_claim.phone_normalized,-v_goal,v_balance,'smartphone_redemption',v_claim.id,'স্মার্টফোন পুরস্কার দেওয়া হয়েছে');
  end if;
  update public.spin_smartphone_claims set status=p_status,admin_note=btrim(coalesce(p_admin_note,'')),updated_at=now() where id=p_id returning * into v_claim;
  return to_jsonb(v_claim);
end;
$function$;

create or replace function public.spin_result_draw_start(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone text;
  v_pick integer;
  v_rewards integer[];
  v_prize text;
  v_points integer := 0;
  v_balance bigint := 0;
begin
  if length(v_digits) = 13 and left(v_digits,3) = '880' then v_phone := '0' || substr(v_digits,4); else v_phone := v_digits; end if;
  if length(v_phone) not between 10 and 14 then raise exception 'স্পিনের আগে সঠিক মোবাইল নম্বর লিখুন।'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_phone, 0));
  if exists(select 1 from public.spin_result_draws d where d.phone_normalized=v_phone and d.created_at>now()-interval '7 days') then
    raise exception 'এই মোবাইল নম্বরে গত ৭ দিনে স্পিন করা হয়েছে। ৭ দিন পর আবার চেষ্টা করুন।';
  end if;
  select point_rewards into v_rewards from public.spin_game_config where id=1;
  v_pick := 1 + floor(random()*8)::int;
  if v_pick <= 4 then
    v_points := v_rewards[v_pick];
    v_prize := 'POINTS ' || v_points::text;
  else
    v_prize := (array['5% OFF','1 FREE EDIT','1 FREE PRINT','TRY AGAIN'])[v_pick-4];
  end if;
  insert into public.spin_result_draws(prize,phone_normalized,points_awarded)
  values(v_prize,v_phone,v_points) returning id into v_id;
  insert into public.spin_points_wallets(phone_normalized,points_balance) values(v_phone,0)
    on conflict(phone_normalized) do nothing;
  if v_points > 0 then
    update public.spin_points_wallets set points_balance=points_balance+v_points,updated_at=now()
      where phone_normalized=v_phone returning points_balance into v_balance;
    insert into public.spin_points_ledger(phone_normalized,points_delta,balance_after,source_type,source_id,note)
    values(v_phone,v_points,v_balance,'spin',v_id,'সাপ্তাহিক স্পিন পয়েন্ট');
  else
    select points_balance into v_balance from public.spin_points_wallets where phone_normalized=v_phone;
  end if;
  return jsonb_build_object('id',v_id,'prize',v_prize,'pointsAwarded',v_points,'pointsBalance',v_balance);
end;
$function$;

create or replace function public.spin_points_award_completed_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_digits text := regexp_replace(coalesce(new.phone,''),'\D','','g');
  v_phone text;
  v_points bigint;
  v_balance bigint;
begin
  if new.status <> 'completed' then return new; end if;
  if tg_op='UPDATE' and old.status='completed' then return new; end if;
  v_phone := case when length(v_digits)=13 and left(v_digits,3)='880' then '0'||substr(v_digits,4) else v_digits end;
  if length(v_phone) not between 10 and 14 then return new; end if;
  select booking_points into v_points from public.spin_game_config where id=1;
  if coalesce(v_points,0) <= 0 then return new; end if;
  if exists(select 1 from public.spin_points_ledger where source_type='booking' and source_id=new.id) then return new; end if;
  insert into public.spin_points_wallets(phone_normalized,points_balance) values(v_phone,0) on conflict(phone_normalized) do nothing;
  update public.spin_points_wallets set points_balance=points_balance+v_points,updated_at=now() where phone_normalized=v_phone returning points_balance into v_balance;
  insert into public.spin_points_ledger(phone_normalized,points_delta,balance_after,source_type,source_id,note)
  values(v_phone,v_points,v_balance,'booking',new.id,'সম্পন্ন ফটোগ্রাফি বুকিং');
  return new;
end;
$function$;
drop trigger if exists spin_points_award_booking_completed on public.booking_clients;
create trigger spin_points_award_booking_completed
after insert or update of status on public.booking_clients
for each row execute function public.spin_points_award_completed_booking();

revoke all on function public.spin_game_public_config() from public;
revoke all on function public.spin_game_admin_config(text) from public;
revoke all on function public.spin_game_admin_update(text,bigint,text,integer[],bigint,text) from public;
revoke all on function public.spin_points_admin_wallet(text,text) from public;
revoke all on function public.spin_points_claim_smartphone(text,text,text) from public;
revoke all on function public.spin_points_admin_claims(text) from public;
revoke all on function public.spin_points_admin_update_claim(text,uuid,text,text) from public;
revoke all on function public.spin_result_draw_start(text) from public;
grant execute on function public.spin_game_public_config() to anon,authenticated;
grant execute on function public.spin_game_admin_config(text) to anon,authenticated;
grant execute on function public.spin_game_admin_update(text,bigint,text,integer[],bigint,text) to anon,authenticated;
grant execute on function public.spin_points_admin_wallet(text,text) to anon,authenticated;
grant execute on function public.spin_points_claim_smartphone(text,text,text) to anon,authenticated;
grant execute on function public.spin_points_admin_claims(text) to anon,authenticated;
grant execute on function public.spin_points_admin_update_claim(text,uuid,text,text) to anon,authenticated;
grant execute on function public.spin_result_draw_start(text) to anon,authenticated;
