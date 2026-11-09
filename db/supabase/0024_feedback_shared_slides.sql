-- APPLIED to the dev Supabase project "Dev: Pollen Picks" on 9 Nov 2026 (as migration feedback_shared_slides). APPLIED to production on 9 Nov 2026.
-- "OK to share?" on the feedback form: a tester who says yes lets Alex see what they made, as two links.
--   source_url: the issue they started from (a pasted page, or their own issue's public address); null when they used the sample issue.
--   slide_url:  the Design step with their picks and layout (a demo link also carries their highlights as hl=; a link from the logged-in app only opens for that account).
-- Both are null unless the tester said yes. No slide text, no images. Deleted with the feedback row.
alter table public.feedback
  add column source_url text check (source_url is null or char_length(source_url) <= 4000),
  add column slide_url text check (slide_url is null or char_length(slide_url) <= 4000);
