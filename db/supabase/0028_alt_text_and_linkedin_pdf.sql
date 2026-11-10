-- APPLIED to "Dev: Pollen Picks" on 10 Nov 2026. NOT YET APPLIED to prod ("Pollen Picks"): apply it BEFORE the code that sends alt text and PDFs is
-- deployed. Everything the code needs from it is optional, so a send keeps working without it (LinkedIn goes as images, no stored alt text), but a
-- LinkedIn PDF needs all of it.
--
-- Alt text: each slide is sent with a description of what it says (Buffer's image `metadata.altText`). It is worked out from the slides when a send's
-- slides are drawn, and kept on the send's rows so a retry, or the next channel of the same send, sends the same text.
--   post_history.slide_alts     : the alt text of the send's slides, in order. Every row of one send holds the same list.
-- LinkedIn as a PDF: one PDF of the slides (a swipeable carousel on LinkedIn) is made for a LinkedIn channel that asked for it, and stored with the slides.
--   post_history.as_pdf         : this channel gets the slides as one PDF. Only ever set on LinkedIn rows, and only when asked for.
--   post_history.slide_pdf_path : the stored PDF of the send, so a retry reuses it and it is removed with the slides (30 days after the post is over).
--   bucket "slides"             : may now also hold application/pdf (Buffer allows a document up to 100 MB; one of ours is a few MB).
-- Which LinkedIn format a user wants (Settings > LinkedIn format): the PDF carousel (the default) or the slides as separate images.
--   slide_styles.linkedin_format : 'pdf' | 'images'. A user who never chose has no row or the default, and gets the PDF.
alter table public.post_history
  add column if not exists slide_alts text[],
  add column if not exists as_pdf boolean not null default false,
  add column if not exists slide_pdf_path text;

alter table public.slide_styles
  add column if not exists linkedin_format text not null default 'pdf' check (linkedin_format in ('pdf', 'images'));

update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'application/pdf']
 where id = 'slides';
