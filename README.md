# Pollen Picks

**From picks to posts.** Top content from your newsletter, to Buffer, and beyond.

Pollen Picks turns a newsletter issue (or any public post) into a branded Instagram or LinkedIn carousel and sends it to your own [Buffer](https://buffer.com) as a draft, or posts it now. Your readers' clicks pick the content, your exact words go on the slides, and the people you feature get tagged.

**No AI writes your content.** Descriptions are your own text, cut at a sentence boundary. Nothing is rewritten.

Built for [Buffer Commit](https://buffer.com/api/commit) (Oct 28 – Nov 13, 2026).

## What it does

1. **Choose a source:** a sample issue (Demo mode, no account needed), your own beehiiv newsletter (API key, with click ranking), or a link to any public newsletter issue, article or blog post (you highlight the parts to share).
2. **Pick:** the most-clicked upcoming items, a section, or passages you highlight yourself. Highlights with a link are split into a title and a description like newsletter picks.
3. **Design:** one cover slide, pick slides and a closing slide, rendered as PNGs. Customize the layout, text, colors and category labels slide by slide.
4. **Write:** a caption built from the picks (no AI), with Instagram @tags for featured accounts.
5. **Send:** drafts or posts to any connected Buffer channel through a server-side queue. History shows every send, with Retry for failed ones.

## Run locally

Requirements: Node 20+, Yarn, a Supabase project, a Buffer app.

1. Register an app at https://publish.buffer.com/settings/api with redirect URI `https://localhost:3003/api/auth/buffer/callback`.
2. Copy `.env.example` to `.env.local` and fill in the Buffer client ID (and secret if it is a confidential client), `SESSION_SECRET` (`openssl rand -base64 32`), and your Supabase URL and secret key. Every variable is explained in `.env.example`.
3. Apply the SQL files in `db/supabase/` to your Supabase project, in order.
4. `yarn install && yarn dev`, then open https://localhost:3003. Buffer requires HTTPS redirect URIs even on localhost, so the dev server runs with Next's `--experimental-https` (accept the browser warning once).

### Trying it without publishing anything

Open `/dev` while running `yarn dev` to fake Buffer: pick the number of channels and which sends succeed, fail, are rate-limited or are cut off. Nothing reaches Buffer. Add `?timing=1` to a page to see its server timings.

### Checks

```
npx tsc --noEmit -p .
npx eslint src
```

## Stack

Next.js (App Router, Cache Components), React, Tailwind CSS, Supabase Postgres (server-side access only; connection tokens in Vault), Buffer's GraphQL API, deployed on Netlify. Slides are rendered by a built-in HTML-to-PNG renderer, on request from a stable URL, so no images are stored.

## Privacy

Only what the app needs is stored: your Buffer identity, brand settings, connection tokens (encrypted), highlights and a send history. See `/privacy` in the app for the full list, including cookies and how to remove your data.

## License

Pollen Picks is free software under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). You can use, study, change and share it. If you run a modified version as a network service, you must offer your users the source of your changes under the same license.

The AGPL covers the code. The **Pollen Picks** name, logo and mascot are not licensed for reuse: if you run your own copy, please give it your own name and branding. The sample newsletter issue used in Demo mode belongs to its publisher.

Contributions are welcome. By contributing you agree your work is released under the AGPL-3.0, and you allow the maintainer to also offer it under other licenses (for example a commercial one).
