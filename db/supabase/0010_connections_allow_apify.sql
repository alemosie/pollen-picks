-- APPLIED to both Supabase projects ("Dev: Pollen Picks", then "Pollen Picks") on 5 Nov 2026 (as connections_allow_apify).
-- A user can save their own Apify token (Vault, like the beehiiv key) to pay for their Instagram lookups once the free ones are used.
alter table public.connections drop constraint connections_provider_check;
alter table public.connections add constraint connections_provider_check check (provider in ('buffer','beehiiv','apify'));
