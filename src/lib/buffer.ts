import type { BufferSession } from "./session";
import { fakeChannels } from "./fake";

const AUTH = "https://auth.buffer.com";
export const API = "https://api.buffer.com";
export const SCOPES = "account:read posts:read posts:write offline_access";

export function env() {
  const clientId = process.env.BUFFER_CLIENT_ID;
  const redirectUri = process.env.BUFFER_REDIRECT_URI ?? "https://localhost:3003/api/auth/buffer/callback";
  if (!clientId) throw new Error("BUFFER_CLIENT_ID is not set");
  return { clientId, clientSecret: process.env.BUFFER_CLIENT_SECRET, redirectUri };
}

/**
 * Canonical site origin (from the registered redirect URI). Redirects must use this, not req.url:
 * on Netlify req.url can be the per-deploy host (<id>--site.netlify.app), where the session cookie does not exist.
 */
export const siteOrigin = () => new URL(env().redirectUri).origin;
export const siteUrl = (path: string) => new URL(path, siteOrigin());

export function authorizeUrl(state: string, codeChallenge: string): string {
  const { clientId, redirectUri } = env();
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "consent",
  });
  return `${AUTH}/auth?${p}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

/** A failed token request. 4xx means the code/refresh token is no longer usable (revoked, expired or already used). */
export class TokenError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function tokenRequest(params: Record<string, string>): Promise<BufferSession> {
  const { clientId, clientSecret } = env();
  const body = new URLSearchParams({ client_id: clientId, ...params });
  if (clientSecret) body.set("client_secret", clientSecret); // confidential clients only
  const res = await fetch(`${AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new TokenError(res.status, `Buffer token endpoint ${res.status}: ${await res.text()}`);
  const t = (await res.json()) as TokenResponse;
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + (t.expires_in - 60) * 1000,
  };
}

export function exchangeCode(code: string, codeVerifier: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: env().redirectUri,
    code_verifier: codeVerifier,
  });
}

// Refresh tokens are single use: the caller MUST persist the returned session immediately.
export function refresh(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export type GqlError = { message: string; extensions?: { code?: string; window?: string } };
export type GqlResult<T> = { data?: T; errors?: GqlError[]; status: number };

/**
 * Whether Buffer refused a request because of its rate limit, which means NOTHING was created and trying again later is safe. Buffer's docs describe
 * it two ways: HTTP 429 (the Rate Limits guide, with Retry-After) and an `errors` entry with `extensions.code` RATE_LIMIT_EXCEEDED on an HTTP 200
 * (the Error Handling guide). Both are the same refusal, so both count.
 */
export const isRateLimited = (r: { status: number; errors?: GqlError[] }): boolean =>
  r.status === 429 || (Array.isArray(r.errors) && r.errors.some((e) => e?.extensions?.code === "RATE_LIMIT_EXCEEDED"));

export async function gql<T = unknown>(
  accessToken: string,
  query: string,
  opts?: { timeoutMs?: number },
): Promise<GqlResult<T>> {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    ...(opts?.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { ...json, status: res.status };
}

export type BufferChannel = { id: string; name: string; service: string };
type RawChannel = BufferChannel & { isLocked?: boolean; isDisconnected?: boolean };

/** All channels across the account's organizations that can take a post. Buffer also lists locked channels (over the plan's limit) and disconnected ones, which would fail to post. */
export async function listChannels(accessToken: string): Promise<BufferChannel[]> {
  const acct = await gql<{ account: { organizations: { id: string }[] } }>(accessToken, `{ account { organizations { id } } }`);
  // One request per organization, all at once (an account with several used to wait for each in turn).
  const perOrg = await Promise.all(
    (acct.data?.account.organizations ?? []).map((o) =>
      gql<{ channels: RawChannel[] }>(accessToken, `{ channels(input: { organizationId: ${JSON.stringify(o.id)} }) { id name service isLocked isDisconnected } }`),
    ),
  );
  // Fake mode can add many fake channels (and a locked and a disconnected one), to try the channel picker and a big send without a Buffer account that has them.
  const all: RawChannel[] = [...perOrg.flatMap((r) => r.data?.channels ?? []), ...fakeChannels()];
  return all.filter((c) => !c.isLocked && !c.isDisconnected).map(({ id, name, service }) => ({ id, name, service }));
}
