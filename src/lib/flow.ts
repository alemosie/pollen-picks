// Where each step of the flow lives. Client-safe: no server imports, so components and pages can both use it.
//
// "demo" is the public sample issue. It has its own pages under /demo and never needs a Buffer login. It runs the whole
// flow with sample channels, and the final send asks for an account instead. Every other mode is a real content source
// in the signed-in app (/pick, /design, /prepare, /send).

export type Step = "pick" | "design" | "prepare" | "send";

export const isDemo = (mode: string | undefined) => mode === "demo";

/** URL of a step. `query` is a query string without the leading "?" or "&" (for example `picks=1,2&spec=...`). */
export function stepUrl(mode: string | undefined, step: Step, query = ""): string {
  if (isDemo(mode)) {
    return `/demo/${step}${query ? `?${query}` : ""}`;
  }
  return `/${step}?mode=${encodeURIComponent(mode ?? "")}${query ? `&${query}` : ""}`;
}

/** Old links like /design?mode=demo&picks=1,2 belong to the public demo now: same params, new address. */
export function demoUrlFrom(step: Step, sp: Record<string, string | string[] | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "mode") continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined) p.set(k, val);
  }
  return stepUrl("demo", step, p.toString());
}

// ---- Your own beehiiv issues ----
// The chosen issue travels in `mode` itself, so every step's URL (and the share links) already carry it:
// "own:<publication id>:<post id>". A plain "own" means "the newest issue of your first publication".
const OWN = /^own:(pub_[0-9a-f-]{36}):(post_[0-9a-f-]{36})$/i;

export const ownMode = (publicationId: string, postId: string) => `own:${publicationId}:${postId}`;

/** null when `mode` is not an own-newsletter mode. Both ids are validated, so they are safe to put in an API path. */
export function parseOwnMode(mode: string | undefined): { publicationId?: string; postId?: string } | null {
  if (mode === "own") return {};
  const m = OWN.exec(mode ?? "");
  return m ? { publicationId: m[1], postId: m[2] } : null;
}

export const isPublicationId = (v: unknown): v is string => typeof v === "string" && /^pub_[0-9a-f-]{36}$/i.test(v);
