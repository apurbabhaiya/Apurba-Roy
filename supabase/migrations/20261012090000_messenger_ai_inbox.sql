-- RamyaChobi AI Inbox: server-only data; all access is mediated by Vercel Functions
create table if not exists public.messenger_settings (
  id smallint primary key default 1 check (id = 1),
  page_id text,
  page_name text,
  is_connected boolean not null default false,
  ai_enabled boolean not null default false,
  auto_reply_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messenger_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(question) between 3 and 1000),
  answer text not null check (length(answer) between 1 and 4000),
  keywords text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messenger_threads (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'facebook' check (platform in ('facebook','instagram','whatsapp')),
  external_id text not null unique,
  customer_name text,
  customer_avatar text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  status text not null default 'open' check (status in ('open','pending','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messenger_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.messenger_threads(id) on delete cascade,
  external_id text unique,
  direction text not null check (direction in ('inbound','outbound')),
  message_text text not null,
  sent_by text not null default 'customer' check (sent_by in ('customer','agent','ai')),
  created_at timestamptz not null default now()
);

create index if not exists messenger_threads_last_message_at_idx on public.messenger_threads(last_message_at desc nulls last);
create index if not exists messenger_messages_thread_created_idx on public.messenger_messages(thread_id, created_at);

alter table public.messenger_settings enable row level security;
alter table public.messenger_faqs enable row level security;
alter table public.messenger_threads enable row level security;
alter table public.messenger_messages enable row level security;

revoke all on public.messenger_settings, public.messenger_faqs, public.messenger_threads, public.messenger_messages from anon, authenticated;
grant all on public.messenger_settings, public.messenger_faqs, public.messenger_threads, public.messenger_messages to service_role;
