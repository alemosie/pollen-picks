-- NOT APPLIED TO PROD YET. Run this on both Supabase projects ("Dev: Pollen Picks", then "Pollen Picks") BEFORE deploying the code that lets
-- people add a link to a public picture for their slides. New table, so old code is unaffected.
-- (An earlier draft of this migration created a user_photos table for uploaded photos. Dev ran that one; this file removes it, and does
-- nothing about it where it was never created.)
--
-- One row per picture link a user saved (Design > edit slide > Picture > Add link). Only the address is kept, never the picture.
--   id  : 8 hex digits, what a slide design refers to (never the address). Unique per user.
--   url : an https address, at most 1000 characters; one row per address per user.
-- Buffer downloads each slide from this app, with no browser involved, for days after a post is made, so the address has to live here.
-- Same access model as the other tables: RLS on, no policies, only the server's secret key (service_role) gets in.
do $$
begin
  perform cron.unschedule('delete-expired-user-photos');
exception when others then
  null; -- no pg_cron, or no such job
end
$$;
drop table if exists public.user_photos;

create table public.user_photo_links (
  user_id uuid not null references public.users(id) on delete cascade,
  id text not null check (id ~ '^[0-9a-f]{8}$'),
  url text not null check (char_length(url) <= 1000 and url ~ '^https://'),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, url)
);

alter table public.user_photo_links enable row level security;
revoke all on public.user_photo_links from anon, authenticated;
grant select, insert, update, delete on public.user_photo_links to service_role;
