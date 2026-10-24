create table if not exists public.website_chatbot_settings (
  id boolean primary key default true check (id is true),
  auto_reply_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.website_chatbot_settings (id, auto_reply_enabled)
values (true, true)
on conflict (id) do nothing;

create table if not exists public.website_chatbot_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(btrim(question)) between 3 and 250),
  keywords text[] not null default '{}'::text[],
  answer text not null check (length(btrim(answer)) between 1 and 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.website_chatbot_settings enable row level security;
alter table public.website_chatbot_faqs enable row level security;
revoke all on table public.website_chatbot_settings, public.website_chatbot_faqs from public, anon, authenticated;

create or replace function public.booking_admin_chatbot_config(
  p_token text,
  p_action text,
  p_id uuid default null,
  p_question text default null,
  p_keywords text[] default '{}'::text[],
  p_answer text default null,
  p_is_active boolean default true,
  p_auto_reply_enabled boolean default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_faq public.website_chatbot_faqs%rowtype;
  v_keywords text[];
  v_faqs jsonb;
  v_enabled boolean;
begin
  if not coalesce(public._booking_admin_valid(p_token), false) then
    raise exception 'Admin session expired';
  end if;

  if p_action = 'get' then
    select s.auto_reply_enabled into v_enabled
    from public.website_chatbot_settings s
    where s.id = true;

    select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc), '[]'::jsonb)
      into v_faqs
    from public.website_chatbot_faqs f;

    return jsonb_build_object(
      'auto_reply_enabled', coalesce(v_enabled, true),
      'faqs', coalesce(v_faqs, '[]'::jsonb)
    );
  elsif p_action = 'settings' then
    if p_auto_reply_enabled is null then
      raise exception 'Auto-reply setting is required';
    end if;

    update public.website_chatbot_settings
      set auto_reply_enabled = p_auto_reply_enabled, updated_at = now()
      where id = true
      returning auto_reply_enabled into v_enabled;

    return jsonb_build_object('auto_reply_enabled', coalesce(v_enabled, true));
  elsif p_action = 'save' then
    if p_question is null or length(btrim(p_question)) not between 3 and 250 then
      raise exception 'Question must be 3 to 250 characters';
    end if;
    if p_answer is null or length(btrim(p_answer)) not between 1 and 2000 then
      raise exception 'Answer must be 1 to 2000 characters';
    end if;

    select coalesce(array_agg(distinct btrim(k)), '{}'::text[])
      into v_keywords
    from unnest(coalesce(p_keywords, '{}'::text[])) as input_keywords(k)
    where btrim(k) <> '';

    if coalesce(array_length(v_keywords, 1), 0) > 20 then
      raise exception 'Use at most 20 keywords';
    end if;

    if p_id is null then
      insert into public.website_chatbot_faqs(question, keywords, answer, is_active)
      values (btrim(p_question), v_keywords, btrim(p_answer), coalesce(p_is_active, true))
      returning * into v_faq;
    else
      update public.website_chatbot_faqs
        set question = btrim(p_question),
            keywords = v_keywords,
            answer = btrim(p_answer),
            is_active = coalesce(p_is_active, true),
            updated_at = now()
        where id = p_id
        returning * into v_faq;
      if not found then
        raise exception 'FAQ was not found';
      end if;
    end if;

    return to_jsonb(v_faq);
  elsif p_action = 'delete' then
    if p_id is null then
      raise exception 'FAQ ID is required';
    end if;
    delete from public.website_chatbot_faqs f
      where f.id = p_id
      returning f.* into v_faq;
    if not found then
      raise exception 'FAQ was not found';
    end if;
    return jsonb_build_object('deleted', true, 'id', v_faq.id);
  end if;

  raise exception 'Unsupported chatboard action';
end;
$function$;

create or replace function public.public_chatbot_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'auto_reply_enabled',
    coalesce((select s.auto_reply_enabled from public.website_chatbot_settings s where s.id = true), true),
    'faqs',
    case
      when coalesce((select s.auto_reply_enabled from public.website_chatbot_settings s where s.id = true), true)
      then coalesce((
        select jsonb_agg(
          jsonb_build_object('question', f.question, 'keywords', f.keywords, 'answer', f.answer)
          order by f.created_at desc
        )
        from public.website_chatbot_faqs f
        where f.is_active
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  );
$function$;

revoke all on function public.booking_admin_chatbot_config(text, text, uuid, text, text[], text, boolean, boolean) from public;
grant execute on function public.booking_admin_chatbot_config(text, text, uuid, text, text[], text, boolean, boolean) to anon, authenticated;
revoke all on function public.public_chatbot_config() from public;
grant execute on function public.public_chatbot_config() to anon, authenticated;
