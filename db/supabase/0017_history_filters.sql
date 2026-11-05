-- APPLIED to "Dev: Pollen Picks" and to prod "Pollen Picks" on 5 Nov 2026 (as history_filters).
-- Indexes for the History page's filters (network, channel, status, draft/now). Each is "this user's rows, newest first" narrowed by one column,
-- so a filtered page stays a short index scan however long the history grows. Safe to run more than once.
create index if not exists post_history_user_service on public.post_history (user_id, service, created_at desc);
create index if not exists post_history_user_channel on public.post_history (user_id, channel_id, created_at desc) where channel_id is not null;
create index if not exists post_history_user_status on public.post_history (user_id, status, created_at desc);
create index if not exists post_history_user_mode on public.post_history (user_id, mode, created_at desc);
