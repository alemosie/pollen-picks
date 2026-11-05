-- APPLIED to both Supabase projects ("Dev: Pollen Picks", then "Pollen Picks") on 5 Nov 2026 (as instagram_handles).
-- Which Instagram account owns a post or reel, as answered by the Apify lookup (see src/lib/instagramHandles.ts).
-- A post's owner never changes, so one answer serves every user and every issue, and nobody pays for the same post twice.
-- Only the handle is stored: no caption, no media, no account details.
-- Same access model as the other tables: RLS on, no policies, only the server's secret key (service_role) gets in.
create table public.instagram_handles (
  shortcode text primary key check (shortcode ~ '^[A-Za-z0-9_-]{1,40}$'),
  handle text not null check (handle ~ '^[a-z0-9._]{1,30}$'),
  resolved_at timestamptz not null default now()
);

alter table public.instagram_handles enable row level security;
revoke all on public.instagram_handles from anon, authenticated;
grant select, insert, update, delete on public.instagram_handles to service_role;
