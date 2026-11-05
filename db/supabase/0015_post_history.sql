-- APPLIED to "Dev: Pollen Picks" and to prod "Pollen Picks" on 5 Nov 2026 (as post_history).
-- The log behind the History page. It was `sent_posts` (0014: only posts Buffer accepted). Now it records every attempt, failed ones too:
--   - post_id may be empty: a failed attempt has no Buffer post.
--   - error: Buffer's reason, kept short (the same text the draft_log already keeps).
--   - status gains 'failed' (Buffer refused, nothing was created) and 'unknown' (the request died; it may or may not have gone out).
-- Still NO caption and no images. Access is unchanged: RLS on, no policies, only the server's secret key (service_role).
alter table public.sent_posts rename to post_history;
alter index public.sent_posts_user_created rename to post_history_user_created;

alter table public.post_history alter column post_id drop not null;
alter table public.post_history add column error text check (error is null or char_length(error) <= 200);
-- Only a failed or unknown attempt may have no post id.
alter table public.post_history
  add constraint post_history_id_or_failed check (post_id is not null or status in ('failed', 'unknown'));
