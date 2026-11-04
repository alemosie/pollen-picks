-- A public newsletter post a signed-in user chose as their content source ("link:<id>" in the flow's `mode`).
-- Only what the public page itself says (its address, title, publication, author, date, preview image), so later steps
-- don't fetch the page again and a shared step link keeps working. No secrets: the page is public.
-- Same access model as the other tables: RLS on, no policies, only the server's secret key (service_role) gets in.
create table public.public_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  url text not null check (char_length(url) <= 2000),
  title text not null check (char_length(title) <= 200),
  site text check (site is null or char_length(site) <= 100),
  author text check (author is null or char_length(author) <= 100),
  published_at timestamptz,
  image text check (image is null or char_length(image) <= 1000),
  created_at timestamptz not null default now(),
  unique (user_id, url)
);

alter table public.public_sources enable row level security;
revoke all on public.public_sources from anon, authenticated;
grant select, insert, update, delete on public.public_sources to service_role;
