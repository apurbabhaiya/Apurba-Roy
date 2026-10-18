create table public.delivery_recovery_policies (
 portal_id uuid primary key references public.delivery_portals(id) on delete cascade,
 enabled boolean not null default false,
 reopen_fee numeric(12,2) check (reopen_fee >= 0),
 recovery_fee numeric(12,2) check (recovery_fee >= 0),
 recovery_after timestamptz,
 reopen_hours integer not null default 48 check (reopen_hours between 1 and 8760),
 payment_method text not null default 'BKASH' check(payment_method in ('BKASH','NAGAD','ROCKET','BANK')),
 payment_number text not null default '' check(length(payment_number)<=80),
 whatsapp_number text not null default '' check(length(whatsapp_number)<=20),
 updated_at timestamptz not null default now()
);
alter table public.delivery_recovery_policies enable row level security;
revoke all on public.delivery_recovery_policies from anon, authenticated;

create function public.delivery_admin_save_recovery_policy(p_token text,p_portal_id uuid,p_policy jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare n public.delivery_recovery_policies;
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 if not exists(select 1 from public.delivery_portals where id=p_portal_id and deleted_at is null) then raise exception 'Delivery not found'; end if;
 n.portal_id:=p_portal_id;
 n.enabled:=coalesce((p_policy->>'enabled')::boolean,false);
 n.reopen_fee:=nullif(p_policy->>'reopen_fee','')::numeric;
 n.recovery_fee:=nullif(p_policy->>'recovery_fee','')::numeric;
 n.recovery_after:=nullif(p_policy->>'recovery_after','')::timestamptz;
 n.reopen_hours:=coalesce((p_policy->>'reopen_hours')::integer,48);
 n.payment_method:=coalesce(p_policy->>'payment_method','BKASH');
 n.payment_number:=trim(coalesce(p_policy->>'payment_number',''));
 n.whatsapp_number:=trim(coalesce(p_policy->>'whatsapp_number',''));
 if n.whatsapp_number<>'' and n.whatsapp_number !~ '^\+?[0-9]{7,15}$' then raise exception 'Invalid WhatsApp number'; end if;
 if n.enabled and (n.payment_number='' or n.whatsapp_number='') then raise exception 'Payment and WhatsApp numbers are required'; end if;
 insert into public.delivery_recovery_policies(portal_id,enabled,reopen_fee,recovery_fee,recovery_after,reopen_hours,payment_method,payment_number,whatsapp_number)
 values(n.portal_id,n.enabled,n.reopen_fee,n.recovery_fee,n.recovery_after,n.reopen_hours,n.payment_method,n.payment_number,n.whatsapp_number)
 on conflict(portal_id) do update set enabled=excluded.enabled,reopen_fee=excluded.reopen_fee,recovery_fee=excluded.recovery_fee,recovery_after=excluded.recovery_after,reopen_hours=excluded.reopen_hours,payment_method=excluded.payment_method,payment_number=excluded.payment_number,whatsapp_number=excluded.whatsapp_number,updated_at=now();
 return true;
end $$;
revoke all on function public.delivery_admin_save_recovery_policy(text,uuid,jsonb) from public;
grant execute on function public.delivery_admin_save_recovery_policy(text,uuid,jsonb) to anon,authenticated;

create function public.get_delivery_recovery_policy(p_portal_id uuid,p_client_token text default null,p_admin_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.delivery_portals; q public.delivery_recovery_policies; admin_ok boolean;
begin
 admin_ok:=coalesce(public._booking_admin_valid(p_admin_token),false);
 select * into p from public.delivery_portals where id=p_portal_id and deleted_at is null;
 if not found then return null; end if;
 if not admin_ok and not coalesce(p.is_published and (p.secure_token=p_client_token or (p.public_listed and p.preview_enabled)),false) then return null; end if;
 select * into q from public.delivery_recovery_policies where portal_id=p.id;
 if not found then return null; end if;
 if not admin_ok and not q.enabled then return null; end if;
 return jsonb_build_object('enabled',q.enabled,'reopen_fee',q.reopen_fee,'recovery_fee',q.recovery_fee,'recovery_after',q.recovery_after,'reopen_hours',q.reopen_hours,'payment_method',q.payment_method,'payment_number',q.payment_number,'whatsapp_number',q.whatsapp_number,'expires_at',p.download_window_ends_at);
end $$;
revoke all on function public.get_delivery_recovery_policy(uuid,text,text) from public;
grant execute on function public.get_delivery_recovery_policy(uuid,text,text) to anon,authenticated;
