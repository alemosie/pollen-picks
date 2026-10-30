# Beehiiv to Buffer

Turns a Beehiiv newsletter's most-clicked upcoming activities into a ready-to-review Instagram carousel draft in Buffer. Built for Buffer Commit (Oct 28 - Nov 13, 2026).

## Run locally

1. Register an app at https://publish.buffer.com/settings/api with redirect URI `https://localhost:3003/api/auth/buffer/callback`.
2. Copy `.env.example` to `.env.local` and fill in `BUFFER_CLIENT_ID` (and `BUFFER_CLIENT_SECRET` if the app is a confidential client) and a `SESSION_SECRET` (`openssl rand -base64 32`).
3. `yarn install && yarn dev`. Buffer requires HTTPS redirect URIs even on localhost, so the dev server runs with Next's `--experimental-https` (it creates a local certificate on first run; accept the browser warning once, and approve the keychain prompt if macOS asks),, then open https://localhost:3003.

## Buffer OAuth spike (`/spike`)

- Connect with Buffer (OAuth 2.0 + PKCE), lists organizations and channels.
- "Read createPost schema" introspects the GraphQL schema for draft and carousel fields.
- "Create 2-image draft" calls `createPost` with `saveToDraft` and two image assets. Use a throwaway channel.

Tokens live in an encrypted httpOnly cookie for now; they move to Supabase later. Buffer refresh tokens are single-use, so refresh only happens in `/api/auth/buffer/refresh`, which writes the new token set straight back.
