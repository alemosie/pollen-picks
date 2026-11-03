-- Applied to the Supabase project "Pollen Picks" (hmzprlzhvhdwpjgrymrk) on 2026-11-03 as round1_users_brand_connections.
-- Access is server-side only: RLS on, no policies, no privileges for anon/authenticated. The app uses the secret key.
-- Secrets (Buffer tokens, later the Beehiiv key) live in Supabase Vault; connections only holds the pointer.
-- Note: db/migrations/0001_init.sql is the earlier, larger design (isolated schema, app-level encryption). It is NOT
-- what runs on this project; port its remaining tables (pick_sets, runs, handles, ...) as new numbered files here.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  buffer_user_id text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.brand_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  org_name text,
  creator_name text,
  creator_bio text,
  tagline text,
  logo_path text,
  palette jsonb not null default '{"bg":"#f7ede2","surface":"#f5cac3","ink":"#2d2a26","accent":"#f28482","highlight":"#f6bd60","secondary":"#84a59d"}'::jsonb,
  heading_font text not null default 'Madimi One'
    check (heading_font in ('Madimi One','DM Sans','Quicksand')),
  body_font text not null default 'DM Sans'
    check (body_font in ('Madimi One','DM Sans','Quicksand')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger brand_profiles_updated_at
  before update on public.brand_profiles
  for each row execute function public.set_updated_at();

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('buffer','beehiiv')),
  secret_id uuid,
  last4 text,
  status text not null default 'active'
    check (status in ('active','expired','revoked','error')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create trigger connections_updated_at
  before update on public.connections
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.connections enable row level security;
revoke all on public.users, public.brand_profiles, public.connections from anon, authenticated;

create or replace function public.set_connection_secret(
  p_user_id uuid,
  p_provider text,
  p_secret text,
  p_last4 text default null,
  p_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_conn_id uuid;
begin
  select secret_id into v_secret_id
  from public.connections
  where user_id = p_user_id and provider = p_provider;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_secret);
  else
    v_secret_id := vault.create_secret(
      p_secret,
      'conn:' || p_user_id::text || ':' || p_provider,
      'connection secret'
    );
  end if;

  insert into public.connections (user_id, provider, secret_id, last4, status, meta)
  values (p_user_id, p_provider, v_secret_id, p_last4, 'active', coalesce(p_meta, '{}'::jsonb))
  on conflict (user_id, provider) do update
    set secret_id = excluded.secret_id,
        last4 = excluded.last4,
        status = 'active',
        meta = excluded.meta
  returning id into v_conn_id;

  return v_conn_id;
end;
$$;

create or replace function public.get_connection_secret(
  p_user_id uuid,
  p_provider text
)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select ds.decrypted_secret
  from public.connections c
  join vault.decrypted_secrets ds on ds.id = c.secret_id
  where c.user_id = p_user_id and c.provider = p_provider;
$$;

create or replace function public.delete_connection(
  p_user_id uuid,
  p_provider text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
begin
  select secret_id into v_secret_id
  from public.connections
  where user_id = p_user_id and provider = p_provider;

  delete from public.connections
  where user_id = p_user_id and provider = p_provider;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;

revoke execute on function public.set_connection_secret(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.get_connection_secret(uuid, text) from public, anon, authenticated;
revoke execute on function public.delete_connection(uuid, text) from public, anon, authenticated;
grant execute on function public.set_connection_secret(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.get_connection_secret(uuid, text) to service_role;
grant execute on function public.delete_connection(uuid, text) to service_role;

-- Clears the advisor warning on the helper Supabase provisioned
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
