-- Face features and worker leases are server-only. No changes to gallery/photo RLS.
create table public.face_photo_index (
  photo_id uuid primary key references public.photos(id) on delete cascade,
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  model_version text not null,
  source_hash text not null,
  generation uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','processing','ready','no_face','failed')),
  descriptors jsonb not null default '[]'::jsonb check (jsonb_typeof(descriptors) = 'array' and jsonb_array_length(descriptors) <= 100),
  attempts integer not null default 0 check (attempts between 0 and 3),
  lease_id uuid,
  error_code text,
  indexed_at timestamptz
);
create index face_photo_index_gallery on public.face_photo_index(gallery_id,model_version,status);
create table public.face_index_runs (
  gallery_id uuid primary key references public.galleries(id) on delete cascade,
  lease_id uuid,
  lease_until timestamptz
);
create table public.face_search_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  requests integer not null default 1
);
alter table public.face_photo_index enable row level security;
alter table public.face_index_runs enable row level security;
alter table public.face_search_limits enable row level security;
revoke all on public.face_photo_index, public.face_index_runs, public.face_search_limits from public,anon,authenticated;
grant select,insert,update,delete on public.face_photo_index, public.face_index_runs, public.face_search_limits to service_role;

create function public.face_index_prepare(p_gallery uuid,p_model text,p_retry boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
begin
  insert into public.face_index_runs(gallery_id) values(p_gallery) on conflict do nothing;
  insert into public.face_photo_index(photo_id,gallery_id,model_version,source_hash)
    select p.id,p.gallery_id,p_model,md5(concat_ws('|',p.drive_file_id,p.size_text,p.drive_created_time,p.mime_type))
    from public.photos p where p.gallery_id=p_gallery and (p.mime_type is null or p.mime_type like 'image/%')
    on conflict(photo_id) do update set model_version=excluded.model_version, source_hash=excluded.source_hash,
      generation=gen_random_uuid(),status='pending',descriptors='[]'::jsonb,attempts=0,lease_id=null,error_code=null,indexed_at=null
    where public.face_photo_index.model_version<>excluded.model_version or public.face_photo_index.source_hash<>excluded.source_hash;
  if p_retry then
    update public.face_photo_index set generation=gen_random_uuid(),status='pending',descriptors='[]'::jsonb,
      attempts=0,lease_id=null,error_code=null,indexed_at=null
    where gallery_id=p_gallery and model_version=p_model and status='failed';
  end if;
end;
$$;

create function public.face_index_status(p_gallery uuid,p_model text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'total',count(*),
    'ready',count(*) filter(where i.status='ready'),
    'noFace',count(*) filter(where i.status='no_face'),
    'failed',count(*) filter(where i.status='failed'),
    'pending',count(*) filter(where i.status in ('pending','processing')),
    'unindexed',count(*) filter(where i.photo_id is null)
  ) from public.photos p left join public.face_photo_index i on i.photo_id=p.id and i.model_version=p_model
  where p.gallery_id=p_gallery and (p.mime_type is null or p.mime_type like 'image/%');
$$;

create function public.face_index_claim_batch(p_gallery uuid,p_model text,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare jobs jsonb;
begin
  update public.face_index_runs set lease_id=p_lease,lease_until=now()+interval '180 seconds'
    where gallery_id=p_gallery and (lease_until is null or lease_until<now());
  if not found then
    return jsonb_build_object('busy',exists(select 1 from public.face_index_runs where gallery_id=p_gallery),'jobs','[]'::jsonb);
  end if;
  -- Recover interrupted invocations. Attempts include crashed invocations.
  update public.face_photo_index set status=case when attempts>=3 then 'failed' else 'pending' end,
    error_code='WORKER_INTERRUPTED',lease_id=null where gallery_id=p_gallery and status='processing';
  with picked as (
    select i.photo_id from public.face_photo_index i where i.gallery_id=p_gallery and i.model_version=p_model
      and i.status='pending' and i.attempts<3 order by i.photo_id limit 5 for update skip locked
  ), claimed as (
    update public.face_photo_index i set status='processing',attempts=attempts+1,lease_id=p_lease
      from picked where i.photo_id=picked.photo_id returning i.photo_id,i.generation,i.attempts
  ) select coalesce(jsonb_agg(jsonb_build_object('photo_id',c.photo_id,'generation',c.generation,'attempts',c.attempts,
      'drive_file_id',p.drive_file_id,'thumbnail_url',p.thumbnail_url) order by c.photo_id),'[]'::jsonb)
    into jobs from claimed c join public.photos p on p.id=c.photo_id;
  if jsonb_array_length(jobs)=0 then
    update public.face_index_runs set lease_id=null,lease_until=null where gallery_id=p_gallery and lease_id=p_lease;
  end if;
  return jsonb_build_object('busy',false,'jobs',jobs);
end;
$$;

create function public.face_index_release(p_gallery uuid,p_lease uuid)
returns void language sql security invoker set search_path='' as $$
  update public.face_index_runs set lease_id=null,lease_until=null where gallery_id=p_gallery and lease_id=p_lease;
$$;

create function public.face_index_rate_limit(p_user uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare hits integer;
begin
  insert into public.face_search_limits(user_id) values(p_user)
    on conflict(user_id) do update set
      requests=case when public.face_search_limits.window_start<now()-interval '1 minute' then 1 else public.face_search_limits.requests+1 end,
      window_start=case when public.face_search_limits.window_start<now()-interval '1 minute' then now() else public.face_search_limits.window_start end
    returning requests into hits;
  return hits<=10;
end;
$$;

-- A source replacement invalidates old features immediately; URL refreshes do not.
create function public.face_index_invalidate_photo()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if row(new.gallery_id,new.drive_file_id,new.size_text,new.drive_created_time,new.mime_type)
      is distinct from row(old.gallery_id,old.drive_file_id,old.size_text,old.drive_created_time,old.mime_type) then
    update public.face_photo_index set gallery_id=new.gallery_id,status='pending',descriptors='[]'::jsonb,generation=gen_random_uuid(),
      source_hash=md5(concat_ws('|',new.drive_file_id,new.size_text,new.drive_created_time,new.mime_type)),
      attempts=0,lease_id=null,indexed_at=null,error_code=null where photo_id=new.id;
  end if;
  return new;
end;
$$;
create trigger face_index_source_change after update of gallery_id,drive_file_id,size_text,drive_created_time,mime_type on public.photos
  for each row execute function public.face_index_invalidate_photo();

revoke all on function public.face_index_prepare(uuid,text,boolean),public.face_index_status(uuid,text),
  public.face_index_claim_batch(uuid,text,uuid),public.face_index_release(uuid,uuid),
  public.face_index_rate_limit(uuid),public.face_index_invalidate_photo() from public,anon,authenticated;
grant execute on function public.face_index_prepare(uuid,text,boolean),public.face_index_status(uuid,text),
  public.face_index_claim_batch(uuid,text,uuid),public.face_index_release(uuid,uuid),public.face_index_rate_limit(uuid) to service_role;
