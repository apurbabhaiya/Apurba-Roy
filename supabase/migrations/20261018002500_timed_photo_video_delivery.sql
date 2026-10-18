alter table public.delivery_portals
 add column if not exists photo_delivery_folder_url text,
 add column if not exists video_delivery_folder_url text,
 add column if not exists download_access_hours integer not null default 48,
 add column if not exists download_window_started_at timestamptz,
 add column if not exists download_window_ends_at timestamptz;

create or replace function public.delivery_admin_configure_downloads(p_token text,p_portal_id uuid,p_photo_folder text,p_video_folder text,p_hours integer)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 if p_hours is null or p_hours<1 or p_hours>8760 then raise exception 'Duration must be between 1 and 8760 hours'; end if;
 if coalesce(p_photo_folder,'')<>'' and p_photo_folder !~ '^https://drive[.]google[.]com/(drive/(u/[0-9]+/)?)?folders/[A-Za-z0-9_-]+' then raise exception 'Invalid photo Drive folder'; end if;
 if coalesce(p_video_folder,'')<>'' and p_video_folder !~ '^https://drive[.]google[.]com/(drive/(u/[0-9]+/)?)?folders/[A-Za-z0-9_-]+' then raise exception 'Invalid video Drive folder'; end if;
 update public.delivery_portals set photo_delivery_folder_url=nullif(p_photo_folder,''),video_delivery_folder_url=nullif(p_video_folder,''),download_access_hours=p_hours where id=p_portal_id and deleted_at is null;
 return found;
end $$;
revoke all on function public.delivery_admin_configure_downloads(text,uuid,text,text,integer) from public;
grant execute on function public.delivery_admin_configure_downloads(text,uuid,text,text,integer) to anon,authenticated;

create or replace function public.delivery_admin_set_public_download(p_token text,p_portal_id uuid,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 if p_enabled is null then raise exception 'Download permission is required'; end if;
 if p_enabled and not exists(select 1 from public.delivery_portals p where p.id=p_portal_id and p.deleted_at is null and p.package_price>0 and public.delivery_total_paid(p.id)>=p.package_price) then
  raise exception 'Set the package price and verify full payment before enabling downloads.';
 end if;
 update public.delivery_portals set public_download_enabled=p_enabled,
 download_window_started_at=case when p_enabled then now() else download_window_started_at end,
 download_window_ends_at=case when p_enabled then now()+make_interval(hours=>download_access_hours) else now() end
 where id=p_portal_id and deleted_at is null;
 return found;
end $$;

create or replace function public.public_delivery_download_allowed(p_album_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select p.public_listed and p.is_published and p.preview_enabled and p.deleted_at is null
 and p.public_download_enabled and p.download_window_started_at<=now() and p.download_window_ends_at>now()
 and (p.photo_download_permission or p.video_download_permission) and p.package_price>0
 and public.delivery_total_paid(p.id)>=p.package_price and p.final_delivery_at is not null
 and (p.storage_retention_until is null or p.storage_retention_until>now())
 and ((p.free_access_expires_at is not null and p.free_access_expires_at>now()) or (p.access_expires_at is not null and p.access_expires_at>now()))
 and coalesce((public.delivery_late_fee_snapshot(p.id)->>'balance')::numeric,0)=0
 from public.delivery_portals p where p.id=p_album_id),false);
$$;

create or replace function public.public_delivery_albums(p_album_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',p.id,'title',coalesce(nullif(p.event_name,''),'Photo album'),'event_date',p.event_date,'download_expires_at',p.download_window_ends_at,
 'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',coalesce(f.title,f.file_name,'Photo'),'download_enabled',public.public_delivery_download_allowed(p.id) and p.photo_download_permission and coalesce(f.photo_download_enabled,true)) order by f.sort_order,f.created_at),'[]'::jsonb)
 from public.delivery_files f where f.portal_id=p.id and f.is_visible and f.preview_enabled and f.file_type='PHOTO' and f.drive_file_id is not null),
 'videos',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',coalesce(f.title,f.file_name,'Video'),'download_enabled',public.public_delivery_download_allowed(p.id) and p.video_download_permission and coalesce(f.video_download_enabled,true)) order by f.sort_order,f.created_at),'[]'::jsonb)
 from public.delivery_files f where f.portal_id=p.id and f.is_visible and f.preview_enabled and f.file_type='VIDEO' and f.drive_file_id is not null)
 ) order by p.created_at desc),'[]'::jsonb)
 from public.delivery_portals p where p.public_listed and p.is_published and p.preview_enabled and p.deleted_at is null and (p_album_id is null or p.id=p_album_id);
$$;

create or replace function public.public_delivery_photo(p_album_id uuid,p_file_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('drive_file_id',f.drive_file_id)
 from public.delivery_files f join public.delivery_portals p on p.id=f.portal_id
 where p.id=p_album_id and f.id=p_file_id and p.public_listed and p.is_published and p.preview_enabled and p.deleted_at is null
 and f.is_visible and f.preview_enabled and f.file_type in ('PHOTO','VIDEO') and f.drive_file_id is not null;
$$;

create or replace function public.public_delivery_original(p_album_id uuid,p_file_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_token text;
begin
 if not public.public_delivery_download_allowed(p_album_id) then return null; end if;
 if not exists(select 1 from public.delivery_files f join public.delivery_portals p on p.id=f.portal_id where f.id=p_file_id and f.portal_id=p_album_id and f.is_visible and f.preview_enabled and f.drive_file_id is not null
 and ((f.file_type='PHOTO' and p.photo_download_permission and coalesce(f.photo_download_enabled,true)) or (f.file_type='VIDEO' and p.video_download_permission and coalesce(f.video_download_enabled,true)))) then return null; end if;
 select secure_token into v_token from public.delivery_portals where id=p_album_id;
 return public.get_delivery_media_by_token(v_token,p_file_id,'ORIGINAL');
end $$;

-- Apply configured window to originals in private delivery too.
create or replace function public.get_delivery_media_by_token(p_token text,p_file_id uuid,p_mode text default 'PREVIEW',p_admin_token text default null)
returns jsonb language plpgsql security definer set search_path='public','extensions' as $$
declare p public.delivery_portals%rowtype; f public.delivery_files%rowtype; result jsonb;
begin
 select * into p from public.delivery_portals where secure_token=p_token limit 1;
 if not found or p.deleted_at is not null then return null; end if;
 if not p.is_published and not coalesce(public._booking_admin_valid(p_admin_token),false) then return null; end if;
 select * into f from public.delivery_files where id=p_file_id and portal_id=p.id and is_visible;
 if not found then return null; end if;
 if upper(coalesce(p_mode,'PREVIEW'))='ORIGINAL' then
  if p.download_window_ends_at is not null and now()>=p.download_window_ends_at then raise exception 'Download access period has ended'; end if;
  if f.file_type='DOCUMENT' and not coalesce(p.document_download_permission,false) then raise exception 'Document downloads are disabled by the administrator'; end if;
 end if;
 result:=public._get_delivery_media_by_token_unpublished(p_token,p_file_id,p_mode);
 if result is null then return null; end if;
 return jsonb_set(result,'{file_size_bytes}',coalesce(to_jsonb(f.file_size_bytes),'null'::jsonb),true);
end $$;

create or replace function public.get_delivery_portal_by_token(p_token text)
returns jsonb language plpgsql security definer set search_path='public','extensions' as $$
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
 select (case when p.download_window_ends_at is not null then jsonb_agg((item-'google_drive_link'-'source_url')||jsonb_build_object('file_size_bytes',f.file_size_bytes) order by f.sort_order,f.created_at)
 else jsonb_agg(item||jsonb_build_object('file_size_bytes',f.file_size_bytes) order by f.sort_order,f.created_at) end)
 from jsonb_array_elements(coalesce(result->'delivery_files','[]'::jsonb)) item join public.delivery_files f on f.id=(item->>'id')::uuid
 ),'[]'::jsonb),true);
end $$;