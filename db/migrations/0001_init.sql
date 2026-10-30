-- Pollen Picks: isolated schema on the Supabase test project.
-- Access is server-side only through the dedicated role b2b_app (no Supabase Auth, no PostgREST exposure).
-- Secrets (Buffer tokens, Beehiiv key) are encrypted by the app before they are written.
-- Slide images are NOT stored: they are rendered on request from pick_sets.payload at a stable URL.

create schema if not exists buffer_app;
revoke all on schema buffer_app from public, anon, authenticated;

-- Identity is the Buffer account id (no passwords, no Supabase Auth).
create table if not exists buffer_app.app_users (
  id uuid primary key default gen_random_uuid(),
  buffer_account_id text not null unique,
  email text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists buffer_app.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references buffer_app.app_users(id) on delete cascade,
  service text not null check (service in ('buffer', 'beehiiv')),
  secret_enc text not null,                 -- AES-GCM ciphertext, key lives in env vars
  meta jsonb not null default '{}'::jsonb,  -- e.g. publication id (not secret)
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, service)
);

-- Onboarding choice + last-used pick settings.
create table if not exists buffer_app.settings (
  user_id uuid primary key references buffer_app.app_users(id) on delete cascade,
  source text not null default 'demo' check (source in ('demo', 'public_url', 'beehiiv_key')),
  public_url text,
  mode text not null default 'top_clicks' check (mode in ('top_clicks', 'section', 'all')),
  section_heading text,
  only_upcoming boolean not null default true,
  pick_count int not null default 4 check (pick_count between 1 and 20),
  updated_at timestamptz not null default now()
);

-- Saved brand kit(s). Small uploads live in the table (no Storage service key needed).
create table if not exists buffer_app.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references buffer_app.app_users(id) on delete cascade,
  name text not null default 'My brand',
  layout text not null default 'classic',
  colors jsonb not null default '{}'::jsonb,   -- background, text, accent...
  fonts jsonb not null default '{}'::jsonb,    -- heading, body (from a fixed list)
  logo bytea,
  logo_mime text,
  background bytea,
  background_mime text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (logo is null or octet_length(logo) <= 1048576),
  check (background is null or octet_length(background) <= 2097152)
);
create unique index if not exists brand_kits_one_default on buffer_app.brand_kits (user_id) where is_default;

-- Per-channel formatting: which kit and which caption template each Buffer channel uses.
create table if not exists buffer_app.channel_formats (
  user_id uuid not null references buffer_app.app_users(id) on delete cascade,
  channel_id text not null,
  service text not null,                       -- instagram, linkedin, ...
  kit_id uuid references buffer_app.brand_kits(id) on delete set null,
  caption_template text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

-- Organizer handle map. match_kind says what match_value is: a domain (robbeburg.nl), a full URL, or a name.
create table if not exists buffer_app.handles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references buffer_app.app_users(id) on delete cascade,
  match_kind text not null check (match_kind in ('domain', 'url', 'name')),
  match_value text not null,
  platform text not null default 'instagram',
  handle text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists handles_user_match on buffer_app.handles (user_id, match_kind, lower(match_value), platform);

-- One reviewed set of picks. The slide images are rendered from payload at
-- /api/slide/<id>/<n>.png, a stable, unguessable, public URL that Buffer/Instagram fetch (possibly days later).
create table if not exists buffer_app.pick_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references buffer_app.app_users(id) on delete cascade,
  source_post_id text,
  mode text not null,
  payload jsonb not null,                      -- picks, resolved tags, layout, kit snapshot (so edits to the kit don't change a queued post)
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);
create index if not exists pick_sets_user on buffer_app.pick_sets (user_id, created_at desc);

create table if not exists buffer_app.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references buffer_app.app_users(id) on delete cascade,
  pick_set_id uuid references buffer_app.pick_sets(id) on delete set null,
  source_post_id text not null,
  channel_id text not null,
  status text not null default 'started',
  buffer_post_ids jsonb,
  error text,
  created_at timestamptz not null default now()
);
-- one non-failed run per issue + channel (idempotency: no duplicate drafts)
create unique index if not exists runs_one_per_issue_channel on buffer_app.runs (user_id, source_post_id, channel_id) where status <> 'failed';

-- Dedicated app role: no login until a password is set by the project owner (see README).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'b2b_app') then
    create role b2b_app nologin;
  end if;
end $$;

grant usage on schema buffer_app to b2b_app;
grant select, insert, update, delete on all tables in schema buffer_app to b2b_app;

-- RLS on, no policy for anon/authenticated (denied). The app role gets explicit policies.
do $$
declare t text;
begin
  foreach t in array array['app_users','connections','settings','brand_kits','channel_formats','handles','pick_sets','runs'] loop
    execute format('alter table buffer_app.%I enable row level security', t);
    execute format('drop policy if exists app_all on buffer_app.%I', t);
    execute format('create policy app_all on buffer_app.%I for all to b2b_app using (true) with check (true)', t);
  end loop;
end $$;
