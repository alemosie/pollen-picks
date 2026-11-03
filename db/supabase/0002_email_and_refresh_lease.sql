-- Applied to the Supabase project "Pollen Picks" (hmzprlzhvhdwpjgrymrk) on 2026-11-03 as round1b_email_and_refresh_lease.

alter table public.users add column if not exists email text;

-- Buffer refresh tokens are single-use, so only one request may call the token endpoint at a time per user.
alter table public.connections add column if not exists refresh_lease_until timestamptz;

create or replace function public.acquire_refresh_lease(
  p_user_id uuid,
  p_provider text,
  p_seconds int default 20
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.connections
     set refresh_lease_until = now() + make_interval(secs => p_seconds)
   where user_id = p_user_id
     and provider = p_provider
     and (refresh_lease_until is null or refresh_lease_until < now())
  returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function public.release_refresh_lease(
  p_user_id uuid,
  p_provider text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.connections
     set refresh_lease_until = null
   where user_id = p_user_id and provider = p_provider;
$$;

revoke execute on function public.acquire_refresh_lease(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.release_refresh_lease(uuid, text) from public, anon, authenticated;
grant execute on function public.acquire_refresh_lease(uuid, text, int) to service_role;
grant execute on function public.release_refresh_lease(uuid, text) to service_role;
