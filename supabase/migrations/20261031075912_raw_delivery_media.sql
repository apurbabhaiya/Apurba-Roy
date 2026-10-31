alter table public.delivery_files
  add column if not exists is_raw boolean not null default false;

update public.delivery_files
set is_raw = true
where file_type = 'DOCUMENT'
  and (coalesce(file_name, '') ~* '\\.zip$' or coalesce(mime_type, '') ilike '%zip%' or coalesce(title, '') ilike 'RAW%ZIP%');

create or replace function public.delivery_admin_list_files(p_token text, p_portal_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Admin session expired'; end if;
  if not exists(select 1 from public.delivery_portals where id = p_portal_id) then raise exception 'Delivery portal not found'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'portal_id', f.portal_id, 'source_url', f.source_url,
      'drive_file_id', f.drive_file_id, 'drive_folder_id', f.drive_folder_id,
      'file_name', f.file_name, 'file_type', f.file_type, 'mime_type', f.mime_type,
      'title', f.title, 'sort_order', f.sort_order, 'is_visible', f.is_visible,
      'is_raw', f.is_raw, 'created_at', f.created_at, 'updated_at', f.updated_at
    ) order by f.sort_order, f.created_at)
    from public.delivery_files f where f.portal_id = p_portal_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_delivery_portal_by_token(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p public.delivery_portals%rowtype; result jsonb;
begin
 if p_token is null or length(p_token)<12 or length(p_token)>128 then return null; end if;
 select * into p from public.delivery_portals where secure_token=p_token limit 1;
 if not found or not p.is_published or p.deleted_at is not null then return null; end if;
 result:=public._get_delivery_portal_by_token_unpublished(p_token);
 if result is null then return null; end if;
 result:=result||jsonb_build_object('is_published',true,'document_download_permission',coalesce(p.document_download_permission,false),'rocket_number',p.rocket_number,'download_window_ends_at',p.download_window_ends_at,'download_access_hours',p.download_access_hours);
 if p.download_window_ends_at is not null then
  result:=result||jsonb_build_object('google_drive_access_enabled',false,'drive_link_access_enabled',false);
  if now()>=p.download_window_ends_at then result:=result||jsonb_build_object('download_status','LOCKED'); end if;
 end if;
 return jsonb_set(result,'{delivery_files}',coalesce((
 select (case when p.download_window_ends_at is not null
   then jsonb_agg((item-'google_drive_link'-'source_url')||jsonb_build_object('file_size_bytes',f.file_size_bytes,'is_raw',f.is_raw) order by f.sort_order,f.created_at)
   else jsonb_agg(item||jsonb_build_object('file_size_bytes',f.file_size_bytes,'is_raw',f.is_raw) order by f.sort_order,f.created_at) end)
 from jsonb_array_elements(coalesce(result->'delivery_files','[]'::jsonb)) item join public.delivery_files f on f.id=(item->>'id')::uuid
 ),'[]'::jsonb),true);
end $$;

create or replace function public.delivery_admin_preview_portal(p_token text, p_admin_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p public.delivery_portals%rowtype; result jsonb;
begin
  if not public._booking_admin_valid(p_admin_token) then raise exception 'Admin session expired'; end if;
  select * into p from public.delivery_portals where secure_token = p_token limit 1;
  if not found then raise exception 'Delivery portal not found'; end if;
  result := public._get_delivery_portal_by_token_unpublished(p_token);
  result := jsonb_set(result, '{is_published}', to_jsonb(p.is_published), true);
  result := jsonb_set(result, '{document_download_permission}', to_jsonb(coalesce(p.document_download_permission,false)), true);
  result := jsonb_set(result, '{rocket_number}', coalesce(to_jsonb(p.rocket_number), 'null'::jsonb), true);
  return jsonb_set(result, '{delivery_files}', coalesce((
    select jsonb_agg(item || jsonb_build_object('file_size_bytes', f.file_size_bytes, 'is_raw', f.is_raw) order by f.sort_order, f.created_at)
    from jsonb_array_elements(coalesce(result->'delivery_files','[]'::jsonb)) item
    join public.delivery_files f on f.id = (item->>'id')::uuid
  ), '[]'::jsonb), true);
end;
$$;

create or replace function public.public_delivery_albums(p_album_id uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',p.id,
 'title',coalesce(nullif(p.event_name,''),'Photo album'),
 'client_name',p.client_name,
 'event_name',p.event_name,
 'secure_token',case when p_album_id is null then p.secure_token else null end,
 'event_date',p.event_date,
 'download_expires_at',p.download_window_ends_at,
 'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',coalesce(f.title,f.file_name,'Photo'),'download_enabled',public.public_delivery_download_allowed(p.id) and p.photo_download_permission and coalesce(f.photo_download_enabled,true)) order by f.sort_order,f.created_at),'[]'::jsonb)
 from public.delivery_files f where f.portal_id=p.id and f.is_visible and f.preview_enabled and f.file_type='PHOTO' and not f.is_raw and f.drive_file_id is not null),
 'videos',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',coalesce(f.title,f.file_name,'Video'),'download_enabled',public.public_delivery_download_allowed(p.id) and p.video_download_permission and coalesce(f.video_download_enabled,true)) order by f.sort_order,f.created_at),'[]'::jsonb)
 from public.delivery_files f where f.portal_id=p.id and f.is_visible and f.preview_enabled and f.file_type='VIDEO' and not f.is_raw and f.drive_file_id is not null)
 ) order by p.created_at desc),'[]'::jsonb)
 from public.delivery_portals p where p.public_listed and p.is_published and p.preview_enabled and p.deleted_at is null and (p_album_id is null or p.id=p_album_id);
$$;

create or replace function public.public_delivery_photo(p_album_id uuid,p_file_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('drive_file_id',f.drive_file_id)
 from public.delivery_files f join public.delivery_portals p on p.id=f.portal_id
 where p.id=p_album_id and f.id=p_file_id and p.public_listed and p.is_published and p.preview_enabled and p.deleted_at is null
 and f.is_visible and f.preview_enabled and not f.is_raw and f.file_type in ('PHOTO','VIDEO') and f.drive_file_id is not null;
$$;

create or replace function public.public_delivery_original(p_album_id uuid, p_file_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_token text;
begin
 if not public.public_delivery_download_allowed(p_album_id) then return null; end if;
 if not exists(select 1 from public.delivery_files f join public.delivery_portals p on p.id=f.portal_id where f.id=p_file_id and f.portal_id=p_album_id and f.is_visible and f.preview_enabled and not f.is_raw and f.drive_file_id is not null
 and ((f.file_type='PHOTO' and p.photo_download_permission and coalesce(f.photo_download_enabled,true)) or (f.file_type='VIDEO' and p.video_download_permission and coalesce(f.video_download_enabled,true)))) then return null; end if;
 select secure_token into v_token from public.delivery_portals where id=p_album_id;
 return public.get_delivery_media_by_token(v_token,p_file_id,'ORIGINAL');
end $$;
