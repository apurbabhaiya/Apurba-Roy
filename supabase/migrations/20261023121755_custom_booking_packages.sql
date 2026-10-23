-- Additive custom booking flow. Existing fixed-package submission is unchanged.
create table public.booking_custom_settings (
 id boolean primary key default true check(id),
 enabled boolean not null default true,
 photo_rate numeric(12,2) not null default 1000 check(photo_rate>=0),
 cinema_rate numeric(12,2) not null default 1000 check(cinema_rate>=0),
 drone_rate numeric(12,2) not null default 0 check(drone_rate>=0),
 photo_edit_rate numeric(12,2) not null default 20 check(photo_edit_rate>=0),
 video_edit_rate numeric(12,2) not null default 2000 check(video_edit_rate>=0),
 min_hours numeric not null default 4 check(min_hours>0 and min_hours<=24),
 peak_dates text[] not null default '{}',
 note text not null default '',
 revision integer not null default 1
);
alter table public.booking_custom_settings enable row level security;
revoke all on public.booking_custom_settings from anon,authenticated;
insert into public.booking_custom_settings(id) values(true);

create function public.booking_custom_config() returns jsonb language sql security definer set search_path='' as $$
 select to_jsonb(s)-'id' from public.booking_custom_settings s where id=true;
$$;
create function public.booking_custom_save_config(p_token text,p_config jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.booking_custom_settings;
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 if exists(select 1 from jsonb_each_text(p_config) where key in ('photo_rate','cinema_rate','drone_rate','photo_edit_rate','video_edit_rate') and (value::numeric<0 or value::numeric>1000000)) then raise exception 'Rates must be between 0 and 1000000'; end if;
 if exists(select 1 from jsonb_array_elements_text(p_config->'peak_dates') d where d !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Season dates must use YYYY-MM-DD'; end if;
 update public.booking_custom_settings set
 enabled=(p_config->>'enabled')::boolean,
 photo_rate=(p_config->>'photo_rate')::numeric,cinema_rate=(p_config->>'cinema_rate')::numeric,
 drone_rate=(p_config->>'drone_rate')::numeric,photo_edit_rate=(p_config->>'photo_edit_rate')::numeric,
 video_edit_rate=(p_config->>'video_edit_rate')::numeric,min_hours=(p_config->>'min_hours')::numeric,
 peak_dates=array(select value from jsonb_array_elements_text(p_config->'peak_dates')),
 note=left(coalesce(p_config->>'note',''),2000),revision=revision+1
 where id=true and revision=p_revision returning * into s;
 if not found then raise exception 'Rates changed. Reload before saving.'; end if;
 return to_jsonb(s)-'id';
end; $$;

create function public.booking_custom_quote(p_events jsonb,p_options jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.booking_custom_settings; e jsonb; lines jsonb:='[]'; days date[]:='{}'; d date;
 st timestamp; en timestamp; minutes numeric; pc integer; cc integer; photos integer; cost numeric; subtotal numeric:=0; travel numeric:=0; amount numeric; needs_review boolean:=false;
begin
 select * into strict s from public.booking_custom_settings where id=true;
 if not s.enabled then raise exception 'Custom packages are currently unavailable'; end if;
 if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 20 then raise exception 'Select 1 to 20 events'; end if;
 for e in select value from jsonb_array_elements(p_events) loop
  if coalesce(e->>'event_name','')='' or coalesce(e->>'event_date','')='' or coalesce(e->>'start_time','')='' or coalesce(e->>'end_time','')='' then raise exception 'Every event needs its type, date, start and end time'; end if;
  st:=(e->>'event_date')::date+(e->>'start_time')::time;
  en:=coalesce(nullif(e->>'end_date',''),e->>'event_date')::date+(e->>'end_time')::time;
  if en<=st or en-st>interval '7 days' then raise exception 'Check the event end date and time (maximum 7 days)'; end if;
  minutes:=extract(epoch from en-st)/60;
  pc:=coalesce((e->>'photographers')::integer,0); cc:=coalesce((e->>'cinematographers')::integer,0);
  photos:=coalesce((e->>'special_photos')::integer,0);
  if pc not between 0 and 20 or cc not between 0 and 20 or photos not between 0 and 10000 then raise exception 'Invalid team or photo count'; end if;
  if pc+cc=0 and not coalesce((e->>'drone')::boolean,false) then raise exception 'Select a service for every event'; end if;
  if (pc>0 and s.photo_rate=0) or (cc>0 and s.cinema_rate=0) or (coalesce((e->>'drone')::boolean,false) and s.drone_rate=0) then raise exception 'Selected service rate needs admin confirmation'; end if;
  if minutes<s.min_hours*60 then needs_review:=true; end if;
  cost:=round(minutes/60*(pc*s.photo_rate+cc*s.cinema_rate+case when coalesce((e->>'drone')::boolean,false) then s.drone_rate else 0 end),2)
    +photos*s.photo_edit_rate+case when coalesce((e->>'video_edit')::boolean,false) then s.video_edit_rate else 0 end;
  subtotal:=subtotal+cost;
  lines:=lines||jsonb_build_array(jsonb_build_object('event_name',e->>'event_name','minutes',minutes,'amount',cost,'special_photos',photos,'video_edit',coalesce((e->>'video_edit')::boolean,false)));
  for d in select generate_series(st::date,(en-interval '1 second')::date,'1 day')::date loop
   if d::text=any(s.peak_dates) then raise exception 'Season date selected. Please contact the office for a package.'; end if;
   if not d=any(days) then days:=array_append(days,d); end if;
  end loop;
 end loop;
 for d in select unnest(days) loop
  amount:=coalesce(nullif(p_options->'travel'->>d::text,'')::numeric,200);
  if amount<200 or amount>100000 then raise exception 'Daily travel must be between 200 and 100000'; end if;
  travel:=travel+round(amount,2);
 end loop;
 return jsonb_build_object('revision',s.revision,'rates',to_jsonb(s)-'id','lines',lines,'travel_days',to_jsonb(days),'travel',travel,'total',subtotal+travel,'needs_review',needs_review);
end; $$;

create function public.submit_custom_booking(p_payload jsonb,p_options jsonb,p_expected_total numeric,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare q jsonb; payload jsonb; result jsonb;
begin
 q:=public.booking_custom_quote(p_payload->'events',p_options);
 if (q->>'revision')::integer<>p_revision or abs((q->>'total')::numeric-p_expected_total)>0.001 then raise exception 'Rates changed. Review the updated quote before submitting.'; end if;
 payload:=p_payload||jsonb_build_object('package_name','Custom package - office verification required','package_amount',(q->>'total')::numeric,'discount',0,'advance_paid',0,'client_extra_charge',case when coalesce((p_options->>'allow_publish')::boolean,true) then 0 else 10000 end,
 'custom_quote',q,'custom_options',p_options,'client_notes',coalesce(p_payload->>'client_notes','')||E'\nCustom package: '||q::text);
 result:=public.submit_client_booking(payload);
 return result||jsonb_build_object('quote',q);
end; $$;
revoke all on function public.booking_custom_config() from public;
revoke all on function public.booking_custom_save_config(text,jsonb,integer) from public;
revoke all on function public.booking_custom_quote(jsonb,jsonb) from public;
revoke all on function public.submit_custom_booking(jsonb,jsonb,numeric,integer) from public;
grant execute on function public.booking_custom_config(),public.booking_custom_save_config(text,jsonb,integer),public.booking_custom_quote(jsonb,jsonb),public.submit_custom_booking(jsonb,jsonb,numeric,integer) to anon,authenticated;
