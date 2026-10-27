-- Add clients who have no online booking, using the existing admin session.
-- Privileged code stays outside exposed schemas. The public RPC is an invoker.
create schema if not exists delivery_private;
revoke all on schema delivery_private from public;
grant usage on schema delivery_private to anon, authenticated;

create or replace function delivery_private.create_manual_client(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text := trim(coalesce(p_payload->>'client_name',''));
  v_phone text := regexp_replace(translate(coalesce(p_payload->>'phone',''),'০১২৩৪৫৬৭৮৯','0123456789'),'[[:space:]()-]','','g');
  v_date date;
  v_total numeric;
  v_paid numeric;
  v_done boolean;
  v_portal public.delivery_portals%rowtype;
begin
  if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Client details are required'; end if;
  if length(v_name)<2 or length(v_name)>150 then raise exception 'Client name must be 2 to 150 characters'; end if;
  if v_phone !~ '^\+?[0-9]{8,15}$' then raise exception 'Enter a valid mobile number'; end if;
  v_id := (p_payload->>'request_id')::uuid;
  v_date := nullif(p_payload->>'event_date','')::date;
  v_total := (p_payload->>'total')::numeric;
  v_paid := (p_payload->>'paid')::numeric;
  v_done := coalesce((p_payload->>'delivered')::boolean,false);
  if v_id is null or v_date is null then raise exception 'Client date and request ID are required'; end if;
  if v_total is null or v_paid is null or v_total::text in ('NaN','Infinity','-Infinity') or v_paid::text in ('NaN','Infinity','-Infinity') or v_total<0 or v_total>1000000000 or v_paid<0 or v_paid>v_total or scale(v_total)>2 or scale(v_paid)>2 then
    raise exception 'Enter valid amounts: paid cannot exceed total, with at most two decimal places';
  end if;
  if length(coalesce(p_payload->>'event_name',''))>200 then raise exception 'Event name is too long'; end if;
  if v_done and v_paid<v_total then raise exception 'Clear the remaining bill before marking full delivery'; end if;
  -- Retrying the same form after a network failure must not create a duplicate.
  perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
  select * into v_portal from public.delivery_portals where id=v_id;
  if found then
    if v_portal.booking_id is not null or v_portal.deleted_at is not null or v_portal.client_name<>v_name or v_portal.client_phone is distinct from v_phone or v_portal.event_date is distinct from v_date or v_portal.package_price<>v_total or v_portal.advance_paid<>v_paid or coalesce(v_portal.event_name,'')<>trim(coalesce(p_payload->>'event_name','')) or (v_portal.delivery_status='FINAL_DELIVERED')<>v_done then
      raise exception 'This form was already saved with other details. Refresh the client list before adding again';
    end if;
  else
    insert into public.delivery_portals(id,client_name,client_phone,whatsapp_number,event_name,event_date,package_name,package_price,advance_paid,verified_total_paid,payment_status,delivery_status,gallery_status,download_status,final_delivery_at,free_access_expires_at,is_published,late_fee_enabled,internal_admin_note)
    values(v_id,v_name,v_phone,v_phone,nullif(trim(p_payload->>'event_name'),''),v_date,'Manual client',v_total,v_paid,v_paid,
      case when v_paid>=v_total then 'FULLY_PAID' when v_paid>0 then 'VERIFIED' else 'PENDING' end,
      case when v_done then 'FINAL_DELIVERED' else 'READY' end,
      case when v_done then 'ACTIVE' else 'PREVIEW' end,
      case when v_done then 'ENABLED' else 'LOCKED' end,
      case when v_done then now() end,case when v_done then now()+interval '30 days' end,
      false,false,'Added manually by admin without an online booking. Opening amount received is recorded as advance.') returning * into v_portal;
    insert into public.delivery_audit_logs(portal_id,action,details)
    values(v_id,'MANUAL_CLIENT_CREATED',jsonb_build_object('total',v_total,'opening_paid',v_paid,'remaining_due',v_total-v_paid,'delivered',v_done));
  end if;
  return jsonb_build_object('id',v_portal.id,'client_name',v_portal.client_name,'remaining_due',v_total-v_paid);
end;
$$;
revoke all on function delivery_private.create_manual_client(text,jsonb) from public;
grant execute on function delivery_private.create_manual_client(text,jsonb) to anon, authenticated;

create or replace function public.delivery_admin_create_manual_client(p_token text,p_payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select delivery_private.create_manual_client(p_token,p_payload);
$$;
revoke all on function public.delivery_admin_create_manual_client(text,jsonb) from public;
grant execute on function public.delivery_admin_create_manual_client(text,jsonb) to anon, authenticated;

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
