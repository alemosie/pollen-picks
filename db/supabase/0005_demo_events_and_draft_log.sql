-- APPLIED to the Supabase project "Pollen Picks" on 4 Nov 2026 (as migration round3_events_draft_log_feedback).
-- Three small tables for proving the app is used. None holds post content:
--   demo_events: one row per step of the flow someone reaches, tagged with a random per-tab session id (no cookie, no IP,
--                no user agent; the id is not tied to a person).
--   draft_log:   one row per draft the signed-in flow tried to create in Buffer (which network, worked or not).
--   feedback:    answers from the in-app feedback form, with the session id, the steps that session reached, and the
--                account when the person is logged in.
-- Same access model as the other tables: RLS on, no policies, only the server's secret key (service_role) gets in.

create type public.app_flow as enum ('demo', 'app');   -- the public demo, or the logged-in app

create table public.demo_events (
  id bigint generated always as identity primary key,
  event text not null check (char_length(event) between 1 and 40),     -- e.g. demo_start, design_reached, login_clicked
  source text not null default 'sample' check (char_length(source) between 1 and 20),   -- which content was used
  session_id uuid,                                                      -- random, made in the browser tab; null if unavailable
  flow public.app_flow not null default 'demo',
  created_at timestamptz not null default now()
);
create index demo_events_event_created on public.demo_events (event, created_at);
create index demo_events_session on public.demo_events (session_id, created_at);

create table public.draft_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  service text not null check (char_length(service) between 1 and 40),  -- "instagram", "linkedin", ...
  ok boolean not null,
  error text check (error is null or char_length(error) <= 200),        -- Buffer's error message, if it failed
  created_at timestamptz not null default now()
);
create index draft_log_created on public.draft_log (created_at);
create index draft_log_user on public.draft_log (user_id, created_at);

create table public.feedback (
  id bigint generated always as identity primary key,
  flow public.app_flow not null,
  user_id uuid references public.users(id) on delete set null,          -- only when logged in
  session_id uuid,
  steps text[] not null default '{}',                                   -- events that session reached, in order
  host text not null check (host in ('beehiiv', 'substack', 'other')),
  host_other text check (host_other is null or char_length(host_other) <= 60),
  easy smallint check (easy between 1 and 5),
  likelihood smallint not null check (likelihood between 1 and 5),
  loved text check (loved is null or char_length(loved) <= 1000),
  would_change text check (would_change is null or char_length(would_change) <= 1000),
  quote_ok boolean not null,
  created_at timestamptz not null default now()
);
create index feedback_created on public.feedback (created_at);

alter table public.demo_events enable row level security;
alter table public.feedback enable row level security;
alter table public.draft_log enable row level security;
revoke all on public.demo_events, public.draft_log, public.feedback from anon, authenticated;
grant select, insert, update, delete on public.demo_events, public.draft_log, public.feedback to service_role;
