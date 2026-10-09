-- Explicit owner-triggered rebuild for replaced Drive contents with unchanged metadata.
create function public.face_index_rebuild(p_gallery uuid,p_model text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform public.face_index_prepare(p_gallery,p_model,true);
  update public.face_photo_index set generation=gen_random_uuid(),status='pending',descriptors='[]'::jsonb,
    attempts=0,lease_id=null,error_code=null,indexed_at=null where gallery_id=p_gallery and model_version=p_model;
end;
$$;
revoke all on function public.face_index_rebuild(uuid,text) from public,anon,authenticated;
grant execute on function public.face_index_rebuild(uuid,text) to service_role;
