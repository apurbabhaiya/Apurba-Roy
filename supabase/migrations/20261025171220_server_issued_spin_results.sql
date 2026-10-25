create table if not exists public.spin_result_draws (
  id uuid primary key default gen_random_uuid(),
  prize text not null check (prize in ('15 MIN FREE PHOTOSHOOT','GIFT 1','20% OFF','GIFT 2','10% OFF','5% OFF','GIFT 3','25% OFF','2% OFF','8% OFF','CHOCOLATE')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  submitted_at timestamptz,
  submission_id uuid references public.spin_result_submissions(id) on delete set null
);

alter table public.spin_result_submissions
  add column if not exists spin_draw_id uuid references public.spin_result_draws(id);

alter table public.spin_result_draws enable row level security;
revoke all on table public.spin_result_draws from anon, authenticated;
revoke all on table public.spin_result_submissions from anon, authenticated;

create or replace function public.spin_result_draw_start()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_prizes text[] := array['15 MIN FREE PHOTOSHOOT','GIFT 1','20% OFF','GIFT 2','10% OFF','5% OFF','GIFT 3','25% OFF','2% OFF','8% OFF','CHOCOLATE'];
  v_prize text;
begin
  v_prize := v_prizes[1 + floor(random() * array_length(v_prizes, 1))::int];
  insert into public.spin_result_draws(prize) values (v_prize) returning id into v_id;
  return jsonb_build_object('id', v_id, 'prize', v_prize);
end;
$function$;

drop function if exists public.submit_spin_result(text,text,text,text,text);

create or replace function public.submit_spin_result(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_spin_draw_id uuid,
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
  v_link text := btrim(coalesce(p_campaign_link, ''));
  v_prize text;
begin
  if length(v_name) not between 1 and 120 then raise exception 'নাম ১ থেকে ১২০ অক্ষরের মধ্যে লিখুন।'; end if;
  if length(v_phone) not between 5 and 30 then raise exception 'সঠিক মোবাইল নম্বর লিখুন।'; end if;
  if length(v_address) not between 1 and 500 then raise exception 'ঠিকানা লিখুন।'; end if;
  if length(v_link) > 500 or (v_link <> '' and v_link !~ '^https://[A-Za-z0-9.-]+(/[^[:space:]]*)?$') then
    raise exception 'শুধু HTTPS লিংক দিন।';
  end if;
  select d.prize into v_prize
  from public.spin_result_draws d
  where d.id = p_spin_draw_id and d.submitted_at is null and d.expires_at > now()
  for update;
  if v_prize is null then raise exception 'স্পিনের ফলাফল পাওয়া যায়নি বা মেয়াদ শেষ হয়েছে। আবার স্পিন করুন।'; end if;
  insert into public.spin_result_submissions(customer_name, phone, address, spin_result, campaign_link, spin_draw_id)
  values (v_name, v_phone, v_address, v_prize, v_link, p_spin_draw_id)
  returning id into v_id;
  update public.spin_result_draws set submitted_at = now(), submission_id = v_id where id = p_spin_draw_id;
  return jsonb_build_object('id', v_id, 'status', 'pending', 'spin_result', v_prize);
end;
$function$;

revoke all on function public.spin_result_draw_start() from public;
revoke all on function public.submit_spin_result(text,text,text,uuid,text) from public;
grant execute on function public.spin_result_draw_start() to anon, authenticated;
grant execute on function public.submit_spin_result(text,text,text,uuid,text) to anon, authenticated;
