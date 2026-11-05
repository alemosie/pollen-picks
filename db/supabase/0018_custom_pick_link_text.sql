-- Applied to dev and prod on 5 Nov 2026.
-- Old code ignores the column, so this can be applied before deploying.
alter table public.custom_picks add column link_text text check (link_text is null or char_length(link_text) <= 200);
