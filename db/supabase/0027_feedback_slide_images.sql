-- APPLIED to "Dev: Pollen Picks" on 9 Nov 2026 (as feedback_slide_images). NOT APPLIED to prod "Pollen Picks" yet: run it there (after 0026) before deploying the feedback change.
--
-- Feedback "OK to share?" = yes: also keep the stored slides of the person's latest send, so Alex can see (and, with their yes, show) what they made.
-- Set by the server from the account's own send history, never from what the browser says. Emptied when the account is deleted, together with the files.
alter table public.feedback add column if not exists slide_images text[];
