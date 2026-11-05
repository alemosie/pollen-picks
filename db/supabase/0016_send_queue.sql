-- APPLIED to "Dev: Pollen Picks" and to prod "Pollen Picks" on 5 Nov 2026 (as send_queue).
-- Makes post_history the send queue, so a send keeps going when the person closes the tab or leaves the page.
-- "Send" now writes one row per channel with status 'queued'; a worker (src/lib/sendQueue.ts) claims rows, creates the post in Buffer
-- and updates the row. Statuses added: 'queued' (waiting for its turn, or for Buffer's rate limit to ease) and 'working' (claimed).
--
-- What a queued row holds beyond the log columns: where it goes (channel_id), what to send (source, picks, template and the caption the
-- person wrote) and when to try next (not_before). The caption is the only content kept, only until the post has been created or has
-- failed, and then it is set to null. Everything else stays as before: no images, RLS on, no policies, service_role only.
alter table public.post_history
  add column channel_id text check (channel_id is null or char_length(channel_id) <= 100),
  add column batch_id uuid,                                           -- one "Send" press: its rows share it
  add column source text check (source is null or char_length(source) <= 200),
  add column picks integer[],
  add column template text check (template is null or char_length(template) <= 4000),
  add column caption text check (caption is null or char_length(caption) <= 10000),
  add column not_before timestamptz,                                  -- don't try before this (Buffer was rate limiting)
  add column attempts smallint not null default 0,
  add column lease_until timestamptz;                                 -- a worker holds the row until then

create index post_history_queue on public.post_history (status, not_before) where status in ('queued', 'working');
create index post_history_batch on public.post_history (user_id, batch_id);

-- A row may have no Buffer post id while it is waiting, being sent, or after it failed.
alter table public.post_history drop constraint post_history_id_or_failed;
alter table public.post_history
  add constraint post_history_id_or_open check (post_id is not null or status in ('queued', 'working', 'failed', 'unknown'));

-- Takes up to p_limit due rows for one user (or any user, when p_user_id is null) and marks them 'working' for p_lease_seconds. Two workers
-- never get the same row (skip locked). A row whose worker died while it was working is NEVER retried: we can't know whether Buffer got it, so
-- it becomes 'unknown' and the person is told to check Buffer. That is what stops a post going out twice.
create or replace function public.claim_queued_posts(p_user_id uuid, p_limit int, p_lease_seconds int)
returns setof public.post_history
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.post_history
     set status = 'unknown',
         caption = null,
         lease_until = null,
         error = 'This was interrupted, so it may or may not have gone out. Check Buffer before sending it again.'
   where status = 'working' and lease_until < now();

  return query
  update public.post_history h
     set status = 'working',
         lease_until = now() + make_interval(secs => p_lease_seconds),
         attempts = h.attempts + 1
   where h.id in (
     select q.id from public.post_history q
      where q.status = 'queued'
        and (q.not_before is null or q.not_before <= now())
        and (p_user_id is null or q.user_id = p_user_id)
      order by q.created_at, q.id
      limit p_limit
      for update skip locked
   )
  returning h.*;
end;
$$;
revoke all on function public.claim_queued_posts(uuid, int, int) from public, anon, authenticated;
grant execute on function public.claim_queued_posts(uuid, int, int) to service_role;
