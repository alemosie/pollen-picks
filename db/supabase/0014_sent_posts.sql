-- APPLIED to both Supabase projects ("Dev: Pollen Picks", then "Pollen Picks") on 5 Nov 2026 (as sent_posts).
-- Settings > Sent posts: one row per post (draft or publish-now) the signed-in flow created in Buffer, so people can find their
-- Buffer link and live link again later. It holds NO caption and no images: the channel, the newsletter and issue title, Buffer's post id,
-- Buffer's last known status and the live URL once the post is out. Same access model as the other tables: RLS on, no policies,
-- only the server's secret key (service_role) gets in.
create table public.sent_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  post_id text not null check (char_length(post_id) between 1 and 100),      -- Buffer's id for the post
  service text not null check (char_length(service) between 1 and 40),       -- "instagram", "linkedin", ...
  channel_name text not null default '' check (char_length(channel_name) <= 120),
  mode text not null default 'draft' check (mode in ('draft', 'now')),
  newsletter text not null default '' check (char_length(newsletter) <= 120),
  issue_title text not null default '' check (char_length(issue_title) <= 200),
  slides smallint check (slides is null or slides between 1 and 20),
  status text not null default 'unknown' check (char_length(status) <= 30),  -- Buffer's PostStatus: draft, sending, sent, error, ...
  live_url text check (live_url is null or char_length(live_url) <= 500),    -- the post on the network, once it is live
  created_at timestamptz not null default now(),
  checked_at timestamptz,                                                    -- when Buffer was last asked about this post
  unique (user_id, post_id)
);
create index sent_posts_user_created on public.sent_posts (user_id, created_at desc);

alter table public.sent_posts enable row level security;
revoke all on public.sent_posts from anon, authenticated;
grant select, insert, update, delete on public.sent_posts to service_role;
