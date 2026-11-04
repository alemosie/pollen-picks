-- APPLIED to both Supabase projects ("Dev: Pollen Picks", then "Pollen Picks") on 4 Nov 2026 (as migration draft_log_mode).
-- draft_log gets a `mode` so a publish-now can be told apart from a draft. Existing rows are drafts.
alter table public.draft_log
  add column mode text not null default 'draft' check (mode in ('draft', 'now'));
