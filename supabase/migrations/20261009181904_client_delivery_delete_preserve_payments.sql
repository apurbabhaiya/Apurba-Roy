alter table public.delivery_portals add column if not exists deleted_at timestamptz;
create or replace function public.delivery_admin_delete_portal(p_token text,p_portal_id uuid,p_client_name text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare p public.delivery_portals%rowtype; n integer;
begin
 if not public._booking_admin_valid(p_token) then raise exception 'Admin session expired'; end if;
 select * into p from public.delivery_portals where id=p_portal_id for update;
 if not found or p.deleted_at is not null then raise exception 'Client delivery not found'; end if;
 if p_client_name is distinct from p.client_name then raise exception 'Client name does not match'; end if;
 delete from public.delivery_files where portal_id=p.id;
 get diagnostics n = row_count;
 update public.delivery_portals set deleted_at=now(),is_published=false,secure_token=gen_random_uuid()::text,preview_items='[]'::jsonb,hero_image_url=null,updated_at=now() where id=p.id;
 insert into public.delivery_audit_logs(portal_id,action,details) values(p.id,'CLIENT_DELIVERY_DELETED',jsonb_build_object('removed_file_records',n,'payment_history_preserved',true));
 return true;
end; $$;
revoke all on function public.delivery_admin_delete_portal(text,uuid,text) from public;
grant execute on function public.delivery_admin_delete_portal(text,uuid,text) to anon,authenticated,service_role;
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.delivery_admin_dashboard(text)'::regprocedure);
 if position('from public.delivery_portals p)' in definition)=0 then raise exception 'Unexpected dashboard definition'; end if;
 definition:=replace(definition,'from public.delivery_portals p)','from public.delivery_portals p where p.deleted_at is null)');
 execute definition;
end $$;