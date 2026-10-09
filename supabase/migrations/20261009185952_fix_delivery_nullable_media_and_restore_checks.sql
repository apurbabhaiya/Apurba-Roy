do $migration$
declare d text;
begin
 d:=pg_get_functiondef('public.get_delivery_media_by_token(text,uuid,text,text)'::regprocedure);
 d:=replace(d,'to_jsonb(f.file_size_bytes)','coalesce(to_jsonb(f.file_size_bytes), ''null''::jsonb)');
 d:=replace(d,'if not found then return null; end if;','if not found or p.deleted_at is not null then return null; end if;');
 -- Only the first missing-record check refers to the portal; keep the file check unchanged.
 d:=replace(d,'if not found or p.deleted_at is not null then return null; end if;'||chr(10)||'  if upper', 'if not found then return null; end if;'||chr(10)||'  if upper');
 execute d;
 d:=pg_get_functiondef('public.delivery_admin_preview_portal(text,text)'::regprocedure);
 d:=replace(d,'to_jsonb(p.rocket_number)','coalesce(to_jsonb(p.rocket_number), ''null''::jsonb)');
 execute d;
 d:=pg_get_functiondef('public.delivery_admin_restore_access(text,uuid,integer,boolean)'::regprocedure);
 d:=replace(d,'if not found then raise exception ''Delivery portal not found''; end if;',
 'if not found or p.deleted_at is not null then raise exception ''Delivery portal not found''; end if;
  if p.final_delivery_at is null then raise exception ''Activate final delivery before restoring access''; end if;
  if p.storage_retention_until is not null and p.storage_retention_until <= now() then raise exception ''Storage retention has ended. Extend the storage retention date in Delivery Settings before restoring access.''; end if;');
 execute d;
end $migration$;