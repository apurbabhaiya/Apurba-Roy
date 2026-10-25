alter table public.website_team_members
  add column if not exists phone text not null default '';

alter table public.website_team_members
  drop constraint if exists website_team_members_phone_check;
alter table public.website_team_members
  add constraint website_team_members_phone_check
  check (length(phone) <= 30);

drop policy if exists website_team_members_public_read on public.website_team_members;
create policy website_team_members_public_read
  on public.website_team_members
  for select
  to anon, authenticated
  using (is_visible = true and deleted_at is null);

drop policy if exists website_team_work_public_read on public.website_team_work;
create policy website_team_work_public_read
  on public.website_team_work
  for select
  to anon, authenticated
  using (exists (
    select 1
    from public.website_team_members member
    where member.id = website_team_work.member_id
      and member.is_visible = true
      and member.deleted_at is null
  ));

grant select on public.website_team_members to anon, authenticated;
grant select on public.website_team_work to anon, authenticated;

create index if not exists website_team_work_post_id_idx
  on public.website_team_work(post_id);

create or replace function public.website_team_admin_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then
    raise exception 'Admin session expired';
  end if;

  return jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(to_jsonb(member) order by member.sort_order, member.name)
      from public.website_team_members member
      where member.deleted_at is null
    ), '[]'::jsonb),
    'work', coalesce((
      select jsonb_agg(to_jsonb(work) order by work.created_at)
      from public.website_team_work work
    ), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', post.id,
        'title', post.title,
        'event_type', post.event_type,
        'cover_image_url', post.cover_image_url,
        'is_published', post.is_published
      ) order by post.created_at desc)
      from public.portfolio_posts post
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.website_team_admin_save(p_token text, p_member jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_member public.website_team_members%rowtype;
  v_tags text[];
  v_name text;
  v_role text;
  v_phone text;
  v_bio text;
  v_photo_url text;
  v_sort_order integer;
  v_is_visible boolean;
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then
    raise exception 'Admin session expired';
  end if;
  if jsonb_typeof(p_member) <> 'object' then
    raise exception 'Member information is required';
  end if;

  v_name := btrim(coalesce(p_member->>'name', ''));
  v_role := btrim(coalesce(p_member->>'role', ''));
  v_phone := btrim(coalesce(p_member->>'phone', ''));
  v_bio := coalesce(p_member->>'bio', '');
  v_photo_url := coalesce(p_member->>'photo_url', '');
  v_sort_order := greatest(-10000, least(10000, coalesce(nullif(p_member->>'sort_order', '')::integer, 0)));
  v_is_visible := coalesce((p_member->>'is_visible')::boolean, false);

  if length(v_name) < 1 or length(v_name) > 100 then
    raise exception 'Name must be between 1 and 100 characters';
  end if;
  if length(v_role) < 1 or length(v_role) > 150 then
    raise exception 'Role must be between 1 and 150 characters';
  end if;
  if length(v_phone) > 30 or length(v_bio) > 2000 then
    raise exception 'Phone or biography is too long';
  end if;
  if length(v_photo_url) > 700000 then
    raise exception 'Photo is too large';
  end if;
  if v_photo_url <> '' and v_photo_url !~ '^data:image/(jpeg|png|webp);base64,' then
    raise exception 'Use a JPEG, PNG, or WebP image';
  end if;

  select coalesce(array_agg(tag), '{}'::text[])
  into v_tags
  from jsonb_array_elements_text(coalesce(p_member->'tags', '[]'::jsonb)) as tags(tag);

  v_id := nullif(p_member->>'id', '')::uuid;
  if v_id is null then
    insert into public.website_team_members
      (name, role, phone, bio, photo_url, tags, sort_order, is_visible, updated_at)
    values
      (v_name, v_role, v_phone, v_bio, v_photo_url, v_tags, v_sort_order, v_is_visible, now())
    returning * into v_member;
  else
    update public.website_team_members
    set name = v_name,
        role = v_role,
        phone = v_phone,
        bio = v_bio,
        photo_url = v_photo_url,
        tags = v_tags,
        sort_order = v_sort_order,
        is_visible = v_is_visible,
        updated_at = now()
    where id = v_id and deleted_at is null
    returning * into v_member;
    if not found then
      raise exception 'Team member was not found';
    end if;
  end if;

  return to_jsonb(v_member);
end;
$function$;

create or replace function public.website_team_admin_set_work(
  p_token text,
  p_member_id uuid,
  p_post_ids uuid[] default '{}'::uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then
    raise exception 'Admin session expired';
  end if;
  if not exists (
    select 1 from public.website_team_members member
    where member.id = p_member_id and member.deleted_at is null
  ) then
    raise exception 'Team member was not found';
  end if;

  delete from public.website_team_work where member_id = p_member_id;

  insert into public.website_team_work (member_id, post_id, title, media_url, media_type)
  select p_member_id, post.id, post.title, coalesce(post.cover_image_url, ''), 'photo'
  from public.portfolio_posts post
  where post.id = any(coalesce(p_post_ids, '{}'::uuid[]));

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.website_team_admin_snapshot(text) from public;
revoke all on function public.website_team_admin_save(text, jsonb) from public;
revoke all on function public.website_team_admin_set_work(text, uuid, uuid[]) from public;
grant execute on function public.website_team_admin_snapshot(text) to anon, authenticated;
grant execute on function public.website_team_admin_save(text, jsonb) to anon, authenticated;
grant execute on function public.website_team_admin_set_work(text, uuid, uuid[]) to anon, authenticated;

