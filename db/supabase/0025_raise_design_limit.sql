-- APPLIED to dev (Dev: Pollen Picks) on 9 Nov 2026 (migration raise_design_limit). APPLIED to production on 9 Nov 2026.
-- A slide design (the layout plus every text edit, as a query string) could not be longer than 4,000 characters: a design with
-- text edits on about 10 slides passes that, and a send then cut it short, which reads as the standard layout. The limit is now 7,500 (MAX_TEMPLATE_CHARS
-- in src/lib/savedCreationShape.ts), and a design over it is refused with a message instead of cut. The feedback slide link holds a design plus a demo's
-- highlights, so it gets room for both (12,000).
alter table public.saved_creations drop constraint saved_creations_template_check, add constraint saved_creations_template_check check (char_length(template) <= 7500);
alter table public.current_runs drop constraint current_runs_template_check, add constraint current_runs_template_check check (char_length(template) <= 7500);
alter table public.post_history drop constraint post_history_template_check, add constraint post_history_template_check check (template is null or char_length(template) <= 7500);
alter table public.feedback drop constraint feedback_slide_url_check, add constraint feedback_slide_url_check check (slide_url is null or char_length(slide_url) <= 12000);
