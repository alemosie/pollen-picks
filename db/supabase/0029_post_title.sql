-- APPLIED to "Dev: Pollen Picks" on 11 Nov 2026. NOT YET APPLIED to prod ("Pollen Picks"). The code works without it (History falls back to naming a
-- send by its issue), so there is no order to get wrong.
--
-- What History calls a send. Until now a send was named by its newsletter issue, which two sends of the same issue share, so they could not be told
-- apart. post_title is the title of the send's first pick, or that pick's description cut short when it has no title (see lib/slides/postTitle.ts).
--   post_history.post_title : worked out when the send is queued. Every row of one send holds the same text. Older rows have none.
-- No caption and no images, as before: it is the pick's own heading, a few words.
alter table public.post_history
  add column if not exists post_title text check (post_title is null or char_length(post_title) <= 200);
