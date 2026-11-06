-- NOT APPLIED YET. Run this on both Supabase projects ("Dev: Pollen Picks", then "Pollen Picks") BEFORE deploying the code that offers
-- "Carousel title" as a corner option: until then, saving that choice in Settings > Slide style is refused by the checks below.
--
-- Adds 'carousel' to what can go in the left corner of the header or the footer of pick slides: the title of the carousel itself
-- (the cover's title), next to the existing issue title ('title') and issue date ('date'). Existing rows are unchanged.
-- The two checks were created inline in 0011, so Postgres named them slide_styles_top_check and slide_styles_bottom_check.
alter table public.slide_styles drop constraint if exists slide_styles_top_check;
alter table public.slide_styles drop constraint if exists slide_styles_bottom_check;

alter table public.slide_styles
  add constraint slide_styles_top_check check (top in ('publication', 'organization', 'title', 'carousel', 'date', 'none')),
  add constraint slide_styles_bottom_check check (bottom in ('publication', 'organization', 'title', 'carousel', 'date', 'none'));
