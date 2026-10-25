create table if not exists public.spin_result_submissions (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address text not null,
  spin_result text not null,
  campaign_link text not null default '',
  status text not null default 'pending' check (status in ('pending','verified','redeemed','rejected')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spin_result_submissions_name_length check (length(customer_name) between 1 and 120),
  constraint spin_result_submissions_phone_length check (length(phone) between 5 and 30),
  constraint spin_result_submissions_address_length check (length(address) between 1 and 500),
  constraint spin_result_submissions_link_length check (length(campaign_link) <= 500),
  constraint spin_result_submissions_note_length check (length(admin_note) <= 2000)
);
alter table public.spin_result_submissions enable row level security;
revoke all on table public.spin_result_submissions from public, anon, authenticated;
grant all on table public.spin_result_submissions to service_role;

create or replace function public.submit_spin_result(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_spin_result text,
  p_campaign_link text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_address text := btrim(coalesce(p_address, ''));
  v_result text := btrim(coalesce(p_spin_result, ''));
  v_link text := btrim(coalesce(p_campaign_link, ''));
begin
  if length(v_name) not between 1 and 120 then raise exception 'নাম ১ থেকে ১২০ অক্ষরের মধ্যে লিখুন।'; end if;
  if length(v_phone) not between 5 and 30 then raise exception 'সঠিক মোবাইল নম্বর লিখুন।'; end if;
  if length(v_address) not between 1 and 500 then raise exception 'ঠিকানা লিখুন।'; end if;
  if v_result not in ('15 MIN FREE PHOTOSHOOT','GIFT 1','20% OFF','GIFT 2','10% OFF','5% OFF','GIFT 3','25% OFF','2% OFF','8% OFF','CHOCOLATE') then
    raise exception 'স্পিনের ফলাফল তালিকা থেকে নির্বাচন করুন।';
  end if;
  if length(v_link) > 500 or (v_link <> '' and v_link !~ '^https://[A-Za-z0-9.-]+(/[^[:space:]]*)?$') then
    raise exception 'শুধু HTTPS লিংক দিন।';
  end if;
  insert into public.spin_result_submissions(customer_name, phone, address, spin_result, campaign_link)
  values (v_name, v_phone, v_address, v_result, v_link)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$function$;

create or replace function public.spin_result_admin_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then
    raise exception 'Admin session expired';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(item) order by item.created_at desc)
    from public.spin_result_submissions item
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.spin_result_admin_update(
  p_token text,
  p_id uuid,
  p_status text,
  p_admin_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.spin_result_submissions%rowtype;
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then
    raise exception 'Admin session expired';
  end if;
  if p_status not in ('pending','verified','redeemed','rejected') then
    raise exception 'Invalid result status';
  end if;
  if length(coalesce(p_admin_note,'')) > 2000 then raise exception 'Admin note is too long'; end if;
  update public.spin_result_submissions
     set status = p_status,
         admin_note = btrim(coalesce(p_admin_note,'')),
         updated_at = now()
   where id = p_id
   returning * into v_row;
  if not found then raise exception 'Spin result was not found'; end if;
  return to_jsonb(v_row);
end;
$function$;

revoke all on function public.submit_spin_result(text,text,text,text,text) from public;
revoke all on function public.spin_result_admin_snapshot(text) from public;
revoke all on function public.spin_result_admin_update(text,uuid,text,text) from public;
grant execute on function public.submit_spin_result(text,text,text,text,text) to anon, authenticated;
grant execute on function public.spin_result_admin_snapshot(text) to anon, authenticated;
grant execute on function public.spin_result_admin_update(text,uuid,text,text) to anon, authenticated;