# TODO

## !! TOP PRIORITY: must work before the first Instagram post (Sat 7 Nov)

- [ ] After the next deploy, run the whole demo on the LIVE site in a fresh private window (source, pick, design, write, send, Finish demo, feedback).
- [x] Check prod Supabase: `demo_events` has a row for every step with the same `session_id`, and `feedback` has the row with its `steps` list. Checked 4 Nov (22:40) on the build before the Write rename: the demo run left demo_start, design, prepare, send, gate_opened and feedback_clicked, and the feedback row has the same steps list and a session id (the demo's first step is `demo_start`, not `pick_reached`, by design). `draft_log` has the real LinkedIn `now` row, so migration 0007 and the logging work. Still to re-check after one full demo run on the live Write build: a `write_reached` row with flow `demo`. (Feedback returned "Not allowed" and step events were missing before the same-site check in `src/lib/sameSite.ts` was loosened.)
- [ ] Check the new Write / Send split in the browser (4 Nov change): `/write` shows the caption(s) for the networks the account has connected; `/send` has the Channels | Preview folder, channel choice is remembered, and both buttons stay disabled with no channel ticked. Old `/prepare` and `/demo/prepare` links should redirect to `/write` and `/demo/write` with their query string. Run it with `BUFFER_FAKE=1 yarn dev` first.
- [ ] Try the Send step at scale in the browser: `BUFFER_FAKE=1 BUFFER_FAKE_CHANNELS=60 yarn dev` (60 fake channels across all networks, on top of your real ones; every send is fake). Look at the Channels tab (stacked per-network lists, nested scrolling), the posts modal with 60 rows, and a full send. Likely follow-ups: an overall "Select all / Clear" above the pills, collapse the per-network boxes when there are many networks, shorter modal rows past ~20 channels, and skip or flag disconnected channels (check Buffer's channel fields for a disconnected flag).
- [ ] Buffer's rate limit is per app and shared by every user (it grows with the number of users who authorised the app; the docs give different numbers per plan). A 60-channel send is 60 requests, so one big send could use a large share of it. Polling is already batched (about one request per check, backing off) and a 429 shows a plain "Try again in a few minutes". Consider asking Buffer (developersupport@buffer.com) for more headroom for the contest period, since the judges are Buffer staff with many channels.
- [ ] After deploy, the funnel event is `write_reached` (was `prepare_reached`): the live site keeps the old name until the deploy, so count both when reading `demo_events`.
- [ ] Check the phone (iOS Safari text selection in the Manual iframe, source screen, bottom bar, progress indicator).

## !! IMPORTANT: come back to this when we do tagging (captions per network)

Today there is one caption for every non-Instagram network ("Other platforms", up to 2,200 characters). That is too long for X and Bluesky. Decided on 4 Nov to leave it for now and fix it together with tagging, because tagging changes what goes into captions (@mentions) and how much room /write has.

- [ ] Split the single "Other platforms" caption into Base (long, with the link) and Short, next to Instagram. Show a caption box only for a network family the account has connected (not only the selected channels). LinkedIn + Facebook = one box (Base).
- [ ] Short limit = the tightest connected short network: 280 if X is connected (also covers Bluesky's 300), 300 if only Bluesky, 500 if only Threads or Mastodon. Treat every X account as free (Buffer doesn't say who has Premium). Show the limit and the networks it covers in the box.
- [ ] Limits per Buffer's docs (https://developers.buffer.com/guides/character-limits.md): Instagram 2,196 (our `MAX_CAPTION_CHARS` is 2,200, so lower it), LinkedIn 3,000, Facebook 5,000, X free 280 (Premium 25,000), Bluesky 300, Threads 500, Mastodon 500 (varies by server).
- [ ] Count the link at full length (not X's 23) to leave a margin, since Buffer validates in its own units. Show a live counter and block both send buttons for a network whose caption is over its limit.
- [ ] Reuse `fitCaption` in `src/lib/caption.ts` with a limit per variant (it already fits what it can and reports what it left out); `variantFor` gets a third case for short-form networks.
- [ ] Decide the tagging approach first: Instagram tags positioned per image (`image.metadata.userTags`, from Buffer's docs, not checked in detail), or @mentions in the caption (works on every network). Positioned tags need the slide images on screen, which affects the layout.

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

- [x] beehiiv is always lowercase in copy (platform name).
- [x] Public beehiiv step 1: `src/lib/pollen/flatten.ts` turns div-based newsletters (WellyBuzz: cards, no h/p/ul) into headings, paragraphs and lists inside `contentRoot`; own-issue fixtures give identical results. Fixture: `fixtures/wellybuzz-issue.web.html` (6 chunks before, 78 after). Next: the live fetcher (allowed hosts, cache, rate limit, kill switch), then the source screen cards. Still to do: flag sponsor/weather/footer sections; Camber, Vibe Hamilton fixtures.

- [x] Public links = Manual mode only (no parser; the flattener stays built but unused). Step 1 done: `src/lib/publicFetch.ts` (https only, private/internal addresses blocked on every redirect, 8s and 2.5 MB limits, 10 min cache, 20 links per 10 min per visitor, kill switch `PUBLIC_FETCH_DISABLED=1`), `renderablePublicPage` in `src/lib/pollen/render.ts` (beehiiv pages keep their look, other pages get a plain reading style), route `GET /api/demo/source?url=`.
- [x] Public links step 2: "paste a link" cards on the demo source screen (beehiiv, Substack, any) open the Manual pane (only tab) with that page; the page and newsletter name live in the `pp_demo_src` cookie, highlights in `pp_demo_hl` (demo limit: 5 highlights, 250 words; pick tray bottom right). Step 3 (still to do): test with WellyBuzz, Camber, Vibe Hamilton, a Substack, on a phone. Known gap: DNS rebinding isn't fully closed (each hop is checked, not pinned).

### Later / stretch (not today)

- [ ] A public link that isn't a newsletter post (found with a Google search): navigating to `/pick` gives a 429 on the site and a 502 in the network tab. Load the content when the link is entered on the source screen and decide there whether it can be shown in /pick (page loads, is HTML, has enough readable text, isn't a blocked or JavaScript-only page). If it can't, say so on the source screen with a clear reason and don't go to /pick. Suspects, not checked: `fetchPublicPage` turns any non-OK answer from the other site into a 502 ("That page didn't load"), and the per-visitor limit (20 links per 10 minutes, `allowFetch`) answers 429, which retries or repeated navigation to /pick could be hitting. Check which one it is, and whether /pick re-fetches the page on every visit instead of reusing the 10-minute cache.
- [x] Now + Draft send modes (drop "later"): built 4 Nov (two buttons, posts modal, `shareNow` vs `saveToDraft`, "unknown, check Buffer" for timeouts, fake mode `BUFFER_FAKE=1`). Migration `db/supabase/0007_draft_log_mode.sql` is applied to dev and prod (4 Nov). Real LinkedIn send from the personal account worked (4 Nov), so `shareNow` is right. The modal showed both the Buffer and the live post link (`externalLink` works for LinkedIn); publishing itself took a while on Buffer's side. Still to do: delete the test post. Instagram Now is untested, so either publish the Sat 7 Nov post as a draft or use it as the first real Instagram Now test with Create draft as the fallback.
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
- [ ] Public links: when a publication link (not a post) is pasted, fetch its latest issue. Substack: `<site>/feed` (RSS, full HTML for free posts, home pages are built in the browser); beehiiv: its feed or archive. Today the demo answers "This looks like a link to a publication, not a specific post. Paste a direct link to a public newsletter post instead."
