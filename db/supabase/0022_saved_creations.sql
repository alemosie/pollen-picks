-- APPLIED to "Dev: Pollen Picks" on 7 Nov 2026 (as saved_creations_and_current_runs). NOT APPLIED to prod "Pollen Picks" yet: run it there BEFORE deploying the code that adds "Save" and
-- the "Saved creations" list on the History page, and the autosaved current run. Two new tables (saved_creations, current_runs), so old code is unaffected.
--
-- One row per saved creation: a newsletter issue the person is working on, kept so they can come back to it from any device.
-- It is the server-side copy of what the browser keeps in localStorage ("pollen-picks:run"). One per account and issue: saving again replaces it.
--   source   : the flow mode that names the issue ("own:<publication id>:<post id>" or "link:<id>"), at most 200 characters
--   link     : the issue's address, which the caption's saved state is keyed on (see FormatState.sig)
--   picks    : the chosen items (positions in the issue's list)
--   template : the slide design as the query string the steps pass around (spec, heading, ...), at most 4000 characters
--   format   : what Write kept: caption order, hand-edited captions per kind of network, and the open tab (at most 40,000 characters)
--   step     : where to reopen it: 3 = Design, 4 = Write, 5 = Send
--   newsletter, title : only to show the row in the list
-- Kept until the person deletes it (or deletes their account). It never holds images: slides are drawn again from picks + template.
-- It holds the caption text, which the send queue does not keep for long. The privacy page says so.
-- Same access model as the other tables: RLS on, no policies, only the server's secret key (service_role) gets in.
create table public.saved_creations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null check (char_length(source) between 1 and 200),
  link text not null check (char_length(link) <= 2000),
  picks integer[] not null check (cardinality(picks) between 1 and 200),
  template text not null default '' check (char_length(template) <= 4000),
  format jsonb check (format is null or char_length(format::text) <= 40000),
  step smallint not null default 4 check (step in (3, 4, 5)),
  newsletter text not null default '' check (char_length(newsletter) <= 200),
  title text not null default '' check (char_length(title) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source)
);
create index saved_creations_user_updated on public.saved_creations (user_id, updated_at desc);

alter table public.saved_creations enable row level security;
revoke all on public.saved_creations from anon, authenticated;
grant select, insert, update, delete on public.saved_creations to service_role;

-- The current run: the one run of the flow the app keeps for you as you go, so another device can carry on where you left off.
-- One row per account (the slot is shared by every device), written automatically as picks, design and caption change, and replaced when a new run starts.
-- Same fields as a saved creation, plus:
--   step      : 2 = Pick, 3 = Design, 4 = Write, 5 = Send (where the person was)
--   saved_id  : the saved creation this run keeps up to date, if the person saved it (set to null when that creation is deleted)
--   updated_at: what a device must have seen to be allowed to write (see decideRunWrite): stops one device overwriting another's newer work.
-- It holds the caption text while the run is in progress. The row is deleted when the send is queued, when the person discards it, and with the account.
create table public.current_runs (
  user_id uuid primary key references public.users(id) on delete cascade,
  source text not null check (char_length(source) between 1 and 200),
  link text not null check (char_length(link) <= 2000),
  picks integer[] not null check (cardinality(picks) between 1 and 200),
  template text not null default '' check (char_length(template) <= 4000),
  format jsonb check (format is null or char_length(format::text) <= 40000),
  step smallint not null default 2 check (step in (2, 3, 4, 5)),
  newsletter text not null default '' check (char_length(newsletter) <= 200),
  title text not null default '' check (char_length(title) <= 300),
  saved_id uuid references public.saved_creations(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.current_runs enable row level security;
revoke all on public.current_runs from anon, authenticated;
grant select, insert, update, delete on public.current_runs to service_role;
