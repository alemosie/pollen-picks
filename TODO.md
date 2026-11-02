# TODO

- [ ] Run an accessibility audit on the site (keyboard navigation, focus states, screen reader landmarks and headings, color contrast, modals/dialogs, drag-and-drop alternatives in the Design builder, reduced motion).

## Next: Bring your own Beehiiv, public newsletters and tagging

Priority for 3 Nov: BYO Beehiiv, so we can start tagging Beehiiv creators.

- [ ] Save raw HTML fixtures (Save Page As, HTML only) of one post from each example newsletter into `fixtures/`: Publish Press (https://news.thepublishpress.com/p/apple-launched-the-new-macbook-like-a-creator) and Camber (https://camber.beehiiv.com/p/date-pipeline-ideas-in-la). Check the markup before choosing a parser approach.
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
