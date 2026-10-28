create or replace function private.booking_admin_update_event_date(
  p_token text,
  p_event_id uuid,
  p_event_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then
    raise exception 'Admin session expired';
  end if;
  if p_event_date is null then
    raise exception 'ইভেন্টের তারিখ দিন';
  end if;

  update public.booking_events e
     set event_date = p_event_date
    from public.booking_clients b
   where e.id = p_event_id
     and b.id = e.booking_id
     and b.deleted_at is null
  returning e.id into v_event_id;

  if v_event_id is null then
    raise exception 'সক্রিয় বুকিংয়ের ইভেন্ট পাওয়া যায়নি';
  end if;
  return true;
end;
$$;

create or replace function public.booking_admin_update_event_date(
  p_token text,
  p_event_id uuid,
  p_event_date date
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.booking_admin_update_event_date(p_token, p_event_id, p_event_date);
$$;

revoke all on function private.booking_admin_update_event_date(text,uuid,date) from public;
grant execute on function private.booking_admin_update_event_date(text,uuid,date) to anon, authenticated;
revoke all on function public.booking_admin_update_event_date(text,uuid,date) from public;
grant execute on function public.booking_admin_update_event_date(text,uuid,date) to anon, authenticated;
