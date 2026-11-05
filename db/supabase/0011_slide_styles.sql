-- APPLIED to both Supabase projects ("Dev: Pollen Picks", then "Pollen Picks") on 5 Nov 2026 (as slide_styles).
-- One row per user: how their slides look (Settings > Slide style). No row = the standard look.
--   top / bottom : what goes in the left corner of the header and the footer of pick slides
--   font         : which of the three loaded fonts the slides use for headlines (see src/lib/slides/style.ts)
--   org_name / org_logo : the organization shown by the "organization" option. The logo is a small PNG or JPEG kept as a
--                         data URI (the browser shrinks it before upload; capped here so a row stays small).
-- Same access model as the other tables: RLS on, no policies, only the server's secret key (service_role) gets in.
create table public.slide_styles (
  user_id uuid primary key references public.users(id) on delete cascade,
  top text not null default 'publication' check (top in ('publication', 'organization', 'title', 'date', 'none')),
  bottom text not null default 'publication' check (bottom in ('publication', 'organization', 'title', 'date', 'none')),
  font text not null default 'madimi' check (font in ('madimi', 'dmsans', 'quicksand')),
  org_name text not null default '' check (char_length(org_name) <= 80),
  org_logo text check (org_logo is null or (char_length(org_logo) <= 250000 and org_logo ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$')),
  updated_at timestamptz not null default now()
);

alter table public.slide_styles enable row level security;
revoke all on public.slide_styles from anon, authenticated;
grant select, insert, update, delete on public.slide_styles to service_role;
