# TODO

## Today (4 Nov): demo for everyone, aimed at real use, then feedback

Goal order: people actually using it (login + Buffer) first, feedback second (proof of utility for judging). No download button.

- [x] Remove the hard-coded "Just a Phase" and sample issue URL: pass the newsletter name and link through the demo (preview route, demo prepare/send) and carry the publication name on the signed-in issue data (send, prepare, /api/draft).
- [x] Demo paste feature built, then removed on purpose (Alex wants content to come from Beehiiv/Substack links, not pasting). Backup in `.git/paste-backup-2026-11-04/`.
- [x] Demo starts on a source screen (`/demo/source`): Demo issue is live; Beehiiv link, Substack link and "Any public newsletter" show as coming soon. Landing page buttons point there.
- [ ] Make the Beehiiv / Substack public-link cards work (fetchers; see the safety list under Later). Confirm with Alex before building.
- [x] Final demo screen: "Send it to your Buffer" (login) as the primary action, feedback link as secondary (deadline 12 Nov). After the first real draft, ask for feedback in the results dialog and ask permission to quote.
- [x] Anonymous funnel events (event, which content was used, timestamp; no cookie, no id, no content, no IP; once per tab session) and a draft log (user, channel service, ok/failed, timestamp). New numbered migration in `db/supabase/`.
- [x] Privacy page: describe the demo cookie, the anonymous usage events and the draft log.
- [x] Applied `db/supabase/0005_demo_events_and_draft_log.sql` to the Supabase project on 4 Nov (was: written, not applied; creates `demo_events`, `draft_log` and `feedback`. Until then the event and draft-log writes only log an error, and the feedback form shows "Couldn't save that").
- [x] Native feedback form on `/feedback` (replaces the Google form): host, easy, likelihood, loved, would change, OK to quote you; stored in `feedback` with the tab session id, steps reached, flow (demo/app) and the account when logged in. Needs migration 0005 applied.
- [ ] Test on the deployed site and on a phone: landing > source screen > pick > design > prepare > send; newsletter name on slides and captions; final-screen login and feedback links; iOS Safari text selection in the Manual iframe.

- [x] Design step: keep the loading animation up until the first slide previews have loaded (they render slowly on the server), so /design never shows empty frames. Next if still slow: cache rendered slides, or pre-warm the previews on the Pick step.

- [x] Separate databases: prod = Supabase project "Pollen Picks" (`hmzprlzhvhdwpjgrymrk`, creds in `.env.production` and Netlify); dev = "Dev: Pollen Picks" (`nzufhmvyewifebojjaue`, creds in `.env.local`). Dev got migrations 0001-0005 as one migration. Prod test rows in `demo_events`, `feedback` and `draft_log` were cleared on 4 Nov (users, connections, brand and custom picks kept). Apply every new migration to BOTH projects.

### Later / stretch (not today)

- [ ] Now + Draft send modes (drop "later"): `mode: shareNow` vs `saveToDraft: true`; confirm dialog; treat network/5xx failures as "may have sent" (no auto-retry); check Instagram `schedulingType` for notification-only channels; update the "nothing is published" copy.
- [ ] Demo URL tabs: Demo issue / Beehiiv public link / Substack public link. Beehiiv: home or archive lists `/p/slug`, post pages are server-rendered (no RSS needed). Substack: home is a JS shell, use `/feed` (content:encoded). Restrict hosts to `.beehiiv.com` and `.substack.com` (check the final host after redirects), cache fetches 10-15 min, per-IP rate limit, size caps, kill-switch env flag, descriptive User-Agent. Turn picks from fetched sources into demo-cookie rows so slide previews don't refetch.
- [ ] "Made with Pollen Picks" credit on the closing slide, with an opt-out.
- [ ] Optional own login (Google) with Buffer as a connection: nullable `users.buffer_user_id`, split `requireSession` into user vs Buffer, account linking in the Buffer callback.
- [ ] Parser fixes for Section view on Substack HTML: bold/italic-only short paragraphs as headings, generic link text ("here") as titles, keep all links per chunk.


- [ ] Run an accessibility audit on the site (keyboard navigation, focus states, screen reader landmarks and headings, color contrast, modals/dialogs, drag-and-drop alternatives in the Design builder, reduced motion).

## Next: Bring your own Beehiiv, public newsletters and tagging

Priority for 3 Nov: BYO Beehiiv, so we can start tagging Beehiiv creators.

- [ ] Save raw HTML fixtures (Save Page As, HTML only) of one post from each example newsletter into `fixtures/`: Publish Press (https://news.thepublishpress.com/p/apple-launched-the-new-macbook-like-a-creator) and Camber (https://camber.beehiiv.com/p/date-pipeline-ideas-in-la), plus a recent WellyBuzz post (https://www.wellybuzz.co.nz/, latest issue 28 Oct 2026). Check the markup before choosing a parser approach.
- [ ] Public newsletter mode: accept a post URL (`/p/<slug>`) and a publication home page or archive URL (`/archive?page=N`). For a home page, show a short list of recent posts to choose from. Slugs are not reliable titles (e.g. `/p/l`).
- [ ] Parser: handle bullets with bold "Neighborhood, Day" labels (Camber) and one H1 per story (Publish Press). Strip UTM parameters, nav, footer, share bar and "Powered by beehiiv". Skip sponsor blocks ("Presented by", "A message from") and non-event sections (merch, sign-off) by default.
- [ ] No click data on public posts: show all items unranked instead of "most clicked".
- [ ] Tagging: Instagram profile links in posts become handles (venues, instructors, creators). Check Buffer's tagging support; fall back to @mentions in the caption.
- [ ] BYO Beehiiv auth: prefer OAuth2 with narrow scopes (e.g. `posts:read`). Fallback: a dedicated key restricted to one publication, stored in an encrypted HTTP-only cookie. API keys are broad by default. Let the user pick a publication, since creators can have several (Camber plans one per city).
- [ ] Check whether Buffer accepts TikTok photo carousels before promising TikTok (Camber's main channel).
- [ ] Outreach: confirm Camber is still sending (latest post seen: March 2025) before contacting. Pitch angle: brands want to be in the newsletter and the recap; tagging venues serves that.
- [ ] Soften or build the landing-page promises that aren't built yet: public posts, now/later scheduling, tagging creators.
- [ ] Fix random Buffer logouts (refresh tokens are single-use).
- [ ] Add redirects from the old /create and /format URLs.
- [ ] Test newsletters seen so far (all free Beehiiv events/local guides, `/p/slug` posts and `/archive?page=N`): Camber (LA), WellyBuzz (Wellington NZ, weekly, giveaways), The Vibe Hamilton (Ontario, weekly on Thursdays, 25-minute list issues, https://www.thevibehamilton.com/). Parse by page structure, not by the beehiiv.com domain, since custom domains are common.
- [ ] Long lists: one post can hold dozens of items, so the Pick step needs search or section filters when there is no click data.
- [ ] Treat giveaways ("WIN" ticket offers) and sponsored items as flagged picks, like sponsor blocks.
- [ ] Market sizing is unverified: Beehiiv's State of Newsletters 2026 gives no count of local/events newsletters. Do not claim a number on the landing page or in the submission. Safe claims: local newsletters often have open rates above 50%, parenting is in the top open-rate categories (above 51%).
