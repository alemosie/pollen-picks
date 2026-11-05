-- APPLIED to both Supabase projects ("Dev: Pollen Picks", then "Pollen Picks") on 5 Nov 2026 (as profile_palette). Applied after 0011.
-- The user's slide palette (Settings > Slide colors) moves from the browser to their profile row, next to the slide style.
--   palette : 2 to 8 "#rrggbb" colors, or null = the standard Pollen Picks palette
--   styled  : true once the user has saved a slide style (header, footer, font, organization). A row that only holds a palette is
--             false, so saving a palette never switches slides to the saved-style look (publication logos and so on).
-- Rows that exist today all hold a slide style, so they become styled = true.
alter table public.slide_styles
  add column palette jsonb check (palette is null or (jsonb_typeof(palette) = 'array' and jsonb_array_length(palette) between 2 and 8)),
  add column styled boolean not null default true;
