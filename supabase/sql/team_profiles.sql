create table if not exists public.website_team_members (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 100),role text not null check(length(trim(role)) between 1 and 150),bio text not null default '' check(length(bio)<=2000),photo_url text not null default '' check(length(photo_url)<=700000),tags text[] not null default '{}',sort_order integer not null default 0,is_visible boolean not null default false,deleted_at timestamptz,updated_at timestamptz not null default now()
);
create table if not exists public.website_team_work (
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.website_team_members(id) on delete cascade,post_id uuid references public.portfolio_posts(id) on delete cascade,title text not null default '' check(length(title)<=200),media_url text not null default '' check(length(media_url)<=2000),media_type text not null default 'photo' check(media_type in ('photo','video')),created_at timestamptz not null default now(),check(post_id is not null or media_url ~ '^https://')
);
create unique index if not exists website_team_post_tag on public.website_team_work(member_id,post_id) where post_id is not null;
create index if not exists website_team_work_member on public.website_team_work(member_id);
alter table public.website_team_members enable row level security;
alter table public.website_team_work enable row level security;
revoke all on public.website_team_members,public.website_team_work from public,anon,authenticated;
create or replace function public.website_public_team() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'role',m.role,'bio',m.bio,'photo_url',m.photo_url,'tags',m.tags,'works',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'post_id',w.post_id,'title',case when w.post_id is null then w.title else p.title end,'media_url',case when w.post_id is null then w.media_url else p.cover_image_url end,'media_type',w.media_type) order by w.created_at desc) from public.website_team_work w left join public.portfolio_posts p on p.id=w.post_id where w.member_id=m.id and (w.post_id is null or p.is_published)),'[]'::jsonb)) order by m.sort_order,m.name),'[]'::jsonb) from public.website_team_members m where m.is_visible and m.deleted_at is null;
$$;
create or replace function public.website_admin_team(p_token text,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid;wid uuid;v record;result jsonb;
begin
 if not coalesce(public._booking_admin_valid(p_token),false) then raise exception 'Admin session expired'; end if;
 if p_action='save' then
  if length(trim(coalesce(p_payload->>'name',''))) not between 1 and 100 or length(trim(coalesce(p_payload->>'role',''))) not between 1 and 150 then raise exception 'Name and role are required'; end if;
  if coalesce(p_payload->>'photo_url','')<>'' and p_payload->>'photo_url' !~ '^(https://|data:image/(jpeg|png|webp);base64,)' then raise exception 'Use an HTTPS image or uploaded portrait'; end if;
  if jsonb_typeof(p_payload->'tags') is distinct from 'array' or jsonb_array_length(p_payload->'tags')>15 then raise exception 'Use up to 15 tags'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_payload->'tags') t where length(t)>60) then raise exception 'Tag is too long';end if;
  if jsonb_typeof(p_payload->'post_ids') is distinct from 'array' or jsonb_array_length(p_payload->'post_ids')>200 then raise exception 'Select up to 200 portfolio stories'; end if;
  mid:=nullif(p_payload->>'id','')::uuid;
  if mid is null then
   insert into public.website_team_members(name,role,bio,photo_url,tags,sort_order,is_visible) values(trim(p_payload->>'name'),trim(p_payload->>'role'),coalesce(p_payload->>'bio',''),coalesce(p_payload->>'photo_url',''),array(select jsonb_array_elements_text(p_payload->'tags')),coalesce((p_payload->>'sort_order')::integer,0),coalesce((p_payload->>'is_visible')::boolean,false)) returning id into mid;
  else
   update public.website_team_members set name=trim(p_payload->>'name'),role=trim(p_payload->>'role'),bio=coalesce(p_payload->>'bio',''),photo_url=coalesce(p_payload->>'photo_url',''),tags=array(select jsonb_array_elements_text(p_payload->'tags')),sort_order=coalesce((p_payload->>'sort_order')::integer,0),is_visible=coalesce((p_payload->>'is_visible')::boolean,false),updated_at=now() where id=mid and deleted_at is null;
   if not found then raise exception 'Member not found';end if;
  end if;
  delete from public.website_team_work where member_id=mid and post_id is not null;
  insert into public.website_team_work(member_id,post_id) select mid,value::uuid from jsonb_array_elements_text(p_payload->'post_ids') on conflict do nothing;
 elsif p_action in ('visibility','trash','restore') then
  mid:=(p_payload->>'id')::uuid;
  update public.website_team_members set is_visible=case when p_action='visibility' then coalesce((p_payload->>'is_visible')::boolean,false) when p_action='trash' then false else is_visible end,deleted_at=case when p_action='trash' then now() when p_action='restore' then null else deleted_at end,updated_at=now() where id=mid;
  if not found then raise exception 'Member not found';end if;
 elsif p_action='add_work' then
  mid:=(p_payload->>'member_id')::uuid;
  if not exists(select 1 from public.website_team_members where id=mid and deleted_at is null) then raise exception 'Member not found';end if;
  if coalesce(p_payload->>'media_url','') !~ '^https://' then raise exception 'Use an HTTPS photo or video link';end if;
  if length(trim(coalesce(p_payload->>'title','')))=0 then raise exception 'Work title is required';end if;
  insert into public.website_team_work(member_id,title,media_url,media_type) values(mid,p_payload->>'title',p_payload->>'media_url',p_payload->>'media_type');
 elsif p_action='remove_work' then
  delete from public.website_team_work where id=(p_payload->>'id')::uuid;
 elsif p_action<>'list' then raise exception 'Invalid action';
 end if;
 return jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('works',coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from public.website_team_work w where w.member_id=m.id),'[]'::jsonb)) order by m.sort_order,m.name) from public.website_team_members m),'[]'::jsonb),'posts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'is_published',p.is_published) order by p.created_at desc) from public.portfolio_posts p),'[]'::jsonb));
end;$$;
revoke all on function public.website_public_team(), public.website_admin_team(text,text,jsonb) from public;
grant execute on function public.website_public_team(), public.website_admin_team(text,text,jsonb) to anon,authenticated;
