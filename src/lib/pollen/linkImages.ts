import { fetchPublicPage } from "../publicFetch";
import { extractPageImages, pageSiteName } from "./images";
import type { IssueImage } from "./imageIds";

// Server-only: the pictures on the page a pick links to. The address is the pick's own link from the user's issue, and it is read
// like any public page (https only, no private addresses on any redirect, time and size limits, a short cache; see publicFetch).

/** Sites that answer a plain request with a login page (or nothing useful), so there is no point waiting for them. */
const NO_PICTURES = /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com|twitter\.com|x\.com|linkedin\.com|threads\.net|threads\.com|wa\.me)$/i;

/** The pictures on `url`'s page, preview image first, and the site's name (for a photo credit). Always resolves: a page that can't be read has none. */
export async function linkPageFor(url: string | null | undefined): Promise<{ images: IssueImage[]; site: string }> {
  if (!url) return { images: [], site: "" };
  try {
    const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`).hostname;
    if (NO_PICTURES.test(host)) return { images: [], site: "" };
    const page = await fetchPublicPage(url);
    return { images: extractPageImages(page.html, page.url), site: pageSiteName(page.html, page.url) };
  } catch {
    return { images: [], site: "" };
  }
}

export const linkImagesFor = (url: string | null | undefined): Promise<IssueImage[]> => linkPageFor(url).then((p) => p.images);
