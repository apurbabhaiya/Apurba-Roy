alter table public.delivery_portals add column if not exists public_listed boolean not null default false;

create or replace function public.delivery_admin_set_public_listing(p_token text,p_portal_id uuid,p_visible boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 if p_visible is null then raise exception 'Visibility is required'; end if;
 if p_visible and not exists(select 1 from public.delivery_portals where id=p_portal_id and deleted_at is null and is_published and preview_enabled) then
  raise exception 'Publish the delivery and enable preview before showing the album.';
 end if;
 update public.delivery_portals set public_listed=p_visible where id=p_portal_id and deleted_at is null;
 return found;
end $$;

create or replace function public.public_delivery_albums(p_album_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',p.id,'title',coalesce(nullif(p.event_name,''),'Photo album'),'event_date',p.event_date,
 'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id) order by f.sort_order,f.created_at),'[]'::jsonb)
 from public.delivery_files f where f.portal_id=p.id and f.is_visible and f.preview_enabled and f.file_type='PHOTO' and f.drive_file_id is not null)
 ) order by p.created_at desc),'[]'::jsonb)
 from public.delivery_portals p
 where p.public_listed and p.is_published and p.preview_enabled and p.deleted_at is null and (p_album_id is null or p.id=p_album_id);
$$;

create or replace function public.public_delivery_photo(p_album_id uuid,p_file_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('drive_file_id',f.drive_file_id)
 from public.delivery_files f join public.delivery_portals p on p.id=f.portal_id
 where p.id=p_album_id and f.id=p_file_id and p.public_listed and p.is_published and p.preview_enabled and p.deleted_at is null
 and f.is_visible and f.preview_enabled and f.file_type='PHOTO' and f.drive_file_id is not null;
$$;

revoke all on function public.delivery_admin_set_public_listing(text,uuid,boolean) from public;
grant execute on function public.delivery_admin_set_public_listing(text,uuid,boolean) to anon,authenticated;
revoke all on function public.public_delivery_albums(uuid) from public;
grant execute on function public.public_delivery_albums(uuid) to anon,authenticated,service_role;
revoke all on function public.public_delivery_photo(uuid,uuid) from public,anon,authenticated;
grant execute on function public.public_delivery_photo(uuid,uuid) to service_role;
