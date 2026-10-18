alter table public.delivery_portals add column if not exists public_download_enabled boolean not null default false;

create or replace function public.public_delivery_download_allowed(p_album_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select p.public_listed and p.is_published and p.preview_enabled and p.deleted_at is null
 and p.public_download_enabled and p.photo_download_permission and p.package_price>0
 and public.delivery_total_paid(p.id)>=p.package_price and p.final_delivery_at is not null
 and (p.storage_retention_until is null or p.storage_retention_until>now())
 and ((p.free_access_expires_at is not null and p.free_access_expires_at>now()) or (p.access_expires_at is not null and p.access_expires_at>now()))
 and coalesce((public.delivery_late_fee_snapshot(p.id)->>'balance')::numeric,0)=0
 from public.delivery_portals p where p.id=p_album_id),false);
$$;
revoke all on function public.public_delivery_download_allowed(uuid) from public,anon,authenticated;
grant execute on function public.public_delivery_download_allowed(uuid) to service_role;

create or replace function public.delivery_admin_set_public_download(p_token text,p_portal_id uuid,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 if p_enabled is null then raise exception 'Download permission is required'; end if;
 if p_enabled and not exists(select 1 from public.delivery_portals p where p.id=p_portal_id and p.deleted_at is null and p.package_price>0 and public.delivery_total_paid(p.id)>=p.package_price) then
  raise exception 'Set the package price and verify full payment before enabling downloads.';
 end if;
 update public.delivery_portals set public_download_enabled=p_enabled where id=p_portal_id and deleted_at is null;
 return found;
end $$;
revoke all on function public.delivery_admin_set_public_download(text,uuid,boolean) from public;
grant execute on function public.delivery_admin_set_public_download(text,uuid,boolean) to anon,authenticated;

create or replace function public.public_delivery_albums(p_album_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',p.id,'title',coalesce(nullif(p.event_name,''),'Photo album'),'event_date',p.event_date,
 'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'download_enabled',public.public_delivery_download_allowed(p.id) and coalesce(f.photo_download_enabled,true)) order by f.sort_order,f.created_at),'[]'::jsonb)
 from public.delivery_files f where f.portal_id=p.id and f.is_visible and f.preview_enabled and f.file_type='PHOTO' and f.drive_file_id is not null)
 ) order by p.created_at desc),'[]'::jsonb)
 from public.delivery_portals p
 where p.public_listed and p.is_published and p.preview_enabled and p.deleted_at is null and (p_album_id is null or p.id=p_album_id);
$$;

create or replace function public.public_delivery_original(p_album_id uuid,p_file_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_token text;
begin
 if not public.public_delivery_download_allowed(p_album_id) then return null; end if;
 if not exists(select 1 from public.delivery_files where id=p_file_id and portal_id=p_album_id and is_visible and preview_enabled and file_type='PHOTO' and coalesce(photo_download_enabled,true) and drive_file_id is not null) then return null; end if;
 select secure_token into v_token from public.delivery_portals where id=p_album_id;
 return public.get_delivery_media_by_token(v_token,p_file_id,'ORIGINAL');
end $$;
revoke all on function public.public_delivery_original(uuid,uuid) from public,anon,authenticated;
grant execute on function public.public_delivery_original(uuid,uuid) to service_role;
