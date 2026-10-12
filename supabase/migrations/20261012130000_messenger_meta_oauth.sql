alter table public.messenger_settings
  add column if not exists oauth_state_hash text,
  add column if not exists oauth_state_expires_at timestamptz,
  add column if not exists page_access_token_enc text;

comment on column public.messenger_settings.page_access_token_enc is 'AES-256-GCM encrypted Meta Page access token. Never return this column to a client.';

