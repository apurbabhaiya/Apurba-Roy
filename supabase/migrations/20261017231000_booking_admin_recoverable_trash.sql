alter table public.booking_clients add column if not exists deleted_at timestamptz;
create or replace function public.booking_admin_set_trash(p_token text, p_booking_id uuid, p_deleted boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then
    raise exception 'Admin session expired';
  end if;
  if p_deleted is null then raise exception 'Trash action is required'; end if;
  update public.booking_clients
  set deleted_at = case when p_deleted then coalesce(deleted_at, now()) else null end
  where id = p_booking_id;
  return found;
end;
$$;
revoke all on function public.booking_admin_set_trash(text, uuid, boolean) from public;
grant execute on function public.booking_admin_set_trash(text, uuid, boolean) to anon, authenticated;
