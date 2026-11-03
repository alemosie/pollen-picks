-- Applied to the Supabase project "Pollen Picks" (hmzprlzhvhdwpjgrymrk) on 2026-11-03 as round2_custom_picks.
-- Text a user highlighted on the Pick page's Manual tab. Each row becomes an extra pickable chunk of that issue, so the
-- Design, Prepare and Send steps (which rebuild picks by id from the loaded issue) need no changes.
-- Same access model as the other tables: RLS on, no policies, only the server's secret key (service_role) gets in.
create table public.custom_picks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  issue text not null check (char_length(issue) <= 120),            -- "<publication id>:<post id>"
  text text not null check (char_length(text) between 1 and 2000),
  url text check (url is null or char_length(url) <= 1000),          -- first link inside the highlight, if any
  created_at timestamptz not null default now()
);
create index custom_picks_user_issue on public.custom_picks (user_id, issue, id);

alter table public.custom_picks enable row level security;
revoke all on public.custom_picks from anon, authenticated;
grant select, insert, update, delete on public.custom_picks to service_role;
