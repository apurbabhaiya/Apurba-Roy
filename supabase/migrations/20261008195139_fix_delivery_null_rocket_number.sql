-- Preserve JSON output when Rocket payment details are not configured.
-- jsonb_set returns SQL NULL when new_value is SQL NULL; use JSON null instead.

create or replace function public.get_delivery_portal_by_token(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p public.delivery_portals%rowtype; result jsonb;
begin
  if p_token is null or length(p_token) < 12 or length(p_token) > 128 then return null; end if;
  select * into p from public.delivery_portals where secure_token = p_token limit 1;
  if not found or not p.is_published then return null; end if;
  result := public._get_delivery_portal_by_token_unpublished(p_token);
  if result is null then return null; end if;
  result := jsonb_set(result, '{is_published}', 'true'::jsonb, true);
  result := jsonb_set(result, '{document_download_permission}', to_jsonb(coalesce(p.document_download_permission,false)), true);
  result := jsonb_set(result, '{rocket_number}', coalesce(to_jsonb(p.rocket_number), 'null'::jsonb), true);
  return jsonb_set(result, '{delivery_files}', coalesce((
    select jsonb_agg(item || jsonb_build_object('file_size_bytes', f.file_size_bytes) order by f.sort_order, f.created_at)
    from jsonb_array_elements(coalesce(result->'delivery_files','[]'::jsonb)) item
    join public.delivery_files f on f.id = (item->>'id')::uuid
  ), '[]'::jsonb), true);
end;
$$;
revoke all on function public.get_delivery_portal_by_token(text) from public;
grant execute on function public.get_delivery_portal_by_token(text) to anon, authenticated, service_role;

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
    select jsonb_agg(item || jsonb_build_object('file_size_bytes', f.file_size_bytes) order by f.sort_order, f.created_at)
    from jsonb_array_elements(coalesce(result->'delivery_files','[]'::jsonb)) item
    join public.delivery_files f on f.id = (item->>'id')::uuid
  ), '[]'::jsonb), true);
end;
$$;
revoke all on function public.delivery_admin_preview_portal(text,text) from public;
grant execute on function public.delivery_admin_preview_portal(text,text) to anon, authenticated, service_role;
