-- APPLIED to both Supabase projects ("Dev: Pollen Picks", then "Pollen Picks") on 5 Nov 2026 (as instagram_lookups). Applied after 0008.
-- One row per (user, post) that user's lookup sent to Apify. It counts each user's free lookups (APIFY_FREE_LOOKUPS), so
-- looking the same post up twice counts once. The shared answers live in public.instagram_handles (0008).
-- Same access model as the other tables: RLS on, no policies, only the server's secret key (service_role) gets in.
create table public.instagram_lookups (
  user_id uuid not null references public.users(id) on delete cascade,
  shortcode text not null check (shortcode ~ '^[A-Za-z0-9_-]{1,40}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, shortcode)
);

alter table public.instagram_lookups enable row level security;
revoke all on public.instagram_lookups from anon, authenticated;
grant select, insert, update, delete on public.instagram_lookups to service_role;
