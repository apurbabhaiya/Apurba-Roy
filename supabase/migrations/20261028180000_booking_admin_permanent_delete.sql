create or replace function private.booking_admin_permanently_delete(p_token text, p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_at timestamptz;
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then
    raise exception 'Admin session expired';
  end if;

  select b.deleted_at
    into v_deleted_at
    from public.booking_clients b
   where b.id = p_booking_id
   for update;

  if not found then
    raise exception 'Booking was not found';
  end if;
  if v_deleted_at is null then
    raise exception 'Only bookings in Trash can be permanently deleted';
  end if;

  -- Payment requests do not cascade from booking_clients.
  delete from public.booking_payment_requests where booking_id = p_booking_id;

  -- Booking events, payments and booking costs cascade. Delivery portals and
  -- general costs have ON DELETE SET NULL and remain independently managed.
  delete from public.booking_clients where id = p_booking_id;
  return found;
end;
$$;

create or replace function public.booking_admin_permanently_delete(p_token text, p_booking_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.booking_admin_permanently_delete(p_token, p_booking_id);
$$;

revoke all on function private.booking_admin_permanently_delete(text, uuid) from public;
grant execute on function private.booking_admin_permanently_delete(text, uuid) to anon, authenticated;
revoke all on function public.booking_admin_permanently_delete(text, uuid) from public;
grant execute on function public.booking_admin_permanently_delete(text, uuid) to anon, authenticated;
