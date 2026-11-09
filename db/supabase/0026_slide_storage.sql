-- APPLIED to "Dev: Pollen Picks" and to prod "Pollen Picks" on 9 Nov 2026 (as slide_storage). It has to be in place BEFORE the code that stores slides at send
-- time is deployed (without the bucket the send falls back to the old signed slide links, see buildContext in src/lib/sendQueue.ts).
--
-- Slides are drawn once, when a draft or post is sent, and the final images are stored here, so Buffer is given addresses that keep working: they
-- don't depend on the person's highlights, style or the source page still being the same, and they don't expire.
--   bucket "slides"            : public read (Buffer fetches without a login; the file names are content hashes, so they can't be guessed), written only by the server.
--                                Path: u/<user id>/<sha256 of the image>.png (or .jpg for the small copy some networks need).
--   post_history.slide_paths   : the stored full-size slides of the send this row belongs to, in order. Every row of one send holds the same list.
--   post_history.slide_paths_small : the small JPEG copies (null when they could not be made).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slides', 'slides', true, 52428800, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.post_history
  add column if not exists slide_paths text[],
  add column if not exists slide_paths_small text[];
