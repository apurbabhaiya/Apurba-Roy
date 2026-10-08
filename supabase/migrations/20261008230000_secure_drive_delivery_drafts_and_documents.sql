-- Private Drive authorization and additive final-delivery controls.
-- Existing delivery links remain published; newly-created portals default to draft.

create table if not exists public.delivery_drive_connections (
  id smallint primary key default 1 check (id = 1),
  account_email text not null,
  encrypted_refresh_token text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.delivery_drive_connections enable row level security;
revoke all on public.delivery_drive_connections from anon, authenticated;
grant all on public.delivery_drive_connections to service_role;

create table if not exists public.delivery_drive_oauth_states (
  state text primary key,
  encrypted_admin_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.delivery_drive_oauth_states enable row level security;
revoke all on public.delivery_drive_oauth_states from anon, authenticated;
grant all on public.delivery_drive_oauth_states to service_role;

alter table public.delivery_files
  add column if not exists file_size_bytes bigint,
  add constraint delivery_files_file_type_check_v2
    check (file_type = any (array['PHOTO','VIDEO','DOCUMENT','FOLDER']::text[]));
alter table public.delivery_files drop constraint if exists delivery_files_file_type_check;

alter table public.delivery_portals
  add column if not exists is_published boolean not null default false,
  add column if not exists document_download_permission boolean not null default false,
  add column if not exists rocket_number text;
update public.delivery_portals set is_published = true where is_published = false;

alter table public.delivery_payment_submissions drop constraint if exists delivery_payment_submissions_payment_method_check;
alter table public.delivery_payment_submissions add constraint delivery_payment_submissions_payment_method_check
  check (payment_method = any (array['BKASH','NAGAD','DBBL','ROCKET']::text[]));

-- Keep the existing admin file RPC behavior and extend its allowlist for documents.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.delivery_admin_upsert_file(text,uuid,uuid,text,text,text,text,text,integer,boolean)'::regprocedure) into definition;
  definition := replace(definition, $str$('PHOTO','VIDEO','FOLDER')$str$, $str$('PHOTO','VIDEO','DOCUMENT','FOLDER')$str$);
  definition := replace(definition, 'File type must be PHOTO, VIDEO or FOLDER', 'File type must be PHOTO, VIDEO, DOCUMENT or FOLDER');
  execute definition;
end $$;

-- Extend the verified payment procedure without changing its current checks.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.submit_delivery_payment(text,text,text,text,numeric,integer,text,text)'::regprocedure) into definition;
  definition := replace(definition, $str$('BKASH','NAGAD','DBBL')$str$, $str$('BKASH','NAGAD','DBBL','ROCKET')$str$);
  definition := replace(definition,
    $str$or (p_payment_method='DBBL' and nullif(trim(coalesce(p.dbbl_number,'')),'') is null) then$str$,
    $str$or (p_payment_method='DBBL' and nullif(trim(coalesce(p.dbbl_number,'')),'') is null)
     or (p_payment_method='ROCKET' and nullif(trim(coalesce(p.rocket_number,'')),'') is null) then$str$);
  execute definition;
end $$;

-- Preserve old client links while ensuring new portals are hidden until publish.
alter function public.get_delivery_portal_by_token(text) rename to _get_delivery_portal_by_token_unpublished;
revoke all on function public._get_delivery_portal_by_token_unpublished(text) from public, anon, authenticated;
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
  result := jsonb_set(result, '{rocket_number}', to_jsonb(p.rocket_number), true);
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
  result := jsonb_set(result, '{rocket_number}', to_jsonb(p.rocket_number), true);
  return jsonb_set(result, '{delivery_files}', coalesce((
    select jsonb_agg(item || jsonb_build_object('file_size_bytes', f.file_size_bytes) order by f.sort_order, f.created_at)
    from jsonb_array_elements(coalesce(result->'delivery_files','[]'::jsonb)) item
    join public.delivery_files f on f.id = (item->>'id')::uuid
  ), '[]'::jsonb), true);
end;
$$;
revoke all on function public.delivery_admin_preview_portal(text,text) from public;
grant execute on function public.delivery_admin_preview_portal(text,text) to anon, authenticated, service_role;

alter function public.get_delivery_media_by_token(text, uuid, text) rename to _get_delivery_media_by_token_unpublished;
revoke all on function public._get_delivery_media_by_token_unpublished(text, uuid, text) from public, anon, authenticated;
create or replace function public.get_delivery_media_by_token(
  p_token text, p_file_id uuid, p_mode text default 'PREVIEW', p_admin_token text default null
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p public.delivery_portals%rowtype; f public.delivery_files%rowtype; result jsonb;
begin
  select * into p from public.delivery_portals where secure_token = p_token limit 1;
  if not found then return null; end if;
  if not p.is_published and not public._booking_admin_valid(p_admin_token) then return null; end if;
  select * into f from public.delivery_files where id = p_file_id and portal_id = p.id and is_visible = true;
  if not found then return null; end if;
  if upper(coalesce(p_mode,'PREVIEW')) = 'ORIGINAL'
     and f.file_type = 'DOCUMENT' and not coalesce(p.document_download_permission,false) then
    raise exception 'Document downloads are disabled by the administrator';
  end if;
  result := public._get_delivery_media_by_token_unpublished(p_token, p_file_id, p_mode);
  if result is null then return null; end if;
  return jsonb_set(result, '{file_size_bytes}', to_jsonb(f.file_size_bytes), true);
end;
$$;
revoke all on function public.get_delivery_media_by_token(text, uuid, text, text) from public;
grant execute on function public.get_delivery_media_by_token(text, uuid, text, text) to anon, authenticated, service_role;

alter function public.submit_delivery_payment(text,text,text,text,numeric,integer,text,text) rename to _submit_delivery_payment_unpublished;
revoke all on function public._submit_delivery_payment_unpublished(text,text,text,text,numeric,integer,text,text) from public, anon, authenticated;
create or replace function public.submit_delivery_payment(
  p_token text,p_payment_type text,p_payer_phone text,p_transaction_id text,p_amount numeric,
  p_selected_days integer,p_payment_method text,p_proof_storage_path text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p public.delivery_portals%rowtype;
begin
  select * into p from public.delivery_portals where secure_token = p_token limit 1;
  if not found or not p.is_published then raise exception 'This delivery is not published'; end if;
  return public._submit_delivery_payment_unpublished(p_token,p_payment_type,p_payer_phone,p_transaction_id,p_amount,p_selected_days,p_payment_method,p_proof_storage_path);
end;
$$;
revoke all on function public.submit_delivery_payment(text,text,text,text,numeric,integer,text,text) from public;
grant execute on function public.submit_delivery_payment(text,text,text,text,numeric,integer,text,text) to anon, authenticated, service_role;

alter function public.get_delivery_payment_methods(text) rename to _get_delivery_payment_methods_unpublished;
revoke all on function public._get_delivery_payment_methods_unpublished(text) from public, anon, authenticated;
create or replace function public.get_delivery_payment_methods(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.delivery_portals%rowtype; methods jsonb;
begin
  select * into p from public.delivery_portals where secure_token = p_token limit 1;
  if not found or not p.is_published then return null; end if;
  methods := public._get_delivery_payment_methods_unpublished(p_token);
  return coalesce(methods,'{}'::jsonb) || jsonb_build_object('rocket_number',p.rocket_number);
end;
$$;
revoke all on function public.get_delivery_payment_methods(text) from public;
grant execute on function public.get_delivery_payment_methods(text) to anon, authenticated, service_role;

create or replace function public.delivery_admin_set_published(p_token text, p_portal_id uuid, p_published boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p public.delivery_portals%rowtype;
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Admin session expired'; end if;
  select * into p from public.delivery_portals where id = p_portal_id for update;
  if not found then raise exception 'Delivery portal not found'; end if;
  if p_published and not exists(select 1 from public.delivery_files where portal_id=p.id and is_visible and file_type <> 'FOLDER') then
    raise exception 'Add at least one visible delivery file before publishing';
  end if;
  update public.delivery_portals set is_published=p_published,
    delivery_status=case when p.final_delivery_at is not null then delivery_status when p_published then 'READY' else 'EDITING' end,
    updated_at=now() where id=p.id;
  insert into public.delivery_audit_logs(portal_id,action,details)
  values(p.id,case when p_published then 'DELIVERY_PUBLISHED' else 'DELIVERY_UNPUBLISHED' end,jsonb_build_object('published',p_published));
  return jsonb_build_object('success',true,'is_published',p_published);
end;
$$;
revoke all on function public.delivery_admin_set_published(text,uuid,boolean) from public;
grant execute on function public.delivery_admin_set_published(text,uuid,boolean) to anon, authenticated, service_role;

create or replace function public.delivery_admin_set_document_permission(p_token text,p_portal_id uuid,p_allowed boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Admin session expired'; end if;
  update public.delivery_portals set document_download_permission=coalesce(p_allowed,false),updated_at=now() where id=p_portal_id;
  if not found then raise exception 'Delivery portal not found'; end if;
  insert into public.delivery_audit_logs(portal_id,action,details) values(p_portal_id,'DOCUMENT_DOWNLOAD_PERMISSION_UPDATED',jsonb_build_object('enabled',p_allowed));
  return jsonb_build_object('success',true,'document_download_permission',p_allowed);
end;
$$;
revoke all on function public.delivery_admin_set_document_permission(text,uuid,boolean) from public;
grant execute on function public.delivery_admin_set_document_permission(text,uuid,boolean) to anon, authenticated, service_role;

create or replace function public.delivery_admin_update_payment_methods(
  p_token text,p_portal_id uuid,p_bkash_number text,p_nagad_number text,p_dbbl_number text,p_rocket_number text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public._booking_admin_valid(p_token) then raise exception 'Admin session expired'; end if;
  update public.delivery_portals set bkash_number=nullif(trim(coalesce(p_bkash_number,'')),''),
    nagad_number=nullif(trim(coalesce(p_nagad_number,'')),''),dbbl_number=nullif(trim(coalesce(p_dbbl_number,'')),''),
    rocket_number=nullif(trim(coalesce(p_rocket_number,'')),''),updated_at=now() where id=p_portal_id;
  if not found then raise exception 'Delivery portal not found'; end if;
  return jsonb_build_object('success',true);
end;
$$;
revoke all on function public.delivery_admin_update_payment_methods(text,uuid,text,text,text,text) from public;
grant execute on function public.delivery_admin_update_payment_methods(text,uuid,text,text,text,text) to anon, authenticated, service_role;

