import { db } from "./db";
import { TokenError, refresh } from "./buffer";
import type { BeehiivPublication } from "./beehiiv";
import { isExpired, type BufferSession } from "./session";

// Users and their Buffer connection. Tokens are stored as one JSON secret in Supabase Vault (via the
// service-role-only functions in db/supabase/); the browser only ever holds a sealed user id.

const PROVIDER = "buffer";
const LEASE_SECONDS = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** First Buffer login creates the user (matched by Buffer account id) and a default brand profile. Returns the user id. */
export async function upsertUser(bufferUserId: string, email?: string | null): Promise<string> {
  const row: { buffer_user_id: string; email?: string } = { buffer_user_id: bufferUserId };
  if (email) row.email = email;
  const u = await db().from("users").upsert(row, { onConflict: "buffer_user_id" }).select("id").single();
  if (u.error || !u.data) throw new Error(`Could not save user: ${u.error?.message ?? "no row returned"}`);
  const id = u.data.id as string;
  const b = await db().from("brand_profiles").upsert({ user_id: id }, { onConflict: "user_id", ignoreDuplicates: true });
  if (b.error) throw new Error(`Could not create brand profile: ${b.error.message}`);
  return id;
}

export async function saveBufferSession(userId: string, session: BufferSession): Promise<void> {
  const { error } = await db().rpc("set_connection_secret", { p_user_id: userId, p_provider: PROVIDER, p_secret: JSON.stringify(session) });
  if (error) throw new Error(`Could not store the Buffer connection: ${error.message}`);
}

export async function loadBufferSession(userId: string): Promise<BufferSession | null> {
  const { data, error } = await db().rpc("get_connection_secret", { p_user_id: userId, p_provider: PROVIDER });
  if (error) throw new Error(`Could not read the Buffer connection: ${error.message}`);
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data) as BufferSession;
  } catch {
    return null;
  }
}

/**
 * A session with a valid access token, or null when the user has to log in again (no connection, or Buffer revoked it).
 * Buffer refresh tokens are single-use, and reusing one revokes the whole grant, so refreshing is serialized per user
 * with a short database lease: one request calls Buffer, the others wait and pick up the rotated tokens.
 * `force` refreshes even if the clock says the token is still valid (Buffer answered 401).
 */
export async function getValidSession(userId: string, opts: { force?: boolean } = {}): Promise<BufferSession | null> {
  const first = await loadBufferSession(userId);
  if (!first) return null;
  if (!opts.force && !isExpired(first)) return first;
  if (!first.refreshToken) return null;

  // The stored session if another request already rotated the tokens since we read them, otherwise null.
  const rotated = (s: BufferSession | null): BufferSession | null => (s && s.accessToken !== first.accessToken && !isExpired(s) ? s : null);

  for (let attempt = 0; attempt < 10; attempt++) {
    const lease = await db().rpc("acquire_refresh_lease", { p_user_id: userId, p_provider: PROVIDER, p_seconds: LEASE_SECONDS });
    if (lease.error) throw new Error(`Refresh lease failed: ${lease.error.message}`);
    if (lease.data === true) {
      try {
        // Re-read inside the lease: the previous holder may have just finished.
        const current = await loadBufferSession(userId);
        const already = rotated(current);
        if (already) return already;
        const next = await refresh(current?.refreshToken ?? first.refreshToken);
        await saveBufferSession(userId, next); // persist BEFORE releasing the lease
        return next;
      } catch (e) {
        // Grant revoked or the refresh token was already used: only a fresh login helps.
        if (e instanceof TokenError && e.status >= 400 && e.status < 500) return null;
        throw e;
      } finally {
        try {
          await db().rpc("release_refresh_lease", { p_user_id: userId, p_provider: PROVIDER });
        } catch {
          // the lease expires on its own
        }
      }
    }
    await sleep(500);
    const waited = rotated(await loadBufferSession(userId));
    if (waited) return waited;
  }
  throw new Error("Timed out waiting for another request to refresh the Buffer token");
}

// ---- beehiiv: the creator's own API key ----
// The key goes into Supabase Vault like the Buffer tokens. `connections` keeps only a pointer, the last four characters
// (so the UI can say which key is saved) and a snapshot of the publications the key could see when it was saved.
// The key itself is never returned to the browser.

const BEEHIIV = "beehiiv";

export type BeehiivConnection = { last4: string; publications: BeehiivPublication[] };

export async function saveBeehiivKey(userId: string, key: string, publications: BeehiivPublication[]): Promise<BeehiivConnection> {
  const last4 = key.slice(-4);
  const { error } = await db().rpc("set_connection_secret", {
    p_user_id: userId,
    p_provider: BEEHIIV,
    p_secret: key,
    p_last4: last4,
    p_meta: { publications },
  });
  if (error) throw new Error(`Could not store the beehiiv key: ${error.message}`);
  return { last4, publications };
}

/** The saved beehiiv connection (no key), or null when there is none or it stopped working. */
export async function getBeehiivConnection(userId: string): Promise<BeehiivConnection | null> {
  const { data, error } = await db().from("connections").select("last4, status, meta").eq("user_id", userId).eq("provider", BEEHIIV).maybeSingle();
  if (error) throw new Error(`Could not read the beehiiv connection: ${error.message}`);
  if (!data || data.status !== "active") return null;
  const publications = Array.isArray(data.meta?.publications) ? (data.meta.publications as BeehiivPublication[]) : [];
  return { last4: typeof data.last4 === "string" ? data.last4 : "", publications };
}

/** The saved key itself, for server-side calls to beehiiv only. Never send this to the browser. */
export async function loadBeehiivKey(userId: string): Promise<string | null> {
  const { data, error } = await db().rpc("get_connection_secret", { p_user_id: userId, p_provider: BEEHIIV });
  if (error) throw new Error(`Could not read the beehiiv key: ${error.message}`);
  return typeof data === "string" && data ? data : null;
}

/** Removes the connection and deletes the key from Vault. */
export async function deleteBeehiivConnection(userId: string): Promise<void> {
  const { error } = await db().rpc("delete_connection", { p_user_id: userId, p_provider: BEEHIIV });
  if (error) throw new Error(`Could not remove the beehiiv key: ${error.message}`);
}

/** Sets (or clears, with null) the logo shown for one saved publication. Returns the updated publications, or null if there is no connection. */
export async function setPublicationLogo(userId: string, publicationId: string, logo: string | null): Promise<BeehiivPublication[] | null> {
  const current = await getBeehiivConnection(userId);
  if (!current || !current.publications.some((p) => p.id === publicationId)) return null;
  const publications = current.publications.map((p) => (p.id === publicationId ? { ...p, logo: logo ?? undefined } : p));
  const { error } = await db().from("connections").update({ meta: { publications } }).eq("user_id", userId).eq("provider", BEEHIIV);
  if (error) throw new Error(`Could not save the logo: ${error.message}`);
  return publications;
}

// ---- Apify: the user's own token, for Instagram lookups once the free ones are used ----
// Same storage as the beehiiv key: the token is in Supabase Vault, `connections` keeps a pointer and the last four characters.
// The token itself is never returned to the browser.

const APIFY = "apify";

export async function saveApifyKey(userId: string, key: string): Promise<{ last4: string }> {
  const last4 = key.slice(-4);
  const { error } = await db().rpc("set_connection_secret", { p_user_id: userId, p_provider: APIFY, p_secret: key, p_last4: last4, p_meta: {} });
  if (error) throw new Error(`Could not store the Apify token: ${error.message}`);
  return { last4 };
}

/** The saved Apify connection (no token), or null. */
export async function getApifyConnection(userId: string): Promise<{ last4: string } | null> {
  const { data, error } = await db().from("connections").select("last4, status").eq("user_id", userId).eq("provider", APIFY).maybeSingle();
  if (error) throw new Error(`Could not read the Apify connection: ${error.message}`);
  return data && data.status === "active" ? { last4: typeof data.last4 === "string" ? data.last4 : "" } : null;
}

/** The saved token itself, for server-side calls to Apify only. Never send this to the browser. */
export async function loadApifyKey(userId: string): Promise<string | null> {
  const { data, error } = await db().rpc("get_connection_secret", { p_user_id: userId, p_provider: APIFY });
  if (error) throw new Error(`Could not read the Apify token: ${error.message}`);
  return typeof data === "string" && data ? data : null;
}

export async function deleteApifyConnection(userId: string): Promise<void> {
  const { error } = await db().rpc("delete_connection", { p_user_id: userId, p_provider: APIFY });
  if (error) throw new Error(`Could not remove the Apify token: ${error.message}`);
}
