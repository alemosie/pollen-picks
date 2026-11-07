-- APPLIED to both Supabase projects ("Dev: Pollen Picks" and "Pollen Picks") on 7 Nov 2026 (as slide_style_bottom_right). It had to run BEFORE deploying the code that adds the footer's bottom right corner to
-- Settings > Slide style (before it, reading and saving the slide style fails).
--
-- Adds bottom_right: what goes in the right corner of the footer of pick slides. It takes the same choices as the other two corners, plus
-- 'attribution' ("Created with Pollen Picks"), which is now one of the choices for every corner (it used to be fixed at the bottom right).
--   * New rows start with the new standard: bottom_right = 'organization' (top 'none' and bottom 'publication' are set by the app).
--   * Rows that already exist keep what their slides show today, so they get bottom_right = 'attribution'.
-- The three checks are replaced because 'attribution' is a new allowed value. They were named by Postgres (0011) and 0020.
alter table public.slide_styles add column bottom_right text not null default 'attribution';
alter table public.slide_styles alter column bottom_right set default 'organization';

alter table public.slide_styles drop constraint if exists slide_styles_top_check;
alter table public.slide_styles drop constraint if exists slide_styles_bottom_check;
alter table public.slide_styles drop constraint if exists slide_styles_bottom_right_check;

alter table public.slide_styles
  add constraint slide_styles_top_check check (top in ('publication', 'organization', 'title', 'carousel', 'date', 'attribution', 'none')),
  add constraint slide_styles_bottom_check check (bottom in ('publication', 'organization', 'title', 'carousel', 'date', 'attribution', 'none')),
  add constraint slide_styles_bottom_right_check check (bottom_right in ('publication', 'organization', 'title', 'carousel', 'date', 'attribution', 'none'));
