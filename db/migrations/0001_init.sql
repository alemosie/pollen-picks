-- Beehiiv to Buffer: isolated schema on the Supabase test project.
-- Access is server-side only through the dedicated role b2b_app (no Supabase Auth, no PostgREST exposure).
-- Secrets (Buffer tokens, Beehiiv key) are encrypted by the app before they are written.

create schema if not exists buffer_app;
revoke all on schema buffer_app from public, anon, authenticated;

create table if not exists buffer_app.app_users (
  id uuid primary key default gen_random_uuid(),
  buffer_account_id text not null unique,
  email text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists buffer_app.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references buffer_app.app_users(id) on delete cascade,
  service text not null check (service in ('buffer', 'beehiiv')),
  secret_enc text not null,              -- AES-GCM ciphertext, key lives in env vars
  meta jsonb not null default '{}'::jsonb, -- e.g. publication id (not secret)
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, service)
);

create table if not exists buffer_app.settings (
  user_id uuid primary key references buffer_app.app_users(id) on delete cascade,
  channel_id text,
  source text not null default 'demo' check (source in ('demo', 'public_url', 'beehiiv_key')),
  public_url text,
  activities_heading text,
  top_n int not null default 4 check (top_n between 1 and 8),
  updated_at timestamptz not null default now()
);

create table if not exists buffer_app.handles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references buffer_app.app_users(id) on delete cascade,
  org_name text not null,
  platform text not null default 'instagram',
  handle text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists handles_user_org_platform on buffer_app.handles (user_id, lower(org_name), platform);

create table if not exists buffer_app.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references buffer_app.app_users(id) on delete cascade,
  source_post_id text not null,
  channel_id text not null,
  status text not null default 'started',
  picked jsonb,
  buffer_post_ids jsonb,
  error text,
  created_at timestamptz not null default now()
);
-- one non-failed run per issue + channel (idempotency: no duplicate drafts)
create unique index if not exists runs_one_per_issue_channel on buffer_app.runs (user_id, source_post_id, channel_id) where status <> 'failed';

-- Dedicated app role: no login until a password is set by the project owner.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'b2b_app') then
    create role b2b_app nologin;
  end if;
end $$;

grant usage on schema buffer_app to b2b_app;
grant select, insert, update, delete on all tables in schema buffer_app to b2b_app;

alter table buffer_app.app_users enable row level security;
alter table buffer_app.connections enable row level security;
alter table buffer_app.settings enable row level security;
alter table buffer_app.handles enable row level security;
alter table buffer_app.runs enable row level security;

-- RLS is on with no policy for anon/authenticated (denied). The app role gets explicit policies.
do $$
declare t text;
begin
  foreach t in array array['app_users','connections','settings','handles','runs'] loop
    execute format('drop policy if exists app_all on buffer_app.%I', t);
    execute format('create policy app_all on buffer_app.%I for all to b2b_app using (true) with check (true)', t);
  end loop;
end $$;
