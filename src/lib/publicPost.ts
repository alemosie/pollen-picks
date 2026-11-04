import { allowFetch, fetchPublicPage, PublicFetchError } from "./publicFetch";
import { renderablePublicPage, type PublicPage } from "./pollen/render";

// Server-only: one public newsletter post, read and made safe to show. Shared by the demo's and the app's "paste a link".
export type PublicPost = PublicPage & { url: string };
export type PostRead = { post: PublicPost } | { error: string; status: number };

const PUBLICATION = "This looks like a link to a publication, not a specific post. Paste a direct link to a public post instead.";

/** `visitor` keys the rate limit (an IP address, or a user id). */
export async function readPublicPost(raw: string, visitor: string): Promise<PostRead> {
  const url = raw.trim();
  if (!url || url.length > 2000) return { error: "Paste a link to a public post.", status: 400 };
  // A publication's home page or archive lists posts (or, on Substack, is built in the browser): ask for one post instead.
  try {
    const path = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`).pathname.replace(/\/+$/, "");
    if (path === "" || path === "/archive") return { error: PUBLICATION, status: 422 };
  } catch {
    // not a web address: the fetcher below says so
  }
  if (!allowFetch(visitor)) return { error: "That's a lot of links. Try again in a few minutes.", status: 429 };
  try {
    const page = await fetchPublicPage(url);
    const doc = renderablePublicPage(page.html, page.url);
    if (!doc) return { error: "Couldn't find any readable text on that page.", status: 422 };
    return { post: { ...doc, url: page.url } };
  } catch (e) {
    if (e instanceof PublicFetchError) {
      const status = e.kind === "disabled" ? 503 : e.kind === "rate-limited" ? 429 : e.kind === "failed" ? 502 : 400;
      return { error: e.message, status };
    }
    console.error("public source failed:", (e as Error).message);
    return { error: "Couldn't read that page.", status: 500 };
  }
}
