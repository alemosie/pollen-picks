-- Applied to dev and prod on 5 Nov 2026. An 'unknown' post (the request died, so it may or may not be in Buffer) used to lose its caption, so
-- it could never be sent again. It is kept now, for the same 24 hours as a failed one, so the person can pick "Send again" after checking Buffer.
-- The only change from 0016: the interrupted-row update no longer sets caption = null.
create or replace function public.claim_queued_posts(p_user_id uuid, p_limit int, p_lease_seconds int)
returns setof public.post_history
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.post_history
     set status = 'unknown',
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
