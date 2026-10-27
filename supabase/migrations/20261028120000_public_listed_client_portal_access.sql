create or replace function public.public_delivery_albums(p_album_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',p.id,
 'title',coalesce(nullif(p.event_name,''),'Photo album'),
 'client_name',p.client_name,
 'event_name',p.event_name,
 'secure_token',case when p_album_id is null then p.secure_token else null end,
 'event_date',p.event_date,
 'download_expires_at',p.download_window_ends_at,
 'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',coalesce(f.title,f.file_name,'Photo'),'download_enabled',public.public_delivery_download_allowed(p.id) and p.photo_download_permission and coalesce(f.photo_download_enabled,true)) order by f.sort_order,f.created_at),'[]'::jsonb)
 from public.delivery_files f where f.portal_id=p.id and f.is_visible and f.preview_enabled and f.file_type='PHOTO' and f.drive_file_id is not null),
 'videos',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',coalesce(f.title,f.file_name,'Video'),'download_enabled',public.public_delivery_download_allowed(p.id) and p.video_download_permission and coalesce(f.video_download_enabled,true)) order by f.sort_order,f.created_at),'[]'::jsonb)
 from public.delivery_files f where f.portal_id=p.id and f.is_visible and f.preview_enabled and f.file_type='VIDEO' and f.drive_file_id is not null)
 ) order by p.created_at desc),'[]'::jsonb)
 from public.delivery_portals p where p.public_listed and p.is_published and p.preview_enabled and p.deleted_at is null and (p_album_id is null or p.id=p_album_id);
$$;

revoke all on function public.public_delivery_albums(uuid) from public;
grant execute on function public.public_delivery_albums(uuid) to anon,authenticated,service_role;
