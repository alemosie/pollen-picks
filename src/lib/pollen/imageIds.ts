// Pure helpers (no Node or parser imports) so the design UI and the slide spec can use them in the browser too.

/** A picture found in a newsletter issue that can be put on a slide. Only the id travels in a slide design; the address stays on the server. */
export type IssueImage = {
  /** Short stable id: a hash of the address without its resize options and cache-busting query, so it survives a re-fetch of the issue. */
  id: string;
  /** https address as written in the issue. */
  src: string;
  alt: string;
  /** Declared size in the HTML, when it says (beehiiv usually doesn't). */
  width?: number;
  height?: number;
  /** The page's own preview image (beehiiv's thumbnail, og:image, twitter:image), as opposed to a picture in its body. The cover uses the issue's by default. */
  preview?: boolean;
};

/** The address minus beehiiv's resize options (/cdn-cgi/image/<options>/) and its ?t= cache stamp: the same picture at any size has one key. */
export function imageKey(src: string): string {
  return src.replace(/\/cdn-cgi\/image\/[^/]*\//, "/").replace(/[?#].*$/, "");
}

/** FNV-1a over the key, as 8 hex digits. Not a secret: it only has to be short, stable and the same in the browser and on the server. */
export const imageId = (src: string) => {
  let h = 0x811c9dc5;
  for (const c of imageKey(src)) h = Math.imul(h ^ c.codePointAt(0)!, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
};
export const isImageId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}$/.test(v);

