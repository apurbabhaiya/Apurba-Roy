alter table public.spin_result_draws
  add column if not exists phone_normalized text;

create index if not exists spin_result_draws_phone_created_idx
  on public.spin_result_draws(phone_normalized, created_at desc)
  where phone_normalized is not null;

drop function if exists public.spin_result_draw_start();

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
  v_prizes text[] := array['15 MIN FREE PHOTOSHOOT','GIFT 1','20% OFF','GIFT 2','10% OFF','5% OFF','GIFT 3','25% OFF','2% OFF','8% OFF','CHOCOLATE'];
  v_prize text;
begin
  if length(v_digits) = 13 and left(v_digits, 3) = '880' then
    v_phone := '0' || substr(v_digits, 4);
  else
    v_phone := v_digits;
  end if;
  if length(v_phone) not between 10 and 14 then
    raise exception 'স্পিনের আগে সঠিক মোবাইল নম্বর লিখুন।';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_phone, 0));
  if exists (
    select 1 from public.spin_result_draws d
    where d.phone_normalized = v_phone
      and d.created_at > now() - interval '7 days'
  ) then
    raise exception 'এই মোবাইল নম্বরে গত ৭ দিনে স্পিন করা হয়েছে। ৭ দিন পর আবার চেষ্টা করুন।';
  end if;

  v_prize := v_prizes[1 + floor(random() * array_length(v_prizes, 1))::int];
  insert into public.spin_result_draws(prize, phone_normalized)
  values (v_prize, v_phone)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'prize', v_prize);
end;
$function$;

revoke all on function public.spin_result_draw_start(text) from public;
grant execute on function public.spin_result_draw_start(text) to anon, authenticated;
