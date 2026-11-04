// A public page the demo visitor pasted instead of the sample issue. Like the highlights, it lives in a cookie in their own
// browser (no account, no database): the Manual tab reads the page from it, and the later steps take the title and
// newsletter name from it. Pure helpers, used by the browser and the server.

export const DEMO_SRC_COOKIE = "pp_demo_src";

export type DemoSource = { url: string; title: string; newsletter: string; author: string | null };

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

const toValue = (s: string) => {
  let bin = "";
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromValue = (v: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(v.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

export const encodeDemoSource = (s: DemoSource) => toValue(JSON.stringify({ u: s.url, t: s.title, n: s.newsletter, a: s.author }));

/** Anything unreadable gives no source (the sample issue). The address is only ever fetched through /api/demo/source. */
export function decodeDemoSource(raw: string | null | undefined): DemoSource | null {
  if (!raw || raw.length > 3000) return null;
  try {
    const d = JSON.parse(fromValue(raw));
    const url = clip(d?.u, 2000);
    if (!/^https:\/\//i.test(url)) return null;
    const title = clip(d?.t, 200) || "A newsletter post";
    return { url, title, newsletter: clip(d?.n, 100) || title, author: clip(d?.a, 100) || null };
  } catch {
    return null;
  }
}

// ---- Browser side ----

export function readDemoSource(): DemoSource | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${DEMO_SRC_COOKIE}=`));
  return hit ? decodeDemoSource(hit.slice(DEMO_SRC_COOKIE.length + 1)) : null;
}

export function writeDemoSource(s: DemoSource): boolean {
  const value = encodeDemoSource(s);
  if (value.length > 3000) return false;
  document.cookie = `${DEMO_SRC_COOKIE}=${value}; path=/; max-age=86400; SameSite=Lax`;
  return true;
}

export function clearDemoSource() {
  document.cookie = `${DEMO_SRC_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
