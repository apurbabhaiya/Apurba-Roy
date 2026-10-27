-- Preserve explicit delivery state for manual clients when their bill is paid.
-- Existing booking-created portals keep their current automatic behavior.
create or replace function public.auto_activate_fully_paid_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz:=now(); v_days integer:=greatest(coalesce(NEW.free_access_days,30),0);
begin
  if NEW.delivery_status<>'FINAL_DELIVERED' and exists(select 1 from public.delivery_audit_logs where portal_id=NEW.id and action='MANUAL_CLIENT_CREATED') then
    return NEW;
  end if;
  if NEW.payment_status='FULLY_PAID' and NEW.final_delivery_at is null and (NEW.storage_retention_until is null or NEW.storage_retention_until>v_now) then
    NEW.delivery_status:='FINAL_DELIVERED'; NEW.gallery_status:='ACTIVE'; NEW.download_status:='ENABLED';
    NEW.final_delivery_at:=v_now; NEW.free_access_expires_at:=v_now+make_interval(days=>v_days); NEW.access_expires_at:=null;
  end if;
  return NEW;
end;
$$;
